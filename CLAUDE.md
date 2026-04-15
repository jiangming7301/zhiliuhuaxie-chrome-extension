# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

**智流华写助手** —— 一个 Chrome 扩展 (Manifest V3)，自动记录网页操作（点击、截图、整页截图）并生成可编辑、可导出的文档。无构建流程；源文件即加载文件。

## 开发与调试

- **加载扩展**：Chrome → `chrome://extensions` → 打开开发者模式 → "加载已解压的扩展程序" → 选择仓库根目录
- **应用代码变更**：在 `chrome://extensions` 点击该扩展的刷新按钮；content script 需要同时刷新目标网页
- **调试入口**：
  - Background (service worker)：扩展详情页的 "service worker" 链接
  - Popup：右键扩展图标 → "审查弹出内容"
  - Content script：目标网页 DevTools → Console
  - Editor：打开 `editor.html` 所在 tab 的 DevTools
- **无测试框架 / 无 lint / 无 package.json**。改动需手动在浏览器中验证；UI 变更按用户全局规则使用 `chrome-devtools-mcp` 或 Playwright 做端到端验证。

## 架构

三进程模型，通过 `chrome.runtime.sendMessage` 通信，状态持久化在 `chrome.storage.local`。

### Background (`background-clean.js`, ~1455 行)
扩展的协调中心。职责：
- **消息路由**：通过单一 `chrome.runtime.onMessage.addListener` 分发所有 action
- **操作记录存储**：`operations` 数组（上限 `MAX_OPERATION_RECORDS = 100`），读写 `chrome.storage.local`
- **可视区截图**：通过 `chrome.tabs.captureVisibleTab`，用 `CAPTURE_MIN_INTERVAL = 600ms` 节流避开 `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`
- **整页截图会话**：长截图有独立状态机（`longScreenshotState`：`idle → pending → capturing → success|error|canceled`），超时 `LONG_SCREENSHOT_TIMEOUT = 120s`，每次状态变更通过 `broadcastLongScreenshotState()` 广播到 popup
- **鉴权/配额**：维护 `isPremium`、`usageCount`、`maxFreePages`、`authToken` 等 storage key

### Content Script (`content-clean.js`, ~1674 行)
注入到目标网页（在 `web_accessible_resources` 中声明，通过 `chrome.scripting` 动态注入，无 `content_scripts` 静态声明）。职责：
- 监听 DOM 事件生成操作记录
- 执行分段滚动截图并用 canvas 拼接出整页图像（`PageScreenshotManager` 模式：重叠 offset、稳定等待、`OffscreenCanvas` 合成）
- 通过 `captureLongScreenshotSegment` 请求 background 截取当前可视区

### Popup (`popup.html` + `popup.js`)
用户控制面板。显示录制状态、操作列表、长截图进度，并提供"打开编辑器"按钮。

### Editor (`editor.html` + `editor.js`)
独立扩展页，用于查看/重排/编辑/导出记录到的操作。使用的 vendor 库：
- `quill.min.js` —— 富文本编辑器
- `fabric.min.js` —— 截图批注 canvas
- `marked.min.js` —— Markdown 渲染
- `Sortable.min.js` —— 操作步骤拖拽排序

`print-handler.js` 处理打印/导出 PDF 时的页面样式调整。

### 数据结构
`operations` 数组元素形态（关键字段）：
```js
{ type: 'click' | 'screenshot' | 'long_screenshot', timestamp, url, title,
  screenshot: dataURL, meta?: { width, height, segments, durationMs } }
```
新增类型时，**所有消费者都要更新**：`popup.js`、`editor.js`、`editor.html`、`print-handler.js`。

## 需要注意的约束

- **无构建步骤** —— 不要引入需要打包的 npm 依赖；vendor 库以 `*.min.js` 形式直接提交
- **MV3 service worker 会休眠**：background 中的模块级状态随时可能丢失。`longScreenshotState` 已通过 `persistLongScreenshotState()` + 启动时 `rehydrateLongScreenshotState()` 持久化到 `chrome.storage.local`；新增跨消息的状态时遵循同样模式
- **CSP 严格**：`script-src 'self'`，禁止内联脚本与远程脚本
- **截图 canvas 尺寸上限**约 32k px，`content-clean.js` 已有保护，修改拼接逻辑时不要破坏
- **权限**：当前 `manifest.json` 未声明 `downloads` —— 若要启用自动下载整图需同步更新 manifest 并提示用户重载扩展
- **设计文档**：`long-screenshot-design.md` 是整页截图功能的权威设计说明，改动长截图流程前先读它
