# Chrome Web Store 隐私页面配置详细步骤

## 🚨 问题说明

虽然已经在 `manifest.json` 中添加了隐私政策链接，但Chrome Web Store开发者控制台的"隐私"页面需要您**手动填写**隐私政策URL。

## 📋 详细操作步骤

### 步骤1：进入隐私页面
1. 在Chrome Web Store开发者控制台中
2. 点击左侧菜单的"隐私"选项
3. 进入隐私配置页面

### 步骤2：填写隐私政策链接
在隐私页面中找到以下字段并填写：

#### 🔸 隐私政策 (Privacy Policy)
- **字段位置**: 通常在页面的"隐私政策"或"Privacy Policy"部分
- **需要填写的URL**: `https://www.hcznai.com/privacy`
- **填写方法**: 
  1. 找到"隐私政策URL"或"Privacy Policy URL"输入框
  2. 清空现有内容
  3. 输入：`https://www.hcznai.com/privacy`
  4. 点击"保存"或"Save"

#### 🔸 数据使用说明
如果有数据使用相关的字段，请按照以下建议填写：

**数据收集类型**:
- 选择"本地存储"或"Local Storage"
- 不选择"远程服务器"相关选项

**数据用途**:
- 选择"功能实现"或"Functionality"
- 选择"用户体验优化"

**数据共享**:
- 选择"不与第三方共享"或"No third-party sharing"

### 步骤3：权限说明配置
在权限相关部分：

#### 🔸 activeTab 权限
- **用途说明**: "仅在用户主动操作时访问当前标签页以实现截图功能"
- **英文**: "Access current tab only when user actively operates for screenshot functionality"

#### 🔸 storage 权限  
- **用途说明**: "在本地存储用户的操作记录和插件设置"
- **英文**: "Store user operation records and plugin settings locally"

#### 🔸 scripting 权限
- **用途说明**: "动态注入必要的录制功能脚本"
- **英文**: "Dynamically inject necessary recording functionality scripts"

### 步骤4：保存配置
1. 填写完所有必需字段后
2. 点击页面底部的"保存"或"Save"按钮
3. 等待系统确认保存成功

## 🎯 关键要点

### ✅ 必须完成的操作
1. **手动输入隐私政策URL**: `https://www.hcznai.com/privacy`
2. **确认URL格式正确**: 必须以 `https://` 开头
3. **保存配置**: 点击保存按钮确认

### ⚠️ 常见错误
1. **只修改manifest.json**: 仅修改代码文件是不够的，必须在Web界面手动填写
2. **URL格式错误**: 确保使用完整的HTTPS URL
3. **忘记保存**: 填写后必须点击保存按钮

## 🔍 验证方法

### 配置完成后验证
1. **刷新隐私页面**: 重新进入隐私页面
2. **检查显示的URL**: 应该显示 `https://www.hcznai.com/privacy`
3. **点击链接测试**: 点击隐私政策链接，确认能正常打开您的隐私政策页面

### 审核状态检查
配置完成后：
1. 返回插件概览页面
2. 检查是否还有隐私政策相关的警告
3. 如果警告消失，说明配置成功

## 📱 界面示例说明

根据您的截图，您需要：

1. **在当前页面找到隐私政策输入框**
2. **将现有的链接替换为**: `https://www.hcznai.com/privacy`
3. **确认URL完全正确后保存**

## 🚨 重要提醒

1. **必须手动操作**: Chrome Web Store要求您在Web界面手动确认隐私政策链接
2. **URL必须可访问**: 确保 `https://www.hcznai.com/privacy` 页面能正常打开
3. **内容要匹配**: 隐私政策页面内容必须与插件实际功能一致

## 📞 如果仍有问题

如果按照上述步骤操作后仍显示错误的链接：

1. **清除浏览器缓存**: 刷新开发者控制台页面
2. **重新登录**: 退出并重新登录开发者控制台
3. **检查权限**: 确认您有修改该插件配置的权限
4. **联系支持**: 如果问题持续，联系Chrome Web Store支持团队

完成这些步骤后，隐私政策链接应该会正确显示为 `https://www.hcznai.com/privacy`。