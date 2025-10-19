# 智流华写助手 Chrome 插件

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-1.0.2-green.svg)](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension)

一个功能强大的Chrome浏览器插件，用于自动记录网页操作并生成详细的操作文档。支持自动截图、点击跟踪、多格式导出等功能。

## ✨ 功能特性

- 🔴 **智能录制**: 一键开始/停止操作录制，实时状态显示
- 📸 **自动截图**: 智能截图策略 + 点击后自动截图
- 🖱️ **精确跟踪**: 记录鼠标点击位置、目标元素和操作上下文
- 📄 **多格式导出**: 支持Word、PDF、Markdown等多种格式
- 💾 **本地存储**: 安全的本地数据存储，保护用户隐私
- ⏱️ **实时统计**: 录制时长、截图数量、操作次数实时显示
- 🎯 **操作回放**: 支持操作步骤的可视化回放和验证

## 🚀 快速开始

### 安装方法

#### 方法一：从源码安装（推荐开发者）
1. 克隆或下载此项目到本地
```bash
git clone https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension.git
cd zhiliuhuaxie-chrome-extension
```

2. 打开Chrome浏览器，进入扩展程序管理页面
   - 地址栏输入：`chrome://extensions/`
   - 或通过菜单：更多工具 → 扩展程序

3. 开启右上角的"开发者模式"

4. 点击"加载已解压的扩展程序"

5. 选择项目根目录

6. 插件安装完成，工具栏会显示插件图标

#### 方法二：Chrome Web Store安装
> 即将上线Chrome Web Store，敬请期待！

### 基本使用

1. **开始录制**
   - 点击插件图标打开控制面板
   - 点击"开始录制"按钮
   - 页面右上角显示红色录制指示器

2. **执行操作**
   - 正常浏览和操作网页
   - 插件自动记录所有点击和页面变化
   - 实时查看操作统计信息

3. **停止录制**
   - 再次点击插件图标
   - 点击"停止录制"按钮

4. **导出文档**
   - 选择导出格式（Word/PDF/Markdown）
   - 点击"导出文档"按钮
   - 选择保存位置

## 📋 详细功能说明

### 录制功能
- **自动截图**: 开始录制时立即截图，之后每30秒自动截图
- **点击跟踪**: 精确记录每次鼠标点击的：
  - 坐标位置和相对位置
  - 目标元素信息（标签、类名、ID等）
  - 元素文本内容和属性
  - 页面URL和时间戳
- **智能识别**: 自动识别按钮、链接、表单等交互元素

### 导出格式

#### Word文档 (.docx)
- A4横向页面布局，适合截图展示
- 图片尺寸优化（20cm宽度）
- 包含操作步骤和详细说明
- 支持打印和进一步编辑

#### PDF文档 (.pdf)
- 高质量矢量输出
- 适合分享和存档
- 保持格式一致性

#### Markdown文档 (.md)
- 轻量级标记语言
- 适合技术文档和版本控制
- 支持GitHub等平台直接预览

### 数据管理
- **本地存储**: 所有数据仅存储在本地浏览器中
- **隐私保护**: 不会上传任何数据到服务器
- **批量操作**: 支持批量导出和清空记录
- **数据备份**: 支持操作记录的导入导出

## 🏗️ 项目结构

```
zhiliuhuaxie-chrome-extension/
├── manifest.json          # 插件配置文件
├── popup.html            # 弹窗界面
├── popup.js             # 弹窗逻辑和主要功能
├── background.js        # 后台服务工作者
├── content.js          # 内容脚本（页面注入）
├── content.css         # 内容样式
├── print-handler.js    # 打印处理器
├── icons/              # 插件图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── test-export.html    # 导出功能测试页面
├── dist/              # 构建输出目录
└── README.md          # 项目说明文档
```

## 🔧 技术实现

### 核心技术栈
- **Manifest V3**: 最新的Chrome扩展API
- **Service Worker**: 后台任务处理
- **Content Scripts**: 页面内容操作
- **Chrome APIs**: 
  - `chrome.tabs.captureVisibleTab` - 截图功能
  - `chrome.storage.local` - 本地存储
  - `chrome.scripting` - 脚本注入
  - `chrome.downloads` - 文件下载

