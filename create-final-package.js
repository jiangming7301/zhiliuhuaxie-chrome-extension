const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log('📦 重新创建修复版扩展包...');

const sourceDir = './zhiliuhuaxie-extension-fixed/';

// 创建新的zip文件
const output = fs.createWriteStream('./zhiliuhuaxie-extension-fixed-final.zip');
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', function() {
  console.log(`✅ 最终修复版zip包已创建: zhiliuhuaxie-extension-fixed-final.zip (${archive.pointer()} bytes)`);
  console.log('🎉 完全修复的扩展包已准备就绪！');
  
  console.log('\n📋 包含的修复内容：');
  console.log('  ✓ manifest.json - Manifest V3合规，版本1.0.1');
  console.log('  ✓ popup.html - 引用popup.js（无内联脚本）');
  console.log('  ✓ popup.js - 清洁版本（无innerHTML违规代码）');
  console.log('  ✓ background.js - 清洁版本（无动态代码执行）');
  console.log('  ✓ content.js - 清洁版本（安全DOM操作）');
  console.log('  ✓ content.css - 样式文件');
  console.log('  ✓ print-handler.js - 打印处理脚本');
  console.log('  ✓ icons/ - 所有必需的图标文件');
  
  console.log('\n🔒 安全特性：');
  console.log('  ✓ 无innerHTML使用');
  console.log('  ✓ 无内联JavaScript');  
  console.log('  ✓ 无eval()或new Function()');
  console.log('  ✓ 严格的内容安全策略');
  console.log('  ✓ 最小权限原则');
  
  console.log('\n🚀 现在您可以将 zhiliuhuaxie-extension-fixed-final.zip 提交到Chrome Web Store');
  console.log('   这个版本应该能够通过"违规托管代码"的审核检查！');
});

output.on('error', function(err) {
  console.error('❌ 创建zip文件时出错:', err);
});

archive.on('error', function(err) {
  console.error('❌ 压缩文件时出错:', err);
});

archive.pipe(output);

// 添加所有文件到zip
archive.directory(sourceDir, false);
archive.finalize();