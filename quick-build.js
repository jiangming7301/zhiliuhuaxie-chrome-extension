const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 简化版构建脚本 - 无需额外依赖
class QuickBuilder {
  constructor() {
    this.sourceFiles = [
      'manifest.json',
      'popup.html',
      'popup.js', 
      'content.js',
      'background.js',
      'content.css',
      'print-handler.js'
    ];
    
    this.iconFiles = [
      'icons/icon16.png',
      'icons/icon48.png',
      'icons/icon128.png'
    ];
    
    this.outputDir = 'quick-build';
  }

  // 简单的代码混淆
  simpleObfuscate(code) {
    // 移除注释和多余空白
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '') // 移除块注释
      .replace(/\/\/.*$/gm, '') // 移除行注释
      .replace(/\s+/g, ' ') // 压缩空白
      .replace(/;\s*}/g, '}') // 优化分号
      .trim();
  }

  // 添加基础保护
  addBasicProtection(code, filename) {
    const protectionCode = `
// Protected Build - ${new Date().toISOString()}
(function() {
  'use strict';
  
  // 基础反调试
  var devtools = false;
  setInterval(function() {
    if (window.outerHeight - window.innerHeight > 160) {
      devtools = true;
      console.clear();
    }
  }, 1000);
  
  // 禁用右键
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  
  ${code}
})();`;
    
    return this.simpleObfuscate(protectionCode);
  }

  // 创建受保护的manifest
  createProtectedManifest() {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    
    // 添加版本标识
    manifest.description = (manifest.description || '') + ' (Protected)';
    manifest.version = manifest.version || '1.0.0';
    
    // 确保必要权限
    if (!manifest.permissions) manifest.permissions = [];
    if (!manifest.permissions.includes('storage')) {
      manifest.permissions.push('storage');
    }
    if (!manifest.permissions.includes('activeTab')) {
      manifest.permissions.push('activeTab');
    }
    
    return JSON.stringify(manifest, null, 2);
  }

  // 构建
  build() {
    console.log('🚀 开始快速构建...');
    
    // 创建输出目录
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true });
    }
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(path.join(this.outputDir, 'icons'), { recursive: true });
    
    // 处理manifest.json
    console.log('📝 处理manifest.json...');
    const protectedManifest = this.createProtectedManifest();
    fs.writeFileSync(path.join(this.outputDir, 'manifest.json'), protectedManifest);
    
    // 处理源文件
    for (const file of this.sourceFiles) {
      if (!fs.existsSync(file) || file === 'manifest.json') continue;
      
      console.log(`📄 处理 ${file}...`);
      
      if (file.endsWith('.js')) {
        // JavaScript文件添加保护
        const sourceCode = fs.readFileSync(file, 'utf8');
        const protectedCode = this.addBasicProtection(sourceCode, file);
        fs.writeFileSync(path.join(this.outputDir, file), protectedCode);
      } else {
        // 其他文件直接复制
        fs.copyFileSync(file, path.join(this.outputDir, file));
      }
    }
    
    // 复制图标
    console.log('🎨 复制图标文件...');
    for (const iconFile of this.iconFiles) {
      if (fs.existsSync(iconFile)) {
        fs.copyFileSync(iconFile, path.join(this.outputDir, iconFile));
      }
    }
    
    // 创建安装说明
    const readme = `
# 智流华写 Chrome扩展

## 安装步骤

1. 打开Chrome浏览器
2. 地址栏输入: chrome://extensions/
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择此文件夹

## 使用说明

- 点击扩展图标打开控制面板
- 点击"开始记录"开始截图记录
- 在网页上进行操作，插件会自动截图
- 点击"停止记录"结束录制
- 点击"导出文档"生成PDF文档

## 注意事项

- 免费版限制20张截图
- 专业版无限制使用
- 如有问题请联系技术支持

构建时间: ${new Date().toLocaleString()}
    `;
    
    fs.writeFileSync(path.join(this.outputDir, 'README.md'), readme.trim());
    
    console.log('✅ 快速构建完成！');
    console.log(`📁 输出目录: ${path.resolve(this.outputDir)}`);
    
    return true;
  }

  // 创建ZIP包（如果系统支持）
  createZip() {
    try {
      console.log('📦 创建ZIP包...');
      
      const zipName = 'zhiliuhuaxie-extension-quick.zip';
      const zipPath = path.join(this.outputDir, '..', zipName);
      
      // 尝试使用系统命令创建ZIP
      if (process.platform === 'win32') {
        // Windows PowerShell
        execSync(`powershell Compress-Archive -Path "${this.outputDir}\\*" -DestinationPath "${zipPath}" -Force`, { stdio: 'inherit' });
      } else {
        // macOS/Linux
        execSync(`cd "${this.outputDir}" && zip -r "../${zipName}" .`, { stdio: 'inherit' });
      }
      
      console.log(`✅ ZIP包已创建: ${zipName}`);
      return true;
      
    } catch (error) {
      console.warn('⚠️  ZIP创建失败，但文件夹构建成功:', error.message);
      console.log('💡 你可以手动压缩 quick-build 文件夹');
      return false;
    }
  }
}

// 主函数
function main() {
  console.log('⚡ 智流华写扩展快速构建工具');
  console.log('=====================================\n');
  
  const builder = new QuickBuilder();
  
  try {
    const success = builder.build();
    
    if (success) {
      // 尝试创建ZIP包
      builder.createZip();
      
      console.log('\n🎉 快速构建完成！');
      console.log('\n📋 构建摘要:');
      console.log('- ✅ 基础代码保护');
      console.log('- ✅ 反调试机制');
      console.log('- ✅ 文件压缩优化');
      console.log('- ✅ 安装说明文档');
      
      console.log('\n📁 输出文件:');
      console.log(`   ${path.resolve(builder.outputDir)}/`);
      
      console.log('\n📖 安装步骤:');
      console.log('1. 打开Chrome浏览器');
      console.log('2. 访问 chrome://extensions/');
      console.log('3. 开启"开发者模式"');
      console.log('4. 点击"加载已解压的扩展程序"');
      console.log('5. 选择 quick-build 文件夹');
      
    } else {
      console.log('\n❌ 构建失败');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 构建异常:', error.message);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = QuickBuilder;
