const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 智流华写扩展保护构建脚本');
console.log('=====================================\n');

// 检查Node.js版本
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  console.log(`📋 Node.js版本: ${nodeVersion}`);
  
  if (majorVersion < 14) {
    console.error('❌ 需要Node.js 14或更高版本');
    process.exit(1);
  }
  
  console.log('✅ Node.js版本检查通过\n');
}

// 检查必要文件
function checkRequiredFiles() {
  const requiredFiles = [
    'manifest.json',
    'popup.html', 
    'popup.js',
    'content.js',
    'background.js'
  ];
  
  console.log('📁 检查必要文件...');
  
  const missingFiles = [];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      missingFiles.push(file);
    } else {
      console.log(`   ✅ ${file}`);
    }
  }
  
  if (missingFiles.length > 0) {
    console.error('\n❌ 缺少必要文件:');
    missingFiles.forEach(file => console.error(`   - ${file}`));
    process.exit(1);
  }
  
  console.log('✅ 文件检查完成\n');
}

// 安装依赖
function installDependencies() {
  console.log('📦 检查并安装依赖...');
  
  const requiredPackages = ['archiver', 'uglify-js'];
  const packageJson = {
    name: 'zhiliuhuaxie-extension-builder',
    version: '1.0.0',
    description: '智流华写扩展构建工具',
    dependencies: {}
  };
  
  // 检查package.json是否存在
  if (!fs.existsSync('package.json')) {
    console.log('📝 创建package.json...');
    
    // 添加依赖
    requiredPackages.forEach(pkg => {
      packageJson.dependencies[pkg] = 'latest';
    });
    
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  }
  
  try {
    // 检查依赖是否已安装
    let needInstall = false;
    for (const pkg of requiredPackages) {
      try {
        require.resolve(pkg);
        console.log(`   ✅ ${pkg} 已安装`);
      } catch (error) {
        console.log(`   ⏳ ${pkg} 需要安装`);
        needInstall = true;
      }
    }
    
    if (needInstall) {
      console.log('\n⏳ 正在安装依赖包...');
      execSync(`npm install ${requiredPackages.join(' ')}`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ 依赖安装完成\n');
    } else {
      console.log('✅ 所有依赖已就绪\n');
    }
    
  } catch (error) {
    console.error('❌ 依赖安装失败:', error.message);
    console.log('\n💡 请手动运行: npm install archiver uglify-js');
    process.exit(1);
  }
}

// 运行构建
function runBuild() {
  console.log('🚀 开始构建受保护的扩展...\n');
  
  try {
    const ProtectedExtensionBuilder = require('./create-protected-extension.js');
    const builder = new ProtectedExtensionBuilder();
    
    return builder.build();
    
  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    return false;
  }
}

// 显示使用说明
function showUsageInstructions() {
  console.log('\n📖 使用说明:');
  console.log('=====================================');
  console.log('1. 构建完成后，在 protected-build 目录找到ZIP文件');
  console.log('2. 解压ZIP文件到任意目录');
  console.log('3. 打开Chrome浏览器，访问 chrome://extensions/');
  console.log('4. 开启"开发者模式"');
  console.log('5. 点击"加载已解压的扩展程序"');
  console.log('6. 选择解压后的文件夹');
  console.log('\n🔒 安全提醒:');
  console.log('- 此版本包含代码保护机制');
  console.log('- 请勿分发给未授权用户');
  console.log('- 如需技术支持请联系开发团队');
}

// 主函数
async function main() {
  try {
    // 检查环境
    checkNodeVersion();
    checkRequiredFiles();
    
    // 安装依赖
    installDependencies();
    
    // 运行构建
    const success = await runBuild();
    
    if (success) {
      console.log('\n🎉 构建成功完成！');
      showUsageInstructions();
    } else {
      console.log('\n❌ 构建失败，请检查错误信息');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 构建过程出现异常:', error);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}