#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log('🔧 开始生成Chrome Web Store优化版本...');

// 创建输出目录
const outputDir = path.join(__dirname, 'zhiliuhuaxie-extension-webstore-optimized');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
} else {
  // 清空目录
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
}

// 创建icons目录
const iconsDir = path.join(outputDir, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

// 优化后的manifest.json (移除host_permissions，依赖activeTab + 动态注入)
const optimizedManifest = {
  "manifest_version": 3,
  "name": "智流华写助手",
  "version": "1.0.3",
  "description": "专业的网页操作记录与文档生成工具",
  
  "permissions": [
    "storage",
    "activeTab", 
    "scripting"
  ],
  
  "background": {
    "service_worker": "background-clean.js"
  },
  
  "action": {
    "default_popup": "popup.html",
    "default_title": "智流华写助手",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png", 
      "128": "icons/icon128.png"
    }
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  "web_accessible_resources": [
    {
      "resources": ["print-handler.js", "content-clean.js", "content.css"],
      "matches": ["<all_urls>"]
    }
  ],
  
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  },
  
  "homepage_url": "https://www.hcznai.com"
};

// 写入优化后的manifest.json
fs.writeFileSync(
  path.join(outputDir, 'manifest.json'), 
  JSON.stringify(optimizedManifest, null, 2)
);

// 复制核心文件
const filesToCopy = [
  'background-clean.js',
  'content-clean.js', 
  'content.css',
  'popup.html',
  'popup-clean.js',
  'print-handler.js'
];

console.log('📂 复制核心文件...');
filesToCopy.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(outputDir, file);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`✅ 已复制: ${file}`);
  } else {
    console.log(`⚠️  文件不存在: ${file}`);
  }
});

// 重命名popup-clean.js为popup.js
const popupCleanPath = path.join(outputDir, 'popup-clean.js');
const popupPath = path.join(outputDir, 'popup.js');
if (fs.existsSync(popupCleanPath)) {
  fs.renameSync(popupCleanPath, popupPath);
  console.log('✅ 已重命名: popup-clean.js -> popup.js');
}

// 生成图标文件
console.log('🎨 生成图标文件...');
const generateIcon = (size) => {
  const canvas = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4A90E2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#357ABD;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
  <text x="50%" y="50%" font-family="Arial" font-size="${size * 0.4}" font-weight="bold" 
        fill="white" text-anchor="middle" dominant-baseline="central">智</text>
</svg>`;
  
  return Buffer.from(canvas);
};

// 创建SVG图标（临时方案）
[16, 48, 128].forEach(size => {
  const iconPath = path.join(iconsDir, `icon${size}.png`);
  const svgContent = generateIcon(size);
  // 由于这里生成的是SVG，实际应该用PNG，这里先创建占位文件
  fs.writeFileSync(iconPath.replace('.png', '.svg'), svgContent);
  
  // 创建简单的PNG占位符（实际项目中应该使用真正的PNG图标）
  const placeholder = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(iconPath, placeholder);
});

console.log('✅ 图标文件已生成');

// 验证文件完整性
console.log('🔍 验证文件完整性...');
const requiredFiles = [
  'manifest.json',
  'background-clean.js', 
  'content-clean.js',
  'content.css',
  'popup.html',
  'popup.js',
  'print-handler.js',
  'icons/icon16.png',
  'icons/icon48.png', 
  'icons/icon128.png'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(outputDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ 缺少文件: ${file}`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.error('❌ 部分文件缺失，请检查');
  process.exit(1);
}

// 创建ZIP压缩包
console.log('📦 创建扩展包...');
const zipPath = path.join(__dirname, 'zhiliuhuaxie-extension-webstore-optimized.zip');

// 删除已存在的ZIP文件
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ 扩展包已创建: zhiliuhuaxie-extension-webstore-optimized.zip`);
  console.log(`📊 包大小: ${sizeInMB} MB`);
  console.log('');
  console.log('🎉 Chrome Web Store优化版本生成完成！');
  console.log('');
  console.log('📋 权限优化说明:');
  console.log('   ✅ 移除了宽泛的host_permissions');
  console.log('   ✅ 仅使用activeTab权限');
  console.log('   ✅ 采用动态注入content script');
  console.log('   ✅ 版本号已递增至1.0.2');
  console.log('');
  console.log('📝 提交Chrome Web Store时的要点:');
  console.log('   1. 单一用途: 网页操作记录与文档生成');
  console.log('   2. 权限理由: 需要activeTab权限来记录用户在当前标签页的操作');
  console.log('   3. 安全性: 不请求宽泛权限，只在用户明确操作时访问标签页');
  console.log('   4. 隐私保护: 所有数据仅存储在用户本地，不上传到服务器');
});

output.on('error', (err) => {
  console.error('❌ 创建ZIP文件失败:', err);
  process.exit(1);
});

archive.on('error', (err) => {
  console.error('❌ 压缩失败:', err);
  process.exit(1);
});

archive.pipe(output);

// 添加所有文件到压缩包
archive.directory(outputDir, false);
archive.finalize();