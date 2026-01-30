# AI News Web

实时聚合 AI 资讯，每2小时自动刷新。

## 功能

- 🤖 聚合多平台 AI 资讯（Twitter/X, Reddit, AI News, Hacker News）
- 🔄 每2小时自动刷新
- 🌐 支持来源筛选
- 📱 响应式设计
- 🎨 暗色主题

## 部署到 Vercel

```bash
# 1. 推送代码到 GitHub
cd ai-news-web
git init
git add .
git commit -m "Initial commit: AI News Web"
git remote add origin https://github.com/NewHubBoy/ai-news-web.git
git push -u origin main

# 2. 用 Vercel CLI 部署（自动创建项目）
npx vercel --token YOUR_VERCEL_TOKEN
```

## 本地开发

```bash
cd ai-news-web
npx http-server .
```

## 技术栈

- 纯原生 HTML/CSS/JavaScript
- Vercel 静态托管
- AllOrigins CORS 代理
