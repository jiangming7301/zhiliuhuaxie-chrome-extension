# 智流华写助手 · Zhiliu Scribe

> 一款自动记录网页操作并生成可编辑文档的 Chrome 扩展
> A Chrome extension that auto-records your web interactions and turns them into editable, exportable documents.

[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/jiangming7301/zhiliuhuaxie-chrome-extension)](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/releases)

**Languages**: [中文](#中文) · [English](#english)

---

## 中文

### 简介

**智流华写助手**是一款基于 Chrome Manifest V3 的浏览器扩展，能在你浏览网页时自动记录每一步操作（点击、截图、整页长截图），并把这些记录整理成结构化的操作文档，支持富文本编辑、截图标注、重排步骤、导出分享。

适合用来做：**操作手册撰写、Bug 复现报告、教程文档、测试用例记录、客户演示材料**。

### 功能亮点

- 📸 **自动录制** —— 实时捕获点击事件与页面可视区截图，时间线式排列
- 📜 **整页长截图** —— 自动滚动 + 分段合成，一键拿到整条网页的完整长图
- ✏️ **可视化编辑** —— 内置富文本编辑器（Quill）+ 截图标注画布（Fabric.js），箭头、文字、矩形、画笔随意标
- 🔀 **步骤重排** —— 拖拽调整操作顺序（Sortable.js），支持删除、重录单步
- 📤 **多格式导出** —— 一键导出 PDF / 打印友好页面（基于浏览器原生能力）
- 🔒 **数据本地化** —— 所有记录存在 `chrome.storage.local`，不上云不上传
- ⚡ **无构建依赖** —— 纯原生 JS + CSS，源文件即加载文件，零 npm 依赖

### 安装

当前未上架 Chrome Web Store，请通过"加载已解压扩展"方式安装：

1. 下载最新 [Release](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/releases) 源码，或 `git clone` 本仓库
2. 打开 Chrome，访问 `chrome://extensions`
3. 右上角开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择本项目根目录
5. 扩展图标出现在工具栏即安装完成

> 升级到新版本时，请在 `chrome://extensions` 点击该扩展的 **刷新按钮**，并刷新正在使用的目标网页，让新的 content script 生效。

### 使用流程

1. 点击浏览器工具栏的扩展图标，打开 popup
2. 点 **开始录制**，随后在目标网页正常操作 —— 每次点击会自动保存截图和元信息
3. 需要截整页时，点 **长截图**，等待进度完成
4. 录制结束后点 **打开编辑器** 进入全屏编辑页
5. 在编辑器里添加说明文字、标注截图、调整步骤顺序
6. 点 **导出 PDF** / **打印** 保存成果

### 架构速览

三进程通过 `chrome.runtime.sendMessage` 通信，状态持久化到 `chrome.storage.local`：

| 模块 | 文件 | 职责 |
|------|------|------|
| Background (Service Worker) | `background-clean.js` | 消息路由、可视区截图、长截图会话状态机、操作记录存储 |
| Content Script | `content-clean.js` | DOM 事件监听、分段滚动截图、整页拼接 |
| Popup | `popup.html` + `popup.js` | 录制控制面板、进度显示 |
| Editor | `editor.html` + `editor.js` | 富文本编辑、截图标注、导出 |

Vendor 库（直接提交 `*.min.js`，无打包）：
- [Quill](https://quilljs.com/) —— 富文本编辑器
- [Fabric.js](http://fabricjs.com/) —— 截图标注 canvas
- [Marked](https://marked.js.org/) —— Markdown 渲染
- [Sortable.js](https://sortablejs.github.io/Sortable/) —— 步骤拖拽

更详细的长截图设计说明见 [`long-screenshot-design.md`](./long-screenshot-design.md)。
开发者向导见 [`CLAUDE.md`](./CLAUDE.md)。

### 开发调试

- **无 build / 无 lint / 无 package.json**，源文件即加载文件
- 改动后在 `chrome://extensions` 点扩展刷新按钮即可生效
- 调试入口：
  - Background —— 扩展详情页的 "service worker" 链接
  - Popup —— 右键扩展图标 → "审查弹出内容"
  - Content —— 目标网页 DevTools → Console
  - Editor —— 编辑器 tab 的 DevTools

### 已知限制

- MV3 service worker 会休眠，长截图进行中若 worker 重启，当前会话会被标记为错误并提示重试（v1.1.0 已修复 UI 卡死问题）
- Canvas 拼接尺寸上限约 **32768 px**，超长页面会被自动截断保护
- CSP 严格模式，禁止内联脚本与远程脚本

### 贡献

欢迎提 Issue 和 Pull Request。提交代码前请确认：

- 在 Chrome 真实环境中验证功能
- 不引入需要打包的 npm 依赖
- 遵循现有文件结构和命名风格

### License

本项目采用 [Apache License 2.0](./LICENSE) 开源协议。

---

## English

### Overview

**Zhiliu Scribe** (智流华写助手) is a Chrome Manifest V3 extension that automatically records your browsing actions — clicks, viewport screenshots, and full-page long screenshots — and compiles them into structured, editable operation documents. You can annotate screenshots, rearrange steps, and export the result as PDF.

Great for: **user manuals, bug reproduction reports, tutorials, test case documentation, and customer demos.**

### Features

- 📸 **Auto-recording** — Captures click events and viewport screenshots in a timeline
- 📜 **Full-page long screenshots** — Auto-scroll and stitch segments into one tall image
- ✏️ **Visual editing** — Built-in rich-text editor (Quill) + annotation canvas (Fabric.js) with arrows, text, shapes, and pen
- 🔀 **Step reordering** — Drag-and-drop steps (Sortable.js), delete or re-record single steps
- 📤 **Export** — One-click PDF export and print-friendly pages
- 🔒 **Local-first** — All data lives in `chrome.storage.local`; nothing is uploaded
- ⚡ **Zero build** — Pure vanilla JS + CSS, source files are load files, no npm dependencies

### Installation

Not yet on the Chrome Web Store. Install as an unpacked extension:

1. Download the latest [Release](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/releases) or `git clone` this repo
2. Open Chrome and go to `chrome://extensions`
3. Toggle **Developer mode** in the top-right corner
4. Click **Load unpacked** and select the repository root
5. The extension icon will appear in your toolbar

> When upgrading, click the **reload** button on the extension in `chrome://extensions`, and refresh any target tabs so the new content script takes effect.

### Usage

1. Click the toolbar icon to open the popup
2. Hit **Start recording** and interact with the target page — clicks are auto-captured
3. For full-page captures, click **Long screenshot** and wait for completion
4. Click **Open editor** to enter the full-screen editor
5. Add descriptions, annotate screenshots, reorder steps
6. Click **Export PDF** or **Print** to save your work

### Architecture

Three processes communicating via `chrome.runtime.sendMessage`, state persisted in `chrome.storage.local`:

| Module | File | Responsibility |
|--------|------|---------------|
| Background (Service Worker) | `background-clean.js` | Message routing, viewport capture, long-screenshot state machine, operation storage |
| Content Script | `content-clean.js` | DOM event listening, segmented scroll capture, canvas stitching |
| Popup | `popup.html` + `popup.js` | Recording controls, progress display |
| Editor | `editor.html` + `editor.js` | Rich-text editing, screenshot annotation, export |

Vendor libraries (committed as `*.min.js`, no bundling):
- [Quill](https://quilljs.com/) — Rich-text editor
- [Fabric.js](http://fabricjs.com/) — Annotation canvas
- [Marked](https://marked.js.org/) — Markdown rendering
- [Sortable.js](https://sortablejs.github.io/Sortable/) — Step drag-and-drop

See [`long-screenshot-design.md`](./long-screenshot-design.md) for the long-screenshot design doc and [`CLAUDE.md`](./CLAUDE.md) for the developer guide.

### Development

- **No build / no lint / no package.json** — source files ARE the load files
- After editing, click the reload button in `chrome://extensions`
- Debug entry points:
  - Background — "service worker" link on the extension details page
  - Popup — Right-click the extension icon → "Inspect popup"
  - Content — Target page DevTools → Console
  - Editor — Editor tab DevTools

### Known Limitations

- MV3 service workers can be evicted; if the worker restarts mid long-screenshot, the session is marked as error and asks the user to retry (v1.1.0 fixed the stuck-UI bug)
- Canvas stitching caps at ~32768 px; extremely long pages are protectively truncated
- Strict CSP — no inline or remote scripts allowed

### Contributing

Issues and pull requests are welcome. Before submitting:

- Verify your change in a real Chrome instance
- Don't add dependencies that require bundling
- Follow the existing file structure and naming conventions

### License

Licensed under the [Apache License 2.0](./LICENSE).

---

Made with ❤ by [@jiangming7301](https://github.com/jiangming7301) · Homepage: [hcznai.com](https://www.hcznai.com)
