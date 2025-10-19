class ContentRecorder {
  constructor() {
    this.isRecording = false;
    this.clickHandler = null;
    this.lastScreenshotTime = 0;
    this.screenshotDelay = 500;
    this.stateCheckInterval = null;
    this.init();
  }

  init() {
    console.log('Content script初始化开始');
    
    this.setupMessageListener();
    this.checkRecordingState();
    
    this.stateCheckInterval = setInterval(() => {
      this.checkRecordingState();
    }, 3000);
    
    console.log('Content script初始化完成');
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content script收到消息:', request);
      try {
        const messageHandlers = {
          ping: () => this.handlePing(),
          startRecording: () => this.startRecording(),
          stopRecording: () => this.stopRecording(),
          getRecordingState: () => ({ isRecording: this.isRecording })
        };

        const handler = messageHandlers[request.action];
        if (handler) {
          const result = handler();
          sendResponse({ success: true, ...result });
        } else {
          console.log('未知消息类型:', request.action);
          sendResponse({ success: false, error: '未知消息类型' });
        }
      } catch (error) {
        console.error('Content script处理消息时出错:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    });
  }

  handlePing() {
    console.log('Content script响应ping消息');
    return { message: 'content script is active', timestamp: Date.now() };
  }

  async checkRecordingState() {
    try {
      if (!chrome.runtime || !chrome.runtime.id) {
        return;
      }
      
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('ping timeout'));
          }, 3000);
          
          chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
      } catch (error) {
        return;
      }
      
      const result = await chrome.storage.local.get(['isRecording']);
      
      if (result.isRecording && !this.isRecording) {
        console.log('检测到录制状态，启动录制');
        this.startRecording();
      } else if (!result.isRecording && this.isRecording) {
        console.log('检测到停止状态，停止录制');
        this.stopRecording();
      }
    } catch (error) {
      console.error('检查录制状态失败:', error);
      if (error.message.includes('Extension context invalidated')) {
        setTimeout(() => {
          this.checkRecordingState();
        }, 3000);
      }
    }
  }

  startRecording() {
    if (this.isRecording) return;
    
    this.isRecording = true;
    console.log('Content: 开始录制操作');
    
    this.clickHandler = (event) => {
      console.log('Content: 检测到点击事件', event);
      this.handleClick(event);
    };
    document.addEventListener('click', this.clickHandler, true);
    
    console.log('Content: 点击监听器已添加');
  }

  stopRecording() {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    console.log('停止录制操作');
    
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
  }

  async handleClick(event) {
    console.log('Content: handleClick被调用，录制状态:', this.isRecording);
    
    if (!this.isRecording) {
      console.log('Content: 不在录制状态，忽略点击');
      return;
    }
    
    const target = event.target;
    const currentTime = Date.now();
    
    if (currentTime - this.lastScreenshotTime < this.screenshotDelay) {
      console.log('截图频率限制，跳过此次点击');
      return;
    }
    
    const x = event.clientX;
    const y = event.clientY;
    
    const elementInfo = this.getElementInfo(target);
    const text = this.getElementText(target);
    
    console.log('Content: 处理点击事件:', { x, y, element: elementInfo, target: target.tagName });

    try {
      if (!chrome.runtime || !chrome.runtime.id) {
        console.error('Chrome runtime对象不存在');
        this.handleContextInvalidated();
        return;
      }
      
      this.lastScreenshotTime = currentTime;
      
      console.log('Content: 添加点击标记');
      const marker = this.addClickMarker(x, y);
      
      console.log('Content: 开始等待页面变化');
      await this.waitForPageChange();
      console.log('Content: 页面变化等待完成');
      
      console.log('Content: 发送截图请求');
      const response = await this.sendMessageSafely({
        action: 'captureScreenshot',
        data: {
          x: x,
          y: y,
          element: elementInfo,
          text: text,
          url: window.location.href,
          title: document.title,
          timestamp: currentTime
        }
      });
      
      if (marker && marker.parentNode) {
        marker.parentNode.removeChild(marker);
        console.log('Content: 点击标记已移除');
      }
      
      if (response && response.success) {
        console.log('Content: 截图成功');
      } else {
        console.error('Content: 截图失败:', response?.error);
        
        if (response && response.error === 'USAGE_LIMIT_EXCEEDED') {
          console.log('Content: 达到使用限制，显示升级提示');
          this.showUpgradeModal(response.message || '免费版已达到20张截图限制，请升级专业版继续使用！');
          return;
        }
        
        if (response && response.message) {
          this.showErrorMessage(response.message);
        }
      }
      
    } catch (error) {
      console.error('Content: 记录点击失败:', error);
      this.handleError(error);
    }
  }

  async waitForPageChange() {
    return new Promise((resolve) => {
      let changeDetected = false;
      let timeoutId;
      let stabilityTimer;
      let changeCount = 0;
      let lastChangeTime = Date.now();
      
      console.log('Content: 开始智能监听页面变化');
      
      const isPageLoading = () => {
        if (document.readyState !== 'complete') {
          console.log('Content: 页面仍在加载 (readyState:', document.readyState + ')');
          return true;
        }
        
        const images = Array.from(document.images);
        const incompleteImages = images.filter(img => !img.complete);
        if (incompleteImages.length > 0) {
          console.log(`Content: 有${incompleteImages.length}张图片仍在加载`);
          return true;
        }
        
        const loadingSelectors = [
          '.loading', '.spinner', '.ant-spin', '.el-loading',
          '[class*=\"loading\"]:not([class*=\"loaded\"])', 
          '[class*=\"spinner\"]', '.progress', '.loader'
        ];
        
        for (const selector of loadingSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              for (const el of elements) {
                const style = window.getComputedStyle(el);
                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                  console.log('Content: 发现活跃的加载指示器:', selector);
                  return true;
                }
              }
            }
          } catch (e) {
            // 忽略选择器错误
          }
        }
        
        return false;
      };
      
      const hasPageContent = () => {
        const contentElements = document.querySelectorAll('h1, h2, h3, p, div > img, table, ul, ol');
        return contentElements.length > 5;
      };
      
      const checkPageStability = () => {
        if (isPageLoading()) {
          console.log('Content: 页面仍在加载，继续等待...');
          lastChangeTime = Date.now();
          return false;
        }
        
        if (!hasPageContent()) {
          console.log('Content: 页面内容不足，可能尚未完全加载');
          return false;
        }
        
        console.log('Content: 页面已稳定，可以截图');
        return true;
      };
      
      const observer = new MutationObserver((mutations) => {
        const relevantMutations = mutations.filter(mutation => {
          if (mutation.target && (
            mutation.target.className === 'click-marker' ||
            mutation.target.id === 'recording-indicator' ||
            mutation.target.id === 'click-marker-style' ||
            mutation.target.id === 'recording-indicator-style'
          )) {
            return false;
          }
          
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            return false;
          }
          
          if (mutation.type === 'childList') {
            const addedNodes = Array.from(mutation.addedNodes);
            const removedNodes = Array.from(mutation.removedNodes);
            
            const isOurElement = (node) => {
              return node.nodeType === Node.ELEMENT_NODE && (
                node.className === 'click-marker' ||
                node.id === 'recording-indicator' ||
                node.id === 'click-marker-style' ||
                node.id === 'recording-indicator-style'
              );
            };
            
            if (addedNodes.length > 0 && addedNodes.every(isOurElement)) {
              return false;
            }
            if (removedNodes.length > 0 && removedNodes.every(isOurElement)) {
              return false;
            }
            
            const hasSignificantChange = addedNodes.some(node => 
              node.nodeType === Node.ELEMENT_NODE && 
              !node.className?.includes('click-marker')
            ) || removedNodes.some(node => 
              node.nodeType === Node.ELEMENT_NODE && 
              !node.className?.includes('click-marker')
            );
            
            return hasSignificantChange;
          }
          
          return true;
        });
        
        if (relevantMutations.length > 0) {
          changeDetected = true;
          changeCount++;
          lastChangeTime = Date.now();
          console.log('Content: 检测到页面变化 #' + changeCount);
          
          if (stabilityTimer) {
            clearTimeout(stabilityTimer);
          }
          
          const checkStability = () => {
            if (checkPageStability()) {
              observer.disconnect();
              clearTimeout(timeoutId);
              resolve();
            } else {
              stabilityTimer = setTimeout(checkStability, 500);
            }
          };
          
          stabilityTimer = setTimeout(checkStability, 500);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'src']
      });
      
      timeoutId = setTimeout(() => {
        console.log('Content: 等待超时，检查页面状态');
        observer.disconnect();
        if (stabilityTimer) {
          clearTimeout(stabilityTimer);
        }
        
        const timeSinceLastChange = Date.now() - lastChangeTime;
        
        if (timeSinceLastChange > 1000) {
          console.log('Content: 页面已有1秒无变化，可以截图');
          resolve();
        } else if (checkPageStability()) {
          console.log('Content: 页面看起来已经稳定，可以截图');
          resolve();
        } else {
          console.log('Content: 页面仍不稳定，额外等待500ms');
          setTimeout(resolve, 500);
        }
      }, 3000);
      
      if (document.readyState !== 'complete') {
        console.log('Content: 添加load事件监听');
        window.addEventListener('load', () => {
          console.log('Content: 页面load事件触发');
          setTimeout(() => {
            if (checkPageStability()) {
              console.log('Content: 页面加载完成且稳定，可以截图');
              observer.disconnect();
              clearTimeout(timeoutId);
              if (stabilityTimer) {
                clearTimeout(stabilityTimer);
              }
              resolve();
            }
          }, 500);
        }, { once: true });
      }
    });
  }

  handleContextInvalidated() {
    console.log('插件上下文失效，停止录制');
    this.isRecording = false;
    this.showErrorMessage('插件需要重新加载，请刷新页面或重新启动插件');
  }

  handleError(error) {
    if (error.message.includes('Extension context invalidated')) {
      this.handleContextInvalidated();
    } else if (error.message.includes('quota exceeded') || error.message.includes('MAX_CAPTURE')) {
      console.log('截图配额超限，增加延迟');
      this.screenshotDelay = 5000;
      this.showErrorMessage('截图频率过高，已自动降低频率');
    } else if (error.message.includes('截图超时')) {
      console.log('截图超时，可能是页面响应慢');
      this.showErrorMessage('截图超时，请稍后再试');
    }
  }

  addClickMarker(x, y) {
    console.log('添加点击标记:', x, y);
    
    const existingMarker = document.getElementById('click-marker');
    if (existingMarker) {
      existingMarker.remove();
    }
    
    const marker = document.createElement('div');
    marker.id = 'click-marker';
    marker.style.cssText = `
      position: fixed !important;
      left: ${x - 15}px !important;
      top: ${y - 15}px !important;
      width: 30px !important;
      height: 30px !important;
      border: 3px solid #ffeb3b !important;
      border-radius: 50% !important;
      background: rgba(255, 235, 59, 0.3) !important;
      z-index: 999999 !important;
      pointer-events: none !important;
      animation: clickPulse 1s ease-out !important;
    `;
    
    if (!document.getElementById('click-marker-style')) {
      const style = document.createElement('style');
      style.id = 'click-marker-style';
      style.textContent = `
        @keyframes clickPulse {
          0% { transform: scale(0.5); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
          100% { transform: scale(1); opacity: 0.6; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(marker);
    console.log('点击标记已添加到DOM');
    
    return marker;
  }

  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50px;
      right: 10px;
      background: rgba(255, 0, 0, 0.9);
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 10001;
      max-width: 300px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 3000);
  }

  showUpgradeModal(message) {
    console.log('Content: 显示升级提示弹窗');
    
    const existingPrompt = document.getElementById('upgrade-prompt');
    if (existingPrompt) {
      existingPrompt.remove();
    }

    const promptDiv = document.createElement('div');
    promptDiv.id = 'upgrade-prompt';
    promptDiv.style.cssText = `
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      background: white !important;
      padding: 30px !important;
      border-radius: 15px !important;
      font-size: 16px !important;
      z-index: 999999 !important;
      max-width: 450px !important;
      width: 90% !important;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
      border: 3px solid #ff4444 !important;
      text-align: center !important;
      font-family: 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif !important;
    `;
    
    // 使用安全的DOM操作替代innerHTML
    const titleDiv = document.createElement('div');
    titleDiv.textContent = '🚀 升级专业版';
    titleDiv.style.cssText = 'color: #ff4444; font-weight: bold; margin-bottom: 20px; font-size: 20px;';
    
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = 'color: #333; margin-bottom: 25px; line-height: 1.6; font-size: 16px;';
    
    const featuresDiv = document.createElement('div');
    featuresDiv.textContent = '专业版功能：无限截图、高级导出、优先支持';
    featuresDiv.style.cssText = 'color: #666; margin-bottom: 25px; font-size: 14px;';
    
    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.cssText = 'display: flex; gap: 15px; justify-content: center;';
    
    const upgradeBtn = document.createElement('button');
    upgradeBtn.id = 'upgradeNowBtn';
    upgradeBtn.textContent = '立即升级';
    upgradeBtn.style.cssText = `
      background: linear-gradient(135deg, #ff4444, #ff6666);
      color: white;
      border: none;
      padding: 12px 25px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.3s ease;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'closePromptBtn';
    closeBtn.textContent = '稍后再说';
    closeBtn.style.cssText = `
      background: #f0f0f0;
      color: #666;
      border: none;
      padding: 12px 25px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
    `;
    
    buttonsDiv.appendChild(upgradeBtn);
    buttonsDiv.appendChild(closeBtn);
    
    promptDiv.appendChild(titleDiv);
    promptDiv.appendChild(messageDiv);
    promptDiv.appendChild(featuresDiv);
    promptDiv.appendChild(buttonsDiv);
    
    document.body.appendChild(promptDiv);
    console.log('Content: 升级提示弹窗已添加到DOM');
    
    upgradeBtn.addEventListener('click', () => {
      console.log('Content: 用户点击立即升级');
      window.open('http://localhost:3000/#pricing', '_blank');
      promptDiv.remove();
    });
    
    upgradeBtn.addEventListener('mouseover', () => {
      upgradeBtn.style.transform = 'scale(1.05)';
      upgradeBtn.style.boxShadow = '0 5px 15px rgba(255, 68, 68, 0.4)';
    });
    
    upgradeBtn.addEventListener('mouseout', () => {
      upgradeBtn.style.transform = 'scale(1)';
      upgradeBtn.style.boxShadow = 'none';
    });
    
    closeBtn.addEventListener('click', () => {
      console.log('Content: 用户点击稍后再说');
      promptDiv.remove();
    });
    
    setTimeout(() => {
      if (promptDiv.parentNode) {
        console.log('Content: 升级提示弹窗自动关闭');
        promptDiv.remove();
      }
    }, 10000);
  }

  getElementInfo(element) {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    
    let className = '';
    if (element.className && typeof element.className === 'string') {
      className = `.${element.className.split(' ').filter(c => c.trim()).join('.')}`;
    } else if (element.className && element.className.baseVal) {
      className = `.${element.className.baseVal}`;
    }
    
    const text = element.textContent ? element.textContent.trim().substring(0, 50) : '';
    
    return `${tagName}${id}${className}${text ? ` [${text}]` : ''}`;
  }

  getElementText(element) {
    if (element.value) return element.value;
    if (element.textContent) return element.textContent.trim().substring(0, 100);
    if (element.alt) return element.alt;
    if (element.title) return element.title;
    return '';
  }

  async sendMessageSafely(message) {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          console.error('Chrome runtime不可用');
          reject(new Error('Extension context invalidated'));
          return;
        }

        console.log('发送消息到background:', message);
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.error('消息发送失败:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log('收到background响应:', response);
            resolve(response);
          }
        });
      } catch (error) {
        console.error('发送消息异常:', error);
        reject(error);
      }
    });
  }
  
  cleanup() {
    console.log('Content script开始清理...');
    
    this.stopRecording();
    
    if (this.stateCheckInterval) {
      clearInterval(this.stateCheckInterval);
      this.stateCheckInterval = null;
      console.log('状态检查定时器已清理');
    }
    
    this.isRecording = false;
    this.clickHandler = null;
    
    console.log('Content script清理完成');
  }
}

// 防重复加载机制
(function(global) {
  'use strict';
  
  const UNIQUE_ID = 'zhiliuhuaxie_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  if (global.__ZHILIUHUAXIE_LOADED__) {
    console.log('智流华写插件已加载，跳过重复初始化');
    return;
  }
  
  global.__ZHILIUHUAXIE_LOADED__ = UNIQUE_ID;
  
  setTimeout(() => {
    if (global.__ZHILIUHUAXIE_LOADED__ !== UNIQUE_ID) {
      console.log('检测到多个实例，当前实例退出');
      return;
    }
    
    function initializeRecorder() {
      if (global.zhiliuhuaxieContentRecorder) {
        console.log('录制器实例已存在，跳过创建');
        return;
      }
      
      try {
        console.log('创建智流华写录制器实例 - ID:', UNIQUE_ID);
        global.zhiliuhuaxieContentRecorder = new ContentRecorder();
        global.zhiliuhuaxieContentRecorder._instanceId = UNIQUE_ID;
      } catch (error) {
        console.error('创建录制器实例失败:', error);
      }
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeRecorder);
    } else {
      initializeRecorder();
    }
  }, 10);
  
})(window);