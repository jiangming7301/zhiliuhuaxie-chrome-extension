class PopupController {
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

  async init() {
    console.log('初始化popup...');
    try {
      // 先绑定事件，确保UI可响应
      this.bindEvents();
      
      // 显示加载状态
      this.showLoadingState();
      
      // 尝试与background建立连接
      await this.pingBackground();
      
      // 加载插件信息
      await this.loadPluginInfo();
      
      // 更新UI
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

  // 显示加载状态
  showLoadingState() {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = '正在加载...';
      status.className = 'status stopped';
    }
    
    const usageInfo = document.getElementById('usageInfo');
    if (usageInfo) {
   // 使用安全的DOM操作替代innerHTML
   while (usageInfo.firstChild) {
     usageInfo.removeChild(usageInfo.firstChild);
   }
       
   const loadingDiv = document.createElement('div');
   loadingDiv.className = 'usage-progress';
       
   const loadingText = document.createElement('div');
   loadingText.className = 'usage-text';
   loadingText.textContent = '加载中...';
       
   loadingDiv.appendChild(loadingText);
   usageInfo.appendChild(loadingDiv);
    }
    
    // 禁用所有按钮，直到加载完成
    const buttons = ['startBtn', 'stopBtn', 'exportBtn', 'clearBtn', 'upgradeBtn'];
    buttons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      }
    });
  }

  // 显示错误状态
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
    // 使用安全的DOM操作替代innerHTML
    while (usageInfo.firstChild) {
      usageInfo.removeChild(usageInfo.firstChild);
    }
    
    const progressDiv = document.createElement('div');
    progressDiv.className = 'usage-progress';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'usage-text';
    textDiv.style.color = '#c62828';
    textDiv.textContent = message;
    
    const retryBtn = document.createElement('button');
    retryBtn.id = 'retryBtn';
    retryBtn.className = 'btn btn-primary';
    retryBtn.style.cssText = 'margin-top: 10px; padding: 8px;';
    retryBtn.textContent = '重试连接';
    
    progressDiv.appendChild(textDiv);
    progressDiv.appendChild(retryBtn);
    usageInfo.appendChild(progressDiv);
      
    // 直接在已创建的按钮元素上绑定重试事件
    retryBtn.addEventListener('click', () => {
      this.initRetryCount = 0;
      this.showLoadingState();
      setTimeout(() => this.init(), 500);
    });
    }
  }

  // 检查与background的连接
  async pingBackground() {
    try {
      console.log('尝试与background建立连接...');
      const response = await this.sendMessage({ action: 'ping' }, 3000);
      
      if (response && response.success) {
        console.log('与background连接成功');
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
    document.getElementById('upgradeBtn').addEventListener('click', () => this.openUpgradePage());
    
    // 授权码按钮事件绑定
    const activateBtn = document.getElementById('activateBtn');
    if (activateBtn) {
      activateBtn.addEventListener('click', () => this.showActivationDialog());
    }
    
    // 检查激活对话框相关元素是否存在
    const confirmActivation = document.getElementById('confirmActivation');
    const cancelActivation = document.getElementById('cancelActivation');
    
    if (confirmActivation) {
      confirmActivation.addEventListener('click', () => this.activatePlugin());
    }
    
    if (cancelActivation) {
      cancelActivation.addEventListener('click', () => this.hideActivationDialog());
    }
  }

  async loadPluginInfo() {
    try {
      console.log('加载插件信息...');
      
      // 获取插件信息
      const pluginInfo = await this.sendMessage({ action: 'getPluginInfo' });
      console.log('获取到插件信息:', pluginInfo);
      
      // 获取使用状态
      const usageInfo = await this.sendMessage({ action: 'checkUsage' });
      console.log('获取到使用状态:', usageInfo);
      
      // 获取录制状态
      const result = await chrome.storage.local.get(['isRecording', 'recordingStartTime']);
      console.log('获取到录制状态:', result);
      
      // 强制设置为专业版
      this.usageInfo = { 
        ...pluginInfo, 
        ...usageInfo,
        isPremium: true,
        subscriptionExpire: new Date(2099, 11, 31).toISOString(), // 设置为2099年底过期
        maxFreePages: 999999, // 设置一个很大的值
        remainingPages: 999999
      };
      
      this.isRecording = result.isRecording || false;
      this.startTime = result.recordingStartTime || null;
      
      // 如果正在录制，启动计时器
      if (this.isRecording && this.startTime) {
        this.startDurationTimer();
      }
      
      this.updateUsageDisplay();
      this.updateSubscriptionStatus();
      await this.updateStats(); // 更新统计信息
      this.updateUI();
      
      // 启动倒计时
      this.startSubscriptionCountdown();
      
    } catch (error) {
      console.error('加载插件信息失败:', error);
      throw error;
    }
  }

  async updateStats() {
    try {
      // 获取操作记录
      const result = await chrome.storage.local.get(['operations']);
      const operations = result.operations || [];
      
      // 统计截图和点击数量
      const screenshots = operations.filter(op => op.type === 'click' && op.screenshot).length;
      const clicks = operations.filter(op => op.type === 'click').length;
      
      // 更新显示
      const screenshotCountEl = document.getElementById('screenshotCount');
      const clickCountEl = document.getElementById('clickCount');
      
      if (screenshotCountEl) {
        // 如果是免费版，显示使用情况
        if (this.usageInfo && !this.usageInfo.isPremium) {
          const limit = this.usageInfo.maxFreePages || 20;
          screenshotCountEl.textContent = `${screenshots}/${limit}`;
          
          // 如果接近或超过限制，改变颜色和显示升级提示
          if (screenshots >= limit) {
            screenshotCountEl.style.color = '#f44336';
            screenshotCountEl.style.fontWeight = 'bold';
            // 显示升级提示
            this.showUpgradePrompt(`免费版已达到${limit}张截图限制，请升级专业版继续使用无限截图功能！`);
          } else if (screenshots >= limit - 2) {
            screenshotCountEl.style.color = '#ff9800';
            screenshotCountEl.style.fontWeight = 'bold';
            // 接近限制时的提醒
            if (screenshots === limit - 1) {
              this.showWarningMessage(`还剩1张截图，即将达到免费版限制`);
            }
          } else {
            screenshotCountEl.style.color = '';
            screenshotCountEl.style.fontWeight = '';
          }
        } else {
          screenshotCountEl.textContent = screenshots;
        }
      }
      
      if (clickCountEl) {
        clickCountEl.textContent = clicks;
      }
      
      console.log('统计更新:', { screenshots, clicks, totalOperations: operations.length });
      
      // 同时更新使用页数统计 - 每张截图算作1页
      if (this.usageInfo && !this.usageInfo.isPremium) {
        this.usageInfo.usedPages = screenshots;
        this.usageInfo.remainingPages = Math.max(0, (this.usageInfo.maxFreePages || 20) - screenshots);
        this.updateUsageDisplay();
      }
      
      // 更新截图列表显示
      this.updateScreenshotsList(operations);
      
    } catch (error) {
      console.error('更新统计失败:', error);
    }
  }

  updateScreenshotsList(operations) {
    const screenshotsContainer = document.getElementById('screenshotsList');
    if (!screenshotsContainer) return;
    
    // 过滤出有截图的操作
    const screenshotOps = operations.filter(op => op.type === 'click' && op.screenshot);
    
    if (screenshotOps.length === 0) {
      screenshotsContainer.innerHTML = '<div class="no-screenshots">暂无截图记录</div>';
      return;
    }
    
    let screenshotsHtml = '';
    screenshotOps.forEach((op, index) => {
      const stepNumber = index + 1;
      const time = new Date(op.timestamp).toLocaleString();
      
      // 简化URL显示
      const displayUrl = op.url.length > 50 ? op.url.substring(0, 50) + '...' : op.url;
      
      screenshotsHtml += `
        <div class="screenshot-item">
          <div class="screenshot-header">
            <span class="screenshot-index">${stepNumber}</span>
            <span class="screenshot-url" title="${op.url}">当前地址：${displayUrl}</span>
            <button class="play-button" data-url="${op.url}" title="跳转到此页面">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5,3 19,12 5,21"></polygon>
              </svg>
            </button>
          </div>
          <div class="screenshot-content">
            <img src="${op.screenshot}" alt="截图${stepNumber}" class="screenshot-image">
            <div class="screenshot-info">
              <p><strong>点击内容:</strong> "${op.text || '无文本'}"</p>
              <p><strong>时间:</strong> ${time}</p>
            </div>
          </div>
        </div>
      `;
    });
    
    screenshotsContainer.innerHTML = screenshotsHtml;
    
    // 绑定播放按钮事件
    this.bindPlayButtonEvents();
  }

  bindPlayButtonEvents() {
    const playButtons = document.querySelectorAll('.play-button');
    playButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const url = button.getAttribute('data-url');
        if (url) {
          // 在新标签页中打开URL
          chrome.tabs.create({ url: url });
        }
      });
    });
  }

  showWarningMessage(message) {
    // 创建警告提示
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(255, 152, 0, 0.9);
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 12px;
      z-index: 10001;
      max-width: 250px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    warningDiv.textContent = message;
    
    document.body.appendChild(warningDiv);
    
    // 3秒后自动移除
    setTimeout(() => {
      if (warningDiv.parentNode) {
        warningDiv.parentNode.removeChild(warningDiv);
      }
    }, 3000);
  }

  updateSubscriptionStatus() {
    // 如果是专业版且有过期时间，在用户状态区域显示倒计时
    if (this.usageInfo && this.usageInfo.isPremium && this.usageInfo.subscriptionExpire) {
      const userStatusElement = document.getElementById('userStatus');
      const expireDate = new Date(this.usageInfo.subscriptionExpire);
      const now = new Date();
      const timeDiff = expireDate - now;
      
      if (timeDiff > 0) {
        userStatusElement.innerHTML = `
          <div class="premium-status">
            <span class="status-badge premium">专业版</span>
            <div id="subscriptionCountdown" class="subscription-countdown" style="color: white; font-size: 12px;"></div>
          </div>
          <div id="renewReminder" class="renew-reminder" style="display: none; margin-top: 8px; padding: 6px; background: rgba(255,255,255,0.2); border-radius: 4px;">
            <p style="margin: 0 0 5px 0; font-size: 11px; color: white;">订阅即将到期，请及时续费</p>
            <button onclick="window.open('http://localhost:3000/#pricing')" style="padding: 2px 6px; font-size: 10px; background: rgba(255,255,255,0.3); border: none; border-radius: 3px; color: white; cursor: pointer;">续费</button>
          </div>
        `;
      } else {
        // 已过期
        this.handleSubscriptionExpired();
      }
    }
  }

  startSubscriptionCountdown() {
    // 清除之前的倒计时
    if (this.subscriptionCountdown) {
      clearInterval(this.subscriptionCountdown);
    }

    this.subscriptionCountdown = setInterval(() => {
      this.updateCountdownDisplay();
    }, 1000);
    
    // 立即更新一次
    this.updateCountdownDisplay();
  }

  updateCountdownDisplay() {
    if (!this.usageInfo || !this.usageInfo.isPremium || !this.usageInfo.subscriptionExpire) {
      return;
    }

    const countdownElement = document.getElementById('subscriptionCountdown');
    const renewReminderElement = document.getElementById('renewReminder');
    
    if (!countdownElement) return;

    const expireDate = new Date(this.usageInfo.subscriptionExpire);
    const now = new Date();
    const timeDiff = expireDate - now;

    if (timeDiff <= 0) {
      // 订阅已过期
      this.handleSubscriptionExpired();
      return;
    }

    // 计算剩余时间
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    let countdownText = '';
    if (days > 0) {
      countdownText = `剩余: ${days}天${hours}小时`;
    } else if (hours > 0) {
      countdownText = `剩余: ${hours}小时${minutes}分钟`;
    } else {
      countdownText = `剩余: ${minutes}分钟`;
    }

    countdownElement.textContent = countdownText;

    // 如果剩余时间少于7天，显示续费提醒和警告样式
    if (days <= 7) {
      countdownElement.style.color = '#ff6b6b';
      countdownElement.style.fontWeight = 'bold';
      countdownElement.style.animation = 'pulse 2s infinite';
      if (renewReminderElement) {
        renewReminderElement.style.display = 'block';
      }
    } else {
      countdownElement.style.color = 'white';
      countdownElement.style.fontWeight = 'normal';
      countdownElement.style.animation = 'none';
      if (renewReminderElement) {
        renewReminderElement.style.display = 'none';
      }
    }

    // 如果剩余时间少于1天，每小时提醒一次
    if (days === 0 && hours <= 24) {
      const lastReminder = localStorage.getItem('lastExpiryReminder');
      const currentHour = new Date().getHours();
      
      if (!lastReminder || parseInt(lastReminder) !== currentHour) {
        this.showExpiryWarning(hours, minutes);
        localStorage.setItem('lastExpiryReminder', currentHour.toString());
      }
    }
  }

  showExpiryWarning(hours, minutes) {
    let message = '';
    if (hours > 0) {
      message = `您的专业版订阅将在${hours}小时${minutes}分钟后到期，请及时续费以免影响使用。`;
    } else {
      message = `您的专业版订阅将在${minutes}分钟后到期，请立即续费！`;
    }

    if (confirm(`⚠️ 订阅即将到期\n\n${message}\n\n点击"确定"前往续费页面，点击"取消"稍后提醒。`)) {
      window.open('http://localhost:3000/#pricing');
    }
  }

  handleSubscriptionExpired() {
    // 清除倒计时
    if (this.subscriptionCountdown) {
      clearInterval(this.subscriptionCountdown);
      this.subscriptionCountdown = null;
    }

    // 更新本地状态为免费版
    this.usageInfo.isPremium = false;
    this.usageInfo.subscriptionExpire = null;
    
    // 通知background script更新状态
    this.sendMessage({ 
      action: 'updateSubscriptionStatus', 
      isPremium: false,
      subscriptionExpire: null
    });

    // 显示过期提醒
    this.showExpiredDialog();
    
    // 更新UI
    this.updateUsageDisplay();
    this.updateSubscriptionStatus();
  }

  showExpiredDialog() {
    const message = `您的专业版订阅已过期，已自动切换为免费版。\n\n免费版限制生成20页文档，如需继续使用专业版功能，请续费。\n\n季度版：¥19.9\n年费版：¥49.9（省37%）`;
    
    if (confirm(`🔔 订阅已过期\n\n${message}\n\n点击"确定"前往续费页面，点击"取消"继续使用免费版。`)) {
      window.open('http://localhost:3000/#pricing');
    }
  }

  updateUsageDisplay() {
    if (!this.usageInfo) return;
    
    const usageElement = document.getElementById('usageInfo');
    const statusElement = document.getElementById('userStatus');
    const upgradeBtn = document.getElementById('upgradeBtn');
    const activateBtn = document.getElementById('activateBtn');
    
    if (this.usageInfo.isPremium) {
      // 专业版用户
      if (!this.usageInfo.subscriptionExpire) {
        // 永久专业版或者没有过期时间的情况
        statusElement.innerHTML = `
          <div class="premium-status">
            <span class="status-badge premium">专业版</span>
            <span class="user-name">${this.usageInfo.userInfo?.nickname || '专业用户'}</span>
          </div>
        `;
      }
      // 如果有过期时间，在updateSubscriptionStatus中处理
      
      usageElement.innerHTML = `
        <div class="usage-unlimited">
          <span>✨ 无限制使用</span>
        </div>
      `;
      upgradeBtn.style.display = 'none';
      if (activateBtn) activateBtn.style.display = 'none';
    } else {
      // 免费版用户
      const remaining = this.usageInfo.remainingPages || 0;
      const used = this.usageInfo.usedPages || 0;
      const total = this.usageInfo.maxFreePages || 20;
      
      statusElement.innerHTML = `
        <div class="free-status">
          <span class="status-badge free">免费版</span>
        </div>
      `;
      
      // 根据使用情况显示不同的进度条颜色
      let progressColor = '#4CAF50';
      if (used >= total) {
        progressColor = '#f44336'; // 红色 - 已达限制
      } else if (used >= total - 2) {
        progressColor = '#ff9800'; // 橙色 - 接近限制
      }
      
      usageElement.innerHTML = `
        <div class="usage-progress">
          <div class="usage-text" style="color: ${used >= total ? '#f44336' : '#333'}">
            已使用 ${used}/${total} 张截图
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min((used/total)*100, 100)}%; background-color: ${progressColor}"></div>
          </div>
          <div class="remaining-text" style="color: ${remaining <= 0 ? '#f44336' : '#666'}">
            ${remaining <= 0 ? '⚠️ 已达限制，请升级专业版' : `剩余 ${remaining} 张`}
          </div>
        </div>
      `;
      
      // 显示升级按钮逻辑
      if (remaining <= 0) {
        upgradeBtn.style.display = 'block';
        upgradeBtn.innerHTML = '🚀 立即升级专业版';
        upgradeBtn.style.backgroundColor = '#f44336';
        upgradeBtn.style.animation = 'pulse 2s infinite';
      } else if (remaining <= 3) {
        upgradeBtn.style.display = 'block';
        upgradeBtn.innerHTML = '⭐ 升级专业版';
        upgradeBtn.style.backgroundColor = '#ff9800';
        upgradeBtn.style.animation = 'none';
      } else {
        upgradeBtn.style.display = 'block';
        upgradeBtn.innerHTML = '⭐ 升级专业版';
        upgradeBtn.style.backgroundColor = '#4CAF50';
        upgradeBtn.style.animation = 'none';
      }
      
      // 隐藏授权码按钮
      if (activateBtn) activateBtn.style.display = 'none';
    }
  }

  // 增强版消息发送，支持超时
  async sendMessage(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('消息发送超时'));
      }, timeout);
      
      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            console.error('消息发送错误:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('消息发送异常:', error);
        reject(error);
      }
    });
  }

  async startRecording() {
    try {
      // 检查使用限制
      if (!this.usageInfo.isPremium) {
        const remaining = this.usageInfo.remainingPages || 0;
        if (remaining <= 0) {
          this.showUpgradePrompt('免费版已达到20页限制，请升级专业版继续使用');
          return;
        }
      }
      
      // 先立即更新UI，给用户即时反馈
      this.isRecording = true;
      const status = document.getElementById('status');
      if (status) {
        status.textContent = '正在记录...';
        status.className = 'status recording';
        // 强制重绘DOM
        status.style.backgroundColor = '#e8f5e8';
        status.style.color = '#2d5a2d';
        status.style.border = '1px solid #4caf50';
      }
      
      // 更新按钮状态
      const startBtn = document.getElementById('startBtn');
      const stopBtn = document.getElementById('stopBtn');
      const exportBtn = document.getElementById('exportBtn');
      
      if (startBtn) {
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';
      }
      
      if (stopBtn) {
        stopBtn.disabled = false;
        stopBtn.style.opacity = '1';
      }
      
      if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.style.opacity = '0.5';
      }
      
      // 启动计时器
      this.startTime = Date.now();
      this.startDurationTimer();
      
      // 发送消息到background
      const response = await this.sendMessage({ action: 'startRecording' });
      
      if (!response.success) {
        if (response.error === 'USAGE_LIMIT_EXCEEDED') {
          this.showUpgradePrompt(response.message);
          // 恢复UI状态
          this.isRecording = false;
          this.updateUI();
          this.stopDurationTimer();
          return;
        } else if (response.error === 'SUBSCRIPTION_EXPIRED') {
          this.handleSubscriptionExpired();
          // 恢复UI状态
          this.isRecording = false;
          this.updateUI();
          this.stopDurationTimer();
          return;
        }
        throw new Error(response.message);
      }
      
      // 保存录制状态到storage
      await chrome.storage.local.set({
        isRecording: true,
        recordingStartTime: this.startTime
      });
      
    } catch (error) {
      console.error('开始记录失败:', error);
      alert('开始记录失败: ' + error.message);
      
      // 恢复UI状态
      this.isRecording = false;
      this.updateUI();
      this.stopDurationTimer();
    }
  }

  async stopRecording() {
    try {
      // 先立即更新UI，给用户即时反馈
      this.isRecording = false;
      this.stopDurationTimer();
      
      // 更新状态显示
      const status = document.getElementById('status');
      if (status) {
        status.textContent = '未开始记录';
        status.className = 'status stopped';
        // 强制重绘DOM
        status.style.backgroundColor = '#f5f5f5';
        status.style.color = '#666';
        status.style.border = '1px solid #ccc';
      }
      
      // 更新按钮状态
      const startBtn = document.getElementById('startBtn');
      const stopBtn = document.getElementById('stopBtn');
      const exportBtn = document.getElementById('exportBtn');
      
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
      }
      
      if (stopBtn) {
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.5';
      }
      
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.style.opacity = '1';
      }
      
      // 强制DOM重绘
      void status.offsetWidth;
      
      // 发送消息到background
      await this.sendMessage({ action: 'stopRecording' });
      
      // 重置时间
      this.startTime = null;
      
      // 更新storage
      await chrome.storage.local.set({
        isRecording: false,
        recordingStartTime: null
      });
      
      // 刷新使用状态和统计
      await this.loadPluginInfo();
      await this.updateStats();
      
    } catch (error) {
      console.error('停止记录失败:', error);
      alert('停止记录失败: ' + error.message);
      
      // 如果出错，恢复录制状态
      this.isRecording = true;
      this.updateUI();
      if (this.startTime) {
        this.startDurationTimer();
      }
    }
  }

  showUpgradePrompt(message) {
    const modal = document.getElementById('upgradeModal');
    const messageEl = document.getElementById('upgradeMessage');
    messageEl.textContent = message;
    modal.style.display = 'flex';
    
    // 绑定升级按钮事件
    document.getElementById('upgradeNowBtn').onclick = () => {
      this.openUpgradePage();
      modal.style.display = 'none';
    };
    
    document.getElementById('cancelUpgrade').onclick = () => {
      modal.style.display = 'none';
    };
  }

  showActivationDialog() {
    const modal = document.getElementById('activationModal');
    modal.style.display = 'flex';
    document.getElementById('authCodeInput').focus();
  }

  hideActivationDialog() {
    const modal = document.getElementById('activationModal');
    modal.style.display = 'none';
    document.getElementById('authCodeInput').value = '';
    document.getElementById('activationError').textContent = '';
  }

  async activatePlugin() {
    const authCode = document.getElementById('authCodeInput').value.trim();
    const errorEl = document.getElementById('activationError');
    const confirmBtn = document.getElementById('confirmActivation');
    
    if (!authCode) {
      errorEl.textContent = '请输入授权码';
      return;
    }
    
    confirmBtn.disabled = true;
    confirmBtn.textContent = '激活中...';
    
    try {
      const response = await this.sendMessage({ 
        action: 'activatePlugin', 
        authCode: authCode 
      });
      
      if (response.success) {
        this.hideActivationDialog();
        alert('激活成功！欢迎使用专业版功能。');
        await this.loadPluginInfo();
      } else {
        errorEl.textContent = response.error || '激活失败';
      }
    } catch (error) {
      errorEl.textContent = '网络错误，请重试';
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '确认激活';
    }
  }

  openUpgradePage() {
    this.sendMessage({ action: 'openUpgradePage' });
  }

  startDurationTimer() {
    this.durationInterval = setInterval(() => {
      if (this.startTime) {
        const duration = Date.now() - this.startTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        document.getElementById('duration').textContent = 
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  stopDurationTimer() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    document.getElementById('duration').textContent = '00:00';
  }

  updateUI() {
    const status = document.getElementById('status');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    if (this.isRecording) {
      // 更新状态显示
      status.textContent = '正在记录...';
      status.className = 'status recording';
      
      // 强制应用样式（确保立即生效）
      status.style.backgroundColor = '#e8f5e8';
      status.style.color = '#2d5a2d';
      status.style.border = '1px solid #4caf50';
      
      // 更新按钮状态
      startBtn.disabled = true;
      stopBtn.disabled = false;
      exportBtn.disabled = true;
      clearBtn.disabled = true; // 录制时禁用清空按钮
      
      // 添加视觉反馈
      startBtn.style.opacity = '0.5';
      stopBtn.style.opacity = '1';
      exportBtn.style.opacity = '0.5';
      clearBtn.style.opacity = '0.5';
      
      // 强制DOM重绘
      void status.offsetWidth;
    } else {
      // 更新状态显示
      status.textContent = '未开始记录';
      status.className = 'status stopped';
      
      // 强制应用样式（确保立即生效）
      status.style.backgroundColor = '#f5f5f5';
      status.style.color = '#666';
      status.style.border = '1px solid #ccc';
      
      // 更新按钮状态
      startBtn.disabled = false;
      stopBtn.disabled = true;
      exportBtn.disabled = false;
      clearBtn.disabled = false; // 非录制时启用清空按钮
      
      // 恢复视觉状态
      startBtn.style.opacity = '1';
      stopBtn.style.opacity = '0.5';
      exportBtn.style.opacity = '1';
      clearBtn.style.opacity = '1';
      
      // 强制DOM重绘
      void status.offsetWidth;
    }
  }

  async exportDocument() {
    try {
      // 获取所有操作记录
      const result = await chrome.storage.local.get(['operations']);
      const operations = result.operations || [];
      
      if (operations.length === 0) {
        alert('没有可导出的操作记录，请先进行一些操作。');
        return;
      }
      
      // 检查截图数量限制
      const screenshots = operations.filter(op => op.type === 'click' && op.screenshot).length;
      
      if (this.usageInfo && !this.usageInfo.isPremium && screenshots > 20) {
        // 免费版超过20张截图时，只导出前20张，并提示升级
        const limitedOperations = operations.filter(op => op.type === 'click' && op.screenshot).slice(0, 20);
        alert(`免费版限制20张截图，将导出前20张截图。升级专业版可导出全部${screenshots}张截图！`);
        this.showExportOptions(limitedOperations);
        return;
      }
      
      // 显示导出选项（专业版）
      const exportOperations = operations.filter(op => op.type === 'click' && op.screenshot);
      this.showExportOptions(exportOperations);
      
    } catch (error) {
      console.error('导出文档失败:', error);
      alert('导出文档失败: ' + error.message);
    }
  }
  
  showExportOptions(operations) {
    // 创建导出选项对话框
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background-color: white;
      border-radius: 8px;
      padding: 20px;
      width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    
    dialog.innerHTML = `
      <h3 style="margin-top: 0; color: #333; font-size: 18px;">选择导出格式</h3>
      <p style="color: #666; font-size: 14px;">共 ${operations.length} 个操作步骤</p>
      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
        <button id="exportPDF" style="padding: 10px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          <span style="font-size: 16px;">📄 PDF格式</span>
          <span style="display: block; font-size: 12px; font-weight: normal; margin-top: 3px;">通过打印对话框保存，仅包含截图</span>
        </button>
        <button id="exportWord" style="padding: 10px; background-color: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          <span style="font-size: 16px;">📝 Word格式</span>
          <span style="display: block; font-size: 12px; font-weight: normal; margin-top: 3px;">直接下载DOCX文件，仅包含截图</span>
        </button>
        <button id="exportMarkdown" style="padding: 10px; background-color: #607D8B; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          <span style="font-size: 16px;">📋 Markdown格式</span>
          <span style="display: block; font-size: 12px; font-weight: normal; margin-top: 3px;">直接下载MD文件，仅包含截图</span>
        </button>
        <button id="cancelExport" style="padding: 8px; background-color: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; margin-top: 5px;">
          取消
        </button>
      </div>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // 绑定事件
    document.getElementById('exportPDF').addEventListener('click', () => {
      modal.remove();
      this.exportToPDF(operations);
    });
    
    document.getElementById('exportWord').addEventListener('click', () => {
      modal.remove();
      this.exportToWord(operations);
    });
    
    document.getElementById('exportMarkdown').addEventListener('click', () => {
      modal.remove();
      this.exportToMarkdown(operations);
    });
    
    document.getElementById('cancelExport').addEventListener('click', () => {
      modal.remove();
    });
  }


  
  async exportToPDF(operations) {
    try {
      // 生成专门为PDF设计的HTML内容
      const htmlContent = this.generatePDFDocument(operations);
      
      // 创建新窗口来显示HTML内容
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // 等待文档加载完成
      printWindow.onload = () => {
        setTimeout(() => {
          // 显示操作指南
          alert('即将打开打印对话框，请按以下步骤操作：\n\n1. 在打印对话框中选择"另存为PDF"\n2. 设置纸张大小为A4\n3. 选择保存位置并点击保存');
          
          setTimeout(() => {
            printWindow.print();
          }, 1000);
        }, 500);
      };
      
    } catch (error) {
      console.error('导出PDF失败:', error);
      alert('导出PDF失败: ' + error.message);
    }
  }
  
  generatePDFDocument(operations) {
    // 生成专门为PDF的HTML文档，包含操作描述和截图
    let stepsHtml = '';
    operations.forEach((op, index) => {
      const stepNumber = index + 1;
      
      if (op.screenshot) {
        // 生成步骤标题，包含操作描述
        let stepTitle = `步骤 ${stepNumber}`;
        if (op.action && op.element) {
          const elementText = op.text ? ` "${op.text}"` : '';
          stepTitle = `步骤 ${stepNumber}: ${op.action}${elementText}`;
        } else if (op.text) {
          stepTitle = `步骤 ${stepNumber}: ${op.text}`;
        }
        
        stepsHtml += `
          <div class="step-section">
            <h2 class="step-title">${stepTitle}</h2>
            <div class="screenshot-container">
              <img src="${op.screenshot}" alt="步骤${stepNumber}截图" class="screenshot-img" />
            </div>
          </div>
        `;
      }
    });
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>操作流程文档</title>
    <style>
        @media print {
            body { margin: 0; padding: 20px; }
            .step-section { page-break-inside: avoid; margin-bottom: 30px; }
            .no-print { display: none; }
        }
        @media screen {
            body { margin: 20px; }
        }
        body {
            font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif;
            color: #333;
            line-height: 1.6;
        }
        .document-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 15px;
        }
        .document-header h1 {
            font-size: 24px;
            margin: 0;
            color: #333;
        }
        .step-section {
            margin-bottom: 30px;
            text-align: center;
        }
        .step-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
        }
        .action-description {
            background-color: #f8f9fa;
            padding: 10px 15px;
            margin: 10px auto 15px auto;
            border-radius: 6px;
            color: #333;
            font-size: 14px;
            max-width: 80%;
            border-left: 4px solid #4CAF50;
            text-align: left;
            font-weight: 500;
        }
        .screenshot-container {
            margin: 15px 0;
        }
        .screenshot-img {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .no-print {
            display: none;
        }
    </style>
</head>
<body>
    <div class="no-print">
        <strong>提示：</strong>请使用浏览器的打印功能（Ctrl+P），并选择"另存为PDF"来保存为PDF文件。
    </div>
    
    <div class="document-header">
        <h1>操作流程文档</h1>
    </div>
    
    <div class="document-content">
        ${stepsHtml}
    </div>
</body>
</html>`;
  }

  async exportToWord(operations) {
    try {
      // 使用HTML方式生成Word文档，这样更容易被Word打开
      const htmlContent = this.generateWordHTMLDocument(operations);
      
      // 创建Blob对象
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `操作流程文档_${timestamp}.doc`;
      
      // 创建下载链接并触发下载
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      alert(`Word文档已下载！文件名: ${filename}`);
      
    } catch (error) {
      console.error('导出Word失败:', error);
      alert('导出Word失败: ' + error.message);
    }
  }

  generateWordHTMLDocument(operations) {
    // 使用HTML格式生成Word文档，包含播放图标、操作描述和截图
    let stepsHtml = '';
    operations.forEach((op, index) => {
      const stepNumber = index + 1;
      
      // 添加播放图标、操作描述和截图
      let contentHtml = '';
      if (op.screenshot) {
        // 生成步骤标题，包含操作描述
        let stepTitle = `步骤 ${stepNumber}`;
        if (op.action && op.element) {
          const elementText = op.text ? ` "${op.text}"` : '';
          stepTitle = `步骤 ${stepNumber}: ${op.action}${elementText}`;
        } else if (op.text) {
          stepTitle = `步骤 ${stepNumber}: ${op.text}`;
        }
        
        // 播放图标，显示在标题右侧
        const playButton = op.url ? `
          <a href="${op.url}" target="_blank" style="display: inline-block; color: #6c5ce7; text-decoration: none; font-size: 24px; margin-left: 15px; vertical-align: middle;">
            ▶️
          </a>
        ` : '';
        
        contentHtml = `
          <div style="text-align: center; margin: 15px 0;">
            <h2 style="font-size: 18px; color: #333; margin-bottom: 15px; display: flex; align-items: center; justify-content: center;">
              ${stepTitle}${playButton}
            </h2>
            <img src="${op.screenshot}" alt="步骤${stepNumber}截图" style="max-width: 100%; width: 20cm; height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);" />
          </div>
        `;
      }
      
      stepsHtml += `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
          ${contentHtml}
        </div>
      `;
    });
    
    const htmlDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>操作流程文档</title>
        <style>
          body {
            font-family: 'Microsoft YaHei', SimHei, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            max-width: 25cm;
            margin: 0 auto;
          }
          h1 {
            font-size: 24px;
            color: #333;
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
          }
          h2 {
            font-size: 18px;
            color: #333;
            margin-top: 20px;
            margin-bottom: 10px;
          }
          img {
            max-width: 100%;
            width: 20cm;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          a {
            transition: all 0.3s ease;
          }
          a:hover {
            background: #5a4fcf !important;
            transform: scale(1.05);
          }
          @page {
            size: A4 landscape;
            margin: 2cm;
          }
          @media print {
            body {
              max-width: 25cm;
              margin: 0 auto;
            }
            img {
              max-width: 100% !important;
              width: 20cm !important;
              height: auto !important;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <h1>操作流程文档</h1>
        ${stepsHtml}
      </body>
      </html>
    `;
    
    return htmlDoc;
  }
  
  async exportToMarkdown(operations) {
    try {
      // 生成Markdown内容
      const mdContent = this.generateMarkdownDocument(operations);
      
      // 创建Blob对象
      const blob = new Blob([mdContent], { type: 'text/markdown' });
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `操作流程文档_${timestamp}.md`;
      
      // 创建下载链接并触发下载
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      alert(`Markdown文档已下载！文件名: ${filename}\n\n提示：截图已嵌入在Markdown文件中，可直接查看。`);
      
    } catch (error) {
      console.error('导出Markdown失败:', error);
      alert('导出Markdown失败: ' + error.message);
    }
  }
  
  async exportScreenshots(operations, timestamp) {
    try {
      // 创建一个ZIP文件来存储所有截图
      const JSZip = await this.loadJSZip();
      const zip = new JSZip();
      const imgFolder = zip.folder("screenshots");
      
      // 添加每个截图到ZIP文件
      operations.forEach((op, index) => {
        if (op.screenshot) {
          // 从base64数据中提取实际的图片数据
          const imgData = op.screenshot.split(',')[1];
          imgFolder.file(`screenshot_${index+1}.jpg`, imgData, {base64: true});
        }
      });
      
      // 生成ZIP文件并下载
      zip.generateAsync({type:"blob"}).then((content) => {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `操作流程截图_${timestamp}.zip`;
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        alert(`截图已打包下载！请解压后与Markdown文档一起查看。`);
      });
    } catch (error) {
      console.error('导出截图失败:', error);
      alert('导出截图失败: ' + error.message + '\n请使用Word或PDF格式查看完整截图。');
    }
  }
  
  async loadJSZip() {
    // 动态加载JSZip库
    return new Promise((resolve, reject) => {
      if (window.JSZip) {
        resolve(window.JSZip);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error('无法加载JSZip库'));
      document.head.appendChild(script);
    });
  }
  
  generateMarkdownDocument(operations) {
    // 生成Markdown文档，直接嵌入base64截图
    let mdContent = `# 操作流程文档\n\n`;
    
    operations.forEach((op, index) => {
      const stepNumber = index + 1;
      
      // 生成步骤标题，包含操作描述
      let stepTitle = `## 步骤 ${stepNumber}`;
      if (op.action && op.element) {
        const elementText = op.text ? ` "${op.text}"` : '';
        stepTitle = `## 步骤 ${stepNumber}: ${op.action}${elementText}`;
      } else if (op.text) {
        stepTitle = `## 步骤 ${stepNumber}: ${op.text}`;
      }
      
      // 添加播放图标（在标题同一行）
      if (op.url) {
        stepTitle += ` [▶️](${op.url})`;
      }
      
      mdContent += `${stepTitle}\n\n`;
      
      // 直接嵌入base64截图
      if (op.screenshot) {
        mdContent += `![步骤${stepNumber}截图](${op.screenshot})\n\n`;
      }
      
      mdContent += `---\n\n`;
    });
    
    return mdContent;
  }



  async clearRecords() {
    if (confirm('确定要清空所有记录吗？')) {
      await chrome.storage.local.set({ operations: [] });
      await this.loadPluginInfo();
      alert('记录已清空');
    }
  }
}

// 初始化控制器
document.addEventListener('DOMContentLoaded', () => {
  window.popupController = new PopupController();
});
