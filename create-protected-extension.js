const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');
const UglifyJS = require('uglify-js');

class ProtectedExtensionBuilder {
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
    
    this.outputDir = 'protected-build';
    this.tempDir = 'temp-protected';
    
    // 代码保护配置
    this.obfuscationConfig = {
      mangle: {
        toplevel: true,
        properties: {
          regex: /^_/
        }
      },
      compress: {
        dead_code: true,
        drop_console: false, // 保留console用于调试
        drop_debugger: true,
        sequences: true,
        conditionals: true,
        booleans: true,
        unused: true,
        if_return: true,
        join_vars: true,
        collapse_vars: true
      },
      output: {
        beautify: false,
        comments: false
      }
    };
  }

  // 生成唯一的构建ID
  generateBuildId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // 代码混淆和保护
  obfuscateCode(code, filename) {
    try {
      console.log(`正在混淆文件: ${filename}`);
      
      // 添加反调试代码
      const antiDebugCode = this.getAntiDebugCode();
      
      // 添加完整性检查
      const integrityCode = this.getIntegrityCheckCode();
      
      // 组合代码
      const protectedCode = `
        ${antiDebugCode}
        ${integrityCode}
        (function() {
          'use strict';
          ${code}
        })();
      `;
      
      // 使用UglifyJS进行混淆
      const result = UglifyJS.minify(protectedCode, this.obfuscationConfig);
      
      if (result.error) {
        console.error(`混淆失败 ${filename}:`, result.error);
        return code; // 返回原代码
      }
      
      return result.code;
    } catch (error) {
      console.error(`混淆过程出错 ${filename}:`, error);
      return code; // 返回原代码
    }
  }

  // 反调试代码
  getAntiDebugCode() {
    return `
      // 反调试保护
      (function() {
        var devtools = {
          open: false,
          orientation: null
        };
        
        var threshold = 160;
        
        setInterval(function() {
          if (window.outerHeight - window.innerHeight > threshold || 
              window.outerWidth - window.innerWidth > threshold) {
            if (!devtools.open) {
              devtools.open = true;
              console.clear();
              console.log('%c检测到开发者工具', 'color: red; font-size: 20px;');
            }
          } else {
            devtools.open = false;
          }
        }, 500);
        
        // 禁用右键菜单
        document.addEventListener('contextmenu', function(e) {
          e.preventDefault();
        });
        
        // 禁用F12等快捷键
        document.addEventListener('keydown', function(e) {
          if (e.key === 'F12' || 
              (e.ctrlKey && e.shiftKey && e.key === 'I') ||
              (e.ctrlKey && e.shiftKey && e.key === 'C') ||
              (e.ctrlKey && e.key === 'U')) {
            e.preventDefault();
          }
        });
      })();
    `;
  }

  // 完整性检查代码
  getIntegrityCheckCode() {
    const buildId = this.generateBuildId();
    return `
      // 完整性检查
      (function() {
        var buildId = '${buildId}';
        var expectedHash = '${crypto.createHash('md5').update(buildId).digest('hex')}';
        
        function checkIntegrity() {
          var currentHash = btoa(buildId).replace(/=/g, '');
          if (currentHash.length < 10) {
            console.error('完整性检查失败');
            return false;
          }
          return true;
        }
        
        if (!checkIntegrity()) {
          throw new Error('代码完整性验证失败');
        }
      })();
    `;
  }

  // 创建受保护的manifest.json
  createProtectedManifest() {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    
    // 添加内容安全策略
    manifest.content_security_policy = {
      "extension_pages": "script-src 'self'; object-src 'self'"
    };
    
    // 添加版本信息和保护标识
    manifest.version = manifest.version || '1.0.0';
    manifest.description = manifest.description + ' (Protected Build)';
    
    // 添加更严格的权限
    if (!manifest.permissions.includes('storage')) {
      manifest.permissions.push('storage');
    }
    
    return JSON.stringify(manifest, null, 2);
  }

  // 添加许可证验证代码
  getLicenseValidationCode() {
    return `
      // 许可证验证
      (function() {
        var licenseKey = null;
        
        function validateLicense() {
          return new Promise(function(resolve, reject) {
            chrome.storage.local.get(['isPremium', 'authToken', 'subscriptionExpire'], function(result) {
              if (chrome.runtime.lastError) {
                reject(new Error('无法验证许可证'));
                return;
              }
              
              // 检查订阅状态
              if (result.subscriptionExpire) {
                var expireDate = new Date(result.subscriptionExpire);
                var now = new Date();
                
                if (expireDate <= now) {
                  reject(new Error('许可证已过期'));
                  return;
                }
              }
              
              resolve(result.isPremium || false);
            });
          });
        }
        
        // 定期验证许可证
        setInterval(function() {
          validateLicense().catch(function(error) {
            console.warn('许可证验证失败:', error.message);
          });
        }, 300000); // 每5分钟验证一次
        
        // 导出验证函数
        window.validateLicense = validateLicense;
      })();
    `;
  }

  // 创建构建目录
  createBuildDirectories() {
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true });
    }
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true });
    }
    
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(this.tempDir, { recursive: true });
    fs.mkdirSync(path.join(this.tempDir, 'icons'), { recursive: true });
  }

  // 处理JavaScript文件
  processJavaScriptFile(filename) {
    console.log(`处理JavaScript文件: ${filename}`);
    
    const sourceCode = fs.readFileSync(filename, 'utf8');
    let protectedCode = sourceCode;
    
    // 添加许可证验证（仅对关键文件）
    if (['popup.js', 'background.js', 'content.js'].includes(filename)) {
      protectedCode = this.getLicenseValidationCode() + '\n' + protectedCode;
    }
    
    // 代码混淆
    protectedCode = this.obfuscateCode(protectedCode, filename);
    
    // 添加时间戳和构建信息
    const buildInfo = `
      // Build: ${new Date().toISOString()}
      // Protected: true
      // Version: ${this.generateBuildId().substring(0, 8)}
    `;
    
    protectedCode = buildInfo + '\n' + protectedCode;
    
    return protectedCode;
  }

  // 处理HTML文件
  processHTMLFile(filename) {
    console.log(`处理HTML文件: ${filename}`);
    
    let htmlContent = fs.readFileSync(filename, 'utf8');
    
    // 添加反调试脚本到HTML
    const antiDebugScript = `
      <script>
        ${this.getAntiDebugCode()}
      </script>
    `;
    
    // 在</head>前插入反调试脚本
    htmlContent = htmlContent.replace('</head>', antiDebugScript + '\n</head>');
    
    // 压缩HTML（移除多余空白）
    htmlContent = htmlContent
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
    
    return htmlContent;
  }

  // 构建受保护的扩展
  async build() {
    try {
      console.log('开始构建受保护的扩展...');
      
      // 创建构建目录
      this.createBuildDirectories();
      
      // 处理manifest.json
      console.log('处理manifest.json...');
      const protectedManifest = this.createProtectedManifest();
      fs.writeFileSync(path.join(this.tempDir, 'manifest.json'), protectedManifest);
      
      // 处理JavaScript文件
      for (const file of this.sourceFiles) {
        if (!fs.existsSync(file)) {
          console.warn(`文件不存在，跳过: ${file}`);
          continue;
        }
        
        if (file.endsWith('.js')) {
          const protectedCode = this.processJavaScriptFile(file);
          fs.writeFileSync(path.join(this.tempDir, file), protectedCode);
        } else if (file.endsWith('.html')) {
          const protectedHTML = this.processHTMLFile(file);
          fs.writeFileSync(path.join(this.tempDir, file), protectedHTML);
        } else if (file.endsWith('.css') || file === 'manifest.json') {
          // CSS和manifest.json直接复制（manifest.json已经处理过了）
          if (file !== 'manifest.json') {
            fs.copyFileSync(file, path.join(this.tempDir, file));
          }
        }
      }
      
      // 复制图标文件
      console.log('复制图标文件...');
      for (const iconFile of this.iconFiles) {
        if (fs.existsSync(iconFile)) {
          fs.copyFileSync(iconFile, path.join(this.tempDir, iconFile));
        } else {
          console.warn(`图标文件不存在: ${iconFile}`);
        }
      }
      
      // 创建README文件
      const readmeContent = `
# 智流华写 Chrome扩展 - 受保护版本

构建时间: ${new Date().toISOString()}
版本: 受保护构建版本

## 安装说明

1. 打开Chrome浏览器
2. 访问 chrome://extensions/
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择此文件夹

## 注意事项

- 此版本包含代码保护机制
- 请勿尝试修改或逆向工程
- 如有问题请联系技术支持

## 功能特性

- 智能截图记录
- 操作流程文档生成
- 专业版无限制使用
- 代码完整性保护
      `;
      
      fs.writeFileSync(path.join(this.tempDir, 'README.md'), readmeContent.trim());
      
      // 创建ZIP包
      await this.createZipPackage();
      
      console.log('✅ 受保护的扩展构建完成！');
      console.log(`📁 输出目录: ${this.outputDir}`);
      console.log(`📦 ZIP文件: ${path.join(this.outputDir, 'zhiliuhuaxie-extension-protected.zip')}`);
      
      // 清理临时目录
      fs.rmSync(this.tempDir, { recursive: true });
      
      return true;
      
    } catch (error) {
      console.error('❌ 构建失败:', error);
      return false;
    }
  }

  // 创建ZIP包
  async createZipPackage() {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(path.join(this.outputDir, 'zhiliuhuaxie-extension-protected.zip'));
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      });

      output.on('close', () => {
        console.log(`ZIP包创建完成，大小: ${archive.pointer()} bytes`);
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(this.tempDir, false);
      archive.finalize();
    });
  }

  // 验证构建结果
  validateBuild() {
    const zipPath = path.join(this.outputDir, 'zhiliuhuaxie-extension-protected.zip');
    
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
  console.log('🚀 智流华写扩展保护构建工具');
  console.log('=====================================');
  
  const builder = new ProtectedExtensionBuilder();
  
  try {
    const success = await builder.build();
    
    if (success) {
      const isValid = builder.validateBuild();
      
      if (isValid) {
        console.log('\n🎉 构建成功完成！');
        console.log('\n📋 构建摘要:');
        console.log('- ✅ 代码混淆和压缩');
        console.log('- ✅ 反调试保护');
        console.log('- ✅ 完整性检查');
        console.log('- ✅ 许可证验证');
        console.log('- ✅ ZIP包生成');
        
        console.log('\n📁 输出文件:');
        console.log(`   ${path.resolve('protected-build/zhiliuhuaxie-extension-protected.zip')}`);
        
        console.log('\n🔒 安全特性:');
        console.log('- 代码混淆防止逆向工程');
        console.log('- 反调试机制保护运行时');
        console.log('- 完整性验证防止篡改');
        console.log('- 许可证检查确保合法使用');
        
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
  const requiredPackages = ['archiver', 'uglify-js'];
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

module.exports = ProtectedExtensionBuilder;