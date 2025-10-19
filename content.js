class ContentRecorder {
  constructor() {
    this.isRecording = false;
    this.clickHandler = null;
    this.lastScreenshotTime = 0;
    this.screenshotDelay = 500; // 限制截图频率：每0.5秒最多1次，提高响应速度
    this.stateCheckInterval = null; // 状态检查定时器
    this.init();
  }

  init() {
    console.log('Content script初始化开始');
    
    // 直接设置消息监听器，不需要等待
    this.setupMessageListener();
    
    // 立即检查一次录制状态
    this.checkRecordingState();
    
    // 定期检查录制状态（每3秒检查一次，减少频率）
    this.stateCheckInterval = setInterval(() => {
      this.checkRecordingState();
    }, 3000);
    
    console.log('Content script初始化完成');
  }
  
  setupMessageListener() {
    // 监听来自background script的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content script收到消息:', request);
      try {
        switch (request.action) {
          case 'ping':
            // 响应ping消息，用于检测content script是否已注入
            console.log('Content script响应ping消息');
            sendResponse({ success: true, message: 'content script is active', timestamp: Date.now() });
            break;
          case 'startRecording':
            console.log('开始录制消息已接收');
            this.startRecording();
            sendResponse({ success: true, message: '开始录制' });
            break;
          case 'stopRecording':
            console.log('停止录制消息已接收');
            this.stopRecording();
            sendResponse({ success: true, message: '停止录制' });
            break;
          case 'getRecordingState':
            sendResponse({ isRecording: this.isRecording });
            break;
          default:
            console.log('未知消息类型:', request.action);
            sendResponse({ success: false, error: '未知消息类型' });
        }
      } catch (error) {
        console.error('Content script处理消息时出错:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // 保持消息通道开放
    });
  }

  async checkRecordingState() {
    try {
      // 检查chrome.runtime是否可用
      if (!chrome.runtime) {
        return;
      }
      
      // 如果runtime.id不存在，等待一段时间让service worker启动
      if (!chrome.runtime.id) {
        // 等待2秒后重试
        setTimeout(() => {
          this.checkRecordingState();
        }, 2000);
        return;
      }
      
      // 尝试通过发送测试消息来检查runtime是否真正可用
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
      
      // 直接从storage检查录制状态
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
      // 如果是扩展上下文失效，等待一段时间后重试
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
    
    // 添加点击监听器
    this.clickHandler = (event) => {
      console.log('Content: 检测到点击事件', event);
      this.handleClick(event);
    };
    document.addEventListener('click', this.clickHandler, true);
    
    // 不显示页面录制指示器，只在扩展图标上显示
    console.log('Content: 点击监听器已添加');
  }

  stopRecording() {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    console.log('停止录制操作');
    
    // 移除点击监听器
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
  }

  async handleClick(event) {
    console.log('Content: handleClick被调用，录制状态:', this.isRecording);
    
    // 如果不在录制状态，直接返回，不显示任何错误消息
    if (!this.isRecording) {
      console.log('Content: 不在录制状态，忽略点击');
      return;
    }
    
    const target = event.target;
    const currentTime = Date.now();
    
    // 限制截图频率，避免超出Chrome配额
    if (currentTime - this.lastScreenshotTime < this.screenshotDelay) {
      console.log('截图频率限制，跳过此次点击');
      return;
    }
    
    // 获取点击坐标（相对于视口）
    const x = event.clientX;
    const y = event.clientY;
    
    // 获取元素信息
    const elementInfo = this.getElementInfo(target);
    const text = this.getElementText(target);
    
    console.log('Content: 处理点击事件:', { x, y, element: elementInfo, target: target.tagName });

    // 记录点击操作并智能等待截图
    try {
      // 检查chrome.runtime是否可用
      if (!chrome.runtime) {
        console.error('Chrome runtime对象不存在');
        this.handleContextInvalidated();
        return;
      }
      
      if (!chrome.runtime.id) {
        console.error('Chrome runtime.id不可用，service worker可能未启动');
        this.showErrorMessage('扩展服务未就绪，请稍后再试或重新加载扩展');
        return;
      }
      
      this.lastScreenshotTime = currentTime;
      
      // 先添加点击标记
      console.log('Content: 添加点击标记');
      const marker = this.addClickMarker(x, y);
      
      // 智能等待页面响应点击事件，让DOM变化完成
      console.log('Content: 开始等待页面变化');
      await this.waitForPageChange();
      console.log('Content: 页面变化等待完成');
      
      // 发送截图请求
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
      
      // 移除点击标记
      if (marker && marker.parentNode) {
        marker.parentNode.removeChild(marker);
        console.log('Content: 点击标记已移除');
      }
      
      if (response && response.success) {
        console.log('Content: 截图成功');
      } else {
        console.error('Content: 截图失败:', response?.error);
        
        // 处理使用限制错误
        if (response && response.error === 'USAGE_LIMIT_EXCEEDED') {
          console.log('Content: 达到使用限制，显示升级提示');
          this.showUpgradeModal(response.message || '免费版已达到20张截图限制，请升级专业版继续使用！');
          return;
        }
        
        // 处理其他错误
        if (response && response.message) {
          this.showErrorMessage(response.message);
        }
      }
      
    } catch (error) {
      console.error('Content: 记录点击失败:', error);
      this.handleError(error);
    }
  }

  // 增强版智能等待页面变化完成
  async waitForPageChange() {
    return new Promise((resolve) => {
      let changeDetected = false;
      let timeoutId;
      let stabilityTimer;
      let changeCount = 0;
      let lastChangeTime = Date.now();
      
      console.log('Content: 开始增强版智能监听页面变化');
      
      // 检查页面是否仍在加载
      const isPageLoading = () => {
        // 检查document.readyState
        if (document.readyState !== 'complete') {
          console.log('Content: 页面仍在加载 (readyState:', document.readyState + ')');
          return true;
        }
        
        // 检查图片是否仍在加载
        const images = Array.from(document.images);
        const incompleteImages = images.filter(img => !img.complete);
        if (incompleteImages.length > 0) {
          console.log(`Content: 有${incompleteImages.length}张图片仍在加载`);
          return true;
        }
        
        // 检查常见的加载指示器
        const loadingSelectors = [
          '.loading', '.spinner', '.ant-spin', '.el-loading',
          '[class*="loading"]:not([class*="loaded"])', 
          '[class*="spinner"]', '.progress', '.loader',
          // 添加更多常见的加载指示器选择器
          '.MuiCircularProgress', '.v-progress-circular',
          '.ivu-spin', '.weui-loading', '.layui-layer-loading',
          '.el-loading-spinner', '.ant-spin-dot', '.van-loading',
          // 骨架屏
          '[class*="skeleton"]', '.ant-skeleton', '.el-skeleton',
          '.MuiSkeleton', '.v-skeleton-loader'
        ];
        
        for (const selector of loadingSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              // 检查元素是否真的在加载（有动画或显示状态）
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
        
        // 检查动画元素
        const animatingElements = document.querySelectorAll('[class*="animate"], [class*="transition"]');
        for (const el of animatingElements) {
          const style = window.getComputedStyle(el);
          if (style.animationName && style.animationName !== 'none' && 
              style.display !== 'none' && style.visibility !== 'hidden') {
            console.log('Content: 发现正在进行的动画');
            return true;
          }
        }
        
        return false;
      };
      
      // 检查页面内容是否已经渲染
      const hasPageContent = () => {
        // 检查页面是否有实际内容
        const contentElements = document.querySelectorAll('h1, h2, h3, p, div > img, table, ul, ol');
        return contentElements.length > 5; // 至少有5个内容元素
      };
      
      // 检查页面稳定性
      const checkPageStability = () => {
        if (isPageLoading()) {
          console.log('Content: 页面仍在加载，继续等待...');
          lastChangeTime = Date.now(); // 重置最后变化时间
          return false;
        }
        
        // 检查是否有足够的内容
        if (!hasPageContent()) {
          console.log('Content: 页面内容不足，可能尚未完全加载');
          return false;
        }
        
        console.log('Content: 页面已稳定，可以截图');
        return true;
      };
      
      // 监听DOM变化 - 增强版
      const observer = new MutationObserver((mutations) => {
        // 过滤掉我们自己添加的标记元素变化
        const relevantMutations = mutations.filter(mutation => {
          // 忽略我们自己添加的元素
          if (mutation.target && (
            mutation.target.className === 'click-marker' ||
            mutation.target.id === 'recording-indicator' ||
            mutation.target.id === 'click-marker-style' ||
            mutation.target.id === 'recording-indicator-style'
          )) {
            return false;
          }
          
          // 忽略样式变化（除非是重要的显示状态变化）
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            return false;
          }
          
          // 只关注重要的DOM结构变化
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
            
            // 如果只是我们自己的元素变化，忽略
            if (addedNodes.length > 0 && addedNodes.every(isOurElement)) {
              return false;
            }
            if (removedNodes.length > 0 && removedNodes.every(isOurElement)) {
              return false;
            }
            
            // 忽略文本节点的变化
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
          lastChangeTime = Date.now(); // 更新最后变化时间
          console.log('Content: 检测到页面变化 #' + changeCount);
          
          // 清除之前的稳定性计时器
          if (stabilityTimer) {
            clearTimeout(stabilityTimer);
          }
          
          // 检查页面稳定性
          const checkStability = () => {
            if (checkPageStability()) {
              observer.disconnect();
              clearTimeout(timeoutId);
              resolve();
            } else {
              // 如果页面不稳定，继续等待
              stabilityTimer = setTimeout(checkStability, 500);
            }
          };
          
          // 设置稳定性检查计时器
          stabilityTimer = setTimeout(checkStability, 500);
        }
      });
      
      // 开始观察DOM变化
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true, // 观察属性变化以捕获加载状态
        attributeFilter: ['style', 'class', 'src'] // 只关注这些属性
      });
      
      // 设置最大等待时间
      timeoutId = setTimeout(() => {
        console.log('Content: 等待超时，检查页面状态');
        observer.disconnect();
        if (stabilityTimer) {
          clearTimeout(stabilityTimer);
        }
        
        // 检查自上次变化以来的时间
        const timeSinceLastChange = Date.now() - lastChangeTime;
        
        if (timeSinceLastChange > 1000) {
          // 如果超过1秒没有变化，认为页面已稳定
          console.log('Content: 页面已有1秒无变化，可以截图');
          resolve();
        } else if (checkPageStability()) {
          // 如果页面看起来已经稳定，直接截图
          console.log('Content: 页面看起来已经稳定，可以截图');
          resolve();
        } else {
          // 如果页面仍不稳定但已超时，给予额外的短暂等待
          console.log('Content: 页面仍不稳定，额外等待500ms');
          setTimeout(resolve, 500);
        }
      }, 3000); // 增加到3秒最大等待时间
      
      // 添加页面加载事件监听
      if (document.readyState !== 'complete') {
        console.log('Content: 添加load事件监听');
        window.addEventListener('load', () => {
          console.log('Content: 页面load事件触发');
          // 页面加载完成后，给予短暂等待让JS执行
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

  // 处理上下文失效
  handleContextInvalidated() {
    console.log('插件上下文失效，停止录制');
    this.isRecording = false;
    
    // 显示错误提示
    this.showErrorMessage('插件需要重新加载，请刷新页面或重新启动插件');
  }

  // 统一错误处理
  handleError(error) {
    if (error.message.includes('Extension context invalidated')) {
      this.handleContextInvalidated();
    } else if (error.message.includes('quota exceeded') || error.message.includes('MAX_CAPTURE')) {
      console.log('截图配额超限，增加延迟');
      this.screenshotDelay = 5000; // 增加延迟到5秒
      this.showErrorMessage('截图频率过高，已自动降低频率');
    } else if (error.message.includes('截图超时')) {
      console.log('截图超时，可能是页面响应慢');
      this.showErrorMessage('截图超时，请稍后再试');
    }
  }

  // 添加点击标记
  addClickMarker(x, y) {
    console.log('添加点击标记:', x, y);
    
    // 移除之前的标记
    const existingMarker = document.getElementById('click-marker');
    if (existingMarker) {
      existingMarker.remove();
    }
    
    // 创建新的点击标记
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
    
    // 添加动画样式
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

  // 显示错误消息
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
    
    // 3秒后自动移除
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 3000);
  }

  // 显示升级提示弹窗
  showUpgradeModal(message) {
    console.log('Content: 显示升级提示弹窗');
    
    // 移除现有的提示弹窗
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
    
    // 直接在已创建的按钮元素上添加事件监听器
    upgradeBtn.addEventListener('click', () => {
      console.log('Content: 用户点击立即升级');
      window.open('http://localhost:3000/#pricing', '_blank');
      promptDiv.remove();
    });
    
    // 添加悬停效果
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
    
    // 10秒后自动关闭
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
    
    // 安全处理className，避免split错误
    let className = '';
    if (element.className && typeof element.className === 'string') {
      className = `.${element.className.split(' ').filter(c => c.trim()).join('.')}`;
    } else if (element.className && element.className.baseVal) {
      // 处理SVG元素的className
      className = `.${element.className.baseVal}`;
    }
    
    const text = element.textContent ? element.textContent.trim().substring(0, 50) : '';
    
    return `${tagName}${id}${className}${text ? ` [${text}]` : ''}`;
  }

  getElementText(element) {
    // 获取元素的文本内容
    if (element.value) return element.value; // input元素
    if (element.textContent) return element.textContent.trim().substring(0, 100);
    if (element.alt) return element.alt; // img元素
    if (element.title) return element.title;
    return '';
  }

  // 安全的消息发送方法
  async sendMessageSafely(message) {
    return new Promise((resolve, reject) => {
      try {
        // 检查runtime是否有效
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
  
  // 清理方法
  cleanup() {
    console.log('Content script开始清理...');
    
    // 停止录制
    this.stopRecording();
    
    // 清理定时器
    if (this.stateCheckInterval) {
      clearInterval(this.stateCheckInterval);
      this.stateCheckInterval = null;
      console.log('状态检查定时器已清理');
    }
    
    // 清理其他资源
    this.isRecording = false;
    this.clickHandler = null;
    
    console.log('Content script清理完成');
  }
}

// 最强防重复加载机制 - 使用唯一标识符
(function(global) {
  'use strict';
  
  // 使用时间戳和随机数创建唯一标识符
  const UNIQUE_ID = 'zhiliuhuaxie_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  // 检查全局标识符
  if (global.__ZHILIUHUAXIE_LOADED__) {
    console.log('智流华写插件已加载，跳过重复初始化');
    return;
  }
  
  // 设置全局标识符
  global.__ZHILIUHUAXIE_LOADED__ = UNIQUE_ID;
  
  // 双重检查机制
  setTimeout(() => {
    if (global.__ZHILIUHUAXIE_LOADED__ !== UNIQUE_ID) {
      console.log('检测到多个实例，当前实例退出');
      return;
    }
    
    // 初始化录制器
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