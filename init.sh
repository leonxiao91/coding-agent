#!/bin/bash

# 初始化脚本 - 安装依赖并启动开发服务器

set -e  # 遇到错误立即退出

echo "🚀 初始化开发环境..."

# 安装依赖
if [ -f "requirements.txt" ]; then
    echo "📦 安装 Python 依赖..."
    pip install -r requirements.txt
fi

if [ -f "package.json" ]; then
    echo "📦 安装 Node.js 依赖..."
    npm install
fi

# 检查是否有其他设置步骤
if [ -f ".env.example" ] && [ ! -f ".env" ]; then
    echo "📝 复制环境变量模板..."
    cp .env.example .env
    echo "⚠️  请编辑 .env 文件配置必要的环境变量"
fi

echo ""
echo "✅ 环境初始化完成！"
echo ""
echo "启动开发服务器："
echo "  Python: python main.py"
echo "  Node:   npm run dev"
echo "  其他:   ./run.sh"
