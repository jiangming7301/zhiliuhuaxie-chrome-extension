class ContentRecorder {
  constructor() {
    this.isRecording = false;
    this.clickHandler = null;
    this.lastScreenshotTime = 0;
    this.screenshotDelay = 500;
    this.stateCheckInterval = null;
    this.longScreenshotManager = new LongScreenshotManager((payload) => this.sendMessageSafely(payload));
    this.init();
  }

  // 单步录制功能 - 用于重新记录
  async startSingleStepRecording(targetIndex) {
    try {
      console.log('启动单步录制模式，目标索引:', targetIndex);
      
      this.isSingleStepMode = true;
      this.targetIndex = targetIndex;
      
      // 设置重新录制状态，确保截图功能可用
      await chrome.storage.local.set({
        isRerecording: true,
        rerecordIndex: targetIndex,
        rerecordMode: 'single-step'
      });
      
      // 绑定点击事件监听器
      this.singleStepClickHandler = this.handleSingleStepClick.bind(this);
      document.addEventListener('click', this.singleStepClickHandler, true);
      
      // 显示提示
      this.showSingleStepHint();
      
      console.log('单步录制模式已启动');
      return { success: true };
    } catch (error) {
      console.error('启动单步录制失败:', error);
      return { success: false, error: error.message };
    }
  }

  startLongScreenshotCapture(request = {}) {
    if (!this.longScreenshotManager) {
      this.longScreenshotManager = new LongScreenshotManager((payload) => this.sendMessageSafely(payload));
    }
    const result = this.longScreenshotManager.beginCapture(request);
    return result || { success: true };
  }

  cancelLongScreenshotCapture() {
    if (this.longScreenshotManager) {
      this.longScreenshotManager.cancel();
    }
    return { success: true };
  }

  clearAllButtonStates() {
    console.log('清理所有按钮状态');
    
    // 查找所有可能的按钮元素
    const buttons = document.querySelectorAll('button, [role="button"], .btn, .button, a[href], input[type="button"], input[type="submit"]');
    
    buttons.forEach(button => {
      // 移除激活状态类
      button.classList.remove('active', 'pressed', 'clicked', 'focus', 'hover');
      
      // 清理焦点状态
      if (button.blur && typeof button.blur === 'function') {
        button.blur();
      }
      
      // 重置样式
      button.style.pointerEvents = '';
    });
    
    // 清理全局焦点
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    
    // 强制重绘
    document.body.style.display = 'none';
    document.body.offsetHeight; // 触发重排
    document.body.style.display = '';
    
    console.log('所有按钮状态清理完成');
  }

  clearButtonStates(element) {
    console.log('清理按钮状态');
    
    // 清理目标元素的状态
    if (element) {
      // 移除可能的激活状态类
      element.classList.remove('active', 'pressed', 'clicked', 'focus');
      
      // 清理焦点状态
      if (element.blur && typeof element.blur === 'function') {
        element.blur();
      }
      
      // 清理CSS伪类状态
      element.style.pointerEvents = 'none';
      setTimeout(() => {
        element.style.pointerEvents = '';
      }, 100);
    }
    
    // 清理全局焦点状态
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    
    console.log('按钮状态清理完成');
  }

  stopSingleStepRecording() {
    console.log('停止单步录制模式');
    
    this.isSingleStepMode = false;
    this.targetIndex = -1;
    
    // 清除重新录制状态
    chrome.storage.local.set({
      isRerecording: false,
      rerecordIndex: -1,
      rerecordMode: ''
    });
    
    // 移除事件监听器
    if (this.singleStepClickHandler) {
      document.removeEventListener('click', this.singleStepClickHandler, true);
      this.singleStepClickHandler = null;
    }
    
    // 隐藏提示
    this.hideSingleStepHint();
  }

  async handleSingleStepClick(event) {
    try {
      console.log('单步录制: 处理点击事件', event.target);
      
      // 防止事件冒泡和默认行为
      event.stopPropagation();
      event.preventDefault();
      
      // 记录原始URL
      const originalUrl = window.location.href;
      console.log('单步录制: 当前URL:', originalUrl);
      
      // 添加点击标记
      this.addClickMarker(event.clientX, event.clientY);
      
      // 隐藏提示框
      this.hideSingleStepHint();
      
      // 等待一小段时间让点击效果生效
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 重新触发点击事件，让原始功能执行
      const target = event.target;
      console.log('单步录制: 重新触发点击事件');
      
      // 创建新的点击事件
      const newEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        buttons: event.buttons
      });
      
      // 暂时移除我们的事件监听器，避免递归
      document.removeEventListener('click', this.singleStepClickHandler, true);
      
      // 触发原始点击
      target.dispatchEvent(newEvent);
      
      // 清理按钮状态
      this.clearButtonStates(target);
      
      // 等待页面变化或导航
      console.log('单步录制: 等待页面变化...');
      await this.waitForPageChangeOrNavigation(originalUrl);
      
      // 截图
      console.log('单步录制: 开始截图');
      await this.captureScreenshot();
      
      // 发送录制完成事件
      console.log('单步录制: 发送录制完成事件');
      chrome.runtime.sendMessage({
        action: 'singleStepRecorded',
        url: window.location.href,
        timestamp: Date.now()
      });
      
      console.log('单步录制: 点击处理完成');
      
    } catch (error) {
      console.error('单步录制点击处理错误:', error);
      
      // 发送录制完成事件，但不进行额外截图
      chrome.runtime.sendMessage({
        action: 'singleStepRecorded',
        url: window.location.href,
        timestamp: Date.now(),
        error: error.message
      });
    } finally {
      // 确保停止单步录制模式
      console.log('单步录制: 清理并停止单步录制模式');
      
      // 额外的按钮状态清理
      this.clearAllButtonStates();
      
      this.stopSingleStepRecording();
    }
  }

  async waitForPageChangeOrNavigation(originalUrl) {
    return new Promise((resolve) => {
      let resolved = false;
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          console.log('单步录制: 页面变化检测完成，准备截图');
          resolve();
        }
      };
      
      // 检查URL变化（页面跳转）
      const checkUrlChange = () => {
        if (window.location.href !== originalUrl) {
          console.log('单步录制: 检测到页面跳转:', window.location.href);
          
          // 页面跳转后，等待页面完全加载
          const waitForPageLoad = () => {
            if (document.readyState === 'complete') {
              console.log('单步录制: 页面已完全加载');
              // 额外等待一段时间确保页面渲染完成
              setTimeout(() => {
                console.log('单步录制: 页面渲染等待完成');
                resolveOnce();
              }, 1500); // 增加等待时间确保页面完全渲染
            } else {
              console.log('单步录制: 等待页面加载完成，当前状态:', document.readyState);
              setTimeout(waitForPageLoad, 200);
            }
          };
          
          waitForPageLoad();
          return true;
        }
        return false;
      };
      
      // 立即检查一次
      if (checkUrlChange()) return;
      
      // 定期检查URL变化
      const urlCheckInterval = setInterval(() => {
        if (checkUrlChange()) {
          clearInterval(urlCheckInterval);
        }
      }, 100);
      
      // 监听页面变化
      let changeDetected = false;
      let timeoutId;
      let stabilityTimer;
      let changeCount = 0;
      
      const observer = new MutationObserver((mutations) => {
        // 过滤掉我们自己的元素变化
        const relevantMutations = mutations.filter(mutation => {
          if (mutation.target && (
            mutation.target.className === 'click-marker' ||
            mutation.target.id === 'single-step-hint' ||
            mutation.target.id === 'recording-indicator' ||
            mutation.target.tagName === 'STYLE'
          )) {
            return false;
          }
          
          // 检查是否是有意义的变化
          if (mutation.type === 'childList') {
            const hasSignificantNodes = Array.from(mutation.addedNodes).some(node => 
              node.nodeType === Node.ELEMENT_NODE && 
              !node.className?.includes('click-marker') &&
              !node.id?.includes('hint')
            );
            return hasSignificantNodes;
          }
          
          if (mutation.type === 'attributes') {
            // 忽略样式变化，除非是重要的属性
            return ['src', 'href', 'data-', 'class'].some(attr => 
              mutation.attributeName?.startsWith(attr)
            );
          }
          
          return true;
        });
        
        if (relevantMutations.length > 0) {
          changeDetected = true;
          changeCount++;
          console.log(`单步录制: 检测到页面内容变化 #${changeCount}`);
          
          if (stabilityTimer) {
            clearTimeout(stabilityTimer);
          }
          
          // 等待页面稳定
          stabilityTimer = setTimeout(() => {
            console.log('单步录制: 页面变化已稳定');
            observer.disconnect();
            clearTimeout(timeoutId);
            clearInterval(urlCheckInterval);
            
            // 确保页面完全加载后再截图
            if (document.readyState === 'complete') {
              setTimeout(resolveOnce, 500); // 额外等待确保渲染完成
            } else {
              const waitForComplete = () => {
                if (document.readyState === 'complete') {
                  setTimeout(resolveOnce, 500);
                } else {
                  setTimeout(waitForComplete, 100);
                }
              };
              waitForComplete();
            }
          }, 1000); // 增加稳定等待时间
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'src', 'href', 'data-loaded', 'data-state']
      });
      
      // 超时处理 - 如果没有检测到变化，也要继续
      timeoutId = setTimeout(() => {
        console.log('单步录制: 等待超时，继续处理');
        observer.disconnect();
        clearInterval(urlCheckInterval);
        if (stabilityTimer) {
          clearTimeout(stabilityTimer);
        }
        
        // 即使没有检测到变化，也要截图
        console.log('单步录制: 未检测到明显变化，但仍进行截图');
        resolveOnce();
      }, 2000); // 减少超时时间
      
      // 如果是同步操作（如弹窗、表单提交等），可能不会有DOM变化
      // 添加一个短延迟后的检查
      setTimeout(() => {
        if (!changeDetected && !resolved) {
          console.log('单步录制: 短延迟后未检测到变化，可能是同步操作');
          observer.disconnect();
          clearTimeout(timeoutId);
          clearInterval(urlCheckInterval);
          resolveOnce();
        }
      }, 500);
    });
  }



  showSingleStepHint() {
    console.log('显示单步录制提示');
    
    // 移除已存在的提示
    const existingHint = document.getElementById('single-step-hint');
    if (existingHint) {
      existingHint.remove();
    }
    
    // 创建提示框
    const hint = document.createElement('div');
    hint.id = 'single-step-hint';
    hint.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideUp 0.3s ease-out;
      pointer-events: none;
      max-width: 300px;
      word-wrap: break-word;
    `;
    hint.textContent = chrome.i18n.getMessage('content_rerecord_hint');
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(hint);
    console.log('单步录制提示已显示');
  }

  hideSingleStepHint() {
    console.log('隐藏单步录制提示');
    const hint = document.getElementById('single-step-hint');
    if (hint) {
      hint.remove();
      console.log('单步录制提示已移除');
    } else {
      console.log('未找到单步录制提示元素');
    }
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    // 3秒后自动移除
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 3000);
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
          getRecordingState: () => ({ isRecording: this.isRecording }),
          startSingleStepRecording: () => this.startSingleStepRecording(request.targetIndex),
          startLongScreenshotCapture: () => this.startLongScreenshotCapture(request),
          cancelLongScreenshotCapture: () => this.cancelLongScreenshotCapture()
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

  checkRecordingState() {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.log('Chrome runtime不可用，可能是context invalidated');
      this.handleContextInvalidated();
      return;
    }
    
    // 如果在单步录制模式，跳过全局录制状态检查
    if (this.isSingleStepMode) {
      console.log('单步录制模式中，跳过全局录制状态检查');
      return;
    }
    
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Ping失败，可能是context invalidated:', chrome.runtime.lastError);
        this.handleContextInvalidated();
        return;
      }
      
      chrome.storage.local.get(['isRecording'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('获取录制状态失败:', chrome.runtime.lastError);
          return;
        }
        
        console.log('检查录制状态 - 存储:', result.isRecording, '本地:', this.isRecording);
        
        if (result.isRecording && !this.isRecording) {
          console.log('检测到开始状态，启动录制');
          this.startRecording();
        } else if (!result.isRecording && this.isRecording) {
          // 只有在非单步录制模式下才停止录制
          if (!this.isSingleStepMode) {
            console.log('检测到停止状态，停止录制');
            this.stopRecording();
          } else {
            console.log('单步录制模式中，忽略全局停止状态');
          }
        }
      });
    });
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

  async captureScreenshot() {
    try {
      console.log('开始截图...');
      
      // 发送截图请求到background script，格式需要匹配background的处理器
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'captureScreenshot',
          data: {
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
            x: 0, // 单步录制不需要具体坐标
            y: 0,
            element: 'single-step-recording',
            text: '单步录制'
          }
        }, resolve);
      });
      
      if (response && response.success) {
        console.log('截图成功');
        return response;
      } else {
        console.error('截图失败:', response?.error);
        throw new Error(response?.error || '截图失败');
      }
    } catch (error) {
      console.error('截图过程出错:', error);
      throw error;
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
    titleDiv.textContent = chrome.i18n.getMessage('content_upgrade_title');
    titleDiv.style.cssText = 'color: #ff4444; font-weight: bold; margin-bottom: 20px; font-size: 20px;';
    
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = 'color: #333; margin-bottom: 25px; line-height: 1.6; font-size: 16px;';
    
    const featuresDiv = document.createElement('div');
    featuresDiv.textContent = chrome.i18n.getMessage('content_upgrade_features');
    featuresDiv.style.cssText = 'color: #666; margin-bottom: 25px; font-size: 14px;';
    
    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.cssText = 'display: flex; gap: 15px; justify-content: center;';
    
    const upgradeBtn = document.createElement('button');
    upgradeBtn.id = 'upgradeNowBtn';
    upgradeBtn.textContent = chrome.i18n.getMessage('btn_upgrade_now');
    upgradeBtn.style.cssText = `
      background: #ef4444;
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
    closeBtn.textContent = chrome.i18n.getMessage('content_later');
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

class LongScreenshotManager {
  constructor(messageSender) {
    this.messageSender = messageSender;
    this.isRunning = false;
    this.canceled = false;
    this.sessionId = null;
    this.segmentOverlap = 60;
    this.captureDelay = 1000;
    this.additionalStabilityDelay = 400;
    this.maxStabilityChecks = 5;
    this.pendingImageCheckInterval = 250;
    this.pendingImageTimeout = 6000;
    this.maxCanvasDimension = 32760;
    this.scrollingElement = document.scrollingElement || document.documentElement || document.body;
    this.fixedHeaderHeight = 0;
    this.dynamicOverlap = this.segmentOverlap;
    this.maxDataUrlLength = 4 * 1024 * 1024;
    this.stickyHideDelay = 120;
    this.maxStickyDetectionDepth = 6;
    this.stickySampleYs = [2, 6, 12, 24, 48, 72];
    this.stickySampleXRatios = [0.5, 0.35, 0.65];
  }

  beginCapture(options = {}) {
    if (this.isRunning) {
      return { success: false, error: 'CAPTURE_RUNNING' };
    }
    if (!options.sessionId) {
      return { success: false, error: 'MISSING_SESSION' };
    }

    this.isRunning = true;
    this.canceled = false;
    this.sessionId = options.sessionId;
    this.fixedHeaderHeight = 0;
    this.dynamicOverlap = this.segmentOverlap;
    this.startTime = Date.now();
    this.originalScroll = {
      x: window.scrollX,
      y: window.scrollY
    };
    this.originalScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';

    this.executeCaptureFlow().catch((error) => {
      console.error('整页截图执行失败:', error);
      this.notifyUpdate({
        status: 'error',
        message: error.message || '整页截图失败',
        error: error.message
      });
    }).finally(() => {
      this.restoreScroll();
      document.documentElement.style.scrollBehavior = this.originalScrollBehavior || '';
      this.isRunning = false;
      this.sessionId = null;
      this.fixedHeaderHeight = 0;
      this.dynamicOverlap = this.segmentOverlap;
    });

    return { success: true };
  }

  cancel() {
    if (!this.isRunning) {
      return;
    }
    this.canceled = true;
  }

  async executeCaptureFlow() {
    try {
      const metrics = this.calculateMetrics();
      if (!metrics.offsets.length) {
        throw new Error('无法计算页面高度，请稍后再试');
      }
      this.fixedHeaderHeight = metrics.fixedHeader || 0;
      this.dynamicOverlap = metrics.overlap || this.segmentOverlap;

      await this.notifyUpdate({
        status: 'capturing',
        progress: { captured: 0, total: metrics.offsets.length },
        message: '正在截取整页'
      });

      const { canvas, ctx } = this.createCanvas(metrics);

      for (let index = 0; index < metrics.offsets.length; index++) {
        if (this.canceled) {
          await this.notifyUpdate({ status: 'canceled', message: '用户已取消' });
          return;
        }

        await this.scrollToOffset(metrics.offsets[index]);
        await this.waitForStability();

        let hiddenStickyRecords = [];
        let stickyHeight = 0;
        if (index > 0) {
          hiddenStickyRecords = this.temporarilyHideStickyHeaders();
          stickyHeight = this.calculateStickyHeight(hiddenStickyRecords);
          if (hiddenStickyRecords.length && this.stickyHideDelay) {
            await new Promise(resolve => setTimeout(resolve, this.stickyHideDelay));
          }
        }

        let segmentResponse;
        try {
          segmentResponse = await this.messageSender({
            action: 'longScreenshotCaptureSegment',
            sessionId: this.sessionId,
            segmentIndex: index,
            totalSegments: metrics.offsets.length
          });
        } finally {
          if (hiddenStickyRecords.length) {
            this.restoreStickyHeaders(hiddenStickyRecords);
          }
        }

        if (!segmentResponse || !segmentResponse.success || !segmentResponse.dataUrl) {
          throw new Error(segmentResponse?.error || '捕获页面失败');
        }

        await this.drawSegment(ctx, segmentResponse.dataUrl, metrics, metrics.offsets[index], index, stickyHeight);

        await this.notifyUpdate({
          status: 'capturing',
          progress: { captured: index + 1, total: metrics.offsets.length }
        });
      }

      if (this.canceled) {
        await this.notifyUpdate({ status: 'canceled', message: '用户已取消' });
        return;
      }

      const exportResult = await this.exportCanvasData(canvas);
      const dataUrl = exportResult.dataUrl;
      await this.messageSender({
        action: 'longScreenshotComplete',
        sessionId: this.sessionId,
        screenshot: dataUrl,
        meta: {
          width: Math.round(metrics.viewportWidth),
          height: Math.round(metrics.totalHeight),
          segments: metrics.offsets.length,
          devicePixelRatio: metrics.devicePixelRatio,
          captureDurationMs: Date.now() - this.startTime,
          overlap: metrics.overlap,
          format: exportResult.format,
          quality: exportResult.quality
        },
        url: window.location.href,
        title: document.title
      });
    } catch (error) {
      if (this.canceled) {
        await this.notifyUpdate({ status: 'canceled', message: '用户已取消' });
        return;
      }
      throw error;
    }
  }

  calculateMetrics() {
    const viewportWidth = Math.max(window.innerWidth, document.documentElement.clientWidth || 0);
    const viewportHeight = Math.max(window.innerHeight, document.documentElement.clientHeight || 0);

    if (!viewportWidth || !viewportHeight) {
      throw new Error('当前页面不可见，请切换到目标标签页再试');
    }

    const totalHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      viewportHeight
    );
    const offsets = [];
    const fixedHeader = this.detectFixedHeaderHeight();
    const effectiveOverlap = Math.max(this.segmentOverlap, Math.ceil(fixedHeader) + 20);
    const step = Math.max(1, viewportHeight - effectiveOverlap);
    let current = 0;
    while (current < totalHeight) {
      const offset = Math.min(current, Math.max(0, totalHeight - viewportHeight));
      offsets.push(Math.max(0, Math.floor(offset)));
      if (current + viewportHeight >= totalHeight) {
        break;
      }
      current += step;
    }
    if (!offsets.length) {
      offsets.push(0);
    }

    const uniqueOffsets = Array.from(new Set(offsets));
    const devicePixelRatio = window.devicePixelRatio || 1;
    const pixelHeight = Math.round(totalHeight * devicePixelRatio);
    const pixelWidth = Math.round(viewportWidth * devicePixelRatio);

    if (pixelHeight > this.maxCanvasDimension || pixelWidth > this.maxCanvasDimension) {
      throw new Error('页面尺寸超过32,000像素限制，暂不支持整页截图');
    }

    return {
      offsets: uniqueOffsets,
      totalHeight,
      viewportHeight,
      viewportWidth,
      devicePixelRatio,
      fixedHeader,
      overlap: effectiveOverlap
    };
  }

  detectFixedHeaderHeight() {
    try {
      const probeY = Math.min(10, window.innerHeight / 10);
      let element = document.elementFromPoint(window.innerWidth / 2, probeY);
      let depth = 0;
      while (element && element !== document.body && depth < 10) {
        depth++;
        const style = window.getComputedStyle(element);
        if (['fixed', 'sticky'].includes(style.position)) {
          const top = parseFloat(style.top || '0');
          if (!Number.isNaN(top) && top <= 2) {
            const rect = element.getBoundingClientRect();
            if (rect.height > 40 && rect.height < window.innerHeight * 0.8 && rect.width > window.innerWidth * 0.5) {
              return rect.height;
            }
          }
        }
        element = element.parentElement;
      }
    } catch (error) {
      console.warn('检测固定头部失败:', error);
    }
    return 0;
  }

  collectStickyHeaderElements() {
    if (typeof document.elementsFromPoint !== 'function') {
      return [];
    }
    const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 0);
    const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 0);
    const maxTop = Math.min(200, height * 0.35);
    const seen = new Set();
    const elements = [];

    for (const ratio of this.stickySampleXRatios) {
      const x = Math.min(width - 1, Math.max(1, Math.round(width * ratio)));
      for (const sampleY of this.stickySampleYs) {
        const y = Math.min(maxTop, sampleY);
        const found = document.elementsFromPoint(x, y) || [];
        for (const node of found) {
          let current = node;
          let depth = 0;
          while (current && current !== document.body && current !== document.documentElement && depth < this.maxStickyDetectionDepth) {
            depth++;
            if (seen.has(current)) {
              break;
            }
            const style = window.getComputedStyle(current);
            if (!['fixed', 'sticky'].includes(style.position)) {
              current = current.parentElement;
              continue;
            }
            const rect = current.getBoundingClientRect();
            if (!rect) {
              break;
            }
            if (rect.top < -5 || rect.top > maxTop) {
              current = current.parentElement;
              continue;
            }
            if (rect.height < 30 || rect.height > height * 0.8 || rect.width < width * 0.4) {
              current = current.parentElement;
              continue;
            }
            seen.add(current);
            elements.push(current);
            break;
          }
        }
      }
    }

    return elements;
  }

  temporarilyHideStickyHeaders() {
    try {
      const candidates = this.collectStickyHeaderElements();
      if (!candidates || !candidates.length) {
        return [];
      }
      return candidates.map(el => {
        const record = {
          el,
          visibility: el.style.visibility,
          pointerEvents: el.style.pointerEvents,
          transition: el.style.transition,
          height: el.getBoundingClientRect()?.height || 0
        };
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        el.style.transition = 'none';
        return record;
      });
    } catch (error) {
      console.warn('临时隐藏固定头部失败:', error);
      return [];
    }
  }

  restoreStickyHeaders(records = []) {
    records.forEach(record => {
      if (!record || !record.el) return;
      try {
        record.el.style.visibility = record.visibility || '';
        record.el.style.pointerEvents = record.pointerEvents || '';
        record.el.style.transition = record.transition || '';
      } catch (error) {
        console.warn('恢复固定头部失败:', error);
      }
    });
  }

  calculateStickyHeight(records = []) {
    if (!records || !records.length) return 0;
    return records.reduce((sum, record) => {
      if (!record || !record.el) return sum;
      if (record.height && Number.isFinite(record.height)) {
        return sum + record.height;
      }
      const rect = record.el.getBoundingClientRect();
      if (rect && rect.height) {
        return sum + rect.height;
      }
      return sum;
    }, 0);
  }

  createCanvas(metrics) {
    const canvas = document.createElement('canvas');
    const width = Math.max(1, Math.round(metrics.viewportWidth * metrics.devicePixelRatio));
    const height = Math.max(1, Math.round(metrics.totalHeight * metrics.devicePixelRatio));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    return { canvas, ctx };
  }

  async drawSegment(ctx, dataUrl, metrics, offsetY, segmentIndex, dynamicHeaderHeight = 0) {
    const img = await this.loadImage(dataUrl);
    const dpr = metrics.devicePixelRatio;
    const overlapCss = metrics.overlap || this.segmentOverlap;
    const seamTopTrim = segmentIndex === 0 ? 0 : Math.min(8, overlapCss * 0.5);
    const seamBottomTrim = 0;
    let headerCutCss = segmentIndex === 0 ? 0 : (dynamicHeaderHeight || metrics.fixedHeader || 0);
    const maxAllowedCut = Math.max(0, overlapCss - seamTopTrim);
    if (segmentIndex > 0 && maxAllowedCut > 0) {
      headerCutCss = Math.min(headerCutCss, maxAllowedCut);
    }
    const totalTopCutCss = headerCutCss + seamTopTrim;
    const cutTopPx = Math.max(0, Math.round(totalTopCutCss * dpr));
    const targetY = Math.round((offsetY + totalTopCutCss) * dpr);
    const remainingCss = Math.max(0, metrics.totalHeight - offsetY);
    const visibleCss = Math.min(metrics.viewportHeight, remainingCss);
    const effectiveCss = Math.max(0, visibleCss - totalTopCutCss - seamBottomTrim);
    if (effectiveCss <= 0) {
      return;
    }
    const visiblePx = Math.max(1, Math.round(effectiveCss * dpr));
    const targetWidth = Math.round(metrics.viewportWidth * dpr);
    const bottomTrimPx = Math.max(0, Math.round(seamBottomTrim * dpr));
    const maxSourceHeight = img.height - cutTopPx - bottomTrimPx;
    const sourceHeight = Math.min(visiblePx, Math.max(1, maxSourceHeight));
    ctx.drawImage(img, 0, cutTopPx, img.width, sourceHeight, 0, targetY, targetWidth, sourceHeight);
  }

  async loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('分段图像加载失败'));
      img.src = dataUrl;
    });
  }

  async notifyUpdate(state) {
    if (!this.sessionId) {
      return;
    }
    try {
      await this.messageSender({
        action: 'longScreenshotUpdate',
        sessionId: this.sessionId,
        state
      });
    } catch (error) {
      console.warn('发送整页截图状态失败:', error);
    }
  }

  async waitForStability() {
    let lastHeight = document.documentElement.scrollHeight;
    let lastWidth = document.documentElement.scrollWidth;
    for (let i = 0; i < this.maxStabilityChecks; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, this.captureDelay));
      const currentHeight = document.documentElement.scrollHeight;
      const currentWidth = document.documentElement.scrollWidth;
      const heightChanged = Math.abs(currentHeight - lastHeight) > 2;
      const widthChanged = Math.abs(currentWidth - lastWidth) > 2;
      if (!heightChanged && !widthChanged) {
        break;
      }
      lastHeight = currentHeight;
      lastWidth = currentWidth;
    }
    await this.waitForPendingImages();
    if (this.additionalStabilityDelay) {
      await new Promise(resolve => setTimeout(resolve, this.additionalStabilityDelay));
    }
  }

  async scrollToOffset(offset) {
    if (typeof offset !== 'number' || Number.isNaN(offset)) {
      return;
    }
    window.scrollTo(0, offset);
  }

  restoreScroll() {
    window.scrollTo(this.originalScroll?.x || 0, this.originalScroll?.y || 0);
  }

  async exportCanvasData(canvas) {
    const pngData = canvas.toDataURL('image/png', 0.92);
    if (pngData.length <= this.maxDataUrlLength) {
      return { dataUrl: pngData, format: 'png' };
    }
    const qualities = [0.9, 0.85, 0.8, 0.75, 0.7];
    for (const quality of qualities) {
      const jpegData = canvas.toDataURL('image/jpeg', quality);
      if (jpegData.length <= this.maxDataUrlLength) {
        return { dataUrl: jpegData, format: 'jpeg', quality };
      }
    }
    const fallback = canvas.toDataURL('image/jpeg', 0.65);
    return { dataUrl: fallback, format: 'jpeg', quality: 0.65 };
  }

  async waitForPendingImages() {
    const start = Date.now();
    while (Date.now() - start < this.pendingImageTimeout) {
      const pending = Array.from(document.images || []).some(img => this.isImagePendingInViewport(img));
      if (!pending) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, this.pendingImageCheckInterval));
    }
  }

  isImagePendingInViewport(img) {
    if (!img || img.complete) {
      return false;
    }
    const rect = img.getBoundingClientRect();
    const buffer = 200;
    return rect.bottom >= -buffer && rect.top <= (window.innerHeight || 0) + buffer;
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
        return global.zhiliuhuaxieContentRecorder;
      }
      
      try {
        console.log('创建智流华写录制器实例 - ID:', UNIQUE_ID);
        global.zhiliuhuaxieContentRecorder = new ContentRecorder();
        global.zhiliuhuaxieContentRecorder._instanceId = UNIQUE_ID;
        console.log('录制器实例创建成功');
        return global.zhiliuhuaxieContentRecorder;
      } catch (error) {
        console.error('创建录制器实例失败:', error);
        return null;
      }
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeRecorder);
    } else {
      initializeRecorder();
    }
  }, 10);
  
})(window);
