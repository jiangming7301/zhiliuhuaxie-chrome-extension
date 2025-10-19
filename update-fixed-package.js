const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log('🔄 更新 zhiliuhuaxie-extension-fixed 包...');

// 源文件路径
const sourceDir = './';
const targetDir = './zhiliuhuaxie-extension-fixed/';

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

try {
  // 1. 更新 manifest.json
  console.log('📝 更新 manifest.json...');
  const manifestContent = fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'manifest.json'), manifestContent);

  // 2. 更新popup.html
  console.log('📝 更新 popup.html...');
  let popupHtml = fs.readFileSync(path.join(sourceDir, 'popup.html'), 'utf8');
  // 确保引用的是清洁版本的脚本
  popupHtml = popupHtml.replace('popup.js', 'popup-clean.js');
  fs.writeFileSync(path.join(targetDir, 'popup.html'), popupHtml);

  // 3. 复制清洁版本的JavaScript文件
  console.log('📝 更新JavaScript文件...');
  
  // 复制popup-clean.js并重命名为popup.js
  const popupCleanContent = fs.readFileSync(path.join(sourceDir, 'popup-clean.js'), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'popup.js'), popupCleanContent);

  // 复制background-clean.js并重命名为background.js
  const backgroundCleanContent = fs.readFileSync(path.join(sourceDir, 'background-clean.js'), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'background.js'), backgroundCleanContent);

  // 复制content-clean.js并重命名为content.js
  const contentCleanContent = fs.readFileSync(path.join(sourceDir, 'content-clean.js'), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'content.js'), contentCleanContent);

  // 4. 复制其他必要文件
  console.log('📝 更新其他文件...');
  
  // 复制CSS文件
  const contentCss = fs.readFileSync(path.join(sourceDir, 'content.css'), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'content.css'), contentCss);

  // 复制print-handler.js
  const printHandler = fs.readFileSync(path.join(sourceDir, 'print-handler.js'), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'print-handler.js'), printHandler);

  // 5. 确保icons目录存在并复制图标
  const iconsTargetDir = path.join(targetDir, 'icons');
  if (!fs.existsSync(iconsTargetDir)) {
    fs.mkdirSync(iconsTargetDir, { recursive: true });
  }

  // 复制图标文件
  const iconsSourceDir = path.join(sourceDir, 'icons');
  if (fs.existsSync(iconsSourceDir)) {
    const iconFiles = fs.readdirSync(iconsSourceDir);
    iconFiles.forEach(file => {
      const sourcePath = path.join(iconsSourceDir, file);
      const targetPath = path.join(iconsTargetDir, file);
      fs.copyFileSync(sourcePath, targetPath);
    });
  }

  console.log('✅ 扩展文件更新完成！');

  // 6. 创建新的zip文件
  console.log('📦 创建新的zip包...');
  
  const output = fs.createWriteStream('./zhiliuhuaxie-extension-fixed-v2.zip');
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  output.on('close', function() {
    console.log(`✅ 新的zip包已创建: zhiliuhuaxie-extension-fixed-v2.zip (${archive.pointer()} bytes)`);
    console.log('🎉 修复版扩展包更新完成！');
    
    // 提供详细的文件清单
    console.log('\n📋 包含的文件:');
    console.log('  ✓ manifest.json (Manifest V3合规版本)');
    console.log('  ✓ popup.html (引用清洁脚本)');
    console.log('  ✓ popup.js (从popup-clean.js复制，无innerHTML)');
    console.log('  ✓ background.js (从background-clean.js复制，清洁版本)');
    console.log('  ✓ content.js (从content-clean.js复制，无违规代码)');
    console.log('  ✓ content.css (样式文件)');
    console.log('  ✓ print-handler.js (打印处理)');
    console.log('  ✓ icons/ (所有图标文件)');
    
    console.log('\n🚀 现在您可以将 zhiliuhuaxie-extension-fixed-v2.zip 提交到Chrome Web Store');
  });

  output.on('error', function(err) {
    console.error('❌ 创建zip文件时出错:', err);
  });

  archive.on('error', function(err) {
    console.error('❌ 压缩文件时出错:', err);
  });

  archive.pipe(output);

  // 添加所有文件到zip
  archive.directory(targetDir, false);
  archive.finalize();

} catch (error) {
  console.error('❌ 更新过程中出错:', error);
  process.exit(1);
}