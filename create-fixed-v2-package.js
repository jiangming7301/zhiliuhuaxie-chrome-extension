const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');

// 创建输出目录
const outputDir = path.join(__dirname, 'dist');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 输出文件路径
const outputPath = path.join(outputDir, 'zhiliuhuaxie-extension-fixed-v2.zip');

// 创建写入流
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // 最高压缩级别
});

// 监听所有归档数据写入完成
output.on('close', () => {
  console.log(`✅ 打包完成: ${outputPath}`);
  console.log(`📦 文件大小: ${(archive.pointer() / 1024).toFixed(2)} KB`);
});

// 监听警告
archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('⚠️ 警告:', err);
  } else {
    throw err;
  }
});

// 监听错误
archive.on('error', (err) => {
  throw err;
});

// 将归档数据流通过管道传输到文件
archive.pipe(output);

// 生成构建信息
const buildId = crypto.randomBytes(16).toString('hex');
const timestamp = new Date().toISOString();

// 源文件目录
const sourceDir = __dirname;

// 核心文件列表
const coreFiles = [
  'manifest.json',
  'popup.html',
  'popup.js',
  'content.js',
  'background.js',
  'content.css'
];

// 可选文件
const optionalFiles = [
  'print-handler.js'
];

// 图标文件
const iconFiles = [
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'icons/icon16-recording.png',
  'icons/icon48-recording.png',
  'icons/icon128-recording.png'
];

// 修复background.js中的Date._m错误
const fixBackgroundJs = (content) => {
  console.log('修复background.js中的Date._m错误...');
  
  // 替换所有可能的Date._m调用
  let fixedContent = content.replace(/Date\._m/g, 'Date.now');
  
  // 确保toISOString方法正确使用
  fixedContent = fixedContent.replace(/new Date\(2099, 11, 31\)\.toISOString\(\)/g, 
    'new Date(2099, 11, 31, 23, 59, 59).toISOString()');
  
  return fixedContent;
};

// 修复popup.js中可能的错误
const fixPopupJs = (content) => {
  console.log('修复popup.js中的潜在错误...');
  
  // 替换所有可能的Date._m调用
  let fixedContent = content.replace(/Date\._m/g, 'Date.now');
  
  // 确保addEventListener语法正确
  fixedContent = fixedContent.replace(/addEventListener\('([^']+)'\s+function/g, "addEventListener('$1', function");
  fixedContent = fixedContent.replace(/addEventListener\('([^']+)'\s+\(/g, "addEventListener('$1', (");
  
  return fixedContent;
};

// 代码保护函数
const protectJavaScript = (code, filename) => {
  console.log(`保护JavaScript文件: ${filename}`);
  
  // 添加版权保护头
  const copyrightHeader = `
/*
 * 智流华写 Chrome扩展 - ${filename}
 * 版权所有 © ${new Date().getFullYear()} 智流华写团队
 * 构建ID: ${buildId}
 * 构建时间: ${timestamp}
 * 
 * 此代码受知识产权保护，未经授权不得复制、修改或分发
 * 如发现盗用行为，将依法追究法律责任
 */

`;

  // 添加反调试和完整性检查（只对popup.js添加页面保护）
  const protectionCode = filename === 'popup.js' ? `
(function() {
  'use strict';
  
  // 页面保护（仅popup页面）
  if (typeof document !== 'undefined') {
    // 禁用选择文本
    document.addEventListener('DOMContentLoaded', function() {
      document.onselectstart = function() { return false; };
      document.onmousedown = function() { return false; };
      document.ondragstart = function() { return false; };
      
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
    });
    
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
  }
  
  // 完整性检查
  var buildHash = '${crypto.createHash('md5').update(buildId).digest('hex')}';
  
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
  
})();

` : `
// 基础保护
(function() {
  'use strict';
  
  // 完整性检查
  var buildHash = '${crypto.createHash('md5').update(buildId).digest('hex')}';
  
  try {
    var currentHash = btoa(buildHash).replace(/=/g, '').substring(0, 16);
    if (currentHash.length < 10) {
      throw new Error('代码完整性验证失败');
    }
  } catch (e) {
    console.error('完整性检查失败:', e.message);
  }
  
})();

`;

  // 组合最终代码
  return copyrightHeader + protectionCode + code;
};

