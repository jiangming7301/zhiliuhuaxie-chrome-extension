class PopupManager {
  constructor() {
    this.isRecording = false;
    this.startTime = null;
    this.durationInterval = null;
    this.usageInfo = null;
    this.subscriptionCountdown = null;
    this.initRetryCount = 0;
    this.maxRetries = 5;
    this.init();
  }

  // 安全的DOM创建工具函数
  createElement(tag, options = {}) {
    const element = document.createElement(tag);
    
    if (options.className) {
      element.className = options.className;
    }
    
    if (options.textContent) {
      element.textContent = options.textContent;
    }
    
    if (options.style) {
      element.style.cssText = options.style;
    }
    
    if (options.id) {
      element.id = options.id;
    }
    
    if (options.attributes) {
      for (const [key, value] of Object.entries(options.attributes)) {
        element.setAttribute(key, value);
      }
    }
    
    return element;
  }

  // 安全地清空元素内容
  clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  async init() {
    console.log('初始化popup...');
    try {
      this.bindEvents();
      this.showLoadingState();
      
      await this.pingBackground();
      await this.loadPluginInfo();
      
      this.updateUI();
      console.log('初始化完成');
    } catch (error) {
      console.error('初始化失败:', error);
      
      if (this.initRetryCount < this.maxRetries) {
        this.initRetryCount++;
        console.log(`初始化重试 (${this.initRetryCount}/${this.maxRetries})...`);
        setTimeout(() => this.init(), 1000);
      } else {
        this.showErrorState('插件初始化失败，请尝试重新加载插件');
      }
    }
  }

  showLoadingState() {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = '正在加载...';
      status.className = 'status stopped';
    }
    
    const usageInfo = document.getElementById('usageInfo');
    if (usageInfo) {
      this.clearElement(usageInfo);
      
      const loadingDiv = this.createElement('div', {
        className: 'usage-progress'
      });
      
      const loadingText = this.createElement('div', {
        className: 'usage-text',
        textContent: '加载中...'
      });
      
      loadingDiv.appendChild(loadingText);
      usageInfo.appendChild(loadingDiv);
    }
    
    const buttons = ['startBtn', 'stopBtn', 'exportBtn', 'clearBtn', 'upgradeBtn'];
    buttons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      }
    });
  }

  showErrorState(message) {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = '初始化失败';
      status.className = 'status stopped';
      status.style.backgroundColor = '#ffebee';
      status.style.color = '#c62828';
      status.style.border = '1px solid #ef5350';
    }
    
    const usageInfo = document.getElementById('usageInfo');
    if (usageInfo) {
      this.clearElement(usageInfo);
      
      const progressDiv = this.createElement('div', {
        className: 'usage-progress'
      });
      
      const textDiv = this.createElement('div', {
        className: 'usage-text',
        textContent: message,
        style: 'color: #c62828;'
      });
      
      const retryBtn = this.createElement('button', {
        id: 'retryBtn',
        className: 'btn btn-primary',
        textContent: '重试连接',
        style: 'margin-top: 10px; padding: 8px;'
      });
      
      progressDiv.appendChild(textDiv);
      progressDiv.appendChild(retryBtn);
      usageInfo.appendChild(progressDiv);
      
      retryBtn.addEventListener('click', () => {
        this.initRetryCount = 0;
        this.showLoadingState();
        setTimeout(() => this.init(), 500);
      });
    }
  }

  async pingBackground() {
    try {
      const response = await this.sendMessage({ action: 'ping' }, 3000);
      if (response && response.success) {
        return true;
      } else {
        throw new Error('连接响应无效');
      }
    } catch (error) {
      console.error('与background连接失败:', error);
      throw new Error('无法连接到插件后台服务');
    }
  }

  bindEvents() {
    document.getElementById('startBtn').addEventListener('click', () => this.startRecording());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopRecording());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportDocument());
    document.getElementById('clearBtn').addEventListener('click', () => this.clearRecords());
    
    const upgradeBtn = document.getElementById('upgradeBtn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.openUpgradePage());
    }
  }

  async loadPluginInfo() {
    try {
      const pluginInfo = await this.sendMessage({ action: 'getPluginInfo' });
      const usageInfo = await this.sendMessage({ action: 'checkUsage' });
      const result = await chrome.storage.local.get(['isRecording', 'recordingStartTime']);
      
      this.usageInfo = { 
        ...pluginInfo, 
        ...usageInfo,
        isPremium: true,
        subscriptionExpire: new Date(2099, 11, 31).toISOString(),
        maxFreePages: 999999,
        remainingPages: 999999
      };
      
      this.isRecording = result.isRecording || false;
      this.startTime = result.recordingStartTime || null;
      
      if (this.isRecording && this.startTime) {
        this.startDurationTimer();
      }
      
      this.updateUsageDisplay();
      await this.updateStats();
      this.updateUI();
      
    } catch (error) {
      console.error('加载插件信息失败:', error);
      throw error;
    }
  }

  updateUsageDisplay() {
    const usageInfo = document.getElementById('usageInfo');
    if (!usageInfo) return;
    
    this.clearElement(usageInfo);
    
    if (this.usageInfo && this.usageInfo.isPremium) {
      const progressDiv = this.createElement('div', {
        className: 'usage-unlimited',
        textContent: '专业版 - 无限使用'
      });
      usageInfo.appendChild(progressDiv);
    } else {
      const used = this.usageInfo?.usedPages || 0;
      const total = this.usageInfo?.maxFreePages || 20;
      const remaining = Math.max(0, total - used);
      const percentage = Math.min((used / total) * 100, 100);
      
      const progressDiv = this.createElement('div', {
        className: 'usage-progress'
      });
      
      const textDiv = this.createElement('div', {
        className: 'usage-text',
        textContent: `免费版 - 已使用 ${used}/${total} 张截图`
      });
      
      const progressBar = this.createElement('div', {
        className: 'progress-bar'
      });
      
      const progressFill = this.createElement('div', {
        className: 'progress-fill',
        style: `width: ${percentage}%; background-color: ${percentage >= 100 ? '#f44336' : '#4CAF50'}`
      });
      
      const remainingText = this.createElement('div', {
        className: 'remaining-text',
        textContent: `剩余 ${remaining} 张`
      });
      
      progressBar.appendChild(progressFill);
      progressDiv.appendChild(textDiv);
      progressDiv.appendChild(progressBar);
      progressDiv.appendChild(remainingText);
      usageInfo.appendChild(progressDiv);
    }
  }

  async updateStats() {
    try {
      const result = await chrome.storage.local.get(['operations']);
      const operations = result.operations || [];
      
      const screenshots = operations.filter(op => op.type === 'click' && op.screenshot).length;
      const clicks = operations.filter(op => op.type === 'click').length;
      
      const screenshotCountEl = document.getElementById('screenshotCount');
      const clickCountEl = document.getElementById('clickCount');
      
      if (screenshotCountEl) {
        screenshotCountEl.textContent = screenshots;
      }
      
      if (clickCountEl) {
        clickCountEl.textContent = clicks;
      }
      
      this.updateScreenshotsList(operations);
      
    } catch (error) {
      console.error('更新统计失败:', error);
    }
  }

  updateScreenshotsList(operations) {
    const screenshotsContainer = document.getElementById('screenshotsList');
    if (!screenshotsContainer) return;
    
    const screenshotOps = operations.filter(op => op.type === 'click' && op.screenshot);
    
    this.clearElement(screenshotsContainer);
    
    if (screenshotOps.length === 0) {
      const noScreenshotsDiv = this.createElement('div', {
        className: 'no-screenshots',
        textContent: '暂无截图记录'
      });
      screenshotsContainer.appendChild(noScreenshotsDiv);
      return;
    }
    
    screenshotOps.forEach((op, index) => {
      const item = this.createScreenshotItem(op, index + 1);
      screenshotsContainer.appendChild(item);
    });
  }

  createScreenshotItem(op, stepNumber) {
    const item = this.createElement('div', {
      className: 'screenshot-item'
    });
    
    const header = this.createElement('div', {
      className: 'screenshot-header'
    });
    
    const indexSpan = this.createElement('span', {
      className: 'screenshot-index',
      textContent: stepNumber.toString()
    });
    
    const urlSpan = this.createElement('span', {
      className: 'screenshot-url',
      textContent: `当前地址：${op.url.length > 50 ? op.url.substring(0, 50) + '...' : op.url}`,
      attributes: { title: op.url }
    });
    
    const playButton = this.createElement('button', {
      className: 'play-button',
      attributes: { 'data-url': op.url, title: '跳转到此页面' }
    });
    
    playButton.appendChild(this.createPlayIcon());
    
    header.appendChild(indexSpan);
    header.appendChild(urlSpan);
    header.appendChild(playButton);
    
    const content = this.createElement('div', {
      className: 'screenshot-content'
    });
    
    const img = this.createElement('img', {
      attributes: { src: op.screenshot, alt: `截图${stepNumber}` },
      className: 'screenshot-image'
    });
    
    const info = this.createElement('div', {
      className: 'screenshot-info'
    });
    
    const textP = this.createElement('p');
    const textStrong = this.createElement('strong', { textContent: '点击内容: ' });
    textP.appendChild(textStrong);
    textP.appendChild(document.createTextNode(`"${op.text || '无文本'}"`));
    
    const timeP = this.createElement('p');
    const timeStrong = this.createElement('strong', { textContent: '时间: ' });
    timeP.appendChild(timeStrong);
    timeP.appendChild(document.createTextNode(new Date(op.timestamp).toLocaleString()));
    
    info.appendChild(textP);
    info.appendChild(timeP);
    
    content.appendChild(img);
    content.appendChild(info);
    
    item.appendChild(header);
    item.appendChild(content);
    
    playButton.addEventListener('click', (e) => {
      e.preventDefault();
      const url = playButton.getAttribute('data-url');
      if (url) {
        chrome.tabs.create({ url: url });
      }
    });
    
    return item;
  }

  createPlayIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '5,3 19,12 5,21');
    
    svg.appendChild(polygon);
    return svg;
  }

  updateUI() {
    const status = document.getElementById('status');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (this.isRecording) {
      if (status) {
        status.textContent = '正在记录';
        status.className = 'status recording';
      }
      if (startBtn) {
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';
      }
      if (stopBtn) {
        stopBtn.disabled = false;
        stopBtn.style.opacity = '1';
      }
    } else {
      if (status) {
        status.textContent = '未开始记录';
        status.className = 'status stopped';
      }
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
      }
      if (stopBtn) {
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.5';
      }
    }
    
    const buttons = ['exportBtn', 'clearBtn', 'upgradeBtn'];
    buttons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
  }

  async startRecording() {
    try {
      const response = await this.sendMessage({ action: 'startRecording' });
      if (response && response.success) {
        this.isRecording = true;
        this.startTime = Date.now();
        this.startDurationTimer();
        this.updateUI();
      } else {
        throw new Error(response?.error || '开始录制失败');
      }
    } catch (error) {
      console.error('开始录制失败:', error);
      this.showErrorMessage(error.message);
    }
  }

  async stopRecording() {
    try {
      const response = await this.sendMessage({ action: 'stopRecording' });
      if (response && response.success) {
        this.isRecording = false;
        this.startTime = null;
        this.stopDurationTimer();
        this.updateUI();
        await this.updateStats();
      } else {
        throw new Error(response?.error || '停止录制失败');
      }
    } catch (error) {
      console.error('停止录制失败:', error);
      this.showErrorMessage(error.message);
    }
  }

  startDurationTimer() {
    this.stopDurationTimer();
    
    this.durationInterval = setInterval(() => {
      if (this.startTime) {
        const elapsed = Date.now() - this.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const durationEl = document.getElementById('duration');
        if (durationEl) {
          durationEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      }
    }, 1000);
  }

  stopDurationTimer() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  async exportDocument() {
    try {
      const result = await chrome.storage.local.get(['operations']);
      const operations = result.operations || [];
      
      if (operations.length === 0) {
        this.showErrorMessage('没有可导出的记录');
        return;
      }
      
      const html = this.generateDocumentHTML(operations);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `操作记录_${new Date().toLocaleDateString()}.html`;
      link.click();
      
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('导出失败:', error);
      this.showErrorMessage('导出失败: ' + error.message);
    }
  }

  generateDocumentHTML(operations) {
    const title = `操作记录 - ${new Date().toLocaleDateString()}`;
    
    let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .step { margin-bottom: 30px; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
        .step-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .step-image { max-width: 100%; height: auto; border: 1px solid #ccc; margin: 10px 0; }
        .step-info { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <p>生成时间: ${new Date().toLocaleString()}</p>
    </div>`;
    
    operations.forEach((op, index) => {
      if (op.type === 'click' && op.screenshot) {
        html += `
    <div class="step">
        <div class="step-title">步骤 ${index + 1}</div>
        <img src="${op.screenshot}" alt="步骤${index + 1}截图" class="step-image">
        <div class="step-info">
            <p><strong>操作:</strong> 点击 "${op.text || '无文本'}"</p>
            <p><strong>页面:</strong> ${op.url}</p>
            <p><strong>时间:</strong> ${new Date(op.timestamp).toLocaleString()}</p>
        </div>
    </div>`;
      }
    });
    
    html += `
</body>
</html>`;
    
    return html;
  }

  async clearRecords() {
    if (confirm('确定要清空所有记录吗？此操作不可恢复。')) {
      try {
        await chrome.storage.local.set({ operations: [] });
        await this.updateStats();
        this.showSuccessMessage('记录已清空');
      } catch (error) {
        console.error('清空记录失败:', error);
        this.showErrorMessage('清空记录失败');
      }
    }
  }

  openUpgradePage() {
    chrome.tabs.create({ url: 'http://localhost:3000/#pricing' });
  }

  showErrorMessage(message) {
    this.showMessage(message, 'error');
  }

  showSuccessMessage(message) {
    this.showMessage(message, 'success');
  }

  showMessage(message, type = 'info') {
    const messageDiv = this.createElement('div', {
      style: `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 12px;
        z-index: 10001;
        max-width: 250px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        ${type === 'error' ? 'background: rgba(255, 0, 0, 0.9); color: white;' : 
          type === 'success' ? 'background: rgba(76, 175, 80, 0.9); color: white;' :
          'background: rgba(255, 152, 0, 0.9); color: white;'}
      `,
      textContent: message
    });
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 3000);
  }

  async sendMessage(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('消息发送超时'));
      }, timeout);
      
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});