#!/usr/bin/env python3
"""
MiniMax Coding Agent - 持续Coding代理系统
基于 Anthropic 的 Long-Running Agents 设计模式

核心特性：
- 双代理模式：初始化代理 + 编码代理
- 记忆持久化：claude-progress.txt + feature_list.json
- Git 集成：自动提交、状态恢复
- 增量开发：每次会话只做一个功能
"""

import os
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# 导入 MiniMax SDK
try:
    from minimax import MiniMaxClient
except ImportError:
    print("请安装 MiniMax SDK: pip install minimax")
    sys.exit(1)


class MiniMaxCodingAgent:
    """基于 MiniMax 的持续Coding代理"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.minimax.chat"):
        self.client = MiniMaxClient(api_key=api_key, base_url=base_url)
        self.project_dir = Path(__file__).parent
        self.workspace_dir = self.project_dir / "workspace"
        self.workspace_dir.mkdir(exist_ok=True)
        
        # 文件路径
        self.progress_file = self.project_dir / "claude-progress.txt"
        self.feature_file = self.project_dir / "feature_list.json"
        self.init_script = self.project_dir / "init.sh"
        
    def call_minimax(self, system_prompt: str, user_prompt: str, max_tokens: int = 8192) -> str:
        """调用 MiniMax API"""
        response = self.client.chat.completions.create(
            model="MiniMax-M2.1",  # 或 MiniMax-M2
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=max_tokens,
            temperature=0.7
        )
        return response.choices[0].message.content
    
    def run_shell(self, cmd: str) -> tuple[int, str, str]:
        """执行shell命令"""
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, cwd=str(self.workspace_dir)
        )
        return result.returncode, result.stdout, result.stderr
    
    def git_commit(self, message: str) -> bool:
        """Git 提交"""
        code, stdout, stderr = self.run_shell(f"git add -A && git commit -m '{message}'")
        return code == 0
    
    def git_push(self) -> bool:
        """Git 推送"""
        code, stdout, stderr = self.run_shell("git push origin main")
        return code == 0
    
    def read_file(self, filepath: Path) -> Optional[str]:
        """读取文件"""
        if filepath.exists():
            return filepath.read_text()
        return None
    
    def write_file(self, filepath: Path, content: str) -> None:
        """写入文件"""
        filepath.write_text(content)
    
    def update_progress(self, message: str) -> None:
        """更新进度文件"""
        timestamp = datetime.now().isoformat()
        progress = f"[{timestamp}] {message}\n"
        if self.progress_file.exists():
            existing = self.progress_file.read_text()
            self.write_file(self.progress_file, existing + progress)
        else:
            self.write_file(self.progress_file, progress)
    
    def get_bearings(self) -> dict:
        """获取当前项目状态"""
        status = {
            "directory": str(self.workspace_dir),
            "files": [],
            "git_log": [],
            "features_completed": [],
            "current_work": None
        }
        
        # 列出工作目录文件
        if self.workspace_dir.exists():
            status["files"] = [f.name for f in self.workspace_dir.iterdir() 
                            if f.is_file() and not f.name.startswith('.')]
        
        # 读取 git 日志
        code, stdout, _ = self.run_shell("git log --oneline -20")
        if code == 0:
            status["git_log"] = stdout.strip().split('\n')[:10]
        
        # 读取进度文件
        progress = self.read_file(self.progress_file)
        if progress:
            status["progress_history"] = progress.strip().split('\n')[-5:]
        
        # 读取功能列表
        features = self.read_file(self.feature_file)
        if features:
            try:
                feature_data = json.loads(features)
                status["features_completed"] = [
                    f for f in feature_data if f.get("passes", False)
                ]
            except json.JSONDecodeError:
                pass
        
        return status
    
    def system_prompt_init(self) -> str:
        """初始化代理的系统提示"""
        return """你是项目的初始化代理。你的任务是：
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
- claude-progress.txt: 初始进度记录"""
    
    def system_prompt_coding(self) -> str:
        """编码代理的系统提示"""
        return """你是项目的编码代理。你的任务是：
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
- 不能因为已经做了些工作就宣布项目完成"""
    
    def initialize_project(self, user_task: str) -> None:
        """初始化项目"""
        self.update_progress("开始初始化项目")
        
        # 获取当前状态
        bearings = self.get_bearings()
        
        user_prompt = f"""
用户任务：{user_task}

当前工作目录：{bearings['directory']}
已有文件：{bearings.get('files', [])}

请完成以下任务：
1. 创建详细的 feature_list.json（JSON格式），列出所有需要实现的功能点
2. 创建 init.sh 启动脚本（如果需要）
3. 创建 claude-progress.txt 初始记录
4. 进行 git 初始提交

功能列表格式示例：
```json
[
  {{
    "category": "functional",
    "description": "功能描述",
    "steps": ["步骤1", "步骤2", "步骤3"],
    "passes": false
  }}
]
```
"""
        
        response = self.call_minimax(self.system_prompt_init(), user_prompt)
        
        # 解析响应并创建文件
        self.save_agent_output(response)
        
        # 提交
        self.git_commit("Initial commit: project setup")
        self.update_progress("项目初始化完成")
        
        print("项目初始化完成！")
    
    def save_agent_output(self, response: str) -> None:
        """解析并保存 agent 的输出"""
        # 这里可以解析 markdown 代码块，保存文件
        pass
    
    def coding_session(self, user_instruction: str = None) -> None:
        """执行编码会话"""
        print("\n" + "="*50)
        print("开始编码会话")
        print("="*50)
        
        # 1. 获取当前状态
        bearings = self.get_bearings()
        print(f"工作目录: {bearings['directory']}")
        print(f"已有文件: {bearings.get('files', [])}")
        
        if bearings.get('git_log'):
            print(f"\n最近提交:")
            for log in bearings['git_log'][:5]:
                print(f"  {log}")
        
        # 2. 读取功能列表
        features = self.read_file(self.feature_file)
        
        # 3. 准备用户提示
        context = f"""
当前工作目录: {bearings['directory']}
已有文件: {bearings.get('files', [])}

最近 git 提交:
{bearings.get('git_log', [])}

"""
        
        if user_instruction:
            context += f"\n用户指令: {user_instruction}"
        else:
            context += """
请选择 feature_list.json 中优先级最高的未完成功能进行实现。
实现后更新功能状态，进行测试，然后提交代码。
"""
        
        # 4. 调用 MiniMax
        response = self.call_minimax(self.system_prompt_coding(), context)
        
        print("\nAgent 响应:")
        print("-"*50)
        print(response[:1000] + "..." if len(response) > 1000 else response)
        print("-"*50)
        
        # 5. 解析响应并创建文件
        self.save_agent_output(response)
        
        # 6. 提交并更新进度
        self.git_commit("Update: progress from coding session")
        self.update_progress("编码会话完成")
        
        print("\n编码会话完成！")


def main():
    """主入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description="MiniMax Coding Agent")
    parser.add_argument("--api-key", required=True, help="MiniMax API Key")
    parser.add_argument("--init", type=str, help="初始化项目：描述你的任务")
    parser.add_argument("--code", type=str, help="执行编码会话：可选的指令")
    parser.add_argument("--base-url", default="https://api.minimax.chat", help="API Base URL")
    
    args = parser.parse_args()
    
    agent = MiniMaxCodingAgent(api_key=args.api_key, base_url=args.base_url)
    
    if args.init:
        agent.initialize_project(args.init)
    else:
        agent.coding_session(args.code)


if __name__ == "__main__":
    main()
