const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 创建一个写入流，用于保存ZIP文件
const output = fs.createWriteStream(path.join(__dirname, 'zhiliuhuaxie-extension-fixed.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // 设置压缩级别
});

// 监听所有归档数据写入完成
output.on('close', function() {
  console.log('✅ 修复版插件打包完成!');
  console.log(`📦 文件大小: ${(archive.pointer() / 1024).toFixed(2)} KB`);
  console.log(`📂 保存位置: ${path.join(__dirname, 'zhiliuhuaxie-extension-fixed.zip')}`);
});

// 监听警告
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn('⚠️ 警告:', err);
  } else {
    throw err;
  }
});

// 监听错误
archive.on('error', function(err) {
  throw err;
});

// 将归档数据通过管道传输到文件
archive.pipe(output);

// 添加核心文件
console.log('📄 添加核心文件...');

// 使用修复版的popup.js
fs.copyFileSync('popup-fixed.js', 'popup.js.bak');
fs.copyFileSync('popup-fixed.js', 'popup.js');

// 添加manifest.json
archive.file('manifest.json', { name: 'manifest.json' });

// 添加HTML文件
archive.file('popup.html', { name: 'popup.html' });

// 添加JS文件
archive.file('popup.js', { name: 'popup.js' });
archive.file('content.js', { name: 'content.js' });
archive.file('background.js', { name: 'background.js' });

// 添加CSS文件
archive.file('content.css', { name: 'content.css' });

// 添加可选文件
if (fs.existsSync('print-handler.js')) {
  archive.file('print-handler.js', { name: 'print-handler.js' });
}

// 添加图标文件
console.log('🖼️ 添加图标文件...');
const iconFiles = [
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'icons/icon16-recording.png',
  'icons/icon48-recording.png',
  'icons/icon128-recording.png'
];

iconFiles.forEach(iconFile => {
  if (fs.existsSync(iconFile)) {
    archive.file(iconFile, { name: iconFile });
  }
});

// 添加README文件
archive.append('# 智流华写助手 (专业版) - 修复版\n\n此版本修复了初始化问题，解决了"加载中"状态无法消除和按钮无响应的问题。\n\n安装方法：\n1. 解压此ZIP文件\n2. 打开Chrome浏览器，访问 chrome://extensions/\n3. 开启右上角的"开发者模式"\n4. 点击"加载已解压的扩展程序"\n5. 选择解压后的文件夹\n\n版本：1.0.1 (修复版)\n日期：' + new Date().toISOString().split('T')[0], { name: 'README.md' });

// 完成归档
archive.finalize();

// 恢复原始popup.js
process.on('exit', () => {
  if (fs.existsSync('popup.js.bak')) {
    fs.copyFileSync('popup.js.bak', 'popup.js');
    fs.unlinkSync('popup.js.bak');
    console.log('🔄 已恢复原始popup.js文件');
  }
});

console.log('⏳ 正在打包修复版插件...');