const { createCanvas } = require('canvas');
const fs = require('fs');

function createIcon(size, isRecording = false) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // 清除画布
  ctx.clearRect(0, 0, size, size);
  
  // 创建渐变
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#00CED1');
  gradient.addColorStop(1, '#20B2AA');
  
  // 绘制圆形背景
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2 - 1, 0, 2 * Math.PI);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = '#008B8B';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  if (isRecording) {
    // 录制状态：绘制红色圆点
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff0000';
    ctx.fill();
  } else {
    // 正常状态：绘制对勾
    ctx.beginPath();
    ctx.moveTo(size * 0.3, size * 0.5);
    ctx.lineTo(size * 0.45, size * 0.65);
    ctx.lineTo(size * 0.7, size * 0.35);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = Math.max(2, size / 8);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  
  return canvas.toBuffer('image/png');
}

// 创建所有尺寸的图标
const sizes = [16, 48, 128];

sizes.forEach(size => {
  // 正常图标
  const normalIcon = createIcon(size, false);
  fs.writeFileSync(`icons/icon${size}.png`, normalIcon);
  console.log(`创建了 icon${size}.png`);
  
  // 录制状态图标
  const recordingIcon = createIcon(size, true);
  fs.writeFileSync(`icons/icon${size}-recording.png`, recordingIcon);
  console.log(`创建了 icon${size}-recording.png`);
});

console.log('所有PNG图标已创建完成！');