### 关键特性
- **异步处理**: 使用Promise和async/await处理异步操作
- **事件驱动**: 基于事件监听器的交互捕获
- **模块化设计**: 功能模块清晰分离
- **错误处理**: 完善的错误捕获和用户反馈
- **性能优化**: 截图压缩和存储优化

### 权限说明
```json
{
  "permissions": [
    "storage",      // 本地数据存储
    "activeTab",    // 访问当前活动标签页
    "scripting"     // 脚本注入功能
  ]
}
```

## 🎯 使用场景

| 场景 | 描述 | 优势 |
|------|------|------|
| 📋 **操作手册制作** | 快速生成软件使用教程 | 自动化、高效率 |
| 🔧 **问题复现** | 记录bug复现步骤 | 精确记录、易于分享 |
| 📚 **培训材料** | 制作员工培训文档 | 可视化、易理解 |
| 🧪 **测试记录** | 记录测试过程和结果 | 标准化、可追溯 |
| 📖 **用户指南** | 生成产品使用指南 | 专业、详细 |
| 🎓 **教学演示** | 制作教学课件 | 直观、互动性强 |

## ⚠️ 注意事项

### 兼容性
- ✅ 支持Chrome 88+版本
- ✅ 支持大部分网站和Web应用
- ❌ 某些特殊页面可能无法正常工作：
  - Chrome内部页面（chrome://）
  - 扩展程序管理页面
  - 某些安全性较高的网站

### 性能影响
- 📊 **内存使用**: 录制过程中会占用额外内存
- 💾 **存储空间**: 截图会占用本地存储空间
- 🖼️ **截图质量**: 默认90%质量，平衡文件大小和清晰度

### 隐私保护
- 🔒 所有数据仅存储在本地浏览器中
- 🚫 不会收集或上传任何用户数据
- 🛡️ 符合GDPR和其他隐私法规要求

## 📈 更新日志

### v1.0.2 (当前版本)
- ✨ 新增Word文档导出功能
- 🐛 修复截图尺寸在Word中的显示问题
- 🎨 优化A4横向页面布局
- 📱 改进用户界面和交互体验

### v1.0.1
- 🐛 修复部分网站兼容性问题
- ⚡ 优化截图性能和质量
- 📝 完善操作记录的详细信息

### v1.0.0
- 🎉 初始版本发布
- 📸 基础录制和截图功能
- 📄 HTML文档导出功能
- 💾 本地数据存储

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献
1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发环境设置
```bash
# 克隆项目
git clone https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension.git

# 进入项目目录
cd zhiliuhuaxie-chrome-extension

# 在Chrome中加载扩展进行开发测试
# 打开 chrome://extensions/
# 开启开发者模式
# 点击"加载已解压的扩展程序"
# 选择项目根目录
```

### 报告问题
- 🐛 [报告Bug](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/issues/new?template=bug_report.md)
- 💡 [功能建议](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/issues/new?template=feature_request.md)

## 📞 技术支持

### 联系方式
- 📧 **邮箱**: jiangming7301@126.com
- 🐛 **问题反馈**: [GitHub Issues](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/issues)
- 💬 **讨论交流**: [GitHub Discussions](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/discussions)

### 常见问题
查看我们的 [FAQ](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/wiki/FAQ) 获取常见问题的解答。

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE) - 查看 [LICENSE](LICENSE) 文件了解详细信息。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

### 特别感谢
- Chrome Extensions API 文档和社区
- 所有提供反馈和建议的用户
- 开源社区的支持和贡献

---

<div align="center">

**如果这个项目对您有帮助，请给我们一个 ⭐️**

[🏠 项目主页](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension) | 
[📖 文档](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/wiki) | 
[🐛 报告问题](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/issues) | 
[💡 功能建议](https://github.com/jiangming7301/zhiliuhuaxie-chrome-extension/discussions)

</div>