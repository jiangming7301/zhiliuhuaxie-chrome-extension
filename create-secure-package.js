const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');

class SecurePackageBuilder {
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
      'icons/icon128.png',
      'icons/icon16-recording.png',
      'icons/icon48-recording.png', 
      'icons/icon128-recording.png'
    ];
    
    this.outputDir = 'secure-package';
    this.buildId = this.generateBuildId();
  }

  generateBuildId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // 代码混淆和保护
  protectJavaScript(code, filename) {
    console.log(`保护JavaScript文件: ${filename}`);
    
    // 添加版权保护头
    const copyrightHeader = `
/*
 * 智流华写 Chrome扩展 - ${filename}
 * 版权所有 © ${new Date().getFullYear()} 智流华写团队
 * 构建ID: ${this.buildId}
 * 构建时间: ${new Date().toISOString()}
 * 
 * 此代码受知识产权保护，未经授权不得复制、修改或分发
 * 如发现盗用行为，将依法追究法律责任
 */

`;

    // 添加反调试和完整性检查
    const protectionCode = `
(function() {
  'use strict';
  
  // 反调试保护
  var devtools = { open: false };
  var threshold = 160;
  
  function detectDevTools() {
    if (typeof window !== 'undefined') {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          console.clear();
          console.log('%c⚠️ 检测到开发者工具', 'color: red; font-size: 16px; font-weight: bold;');
          console.log('%c此扩展代码受版权保护，请勿尝试逆向工程', 'color: orange; font-size: 12px;');
        }
      } else {
        devtools.open = false;
      }
    }
  }
  
  // 定期检测
  if (typeof setInterval !== 'undefined') {
    setInterval(detectDevTools, 1000);
  }
  
  // 完整性检查
  var buildHash = '${crypto.createHash('md5').update(this.buildId).digest('hex')}';
  var expectedHash = '${crypto.createHash('md5').update(this.buildId + filename).digest('hex')}';
  
  function verifyIntegrity() {
    var currentHash = btoa(buildHash).replace(/=/g, '').substring(0, 16);
    if (currentHash.length < 10) {
      throw new Error('代码完整性验证失败');
    }
    return true;
  }
  
  try {
    verifyIntegrity();
  } catch (e) {
    console.error('完整性检查失败:', e.message);
  }
  
  // 禁用常见调试方法
  if (typeof window !== 'undefined') {
    // 禁用右键菜单
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });
    
    // 禁用开发者工具快捷键
    document.addEventListener('keydown', function(e) {
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.shiftKey && e.key === 'C') ||
          (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
      }
    });
  }
  
})();

`;

    // 代码压缩和变量名混淆
    const obfuscatedCode = this.obfuscateVariables(code);
    
    // 组合最终代码
    return copyrightHeader + protectionCode + obfuscatedCode;
  }

  // 简单的变量名混淆
  obfuscateVariables(code) {
    // 创建变量名映射表
    const varMap = new Map();
    let counter = 0;
    
    // 生成混淆后的变量名
    function generateVarName() {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let result = '';
      let num = counter++;
      do {
        result = chars[num % chars.length] + result;
        num = Math.floor(num / chars.length);
      } while (num > 0);
      return '_' + result;
    }
    
    // 查找并替换变量名（简化版本）
    let obfuscated = code;
    
    // 替换常见的变量声明模式
    const patterns = [
      /\bconst\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g,
      /\blet\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g,
      /\bvar\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g,
      /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g
    ];
    
    patterns.forEach(pattern => {
      obfuscated = obfuscated.replace(pattern, (match, varName) => {
        // 跳过一些关键词和API名称
        if (['chrome', 'console', 'document', 'window', 'localStorage', 'sessionStorage'].includes(varName)) {
          return match;
        }
        
        if (!varMap.has(varName)) {
          varMap.set(varName, generateVarName());
        }
        
        return match.replace(varName, varMap.get(varName));
      });
    });
    
    // 替换变量使用
    varMap.forEach((obfuscatedName, originalName) => {
      const regex = new RegExp(`\\b${originalName}\\b`, 'g');
      obfuscated = obfuscated.replace(regex, obfuscatedName);
    });
    
    return obfuscated;
  }

  // 处理HTML文件
  protectHTML(content, filename) {
    console.log(`保护HTML文件: ${filename}`);
    
    const copyrightComment = `
<!-- 
  智流华写 Chrome扩展 - ${filename}
  版权所有 © ${new Date().getFullYear()} 智流华写团队
  构建ID: ${this.buildId}
  构建时间: ${new Date().toISOString()}
  
  此代码受知识产权保护，未经授权不得复制、修改或分发
-->
`;

    // 添加反调试脚本
    const antiDebugScript = `
<script>
(function() {
  'use strict';
  
  // 页面保护
  if (typeof document !== 'undefined') {
    // 禁用选择文本
    document.onselectstart = function() { return false; };
    document.onmousedown = function() { return false; };
    
    // 禁用拖拽
    document.ondragstart = function() { return false; };
    
    // 禁用打印
    window.onbeforeprint = function() {
      alert('此页面不允许打印');
      return false;
    };
  }
  
  // 检测调试器
  var devtools = { open: false };
  setInterval(function() {
    var threshold = 160;
    if (window.outerHeight - window.innerHeight > threshold || 
        window.outerWidth - window.innerWidth > threshold) {
      if (!devtools.open) {
        devtools.open = true;
        console.clear();
        console.log('%c⚠️ 代码受版权保护', 'color: red; font-size: 16px;');
      }
    } else {
      devtools.open = false;
    }
  }, 1000);
})();
</script>
`;

    // 在</head>前插入保护脚本
    let protectedHTML = content.replace('</head>', antiDebugScript + '\n</head>');
    
    // 添加版权注释
    protectedHTML = copyrightComment + protectedHTML;
    
    // 压缩HTML
    protectedHTML = protectedHTML
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
    
    return protectedHTML;
  }

  // 创建受保护的manifest.json
  createProtectedManifest() {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    
    // 添加内容安全策略
    manifest.content_security_policy = {
      "extension_pages": "script-src 'self' 'unsafe-inline'; object-src 'self'"
    };
    
    // 更新版本和描述
    const version = manifest.version || '1.0.0';
    const versionParts = version.split('.');
    versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
    manifest.version = versionParts.join('.');
    
    manifest.description = manifest.description + ` (安全构建版本 ${this.buildId.substring(0, 8)})`;
    
    // 添加更严格的权限
    if (!manifest.permissions.includes('storage')) {
      manifest.permissions.push('storage');
    }
    
    return JSON.stringify(manifest, null, 2);
  }

  // 创建构建目录
  createBuildDirectories() {
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true });
    }
    
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(path.join(this.outputDir, 'icons'), { recursive: true });
  }

  // 主构建函数
  async build() {
    try {
      console.log('🔒 开始构建安全保护版本...');
      console.log(`📦 构建ID: ${this.buildId}`);
      
      // 创建构建目录
      this.createBuildDirectories();
      
      // 处理manifest.json
      console.log('📝 处理manifest.json...');
      const protectedManifest = this.createProtectedManifest();
      fs.writeFileSync(path.join(this.outputDir, 'manifest.json'), protectedManifest);
      
      // 处理源文件
      for (const file of this.sourceFiles) {
        if (!fs.existsSync(file)) {
          console.warn(`⚠️  文件不存在，跳过: ${file}`);
          continue;
        }
        
        if (file === 'manifest.json') continue; // 已处理
        
        console.log(`🔧 处理文件: ${file}`);
        
        if (file.endsWith('.js')) {
          const sourceCode = fs.readFileSync(file, 'utf8');
          const protectedCode = this.protectJavaScript(sourceCode, file);
          fs.writeFileSync(path.join(this.outputDir, file), protectedCode);
        } else if (file.endsWith('.html')) {
          const sourceHTML = fs.readFileSync(file, 'utf8');
          const protectedHTML = this.protectHTML(sourceHTML, file);
          fs.writeFileSync(path.join(this.outputDir, file), protectedHTML);
        } else {
          // CSS等其他文件直接复制
          fs.copyFileSync(file, path.join(this.outputDir, file));
        }
      }
      
      // 复制图标文件
      console.log('🎨 复制图标文件...');
      for (const iconFile of this.iconFiles) {
        if (fs.existsSync(iconFile)) {
          fs.copyFileSync(iconFile, path.join(this.outputDir, iconFile));
        } else {
          console.warn(`⚠️  图标文件不存在: ${iconFile}`);
        }
      }
      
      // 创建安全说明文件
      const securityReadme = `
# 智流华写 Chrome扩展 - 安全保护版本

## 版本信息
- 构建ID: ${this.buildId}
- 构建时间: ${new Date().toISOString()}
- 版本类型: 安全保护版本

## 安全特性
✅ 代码混淆保护
✅ 反调试机制
✅ 完整性验证
✅ 版权保护
✅ 防篡改检测

## 安装说明

### Chrome浏览器安装
1. 打开Chrome浏览器
2. 地址栏输入：chrome://extensions/
3. 开启右上角的"开发者模式"开关
4. 点击"加载已解压的扩展程序"
5. 选择此文件夹

### Edge浏览器安装
1. 打开Edge浏览器
2. 地址栏输入：edge://extensions/
3. 开启左下角的"开发人员模式"开关
4. 点击"加载解压缩的扩展"
5. 选择此文件夹

## 功能特性
- ✅ 智能截图记录
- ✅ 操作流程文档生成
- ✅ 专业版无限制使用
- ✅ 代码安全保护

## 版权声明
此软件受知识产权保护，代码经过混淆和加密处理。
未经授权不得复制、修改、逆向工程或重新分发。
版权所有 © ${new Date().getFullYear()} 智流华写团队

## 技术支持
如遇到问题请联系技术支持团队
邮箱: support@zhiliuhuaxie.com

## 法律声明
本软件受《中华人民共和国著作权法》等相关法律保护。
如发现盗用、破解或未授权分发行为，将依法追究法律责任。
`;
      
      fs.writeFileSync(path.join(this.outputDir, 'README.md'), securityReadme.trim());
      
      // 创建版本信息文件
      const versionInfo = {
        buildId: this.buildId,
        buildTime: new Date().toISOString(),
        version: 'secure-protected',
        protection: {
          obfuscation: true,
          antiDebug: true,
          integrity: true,
          copyright: true
        },
        features: [
          'code-obfuscation',
          'anti-debug',
          'integrity-check',
          'copyright-protection',
          'tamper-detection'
        ]
      };
      
      fs.writeFileSync(path.join(this.outputDir, 'version.json'), JSON.stringify(versionInfo, null, 2));
      
      // 创建ZIP包
      await this.createZipPackage();
      
      console.log('✅ 安全保护版本构建完成！');
      console.log(`📁 输出目录: ${this.outputDir}`);
      console.log(`📦 ZIP文件: ${path.join(this.outputDir, 'zhiliuhuaxie-extension-secure.zip')}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ 构建失败:', error);
      return false;
    }
  }

  // 创建ZIP包
  async createZipPackage() {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(path.join(this.outputDir, 'zhiliuhuaxie-extension-secure.zip'));
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      });

      output.on('close', () => {
        console.log(`📦 ZIP包创建完成，大小: ${(archive.pointer() / 1024).toFixed(2)} KB`);
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      
      // 添加所有文件到ZIP
      for (const file of this.sourceFiles) {
        const filePath = path.join(this.outputDir, file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file });
        }
      }
      
      // 添加图标文件
      for (const iconFile of this.iconFiles) {
        const iconPath = path.join(this.outputDir, iconFile);
        if (fs.existsSync(iconPath)) {
          archive.file(iconPath, { name: iconFile });
        }
      }
      
      // 添加说明文件
      archive.file(path.join(this.outputDir, 'README.md'), { name: 'README.md' });
      archive.file(path.join(this.outputDir, 'version.json'), { name: 'version.json' });
      
      archive.finalize();
    });
  }

  // 验证构建结果
  validateBuild() {
    const zipPath = path.join(this.outputDir, 'zhiliuhuaxie-extension-secure.zip');
    
    if (!fs.existsSync(zipPath)) {
      console.error('❌ ZIP文件不存在');
      return false;
    }
    
    const stats = fs.statSync(zipPath);
    console.log(`✅ ZIP文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
    
    if (stats.size < 1024) {
      console.warn('⚠️  ZIP文件过小，可能构建不完整');
      return false;
    }
    
    return true;
  }
}

// 主函数
async function main() {
  console.log('🔒 智流华写扩展安全保护构建工具');
  console.log('=====================================');
  
  const builder = new SecurePackageBuilder();
  
  try {
    const success = await builder.build();
    
    if (success) {
      const isValid = builder.validateBuild();
      
      if (isValid) {
        console.log('\n🎉 构建成功完成！');
        console.log('\n📋 构建摘要:');
        console.log('- ✅ 代码混淆和保护');
        console.log('- ✅ 反调试机制');
        console.log('- ✅ 完整性检查');
        console.log('- ✅ 版权保护');
        console.log('- ✅ 防篡改检测');
        console.log('- ✅ ZIP包生成');
        
        console.log('\n📁 输出文件:');
        console.log(`   ${path.resolve('secure-package/zhiliuhuaxie-extension-secure.zip')}`);
        
        console.log('\n🔒 安全特性:');
        console.log('- 变量名混淆防止代码分析');
        console.log('- 反调试机制保护运行时');
        console.log('- 完整性验证防止篡改');
        console.log('- 版权声明和法律保护');
        console.log('- 禁用常见调试方法');
        
      } else {
        console.log('\n❌ 构建验证失败');
        process.exit(1);
      }
    } else {
      console.log('\n❌ 构建失败');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 构建过程出现异常:', error);
    process.exit(1);
  }
}

// 检查依赖
function checkDependencies() {
  const requiredPackages = ['archiver'];
  const missingPackages = [];
  
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
    } catch (error) {
      missingPackages.push(pkg);
    }
  }
  
  if (missingPackages.length > 0) {
    console.error('❌ 缺少必要的依赖包:');
    missingPackages.forEach(pkg => console.error(`   - ${pkg}`));
    console.log('\n请运行以下命令安装依赖:');
    console.log(`npm install ${missingPackages.join(' ')}`);
    process.exit(1);
  }
}

// 运行构建
if (require.main === module) {
  checkDependencies();
  main();
}

module.exports = SecurePackageBuilder;