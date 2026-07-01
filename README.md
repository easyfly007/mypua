# 读心助手 mypua

上传一张聊天截图（或将来实时录音），分析对方此刻的心理状态，并给出你下一步该怎么说。
适用于销售推进客户、与喜欢的人沟通等场景。

> 设计文档见 [DESIGN.md](./DESIGN.md)。当前已实现「截图分析」通道，「实时录音」通道为骨架。

## 快速开始

```bash
npm install
cp .env.example .env      # 填入你的 ANTHROPIC_API_KEY
npm start                 # 默认 http://localhost:3000
```

手机和电脑在同一局域网时，用手机浏览器打开 `http://<电脑IP>:3000` 即可上传截图。

## 目录结构

```
mypua/
├─ server.js          Express 入口（/api/analyze 截图分析）
├─ public/index.html  移动端单页：上传截图 + 结果展示
├─ lib/
│  ├─ analyzer.js     分析引擎（prompt + 结构化 schema + 调 Claude），两通道共用
│  └─ asr.js          语音转写适配器接口（骨架，待选型后实现）
├─ DESIGN.md          设计文档
└─ README.md
```

## 技术栈

- 后端：Node.js + Express
- AI：Claude（`claude-opus-4-8`）多模态 + 结构化输出
- 前端：移动端友好的原生单页

## 路线图

见 [DESIGN.md §6 里程碑](./DESIGN.md)。下一步：确认 ASR 选型与说话人区分方案，落地实时录音通道。
