const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 配置
const buildDir = 'build-webstore-fixed';
const outputFile = 'zhiliuhuaxie-extension-fixed.zip';

console.log('🔧 生成修复版本的Web Store上传包...');

// 清理并创建构建目录
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
fs.mkdirSync(buildDir, { recursive: true });

// 需要包含的文件列表
const filesToInclude = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'popup.html',
  'popup.js',
  'print-handler.js',
  'icons/'
];

// 复制文件
function copyFiles() {
  console.log('📁 复制插件文件...');
  
  filesToInclude.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(__dirname, buildDir, file);
    
    if (fs.existsSync(srcPath)) {
      if (fs.statSync(srcPath).isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(srcPath, destPath);
      }
      console.log(`✅ 已复制: ${file}`);
    } else {
      console.warn(`⚠️  文件不存在: ${file}`);
    }
  });
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// 验证并修复manifest.json
function validateAndFixManifest() {
  console.log('🔍 验证并修复manifest.json...');
  const manifestPath = path.join(__dirname, buildDir, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json 文件不存在');
  }
  
  let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // 确保必需字段存在
  if (!manifest.name) manifest.name = "智流华写助手";
  if (!manifest.version) manifest.version = "1.0.0";
  if (!manifest.manifest_version) manifest.manifest_version = 3;
  
  // 添加short_name（Web Store推荐）
  if (!manifest.short_name) {
    manifest.short_name = "智流华写";
  }
  
  // 确保description不超过132字符（Web Store限制）
  if (manifest.description && manifest.description.length > 132) {
    manifest.description = "自动记录网页操作并生成文档的Chrome扩展";
  }
  
  // 检查并确保图标文件存在
  if (manifest.icons) {
    Object.entries(manifest.icons).forEach(([size, iconPath]) => {
      const fullIconPath = path.join(__dirname, buildDir, iconPath);
      if (!fs.existsSync(fullIconPath)) {
        console.warn(`⚠️  图标文件不存在: ${iconPath}`);
        // 如果图标不存在，从icons复制
        const srcIcon = path.join(__dirname, iconPath);
        if (fs.existsSync(srcIcon)) {
          const destDir = path.dirname(fullIconPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.copyFileSync(srcIcon, fullIconPath);
          console.log(`✅ 已修复图标: ${iconPath}`);
        }
      }
    });
  }
  
  // 写回修复后的manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ manifest.json 验证并修复完成');
  
  return manifest;
}

// 创建ZIP文件
function createZip() {
  return new Promise((resolve, reject) => {
    console.log('📦 创建Web Store上传ZIP文件...');
    
    const output = fs.createWriteStream(path.join(__dirname, outputFile));
    const archive = archiver('zip', {
      zlib: { level: 9 }, // 最大压缩
      forceLocalTime: true // 确保时间一致性
    });

    output.on('close', () => {
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✅ ZIP文件已生成: ${outputFile}`);
      console.log(`📊 文件大小: ${sizeInMB} MB`);
      
      // 检查文件大小（Web Store限制128MB）
      if (archive.pointer() > 128 * 1024 * 1024) {
        console.warn('⚠️  警告: 文件大小超过128MB，可能被Web Store拒绝');
      }
      
      resolve();
    });

    archive.on('error', (err) => {
      console.error('❌ ZIP创建失败:', err);
      reject(err);
    });

    output.on('error', (err) => {
      console.error('❌ 文件写入失败:', err);
      reject(err);
    });

    archive.pipe(output);

    // 添加构建目录中的所有文件，但排除隐藏文件
    archive.glob('**/*', {
      cwd: buildDir,
      ignore: ['.*', '**/.DS_Store', '**/Thumbs.db']
    });

    archive.finalize();
  });
}

// 清理构建目录
function cleanup() {
  console.log('🧹 清理临时文件...');
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
}

// 生成详细的上传指南
function generateDetailedGuide() {
  const instructions = `
# Chrome Web Store 详细上传解决方案

## 生成的文件
- 文件名: ${outputFile}
- 生成时间: ${new Date().toLocaleString()}
- 修复内容: manifest.json优化、文件结构检查、兼容性增强

## 解决"上传文件出问题"的步骤

### 1. 完成两步验证（必须）
1. 访问 https://myaccount.google.com/security
2. 点击"两步验证" → 开始设置
3. 选择验证方式：
   - 短信验证（推荐）
   - Google Authenticator应用
   - 安全密钥
4. 完成设置后返回Web Store

### 2. 确认开发者账号状态
1. 访问 https://chrome.google.com/webstore/devconsole
2. 检查账号状态：
   - ✅ 看到"Account"和"Add new item"按钮 = 账号已激活
   - ❌ 看到"Pay registration fee"按钮 = 需要重新支付
   - ⏳ 看到"Pending"状态 = 等待处理（最多48小时）

### 3. 上传新的ZIP文件
1. 在开发者控制台点击"Add new item"
2. **使用新生成的文件: ${outputFile}**
3. 上传完成后等待处理

### 4. 查看审核状态
上传成功后，在开发者控制台中：
1. 点击你的插件名称
2. 查看顶部状态栏：
   - **Draft（草稿）**: 未提交审核
   - **Pending review（审核中）**: 正在审核
   - **Published（已发布）**: 审核通过并发布
   - **Rejected（被拒）**: 审核未通过

### 5. 如果仍然上传失败
尝试以下解决方案：

#### 方案A: 清除浏览器缓存
1. 按 Ctrl+Shift+Delete (Windows) 或 Cmd+Shift+Delete (Mac)
2. 清除缓存和Cookie
3. 重新登录Web Store开发者控制台

#### 方案B: 使用无痕模式
1. 打开Chrome无痕窗口 (Ctrl+Shift+N)
2. 访问开发者控制台
3. 重新上传

#### 方案C: 检查网络连接
1. 确保网络稳定
2. 尝试使用不同的网络
3. 关闭VPN或代理

#### 方案D: 文件大小检查
- 当前ZIP大小: 应该小于128MB
- 如果过大，需要移除不必要的文件

## 审核时间说明
- **首次提交**: 通常3-7天
- **更新版本**: 通常1-3天
- **节假日期间**: 可能延长到14天

## 常见被拒原因
1. 权限过多或不必要
2. 描述与功能不符
3. 违反内容政策
4. 图标或截图不清晰
5. 隐私政策缺失（如果收集数据）

## 联系方式
如果持续遇到问题，可以：
1. 访问 Chrome Web Store 帮助中心
2. 在开发者论坛寻求帮助
3. 检查 Google 开发者支持页面

## 下一步
1. 先完成两步验证
2. 确认账号状态
3. 使用 ${outputFile} 重新上传
4. 耐心等待审核结果
`;

  fs.writeFileSync(path.join(__dirname, 'Chrome-Web-Store-详细解决方案.md'), instructions.trim());
  console.log('📋 已生成详细解决方案: Chrome-Web-Store-详细解决方案.md');
}

// 主函数
async function main() {
  try {
    copyFiles();
    const manifest = validateAndFixManifest();
    await createZip();
    cleanup();
    generateDetailedGuide();
    
    console.log('\n🎉 修复版本Web Store上传文件生成完成！');
    console.log(`📁 新的上传文件: ${outputFile}`);
    console.log('📖 请查看 Chrome-Web-Store-详细解决方案.md 了解详细步骤');
    
    console.log('\n🚨 重要提醒：');
    console.log('1. 必须先完成两步验证');
    console.log('2. 确认开发者账号已激活（不再显示"支付5美元"）');
    console.log(`3. 使用新生成的 ${outputFile} 文件上传`);
    console.log('4. 上传后在开发者控制台查看审核状态');
    
  } catch (error) {
    console.error('❌ 生成失败:', error);
    cleanup();
    process.exit(1);
  }
}

main();