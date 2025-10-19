const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 创建专业版插件包
async function createPremiumPackage() {
  console.log('开始创建智流华写助手专业版插件包...');
  
  // 创建输出目录
  const outputDir = path.join(__dirname, 'zhiliuhuaxie-website', 'public', 'downloads');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 输出文件路径
  const outputPath = path.join(outputDir, 'zhiliuhuaxie-extension-premium.zip');
  
  // 创建写入流
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // 最高压缩级别
  });
  
  // 监听所有存档数据都已被写入底层输出流的事件
  output.on('close', function() {
    console.log(`专业版插件包创建成功: ${outputPath}`);
    console.log(`总大小: ${archive.pointer()} 字节`);
  });
  
  // 监听警告
  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      console.warn('警告:', err);
    } else {
      throw err;
    }
  });
  
  // 监听错误
  archive.on('error', function(err) {
    throw err;
  });
  
  // 将输出流与存档关联
  archive.pipe(output);
  
  // 添加文件到存档
  const filesToInclude = [
    'manifest.json',
    'background.js',
    'content.js',
    'content.css',
    'popup.html',
    'popup.js',
    'print-handler.js'
  ];
  
  filesToInclude.forEach(file => {
    archive.file(file, { name: file });
  });
  
  // 添加图标目录
  archive.directory('icons', 'icons');
  
  // 完成存档
  await archive.finalize();
}

// 创建API端点文件
function createApiEndpoint() {
  console.log('创建API端点文件...');
  
  const apiDir = path.join(__dirname, 'zhiliuhuaxie-website', 'src', 'pages', 'api', 'download');
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
  }
  
  const apiFilePath = path.join(apiDir, 'zhiliuhuaxie-extension-premium.zip.js');
  
  const apiContent = `
// 智流华写助手专业版下载API
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    // 设置文件路径
    const filePath = path.join(process.cwd(), 'public', 'downloads', 'zhiliuhuaxie-extension-premium.zip');
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 获取文件统计信息
    const stat = fs.statSync(filePath);
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=zhiliuhuaxie-extension-premium.zip');
    res.setHeader('Content-Length', stat.size);
    
    // 创建读取流并将其管道连接到响应
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // 记录下载
    console.log(\`专业版插件被下载: \${new Date().toISOString()}\`);
    
  } catch (error) {
    console.error('下载处理错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
}
`;

  fs.writeFileSync(apiFilePath, apiContent);
  console.log(`API端点文件创建成功: ${apiFilePath}`);
}

// 执行主函数
async function main() {
  try {
    await createPremiumPackage();
    createApiEndpoint();
    console.log('专业版插件创建完成！');
  } catch (error) {
    console.error('创建专业版插件失败:', error);
    process.exit(1);
  }
}

main();