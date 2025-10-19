const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 配置
const buildDir = 'build-webstore';
const outputFile = 'zhiliuhuaxie-extension-webstore.zip';

// 需要包含的文件列表（Chrome Web Store专用）
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

console.log('🏪 开始生成Chrome Web Store上传包...');

// 创建构建目录
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// 清理之前的构建
function cleanBuild() {
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
    fs.mkdirSync(buildDir, { recursive: true });
  }
}

// 复制文件到构建目录
function copyFiles() {
  console.log('📁 复制插件文件...');
  
  filesToInclude.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(__dirname, buildDir, file);
    
    if (fs.existsSync(srcPath)) {
      if (fs.statSync(srcPath).isDirectory()) {
        // 复制目录
        copyDirectory(srcPath, destPath);
      } else {
        // 复制文件
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

// 验证manifest.json
function validateManifest() {
  console.log('🔍 验证manifest.json...');
  const manifestPath = path.join(__dirname, buildDir, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json 文件不存在');
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // 基本验证
  const requiredFields = ['manifest_version', 'name', 'version'];
  requiredFields.forEach(field => {
    if (!manifest[field]) {
      throw new Error(`manifest.json 缺少必需字段: ${field}`);
    }
  });
  
  // 检查manifest版本
  if (manifest.manifest_version !== 3) {
    console.warn('⚠️  注意：当前使用Manifest V3');
  }
  
  // 检查图标文件是否存在
  if (manifest.icons) {
    Object.values(manifest.icons).forEach(iconPath => {
      const fullIconPath = path.join(__dirname, buildDir, iconPath);
      if (!fs.existsSync(fullIconPath)) {
        console.warn(`⚠️  图标文件不存在: ${iconPath}`);
      }
    });
  }
  
  console.log('✅ manifest.json 验证通过');
  return manifest;
}

// 创建Web Store上传用的ZIP文件
function createWebStoreZip() {
  return new Promise((resolve, reject) => {
    console.log('📦 打包扩展为Web Store上传文件...');
    
    const output = fs.createWriteStream(path.join(__dirname, outputFile));
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最大压缩级别
    });

    output.on('close', () => {
      console.log(`✅ Web Store上传文件已生成: ${outputFile}`);
      console.log(`📊 文件大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error('❌ 打包失败:', err);
      reject(err);
    });

    archive.pipe(output);

    // 添加构建目录中的所有文件
    archive.directory(buildDir, false);

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

// 生成上传指南
function generateUploadGuide() {
  const instructions = `
# Chrome Web Store 上传指南

## 文件信息
- 插件名称: 智流华写助手 (专业版)
- 上传文件: ${outputFile}
- 生成时间: ${new Date().toLocaleString()}
- Manifest版本: V3

## Chrome Web Store 上传步骤

### 1. 准备开发者账号
- 访问 Chrome Web Store 开发者控制台：https://chrome.google.com/webstore/developer/dashboard
- 如果没有开发者账号，需要注册并支付5美元注册费

### 2. 上传插件
1. 登录开发者控制台
2. 点击"添加新项"或"New item"
3. **重要：上传 ${outputFile} 文件（ZIP格式，不是CRX）**
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
1. 解压 ${outputFile} 到文件夹
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
`;

  fs.writeFileSync(path.join(__dirname, 'Chrome-Web-Store-上传指南.md'), instructions.trim());
  console.log('📋 已生成上传指南文档: Chrome-Web-Store-上传指南.md');
}

// 主函数
async function main() {
  try {
    cleanBuild();
    copyFiles();
    const manifest = validateManifest();
    await createWebStoreZip();
    cleanup();
    generateUploadGuide();
    
    console.log('\n🎉 Chrome Web Store上传文件生成完成！');
    console.log(`📁 上传文件: ${outputFile}`);
    console.log('📖 请查看 Chrome-Web-Store-上传指南.md 了解详细上传步骤');
    console.log('\n🚨 重要提醒：');
    console.log('- Chrome Web Store 只接受 ZIP 文件，不接受 CRX 文件');
    console.log('- 请使用生成的 ZIP 文件进行上传');
    console.log('- 首次发布需要通过审核流程');
    
  } catch (error) {
    console.error('❌ 生成失败:', error);
    cleanup();
    process.exit(1);
  }
}

main();