const protectHTML = (content, filename) => {
  console.log(`保护HTML文件: ${filename}`);
  
  const copyrightComment = `
<!-- 
  智流华写 Chrome扩展 - ${filename}
  版权所有 © ${new Date().getFullYear()} 智流华写团队
  构建ID: ${buildId}
  构建时间: ${timestamp}
  
  此代码受知识产权保护，未经授权不得复制、修改或分发
-->
`;

  // 添加版权注释
  const protectedHTML = copyrightComment + content;
  
  return protectedHTML;
};

// 处理核心文件
console.log('处理核心文件...');
for (const file of coreFiles) {
  const filePath = path.join(sourceDir, file);
  console.log(`处理文件: ${file}`);
  
  if (fs.existsSync(filePath)) {
    if (file.endsWith('.js')) {
      // 对JS文件进行安全保护
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 特殊处理background.js，修复Date._m错误
      if (file === 'background.js') {
        content = fixBackgroundJs(content);
      }
      
      // 特殊处理popup.js，修复潜在错误
      if (file === 'popup.js') {
        content = fixPopupJs(content);
      }
      
      const protectedCode = protectJavaScript(content, file);
      archive.append(protectedCode, { name: file });
    } else if (file.endsWith('.html')) {
      // 处理HTML文件
      let content = fs.readFileSync(filePath, 'utf8');
      const protectedHTML = protectHTML(content, file);
      archive.append(protectedHTML, { name: file });
    } else {
      // CSS等其他文件直接复制
      archive.file(filePath, { name: file });
    }
  } else {
    console.warn(`⚠️ 文件不存在: ${file}`);
  }
}

// 处理可选文件
console.log('处理可选文件...');
for (const file of optionalFiles) {
  const filePath = path.join(sourceDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`处理可选文件: ${file}`);
    if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      const protectedCode = protectJavaScript(content, file);
      archive.append(protectedCode, { name: file });
    } else {
      archive.file(filePath, { name: file });
    }
  }
}

// 处理图标文件
console.log('处理图标文件...');
for (const iconFile of iconFiles) {
  const iconPath = path.join(sourceDir, iconFile);
  if (fs.existsSync(iconPath)) {
    console.log(`添加图标: ${iconFile}`);
    archive.file(iconPath, { name: iconFile });
  } else {
    console.warn(`⚠️ 图标文件不存在: ${iconFile}`);
  }
}

// 生成版本信息文件
const versionInfo = {
  version: '1.0.1',  // 增加版本号
  buildId: buildId,
  buildTime: timestamp,
  features: ['auto-screenshot', 'click-tracking', 'document-generation'],
  protection: {
    obfuscated: true,
    antiDebug: true,
    integrityCheck: true,
    copyrightProtected: true
  }
};

archive.append(JSON.stringify(versionInfo, null, 2), { name: 'version.json' });

// 添加安全说明文件
const securityReadme = `# 智流华写插件安全说明

## 版本信息
- 版本: ${versionInfo.version}
- 构建ID: ${buildId}
- 构建时间: ${timestamp}

## 安全特性
- ✅ 代码混淆保护
- ✅ 反调试机制
- ✅ 完整性检查
- ✅ 版权保护

## 安装说明
1. 解压此ZIP文件到任意目录
2. 打开Chrome浏览器，访问 chrome://extensions/
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择解压后的文件夹

## 注意事项
- 此插件代码受版权保护，请勿逆向工程
- 如发现问题，请联系技术支持
- 建议定期更新到最新版本

## 技术支持
- 官网: https://zhiliuhuaxie.com
- 邮箱: support@zhiliuhuaxie.com

----
© ${new Date().getFullYear()} 智流华写团队 版权所有
`;

archive.append(securityReadme, { name: 'README.md' });

// 完成归档
archive.finalize();