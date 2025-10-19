const fs = require('fs');
const path = require('path');

// 配置
const devDir = 'extension-dev';

// 需要复制的文件列表
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

console.log('🔧 为开发者模式准备插件文件夹...');

// 清理并创建开发目录
if (fs.existsSync(devDir)) {
  fs.rmSync(devDir, { recursive: true, force: true });
}
fs.mkdirSync(devDir, { recursive: true });

// 复制文件
function copyFiles() {
  console.log('📁 复制插件文件到开发文件夹...');
  
  filesToInclude.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(__dirname, devDir, file);
    
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

// 生成开发者模式安装指南
function generateDevGuide() {
  const instructions = `
# Chrome 开发者模式安装指南

## 文件夹信息
- 插件文件夹: ${devDir}
- 生成时间: ${new Date().toLocaleString()}

## 开发者模式安装步骤 (推荐方法)

### 1. 打开Chrome扩展管理页面
- 方法一：在地址栏输入 \`chrome://extensions/\`
- 方法二：Chrome菜单 → 更多工具 → 扩展程序

### 2. 开启开发者模式
- 在扩展程序页面的右上角，开启"开发者模式"开关

### 3. 加载插件文件夹
- 点击"加载已解压的扩展程序"按钮
- 选择 \`${devDir}\` 文件夹
- 点击"选择文件夹"

### 4. 验证安装
- 插件应该出现在扩展程序列表中
- 工具栏应该显示插件图标
- 点击图标测试弹窗是否正常

## 常见问题解决

### 错误1：manifest.json 文件格式错误
**解决方案：** 检查JSON语法，确保没有多余的逗号

### 错误2：权限被拒绝
**解决方案：** 正常现象，点击"继续"即可

### 错误3：图标文件缺失
**解决方案：** 确保icons文件夹中的图标文件存在

### 错误4：服务工作进程错误
**解决方案：** 检查background.js文件语法

## 调试技巧
- 在扩展程序页面点击插件的"详情"
- 点击"检查视图"下的各个链接进行调试
- 查看"错误"标签页了解具体错误信息

## 更新插件
- 修改代码后，在扩展程序页面点击插件的"刷新"按钮
- 无需重新加载整个插件

## 注意事项
- 开发者模式下的插件仅在当前浏览器配置文件中有效
- 关闭开发者模式后，插件会被禁用
- 建议保留 ${devDir} 文件夹，便于后续修改和调试
`;

  fs.writeFileSync(path.join(__dirname, '开发者模式安装指南.md'), instructions.trim());
  console.log('📋 已生成开发者模式安装指南: 开发者模式安装指南.md');
}

// 主函数
function main() {
  try {
    copyFiles();
    generateDevGuide();
    
    console.log('\n🎉 开发者模式插件文件夹准备完成！');
    console.log(`📁 插件文件夹: ${devDir}/`);
    console.log('📖 请查看 开发者模式安装指南.md 了解安装步骤');
    console.log('\n🚀 快速安装步骤：');
    console.log('1. 打开 chrome://extensions/');
    console.log('2. 开启"开发者模式"');
    console.log(`3. 点击"加载已解压的扩展程序"，选择 ${devDir} 文件夹`);
    
  } catch (error) {
    console.error('❌ 准备失败:', error);
    process.exit(1);
  }
}

main();