#!/usr/bin/env node
/**
 * MiniMax Coding Agent - Node.js 版本
 * 基于 Anthropic 的 Long-Running Agents 设计模式
 */

import fs from 'fs';
import path from 'path';
import { execSync, exec } from 'child_process';
import axios from 'axios';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const config = yaml.load(fs.readFileSync(path.join(__dirname, 'config.yaml'), 'utf8'));
const API_KEY = process.env.MINIMAX_API_KEY || '';
const BASE_URL = config.api.base_url;
const MODEL = config.api.model;

class MiniMaxCodingAgent {
  constructor() {
    this.projectDir = __dirname;
    this.workspaceDir = path.join(this.projectDir, 'workspace');
    this.progressFile = path.join(this.projectDir, 'claude-progress.txt');
    this.featureFile = path.join(this.projectDir, 'feature_list.json');
    this.initScript = path.join(this.projectDir, 'init.sh');
    
    // 确保工作目录存在
    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
    }
  }
  
  async callMiniMax(systemPrompt, userPrompt) {
    if (!API_KEY) {
      throw new Error('请设置环境变量: export MINIMAX_API_KEY="your-api-key"');
    }
    
    try {
      const response = await axios.post(`${BASE_URL}/v1/text/chatcompletion_v2`, {
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tokens_to_generate: config.api.max_tokens,
        temperature: config.api.temperature
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('API 错误:', error.response?.data || error.message);
      throw error;
    }
  }
  
  runShell(cmd) {
    try {
      const result = execSync(cmd, { 
        cwd: this.workspaceDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { code: 0, stdout: result, stderr: '' };
    } catch (error) {
      return { 
        code: error.status || 1, 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      };
    }
  }
  
  gitCommit(message) {
    const result = this.runShell(`git add -A && git commit -m "${message}"`);
    return result.code === 0;
  }
  
  gitPush() {
    const result = this.runShell('git push origin main');
    return result.code === 0;
  }
  
  readFile(filepath) {
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath, 'utf8');
    }
    return null;
  }
  
  writeFile(filepath, content) {
    fs.writeFileSync(filepath, content, 'utf8');
  }
  
  updateProgress(message) {
    const timestamp = new Date().toISOString();
    const progress = `[${timestamp}] ${message}\n`;
    const existing = this.readFile(this.progressFile) || '';
    this.writeFile(this.progressFile, existing + progress);
  }
  
  getBearings() {
    const status = {
      directory: this.workspaceDir,
      files: [],
      gitLog: [],
      featuresCompleted: [],
      currentWork: null
    };
    
    // 列出文件
    if (fs.existsSync(this.workspaceDir)) {
      status.files = fs.readdirSync(this.workspaceDir)
        .filter(f => !f.startsWith('.') && f !== 'node_modules');
    }
    
    // Git 日志
    const gitLog = this.runShell('git log --oneline -20');
    if (gitLog.code === 0 && gitLog.stdout) {
      status.gitLog = gitLog.stdout.trim().split('\n').slice(0, 10);
    }
    
    // 进度历史
    const progress = this.readFile(this.progressFile);
    if (progress) {
      status.progressHistory = progress.trim().split('\n').slice(-5);
    }
    
    // 功能列表
    const features = this.readFile(this.featureFile);
    if (features) {
      try {
        const featureData = JSON.parse(features);
        status.featuresCompleted = featureData.filter(f => f.passes);
      } catch (e) {
        // JSON 解析失败
      }
    }
    
    return status;
  }
  
  systemPromptInit() {
    return `你是项目的初始化代理。你的任务是：
1. 设置项目的初始环境
2. 创建详细的 feature_list.json，列出所有需要实现的功能
3. 创建 init.sh 启动脚本
4. 创建 claude-progress.txt 记录项目状态
5. 进行初始的 git 提交

工作流程：
- 仔细阅读用户的任务需求
- 将需求分解为具体的、可测试的功能点
- 每个功能包含：分类、描述、测试步骤
- 标记所有功能为 "passes": false
- 写一个 init.sh 可以启动开发服务器
- 初始提交所有文件

输出格式：
- feature_list.json: JSON 格式的功能列表
- init.sh: 启动脚本
- claude-progress.txt: 初始进度记录`;
  }
  
  systemPromptCoding() {
    return `你是项目的编码代理。你的任务是：
1. 每次会话只实现一个功能
2. 实现后进行端到端测试
3. 更新 feature_list.json 中对应功能的状态
4. 提交 git 并更新进度文件

工作流程：
1. 首先获取当前状态：
   - 运行 pwd 查看工作目录
   - 读取 claude-progress.txt 了解最近工作
   - 读取 feature_list.json 选择下一个要实现的功能
   - 检查 git 日志
   
2. 实现功能：
   - 只实现一个功能点
   - 写清晰的代码
   - 添加必要的注释
   
3. 测试验证：
   - 运行端到端测试
   - 只有测试通过才标记为完成
   - 更新 feature_list.json 中的 passes 字段
   
4. 结束会话：
   - Git 提交：描述做了什么
   - 更新 claude-progress.txt
   - 如果有远程，推送代码

重要规则：
- 一次只做一个功能
- 必须测试通过才能标记完成
- 不能因为已经做了些工作就宣布项目完成`;
  }
  
  async initializeProject(userTask) {
    this.updateProgress('开始初始化项目');
    
    const bearings = this.getBearings();
    
    const userPrompt = `
用户任务：${userTask}

当前工作目录：${bearings.directory}
已有文件：${bearings.files}

请完成以下任务：
1. 创建详细的 feature_list.json（JSON格式），列出所有需要实现的功能点
2. 创建 init.sh 启动脚本（如果需要）
3. 创建 claude-progress.txt 初始记录
4. 进行 git 初始提交

功能列表格式示例：
\`\`\`json
[
  {
    "category": "functional",
    "description": "功能描述",
    "steps": ["步骤1", "步骤2", "步骤3"],
    "passes": false
  }
]
\`\`\`
`;
    
    console.log('📋 正在生成功能列表和初始化脚本...');
    const response = await this.callMiniMax(this.systemPromptInit(), userPrompt);
    
    console.log('\n🤖 Agent 响应:\n');
    console.log(response);
    
    this.gitCommit('Initial commit: project setup');
    this.updateProgress('项目初始化完成');
    
    console.log('\n✅ 项目初始化完成！');
  }
  
  async codingSession(userInstruction = null) {
    console.log('\n' + '='.repeat(50));
    console.log('开始编码会话');
    console.log('='.repeat(50));
    
    const bearings = this.getBearings();
    console.log(`工作目录: ${bearings.directory}`);
    console.log(`已有文件: ${bearings.files.join(', ') || '(无)'}`);
    
    if (bearings.gitLog.length > 0) {
      console.log('\n最近提交:');
      bearings.gitLog.forEach(log => console.log(`  ${log}`));
    }
    
    const features = this.readFile(this.featureFile);
    if (features) {
      console.log('\n功能列表已存在，可以继续开发。');
    }
    
    let context = `
当前工作目录: ${bearings.directory}
已有文件: ${bearings.files.join(', ')}

最近 git 提交:
${bearings.gitLog.join('\n')}
`;
    
    if (userInstruction) {
      context += `\n用户指令: ${userInstruction}`;
    } else {
      context += `
请选择 feature_list.json 中优先级最高的未完成功能进行实现。
实现后更新功能状态，进行测试，然后提交代码。
`;
    }
    
    console.log('\n🚀 正在调用 MiniMax...');
    const response = await this.callMiniMax(this.systemPromptCoding(), context);
    
    console.log('\n🤖 Agent 响应:\n');
    console.log(response);
    console.log('-'.repeat(50));
    
    this.gitCommit('Update: progress from coding session');
    this.updateProgress('编码会话完成');
    
    console.log('\n✅ 编码会话完成！');
  }
}

// 主入口
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MiniMax Coding Agent - 持续Coding代理系统

用法:
  npm start                    # 执行编码会话
  npm run init -- "任务描述"   # 初始化项目
  
环境变量:
  export MINIMAX_API_KEY="your-api-key"
  
示例:
  export MINIMAX_API_KEY="xxx"
  npm run init -- "构建一个Todo List应用"
  npm start
`);
    process.exit(0);
  }
  
  const agent = new MiniMaxCodingAgent();
  
  try {
    if (args.includes('--init') || args.includes('init')) {
      // 获取 -- 后的参数作为任务描述
      const initIndex = args.findIndex(a => a === '--init' || a === 'init');
      const task = args[initIndex + 1] || process.argv[initIndex + 2] || '构建一个新项目';
      await agent.initializeProject(task);
    } else if (args.includes('--code') || args.includes('code')) {
      const codeIndex = args.findIndex(a => a === '--code' || a === 'code');
      const instruction = args[codeIndex + 1] || process.argv[codeIndex + 2];
      await agent.codingSession(instruction);
    } else {
      await agent.codingSession();
    }
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
