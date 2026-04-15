# 整页截图功能设计与开发文档

## 1. 背景与目标
- 现有录制流程只截取可视区域，无法覆盖需滚动的完整页面。
- 目标是在 Chrome 扩展内新增“整页截图”模式，实现自动滚动、拼接、保存，并与当前操作记录/编辑器/导出流程兼容。

## 2. 功能范围
- Popup（`popup.html`, `popup.js`）：新增触发按钮、进度/错误提示、状态互斥控制。
- Background（`background-clean.js`）：负责长截图会话管理、注入 content script、与页面协作、写入 `operations`。
- Content（`content-clean.js`）：完成滚动、稳定检测、分段截图、拼接、状态回传。
- 展示层（`popup.js`, `editor.js`, `editor.html`, `editor.css`, `print-handler.js`）：识别 `type: 'long_screenshot'` 的记录，调整展示与导出。
- 可选：自动下载整图（需 `downloads` 权限，更新 `manifest.json`）。

## 3. 交互与状态
- Popup 增加 `isLongCaptureRunning`、`longCaptureProgress`，状态机：`idle → pending → capturing (n/total) → success|error|canceled`。
- Background 通过 `chrome.runtime.sendMessage` 广播 `longScreenshotProgress/Done/Error`，必要时将状态写入 `chrome.storage.local` 以便 Popup 重载恢复。
- Content 监听 `startLongScreenshot`、`cancelLongScreenshot`，期间可显示遮罩/提示并禁止用户滚动。

## 4. 技术方案
### 4.1 Content 端
- 新增 `PageScreenshotManager`：计算 `docHeight`, `viewportHeight`, `devicePixelRatio`，生成带 40–60px 重叠的 offset 列表。
- 每段流程：`scrollTo(offset)` → `await requestAnimationFrame + setTimeout` 稳定 → 向 background 发送 `captureLongScreenshotSegment` 请求 → 缓存 dataURL 并报告进度。
- 拼接：使用 `OffscreenCanvas` 或隐藏 `canvas`，尺寸 `docWidth*dpr × docHeight*dpr`；绘制时处理重叠裁剪。完成后 `toDataURL('image/png')` 携带 `meta`（宽高、段数、耗时）返回 background。
- 异常处理：URL 变化、用户干预、canvas 超限、截图失败等路径需中止并恢复初始滚动/样式。

### 4.2 Background 端
- 新增会话对象 `{sessionId, tabId, status, totalSegments, capturedSegments, startedAt}`，统一管理超时（如 60s）、取消、错误。
- 响应 content 请求分段截图：调用 `chrome.tabs.captureVisibleTab` 并返回 dataURL，处理 quota/权限异常。
- 收到最终整图后写入 `operations`：
  ```js
  {
    type: 'long_screenshot',
    timestamp,
    url,
    title,
    screenshot: finalDataUrl,
    meta: { width, height, segments, durationMs }
  }
  ```
- 可选：调用 `chrome.downloads.download` 触发本地保存（需要权限）。

### 4.3 展示层
- Popup/Editor/导出识别 `long_screenshot`，显示“整页截图”标签、专属排序或分组；导出模版输出整图并保持版式。
- 若 Popup 支持直接查看或下载，新增相应按钮与权限校验。

## 5. 异常与约束
- Chrome canvas 与截图尺寸限制（约 32k px）：超限时提示用户拆分或失败。
- `chrome.tabs.captureVisibleTab` 配额：保留节流（content 端已有 `screenshotDelay`），背景端遇到 `quota exceeded` 时提示稍后再试。
- 固定头/悬浮元素：可提供可选开关暂时移除常见 `position: fixed` 元素，结束后恢复。
- 用户在过程中切换标签/滚动/页面跳转：content 检测并中止，background 清理会话并反馈给 Popup。

## 6. 权限与安全
- 复用现有活动标签截图权限；仅允许当前窗口/活动标签执行，避免跨标签访问。
- 若启用自动下载，需要在 `manifest.json` 增加 `"downloads"` 并更新文档提示用户重新加载扩展。

## 7. 性能与体验
- 为超高页面提供高度上限（例如 30 000px）或分批绘制，避免内存爆炸。
- 记录进度，允许短暂失败重试一段；必要时让用户可以主动取消。
- 使用 try/finally 确保滚动位置、DOM 样式、事件监听均被恢复。

---

## 8. 开发计划
1. **准备**：确认 UI 文案、按钮位置、是否需要下载权限；若需更新 `manifest.json`，提前安排扩展重载。
2. **Popup 改造**：更新 `popup.html/popup.js`，实现按钮与状态显示、发送 `startLongScreenshot`、接收进度消息、禁用冲突操作。
3. **Background 会话管理**：在 `background-clean.js` 添加指令处理、会话状态、超时/取消、`operations` 写入、错误反馈。
4. **Content 滚动拼接模块**：实现 `PageScreenshotManager`，处理滚动、等待、分段请求、canvas 拼接、状态上报与恢复。
5. **数据消费者更新**：`popup.js`, `editor.js`, `editor.html`, `editor.css`, `print-handler.js` 支持新类型展示与导出；必要时新增下载按钮。
6. **状态持久化**：根据需要在 `chrome.storage.local` 存储进行中的长截图状态，`PopupController` 初始化时恢复 UI。
7. **测试**：覆盖页面高度/DPR/固定头/懒加载/无限滚动、并发/取消/错误路径、`operations` 超限、不同窗口状态（最小化/切换标签）。
8. **交付**：代码走查、文档更新、告知权限变化；若有版本说明，记录已知限制与建议使用方式。

## 9. 风险与缓解
- **Canvas 超限**：捕获前预估尺寸，超限立即提示失败或建议拆分。
- **截图配额**：在 background 捕获失败时重试一次并将节流信息反馈给用户。
- **DOM 副作用**：所有样式/滚动修改集中管理并确保 finally 恢复。
- **用户中断**：提供取消指令，并确保 background/Popup 状态一致，避免孤儿会话。

## 10. 后续可选增强
- 长截图任务排队/历史记录查看。
- Popup 中直接预览缩略图或编辑器内添加批注工具。
- 为固定头提供自动识别/移除策略或让用户选择“隐藏悬浮元素”。

