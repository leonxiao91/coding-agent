# MiniMax Coding Agent 🤖

基于 MiniMax 的持续 Coding 代理系统，参考 Anthropic 的 Long-Running Agents 设计模式。

## 核心特性

- 🎯 **双代理模式**：初始化代理 + 编码代理
- 💾 **记忆持久化**：claude-progress.txt + feature_list.json
- 🔄 **Git 集成**：自动提交、状态恢复
- 📦 **增量开发**：每次会话只做一个功能
- ✅ **测试驱动**：必须测试通过才标记完成

## 快速开始

### 1. 安装依赖

```bash
cd coding-agent
pip install -r requirements.txt
```

### 2. 配置 API Key

```bash
export MINIMAX_API_KEY="your-api-key"
```

### 3. 初始化项目

```bash
python main.py --api-key $MINIMAX_API_KEY --init "构建一个Todo List应用"
```

### 4. 开始编码

```bash
python main.py --api-key $MINIMAX_API_KEY
```

## 工作流程

### 初始化阶段
1. Agent 读取用户需求
2. 创建 feature_list.json（所有待实现功能）
3. 创建 init.sh（启动脚本）
4. 创建 claude-progress.txt（进度记录）
5. Git 初始提交

### 编码会话阶段
1. 获取当前状态（pwd、git log、进度文件）
2. 选择下一个未完成的功能
3. 实现功能
4. 端到端测试
5. 更新 feature_list.json
6. Git 提交并更新进度

## 项目结构

```
coding-agent/
├── main.py                 # 主程序
├── config.yaml            # 配置文件
├── requirements.txt       # 依赖
├── feature_list_template.json  # 功能模板
├── workspace/             # 工作目录（代码存放处）
├── claude-progress.txt    # 进度记录
└── feature_list.json      # 功能列表（运行时生成）
```

## 配置文件说明

```yaml
api:
  base_url: "https://api.minimax.chat"
  model: "MiniMax-M2.1"
  max_tokens: 8192

project:
  workspace: "./workspace"
  progress_file: "claude-progress.txt"
  feature_file: "feature_list.json"

coding:
  features_per_session: 1  # 每次只做一个功能
  auto_commit: true
  test_required: true      # 必须测试
```

## 高级用法

### 带指令的编码会话

```bash
python main.py --api-key $MINIMAX_API_KEY --code "实现用户认证模块"
```

### 使用自定义配置

```bash
python main.py --api-key $MINIMAX_API_KEY --config config.yaml
```

### 推送代码到远程

在 `config.yaml` 中设置 `auto_push: true`，或在会话后手动：

```bash
git push origin main
```

## 最佳实践

1. **保持小步快跑**：每次只实现一个功能
2. **及时测试**：实现后立即验证
3. **清晰提交**：每次 git commit 描述做了什么
4. **更新进度**：会话结束时更新 claude-progress.txt
5. **查看历史**：用 git log 回顾项目历程

## 解决的问题

| 问题 | 解决方案 |
|------|---------|
| Agent 一次性做太多 | 每次只做一个功能 |
| 忘记之前的工作 | claude-progress.txt + git history |
| 跳过测试 | 强制测试通过才标记完成 |
| 过早宣布完成 | feature_list.json 跟踪所有功能 |

## 参考

- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
