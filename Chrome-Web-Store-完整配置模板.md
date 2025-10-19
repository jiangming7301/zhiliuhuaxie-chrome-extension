# Chrome Web Store 完整配置模板

## 🎯 基本信息配置

### 商品详情 (Store Listing)

#### 基本信息
- **应用名称**: 智流华写助手 (专业版)
- **简要说明**: 自动记录网页操作并生成文档的Chrome扩展 - 专业版无限制
- **类别**: 生产力工具
- **语言**: 中文 (简体)

#### 详细描述
```
智流华写助手是一款专业的操作流程记录工具，能够自动截图和跟踪鼠标操作，一键生成专业操作文档。

🚀 核心功能：
• 智能截图系统 - 自动捕获每个操作步骤
• 精确点击跟踪 - 记录鼠标点击位置和目标元素
• 自动文档生成 - 生成包含截图和步骤说明的文档
• 多格式导出 - 支持PDF、Word、Markdown等格式
• 本地数据存储 - 所有数据安全存储在本地

💼 适用场景：
• 企业培训材料制作
• 产品使用说明文档
• 客服操作流程记录
• 软件测试过程文档
• 问题复现步骤记录

🔒 隐私保护：
• 所有数据仅存储在本地浏览器
• 不上传任何信息到服务器
• 符合GDPR等隐私法规要求

📧 联系我们：
• 邮箱：18675639813@163.com
• 网站：https://www.hcznai.com/
```

#### 联系信息
- **开发者邮箱**: 18675639813@163.com
- **官方网站**: https://www.hcznai.com/
- **支持网站**: https://www.hcznai.com/

## 🔒 隐私政策配置

### 隐私页面配置
- **隐私政策URL**: https://www.hcznai.com/privacy
- **数据收集类型**: 本地存储
- **数据用途**: 功能实现、用户体验优化
- **数据共享**: 不与第三方共享

### 权限说明

#### activeTab 权限
- **用途说明**: 仅在用户主动操作时访问当前标签页以实现截图功能
- **英文说明**: Access current tab only when user actively operates for screenshot functionality
- **数据处理**: 不收集或存储标签页数据，仅用于实时截图

#### storage 权限
- **用途说明**: 在本地存储用户的操作记录和插件设置
- **英文说明**: Store user operation records and plugin settings locally
- **数据处理**: 所有数据存储在用户本地浏览器，不上传到服务器

#### scripting 权限
- **用途说明**: 动态注入必要的录制功能脚本
- **英文说明**: Dynamically inject necessary recording functionality scripts
- **数据处理**: 仅注入功能脚本，不收集页面数据

#### tabs 权限
- **用途说明**: 获取当前标签页基本信息用于文档生成
- **英文说明**: Get current tab basic information for document generation
- **数据处理**: 仅获取标题和URL用于操作记录

#### notifications 权限
- **用途说明**: 向用户显示录制状态和操作提示
- **英文说明**: Display recording status and operation prompts to users
- **数据处理**: 仅显示本地通知，不收集用户数据

## 📋 填写检查清单

### 商品详情页面
- [ ] 应用名称: 智流华写助手 (专业版)
- [ ] 简要说明: (已提供)
- [ ] 详细描述: (已提供)
- [ ] 开发者邮箱: 18675639813@163.com
- [ ] 官方网站: https://www.hcznai.com/
- [ ] 支持网站: https://www.hcznai.com/
- [ ] 类别: 生产力工具
- [ ] 语言: 中文(简体)

### 隐私页面
- [ ] 隐私政策URL: https://www.hcznai.com/privacy
- [ ] activeTab权限说明: (已提供)
- [ ] storage权限说明: (已提供)
- [ ] scripting权限说明: (已提供)
- [ ] tabs权限说明: (已提供)
- [ ] notifications权限说明: (已提供)
- [ ] 数据收集类型: 本地存储
- [ ] 数据用途: 功能实现、用户体验优化
- [ ] 数据共享: 不与第三方共享

### 其他页面
- [ ] 开发者信息: 邮箱和网站已更新
- [ ] 图标和截图: 已上传
- [ ] 版本信息: 1.0.0

## 🌐 确保网站页面可访问

### 隐私政策页面 (https://www.hcznai.com/privacy)
✅ 已更新，包含正确联系信息：
- 邮箱: 18675639813@163.com
- 网站: https://www.hcznai.com/

### 主页 (https://www.hcznai.com/)
✅ 网站结构完整，包含：
- 产品介绍
- 功能特色
- 价格方案
- 联系信息

## 🚨 重要操作步骤

1. **确保网站可访问**
   - 启动网站服务: `cd zhiliuhuaxie-website && npm run dev`
   - 确认 https://www.hcznai.com/privacy 可正常访问

2. **上传新版本插件**
   - 使用 zhiliuhuaxie-extension-fixed.zip
   - 等待文件上传完成

3. **填写商品详情**
   - 复制上述内容到对应字段
   - 确认所有联系信息正确

4. **配置隐私设置**
   - 手动输入隐私政策URL
   - 填写权限说明
   - 选择正确的数据处理类型

5. **提交审核**
   - 检查所有信息无误
   - 点击提交审核

## 📞 联系信息总结

**主要联系方式**:
- 邮箱: 18675639813@163.com
- 网站: https://www.hcznai.com/
- 隐私政策: https://www.hcznai.com/privacy

所有页面和配置都应使用这些统一的联系信息。