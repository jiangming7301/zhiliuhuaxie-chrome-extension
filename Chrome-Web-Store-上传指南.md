# Chrome Web Store 上传指南

## 文件信息
- 插件名称: 智流华写助手 (专业版)
- 上传文件: zhiliuhuaxie-extension-webstore.zip
- 生成时间: 2025/8/29 12:09:41
- Manifest版本: V3

## Chrome Web Store 上传步骤

### 1. 准备开发者账号
- 访问 Chrome Web Store 开发者控制台：https://chrome.google.com/webstore/developer/dashboard
- 如果没有开发者账号，需要注册并支付5美元注册费

### 2. 上传插件
1. 登录开发者控制台
2. 点击"添加新项"或"New item"
3. **重要：上传 zhiliuhuaxie-extension-webstore.zip 文件（ZIP格式，不是CRX）**
4. 填写插件详细信息：
   - 名称：智流华写助手 (专业版)
   - 描述：自动记录网页操作并生成文档的Chrome扩展
   - 分类：生产力工具
   - 语言：中文（简体）

### 3. 配置商店信息
- 上传应用图标（128x128px）
- 添加屏幕截图（至少1张，建议3-5张）
- 编写详细描述
- 设置隐私政策（如果收集用户数据）

### 4. 发布选项
- **开发者测试**：仅开发者可见
- **私人发布**：仅指定用户可见
- **公开发布**：所有用户可见（需要审核）

## 本地安装测试（开发者模式）
如果想要本地测试，请：
1. 解压 zhiliuhuaxie-extension-webstore.zip 到文件夹
2. 打开 Chrome://extensions/
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择解压后的文件夹

## 常见问题解决
- **权限警告**：正常现象，插件需要这些权限才能正常工作
- **审核被拒**：检查是否违反Chrome Web Store政策
- **上传失败**：确保使用ZIP格式，不是CRX格式

## 注意事项
- Chrome Web Store不再接受CRX文件直接上传
- 必须使用ZIP格式上传
- 首次发布需要审核，可能需要几天时间
- 更新版本通常审核较快