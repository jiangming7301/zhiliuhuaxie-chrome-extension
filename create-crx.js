const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');

// 配置
const buildDir = 'build-crx';
const outputFile = 'zhiliuhuaxie-extension.crx';

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

console.log('🚀 开始生成CRX文件...');

// 创建构建目录
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
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

// 创建ZIP文件（作为CRX的基础）
function createCRX() {
  return new Promise((resolve, reject) => {
    console.log('📦 打包扩展为CRX文件...');
    
    const output = fs.createWriteStream(path.join(__dirname, outputFile));
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最大压缩级别
    });

    output.on('close', () => {
      console.log(`✅ CRX文件已生成: ${outputFile}`);
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

// 生成安装说明
function generateInstallInstructions() {
  const instructions = `
# Chrome插件安装说明

## 文件信息
- 插件名称: 智流华写助手 (专业版)
- 文件名: ${outputFile}
- 生成时间: ${new Date().toLocaleString()}

## 安装步骤

### 方法一：开发者模式安装（推荐）
1. 打开Chrome浏览器
2. 进入扩展程序管理页面：chrome://extensions/
3. 开启右上角的"开发者模式"
4. 将 ${outputFile} 文件拖拽到扩展程序页面
5. 确认安装

### 方法二：解压安装
1. 将 ${outputFile} 文件重命名为 ${outputFile.replace('.crx', '.zip')}
2. 解压ZIP文件到一个文件夹
3. 在Chrome扩展程序页面点击"加载已解压的扩展程序"
4. 选择解压后的文件夹

## 注意事项
- 如果Chrome阻止安装，请在开发者模式下安装
- 插件需要相关权限才能正常工作
- 安装后可在工具栏看到插件图标

## 功能说明
- 自动记录网页操作
- 生成操作文档
- 支持多种导出格式
- 专业版无使用限制
`;

  fs.writeFileSync(path.join(__dirname, 'CRX安装说明.md'), instructions.trim());
  console.log('📋 已生成安装说明文档: CRX安装说明.md');
}

// 主函数
async function main() {
  try {
    copyFiles();
    await createCRX();
    cleanup();
    generateInstallInstructions();
    
    console.log('\n🎉 CRX文件生成完成！');
    console.log(`📁 输出文件: ${outputFile}`);
    console.log('📖 请查看 CRX安装说明.md 了解安装方法');
    
  } catch (error) {
    console.error('❌ 生成失败:', error);
    cleanup();
    process.exit(1);
  }
}

main();