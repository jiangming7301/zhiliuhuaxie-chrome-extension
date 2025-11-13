class PopupController {
  constructor() {
    this.isRecording = false;
    this.startTime = null;
    this.durationInterval = null;
    this.usageInfo = null;
    this.subscriptionCountdown = null;
    this.initRetryCount = 0;
    this.maxRetries = 5;
    this.editorScale = 1;
    this.editorOriginalWidth = 0;
    this.editorOriginalHeight = 0;
    this.editorCanvasWidth = 0;
    this.editorCanvasHeight = 0;
    this.init();
  }

  async init() {
    console.log('初始化popup...');
    try {
      // 先绑定事件，确保UI可响应
      this.bindEvents();
      
      // 显示加载状态
      this.showLoadingState();
      
      // 检查是否在Chrome扩展环境中
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // 尝试与background建立连接
        await this.pingBackground();
        
        // 加载插件信息
        await this.loadPluginInfo();
      } else {
        console.log('非Chrome扩展环境，使用模拟数据');
        // 在非扩展环境中使用模拟数据
        this.usageInfo = {
          isActivated: true,
          subscriptionType: 'premium',
          expiryDate: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30天后过期
        };
      }
      
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
      textDiv.style.cssText = 'color: #c62828; white-space: pre-line; line-height: 1.6; text-align: left;';
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
    // 安全绑定事件，检查元素是否存在
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startRecording());
    }
    
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopRecording());
    }
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportDocument());
    }
    
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearRecords());
    }
    
    const upgradeBtn = document.getElementById('upgradeBtn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.openUpgradePage());
    }
    
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

  async getOperationsData() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['editedOperations', 'operations']);
        let operations = (result.editedOperations && result.editedOperations.length)
          ? result.editedOperations
          : (result.operations || []);
        if (!operations || operations.length === 0) {
          const localEditorData = localStorage.getItem('editorData');
          if (localEditorData) {
            operations = (JSON.parse(localEditorData).operations) || [];
          } else {
            const localOps = localStorage.getItem('operations');
            if (localOps) {
              operations = JSON.parse(localOps);
            }
          }
        }
        return operations;
      }

      const editorDataStr = localStorage.getItem('editorData');
      if (editorDataStr) {
        const editorData = JSON.parse(editorDataStr);
        if (editorData.operations) {
          return editorData.operations;
        }
      }
      const opsStr = localStorage.getItem('operations');
      return opsStr ? JSON.parse(opsStr) : [];
    } catch (error) {
      console.error('获取操作数据失败:', error);
      const fallbackEditorData = localStorage.getItem('editorData');
      if (fallbackEditorData) {
        try {
          const parsed = JSON.parse(fallbackEditorData);
          if (parsed.operations) {
            return parsed.operations;
          }
        } catch (e) {
          console.warn('解析 editorData 失败:', e);
        }
      }
      const fallbackOps = localStorage.getItem('operations');
      return fallbackOps ? JSON.parse(fallbackOps) : [];
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
      // 获取操作记录（包含编辑后的内容）
      const operations = await this.getOperationsData();
      
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
    
    screenshotsContainer.innerHTML = '<div class="loading-screenshots">正在加载截图...</div>';

    // 异步生成截图HTML
    this.generateScreenshotsHtml(screenshotOps).then(screenshotsHtml => {
      screenshotsContainer.innerHTML = screenshotsHtml;

      // 绑定播放按钮事件
      this.bindPlayButtonEvents();

      // 绑定重新记录按钮事件
      this.bindRerecordButtonEvents();

      // 绑定编辑按钮事件
      this.bindEditButtonEvents();
    });
  }

  // 异步生成截图HTML
  async generateScreenshotsHtml(screenshotOps) {
    let screenshotsHtml = '';

    for (let index = 0; index < screenshotOps.length; index++) {
      const op = screenshotOps[index];
      const stepNumber = index + 1;
      const time = new Date(op.timestamp).toLocaleString();

      // 简化URL显示
      const displayUrl = op.url.length > 50 ? op.url.substring(0, 50) + '...' : op.url;

      // 异步获取显示用的截图
      const displayScreenshot = await this.getDisplayScreenshot(op);

      screenshotsHtml += `
        <div class="screenshot-item">
          <div class="screenshot-header">
            <span class="screenshot-index">${stepNumber}</span>
            <span class="screenshot-url" title="${op.url}">当前地址：${displayUrl}</span>
            <div class="screenshot-actions">
              <button class="edit-button" data-index="${index}" title="编辑截图">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="rerecord-button" data-index="${index}" data-url="${op.url}" title="重新记录此截图">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23,4 23,10 17,10"></polyline>
                  <polyline points="1,20 1,14 7,14"></polyline>
                  <path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10m22,4L18.36,18.36A9,9,0,0,1,3.51,15"></path>
                </svg>
              </button>
              <button class="play-button" data-url="${op.url}" title="跳转到此页面">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5,3 19,12 5,21"></polygon>
                </svg>
              </button>
            </div>
          </div>
          <div class="screenshot-content">
            <img src="${displayScreenshot}" alt="截图${stepNumber}" class="screenshot-image">
            <div class="screenshot-info">
              <p><strong>点击内容:</strong> "${op.text || '无文本'}"</p>
              <p><strong>时间:</strong> ${time}</p>
            </div>
          </div>
        </div>
      `;
    }

    return screenshotsHtml;
  }

  // 获取用于显示的截图（包含编辑标注）
  async getDisplayScreenshot(operation) {
    // 如果有编辑数据，生成带标注的截图
    if (operation.editData && operation.editData.canvas) {
      try {
        return await this.generateAnnotatedScreenshot(operation);
      } catch (error) {
        console.error('生成标注截图失败:', error);
        // 如果生成失败，返回原始截图
        return operation.screenshot;
      }
    }

    // 没有编辑数据，返回原始截图
    return operation.screenshot;
  }

  // 生成带有标注的截图
  // 预处理操作数据，为导出生成带标注的截图
  async preprocessOperationsForExport(operations) {
    const processedOperations = [];

    for (const op of operations) {
      // 如果有编辑数据，生成带标注的截图
      if (op.editData && op.editData.canvas) {
        try {
          const annotatedScreenshot = await this.generateAnnotatedScreenshot(op);
          // 创建新的操作对象，使用带标注的截图
          const processedOp = { ...op, screenshot: annotatedScreenshot };
          processedOperations.push(processedOp);
          console.log(`已生成带标注的截图: ${op.text || '未命名操作'}`);
        } catch (error) {
          console.error('生成标注截图失败:', error);
          // 如果生成失败，使用原始截图
          processedOperations.push(op);
        }
      } else {
        // 没有编辑数据，使用原始操作
        processedOperations.push(op);
      }
    }

    return processedOperations;
  }

  async generateAnnotatedScreenshot(operation) {
    // 使用 Fabric 复现编辑器的渲染，再按原图倍率导出，避免坐标和变换误差
    return new Promise((resolve) => {
      const baseImg = new Image();
      baseImg.onload = async () => {
        const originalW = baseImg.width;
        const originalH = baseImg.height;

        // 最终输出画布（原始截图尺寸）
        const outCanvas = document.createElement('canvas');
        outCanvas.width = originalW;
        outCanvas.height = originalH;
        const outCtx = outCanvas.getContext('2d');
        outCtx.drawImage(baseImg, 0, 0);

        // 没有标注则直接返回原图
        if (!operation.editData || !operation.editData.canvas || !operation.editData.canvas.objects) {
          resolve(outCanvas.toDataURL('image/png'));
          return;
        }

        try {
          // 在离屏 Fabric 画布上加载 JSON（不包含背景图）
          const tempCanvasEl = document.createElement('canvas');
          const tempFabric = new fabric.StaticCanvas(tempCanvasEl, { backgroundColor: 'transparent' });
          tempFabric.setDimensions({
            width: operation.editData.canvasWidth || originalW,
            height: operation.editData.canvasHeight || originalH
          });

          // 过滤掉 image 对象，避免背景重复
          const cleaned = JSON.parse(JSON.stringify(operation.editData.canvas));
          if (cleaned.objects) {
            cleaned.objects = cleaned.objects.filter(o => o.type !== 'image');
          }

          await new Promise(resolveLoad => {
            tempFabric.loadFromJSON(cleaned, () => {
              tempFabric.renderAll();
              resolveLoad();
            });
          });

          // 计算导出倍率：把编辑器坐标放大到原图尺寸
          const editScale = operation.editData.scale || 1;
          // 标准倍率：原图宽 / 编辑器画布宽（与 1/editScale 一致）
          const multiplier = (operation.editData.originalImageWidth || originalW) / (operation.editData.canvasWidth || tempFabric.getWidth());

          // 生成按倍率放大的标注层画布
          const overlayCanvas = tempFabric.toCanvasElement(multiplier);

          // 将标注层叠加到最终输出
          outCtx.drawImage(overlayCanvas, 0, 0);

          resolve(outCanvas.toDataURL('image/png'));
        } catch (e) {
          console.warn('Fabric 导出失败，回退到 2D 绘制:', e);
          // 回退到原先的 2D 绘制逻辑
          const fallbackCtx = outCtx;
          const editScale = operation.editData.scale || 1;
          const scaleToOriginal = 1 / editScale;
          this.drawAnnotations(fallbackCtx, operation.editData.canvas.objects, originalW, originalH, scaleToOriginal);
          resolve(outCanvas.toDataURL('image/png'));
        }
      };

      baseImg.onerror = () => resolve(operation.screenshot);
      baseImg.src = operation.screenshot;
    });
  }

  // 绘制标注到canvas上
  drawAnnotations(ctx, objects, canvasWidth, canvasHeight, scaleToOriginal = 1) {
    objects.forEach(obj => {
      // 处理组合对象（如箭头）
      if (obj.type === 'group' && obj.visible !== false) {
        this.drawGroup(ctx, obj, scaleToOriginal);
      } else if (obj.type === 'rect' && obj.visible !== false) {
        // 绘制矩形
        ctx.strokeStyle = obj.stroke || '#ff0000';
        ctx.lineWidth = (obj.strokeWidth || 2) * scaleToOriginal;
        ctx.fillStyle = obj.fill || 'transparent';

        // 应用坐标缩放
        const x = obj.left * scaleToOriginal;
        const y = obj.top * scaleToOriginal;
        const width = obj.width * obj.scaleX * scaleToOriginal;
        const height = obj.height * obj.scaleY * scaleToOriginal;

        if (obj.fill && obj.fill !== 'transparent') {
          ctx.globalAlpha = (obj.opacity || 1) * 0.3;
          ctx.fillRect(x, y, width, height);
          ctx.globalAlpha = obj.opacity || 1;
        }

        ctx.strokeRect(x, y, width, height);

      } else if (obj.type === 'circle' && obj.visible !== false) {
        // 绘制圆形
        ctx.strokeStyle = obj.stroke || '#ff0000';
        ctx.lineWidth = (obj.strokeWidth || 2) * scaleToOriginal;
        ctx.fillStyle = obj.fill || 'transparent';

        // 应用坐标缩放
        const centerX = obj.left * scaleToOriginal;
        const centerY = obj.top * scaleToOriginal;
        const radius = obj.radius * obj.scaleX * scaleToOriginal;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

        if (obj.fill && obj.fill !== 'transparent') {
          ctx.globalAlpha = (obj.opacity || 1) * 0.3;
          ctx.fill();
          ctx.globalAlpha = obj.opacity || 1;
        }

        ctx.stroke();

      } else if (obj.type === 'line' && obj.visible !== false) {
        // 绘制直线
        ctx.strokeStyle = obj.stroke || '#ff0000';
        ctx.lineWidth = (obj.strokeWidth || 2) * scaleToOriginal;
        ctx.globalAlpha = obj.opacity || 1;

        // 应用坐标缩放
        const x1 = obj.x1 * scaleToOriginal;
        const y1 = obj.y1 * scaleToOriginal;
        const x2 = obj.x2 * scaleToOriginal;
        const y2 = obj.y2 * scaleToOriginal;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

      } else if (obj.type === 'path' && obj.visible !== false) {
        // 绘制路径（包括自由绘制和自定义图形）
        if (obj.path && obj.path.length > 0) {
          ctx.globalAlpha = obj.opacity || 1;
          if (obj.stroke) {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = (obj.strokeWidth || 2) * scaleToOriginal;
          }
          if (obj.fill) {
            ctx.fillStyle = obj.fill;
          }

          const offsetX = obj.pathOffset ? obj.pathOffset.x || 0 : 0;
          const offsetY = obj.pathOffset ? obj.pathOffset.y || 0 : 0;

          ctx.beginPath();
          let currentX = 0;
          let currentY = 0;
          obj.path.forEach(segment => {
            const command = segment[0];
            const args = segment.slice(1);

            switch (command) {
              case 'M':
              case 'm': {
                const x = (args[0] - offsetX) * scaleToOriginal;
                const y = (args[1] - offsetY) * scaleToOriginal;
                ctx.moveTo(x, y);
                currentX = x;
                currentY = y;
                break;
              }
              case 'L':
              case 'l': {
                const x = (args[0] - offsetX) * scaleToOriginal;
                const y = (args[1] - offsetY) * scaleToOriginal;
                ctx.lineTo(x, y);
                currentX = x;
                currentY = y;
                break;
              }
              case 'C':
              case 'c': {
                const x1 = (args[0] - offsetX) * scaleToOriginal;
                const y1 = (args[1] - offsetY) * scaleToOriginal;
                const x2 = (args[2] - offsetX) * scaleToOriginal;
                const y2 = (args[3] - offsetY) * scaleToOriginal;
                const x = (args[4] - offsetX) * scaleToOriginal;
                const y = (args[5] - offsetY) * scaleToOriginal;
                ctx.bezierCurveTo(x1, y1, x2, y2, x, y);
                currentX = x;
                currentY = y;
                break;
              }
              case 'Q':
              case 'q': {
                const x1 = (args[0] - offsetX) * scaleToOriginal;
                const y1 = (args[1] - offsetY) * scaleToOriginal;
                const x = (args[2] - offsetX) * scaleToOriginal;
                const y = (args[3] - offsetY) * scaleToOriginal;
                ctx.quadraticCurveTo(x1, y1, x, y);
                currentX = x;
                currentY = y;
                break;
              }
              case 'H':
              case 'h': {
                const x = (args[0] - offsetX) * scaleToOriginal;
                ctx.lineTo(x, currentY);
                currentX = x;
                break;
              }
              case 'V':
              case 'v': {
                const y = (args[0] - offsetY) * scaleToOriginal;
                ctx.lineTo(currentX, y);
                currentY = y;
                break;
              }
              case 'Z':
              case 'z':
                ctx.closePath();
                break;
              default: {
                if (typeof args[0] === 'number' && typeof args[1] === 'number') {
                  const x = (args[0] - offsetX) * scaleToOriginal;
                  const y = (args[1] - offsetY) * scaleToOriginal;
                  ctx.lineTo(x, y);
                  currentX = x;
                  currentY = y;
                }
              }
            }
          });

          if (obj.fill && obj.fill !== 'transparent') {
            ctx.fill();
          }
          if (obj.stroke && obj.stroke !== 'transparent' && obj.strokeWidth) {
            ctx.stroke();
          }
        }

      } else if (obj.type === 'triangle' && obj.visible !== false) {
        // 绘制箭头三角形
        ctx.strokeStyle = obj.stroke || '#ff0000';
        ctx.fillStyle = obj.fill || '#ff0000';
        ctx.lineWidth = (obj.strokeWidth || 2) * scaleToOriginal;
        ctx.globalAlpha = obj.opacity || 1;

        ctx.beginPath();
        const points = obj.points || [];
        if (points.length >= 3) {
          // 应用坐标缩放
          ctx.moveTo(points[0].x * scaleToOriginal, points[0].y * scaleToOriginal);
          points.forEach(point => {
            ctx.lineTo(point.x * scaleToOriginal, point.y * scaleToOriginal);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

      } else if ((obj.type === 'textbox' || obj.type === 'i-text') && obj.visible !== false) {
        // 绘制文本
        ctx.fillStyle = obj.fill || '#000000';
        ctx.font = `${(obj.fontSize || 16) * scaleToOriginal}px ${obj.fontFamily || 'Arial'}`;
        ctx.globalAlpha = obj.opacity || 1;

        // 应用坐标缩放
        const x = obj.left * scaleToOriginal;
        const y = obj.top * scaleToOriginal;
        const lineHeight = (obj.fontSize || 16) * 1.2 * scaleToOriginal;

        // 简单的文本绘制（不考虑复杂的文本换行）
        const lines = obj.text ? obj.text.split('\n') : [''];
        lines.forEach((line, index) => {
          ctx.fillText(line, x, y + (index * lineHeight));
        });
      }
    });
  }

  // 绘制组合对象（如箭头）
  drawGroup(ctx, group, scaleToOriginal) {
    if (!group.objects || group.objects.length === 0) return;

    // 保存当前上下文状态
    ctx.save();

    // 应用组合的变换
    const groupX = (group.left || 0) * scaleToOriginal;
    const groupY = (group.top || 0) * scaleToOriginal;
    const groupScaleX = (group.scaleX || 1) * scaleToOriginal;
    const groupScaleY = (group.scaleY || 1) * scaleToOriginal;

    // 变换顺序与 Fabric 保持一致：translate -> rotate -> scale
    ctx.translate(groupX, groupY);
    if (group.angle) {
        ctx.rotate(group.angle * Math.PI / 180);
    }
    ctx.scale(groupScaleX, groupScaleY);

    // 绘制组合中的每个对象
    group.objects.forEach(obj => {
        this.drawGroupObject(ctx, obj, scaleToOriginal);
    });

    // 恢复上下文状态
    ctx.restore();
  }

  // 绘制组合中的单个对象
  drawGroupObject(ctx, obj, scaleToOriginal) {
    // 对于组合内的对象，坐标是相对于Group的，不需要额外的缩放
    // Group的变换已经在drawGroup中处理

    if (obj.type === 'line') {
      // 绘制线条
      ctx.strokeStyle = obj.stroke || '#ff0000';
      ctx.lineWidth = obj.strokeWidth || 2;
      ctx.lineCap = obj.strokeLineCap || 'butt'; // 与 Fabric 属性对齐，避免长度视觉差异
      ctx.lineJoin = obj.strokeLineJoin || 'miter';
      ctx.globalAlpha = obj.opacity || 1;

      ctx.beginPath();
      ctx.moveTo(obj.x1, obj.y1);
      ctx.lineTo(obj.x2, obj.y2);
      ctx.stroke();
    } else if (obj.type === 'triangle') {
      // 绘制三角形（箭头头部）
      ctx.fillStyle = obj.fill || '#ff0000';
      ctx.strokeStyle = obj.stroke || '#ff0000';
      ctx.lineWidth = obj.strokeWidth || 1;
      ctx.globalAlpha = obj.opacity || 1;

      // 保存当前状态
      ctx.save();

      // 应用三角形的变换
      const triX = obj.left || 0;
      const triY = obj.top || 0;
      const triWidth = obj.width || 20;
      const triHeight = obj.height || 16;
      const triScaleX = obj.scaleX || 1;
      const triScaleY = obj.scaleY || 1;
      const triAngle = obj.angle || 0;
      const originX = obj.originX || 'left';
      const originY = obj.originY || 'top';

      // 补偿 originX/originY 后再移动
      let originOffsetX = 0;
      let originOffsetY = 0;
      if (originX === 'center') originOffsetX = triWidth / 2;
      else if (originX === 'right') originOffsetX = triWidth;
      if (originY === 'center') originOffsetY = triHeight / 2;
      else if (originY === 'bottom') originOffsetY = triHeight;
      ctx.translate(triX - originOffsetX, triY - originOffsetY);
      
      // 应用旋转
      if (triAngle) {
        ctx.rotate(triAngle * Math.PI / 180);
      }
      
      // 应用缩放
      ctx.scale(triScaleX, triScaleY);

      // 绘制三角形（指向右侧）
      ctx.beginPath();
      ctx.moveTo(0, -triHeight / 2);        // 上顶点
      ctx.lineTo(triWidth, 0);              // 右顶点
      ctx.lineTo(0, triHeight / 2);         // 下顶点
      ctx.closePath();
      
      // 填充和描边
      if (obj.fill && obj.fill !== 'transparent') {
        ctx.fill();
      }
      if (obj.stroke && obj.stroke !== 'transparent') {
        ctx.stroke();
      }

      // 恢复状态
      ctx.restore();
    } else if (obj.type === 'path' && obj.path && obj.path.length > 0) {
      // 绘制路径
      ctx.strokeStyle = obj.stroke || '#ff0000';
      ctx.lineWidth = obj.strokeWidth || 2;
      ctx.globalAlpha = obj.opacity || 1;

      ctx.beginPath();
      obj.path.forEach((point, index) => {
        const x = point[1];
        const y = point[2];

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    } else if (obj.type === 'path' && obj.path && obj.path.length > 0) {
      ctx.globalAlpha = obj.opacity || 1;
      if (obj.stroke) {
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth || 1;
      }
      if (obj.fill) {
        ctx.fillStyle = obj.fill;
      }

      ctx.beginPath();
      let currentX = 0;
      let currentY = 0;

      const offsetX = obj.pathOffset ? obj.pathOffset.x || 0 : 0;
      const offsetY = obj.pathOffset ? obj.pathOffset.y || 0 : 0;

      obj.path.forEach(segment => {
        const [command, ...coords] = segment;
        switch (command) {
          case 'M':
          case 'm':
            ctx.moveTo(coords[0] - offsetX, coords[1] - offsetY);
            currentX = coords[0] - offsetX;
            currentY = coords[1] - offsetY;
            break;
          case 'L':
          case 'l':
            ctx.lineTo(coords[0] - offsetX, coords[1] - offsetY);
            currentX = coords[0] - offsetX;
            currentY = coords[1] - offsetY;
            break;
          case 'C':
          case 'c':
            ctx.bezierCurveTo(
              coords[0] - offsetX,
              coords[1] - offsetY,
              coords[2] - offsetX,
              coords[3] - offsetY,
              coords[4] - offsetX,
              coords[5] - offsetY
            );
            currentX = coords[4] - offsetX;
            currentY = coords[5] - offsetY;
            break;
          case 'Q':
          case 'q':
            ctx.quadraticCurveTo(
              coords[0] - offsetX,
              coords[1] - offsetY,
              coords[2] - offsetX,
              coords[3] - offsetY
            );
            currentX = coords[2] - offsetX;
            currentY = coords[3] - offsetY;
            break;
          case 'H':
          case 'h':
            ctx.lineTo(coords[0] - offsetX, currentY);
            currentX = coords[0] - offsetX;
            break;
          case 'V':
          case 'v':
            ctx.lineTo(currentX, coords[0] - offsetY);
            currentY = coords[0] - offsetY;
            break;
          case 'Z':
          case 'z':
            ctx.closePath();
            break;
          default:
            if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
              ctx.lineTo(coords[0] - offsetX, coords[1] - offsetY);
              currentX = coords[0] - offsetX;
              currentY = coords[1] - offsetY;
            }
        }
      });

      if (obj.fill && obj.fill !== 'transparent') {
        ctx.fill();
      }
      if (obj.stroke && obj.stroke !== 'transparent' && obj.strokeWidth) {
        ctx.stroke();
      }
    }
  }

  bindRerecordButtonEvents() {
    const rerecordButtons = document.querySelectorAll('.rerecord-button');
    rerecordButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(button.getAttribute('data-index'));
        const url = button.getAttribute('data-url');
        this.showRerecordConfirmDialog(index, url);
      });
    });
  }

  showRerecordConfirmDialog(index, url) {
    // 创建确认对话框
    const dialogHtml = `
      <div id="rerecordModal" class="dialog-overlay">
        <div class="dialog">
          <h3>重新记录截图</h3>
          <p>确定要重新记录第 ${index + 1} 步的截图吗？</p>
          <p class="rerecord-url">页面地址：${url}</p>
          <div class="dialog-buttons">
            <button id="confirmRerecord" class="btn btn-primary">确认重录</button>
            <button id="cancelRerecord" class="btn btn-secondary">取消</button>
          </div>
        </div>
      </div>
    `;
    
    // 添加到页面
    document.body.insertAdjacentHTML('beforeend', dialogHtml);
    
    // 绑定事件
    document.getElementById('confirmRerecord').addEventListener('click', () => {
      this.startRerecording(index, url);
      this.hideRerecordDialog();
    });
    
    document.getElementById('cancelRerecord').addEventListener('click', () => {
      this.hideRerecordDialog();
    });
  }

  hideRerecordDialog() {
    const modal = document.getElementById('rerecordModal');
    if (modal) {
      modal.remove();
    }
  }

  async startRerecording(index, url) {
    try {
      // 显示加载状态
      this.showLoadingState();
      
      // 发送重新记录消息到后台，让background script处理标签页创建和脚本注入
      const response = await this.sendMessage({
        action: 'startRerecordingWithTab',
        index: index,
        url: url
      });
      
      if (response.success) {
        console.log('重新记录启动成功，新标签页已创建');
        // 关闭popup
        window.close();
      } else {
        this.showErrorState(response.error || '重新记录失败');
      }
    } catch (error) {
      console.error('重新记录错误:', error);
      this.showErrorState('重新记录失败，请重试');
    }
  }

  async waitForTabReady(tabId, targetIndex) {
    let attempts = 0;
    const maxAttempts = 20; // 最多尝试20次，每次500ms
    
    const checkAndStart = async () => {
      attempts++;
      console.log(`尝试 ${attempts}/${maxAttempts}: 检查content script状态`);
      
      try {
        // 首先确保content script已注入
        const pingResponse = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        console.log('Ping响应:', pingResponse);
        
        // 如果ping成功，开始单步录制
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'startSingleStepRecording',
          targetIndex: targetIndex
        });
        
        console.log('单步录制启动响应:', response);
        
        if (response && response.success) {
          console.log('单步录制启动成功');
          return true;
        } else {
          throw new Error('单步录制启动失败: ' + (response?.error || '未知错误'));
        }
      } catch (error) {
        console.log(`尝试 ${attempts}/${maxAttempts}: content script未就绪`, error.message);
        
        if (attempts < maxAttempts) {
          // 等待500ms后重试
          setTimeout(checkAndStart, 500);
          return;
        } else {
          console.log('达到最大重试次数，尝试注入content script');
          // 尝试注入content script
          try {
            console.log('开始注入content script到标签页:', tabId);
            
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content-clean.js']
            });
            
            console.log('content script注入成功');
            
            // 注入CSS样式
            await chrome.scripting.insertCSS({
              target: { tabId: tabId },
              files: ['content.css']
            });
            
            console.log('CSS样式注入成功');
            
            // 注入后等待2秒再尝试
            setTimeout(async () => {
              try {
                console.log('注入后尝试启动单步录制');
                const response = await chrome.tabs.sendMessage(tabId, {
                  action: 'startSingleStepRecording',
                  targetIndex: targetIndex
                });
                console.log('注入后启动单步录制结果:', response);
                
                if (!response || !response.success) {
                  console.error('注入后启动单步录制仍然失败:', response);
                }
              } catch (retryError) {
                console.error('注入后启动单步录制失败:', retryError);
              }
            }, 2000);
          } catch (injectError) {
            console.error('注入content script失败:', injectError);
          }
        }
      }
    };
    
    // 开始检查，先等待1秒让页面加载
    setTimeout(checkAndStart, 1000);
  }

  bindEditButtonEvents() {
    const editButtons = document.querySelectorAll('.edit-button');
    editButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(button.getAttribute('data-index'));
        this.openEditor(index);
      });
    });
  }

  async openEditor(screenshotIndex) {
    try {
      // 获取截图数据
      let operations = await this.getOperationsData();
      if (!operations || operations.length === 0) {
        const opsStr = localStorage.getItem('operations');
        if (opsStr) {
          operations = JSON.parse(opsStr);
        } else {
          operations = [
            {
              screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
              url: 'https://example.com',
              timestamp: Date.now()
            }
          ];
        }
      }
      
      if (screenshotIndex >= 0 && screenshotIndex < operations.length) {
        // 将所有截图数据和当前选中的索引存储到localStorage，供editor.html使用
        const editorData = {
          operations: operations,  // 传递所有截图数据
          currentIndex: screenshotIndex  // 当前选中的截图索引
        };
        
        localStorage.setItem('editorData', JSON.stringify(editorData));
        // 同步持久化当前索引，确保编辑器刷新后仍保持选中
        try {
          localStorage.setItem('editorCurrentIndex', String(screenshotIndex));
        } catch (e) {
          console.warn('写入 editorCurrentIndex 失败:', e);
        }
        
        // 在新标签页中打开编辑器
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          // Chrome扩展环境
          chrome.tabs.create({
            url: chrome.runtime.getURL('editor.html')
          });
        } else {
          // 普通网页环境
          window.open('editor.html', '_blank');
        }
      }
    } catch (error) {
      console.error('打开编辑器失败:', error);
      // 如果新标签页方式失败，回退到模态框
      this.showEditorModal(screenshotIndex);
    }
  }

  async showEditorModal(screenshotIndex) {
    const modal = document.getElementById('editorModal');
    const canvas = document.getElementById('editorCanvas');
    
    // 获取截图数据
    let operations = await this.getOperationsData();
    if (!operations || operations.length === 0) {
      const opsStr = localStorage.getItem('operations');
      if (opsStr) {
        operations = JSON.parse(opsStr);
      } else {
        operations = [
          {
            screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            url: 'https://example.com',
            timestamp: Date.now()
          }
        ];
        console.log('在测试环境中运行，使用模拟数据');
      }
    }
    
    if (screenshotIndex >= 0 && screenshotIndex < operations.length) {
      const operation = operations[screenshotIndex];
      const screenshot = operation.screenshot;
      
      if (screenshot) {
        // 创建图片对象
        const img = new Image();
        img.onload = () => {
          // 获取容器尺寸
          const container = document.querySelector('.editor-canvas-container');
          const containerWidth = container.clientWidth - 40; // 减去padding
          const containerHeight = container.clientHeight - 40;
          
          // 计算缩放比例以适应容器
          const scaleX = containerWidth / img.width;
          const scaleY = containerHeight / img.height;
          const scale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小
          
          const canvasWidth = img.width * scale;
          const canvasHeight = img.height * scale;
          
          // 记录尺寸与缩放信息，保存时需要使用
          this.editorScale = scale;
          this.editorOriginalWidth = img.width;
          this.editorOriginalHeight = img.height;
          this.editorCanvasWidth = canvasWidth;
          this.editorCanvasHeight = canvasHeight;
          
          // 设置canvas尺寸
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          
          // 初始化Fabric.js画布
          if (this.fabricCanvas) {
            this.fabricCanvas.dispose();
          }
          
          this.fabricCanvas = new fabric.Canvas('editorCanvas');
          
          // 设置背景图片
          fabric.Image.fromURL(screenshot, (fabricImg) => {
            fabricImg.set({
              left: 0,
              top: 0,
              selectable: false,
              evented: false,
              scaleX: scale,
              scaleY: scale
            });
            this.fabricCanvas.setBackgroundImage(fabricImg, this.fabricCanvas.renderAll.bind(this.fabricCanvas));
            this.fabricCanvas.setWidth(canvasWidth);
            this.fabricCanvas.setHeight(canvasHeight);
            
            // 如果已有编辑数据，加载至画布（过滤背景图，避免重复）
            if (operation.editData && operation.editData.canvas) {
              const cleanedCanvasData = JSON.parse(JSON.stringify(operation.editData.canvas));
              if (cleanedCanvasData.objects) {
                cleanedCanvasData.objects = cleanedCanvasData.objects.filter(obj => obj.type !== 'image');
              }
              this.fabricCanvas.loadFromJSON(cleanedCanvasData, () => {
                this.fabricCanvas.renderAll();
              });
            }
          });
          
          // 显示模态框
          modal.style.display = 'flex';
          
          // 存储当前编辑的截图索引
          this.currentEditingIndex = screenshotIndex;
          this.currentTool = 'select';
          this.numberCounter = 1;
        };
        img.src = screenshot;
      }
    }
    
    // 绑定编辑器事件
    this.bindEditorEvents();
  }

  bindEditorEvents() {
    const modal = document.getElementById('editorModal');
    const closeBtn = document.getElementById('closeEditor');
    const cancelBtn = document.getElementById('cancelEditor');
    const saveBtn = document.getElementById('saveEditor');
    const strokeColorPicker = document.getElementById('strokeColor');
    const strokeWidthSlider = document.getElementById('strokeWidth');
    const strokeWidthValue = document.getElementById('strokeWidthValue');
    
    // 关闭编辑器
    const closeEditor = () => {
      modal.style.display = 'none';
      this.currentEditingIndex = null;
      if (this.fabricCanvas) {
        this.fabricCanvas.dispose();
        this.fabricCanvas = null;
      }
    };
    
    closeBtn.onclick = closeEditor;
    cancelBtn.onclick = closeEditor;
    
    // 点击模态框背景关闭
    modal.onclick = (e) => {
      if (e.target === modal) {
        closeEditor();
      }
    };
    
    // 保存编辑
    saveBtn.onclick = async () => {
      await this.saveEditedScreenshot();
      closeEditor();
    };
    
    // 工具按钮事件
    const toolBtns = modal.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
      btn.onclick = () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTool = btn.id.replace('Tool', '');
        this.setDrawingMode();
      };
    });
    
    // 颜色选择器事件
    if (strokeColorPicker) {
      strokeColorPicker.onchange = () => {
        this.strokeColor = strokeColorPicker.value;
      };
    }
    
    // 线条宽度滑块事件
    if (strokeWidthSlider) {
      strokeWidthSlider.oninput = () => {
        this.strokeWidth = parseInt(strokeWidthSlider.value);
        if (strokeWidthValue) {
          strokeWidthValue.textContent = this.strokeWidth;
        }
      };
    }
    
    // 初始化默认值
    this.strokeColor = strokeColorPicker ? strokeColorPicker.value : '#ff0000';
    this.strokeWidth = strokeWidthSlider ? parseInt(strokeWidthSlider.value) : 2;
    if (strokeWidthValue) {
      strokeWidthValue.textContent = this.strokeWidth;
    }
  }

  setDrawingMode() {
    if (!this.fabricCanvas) return;
    
    // 重置画布状态
    this.fabricCanvas.isDrawingMode = false;
    this.fabricCanvas.selection = true;
    
    switch (this.currentTool) {
      case 'select':
        this.fabricCanvas.selection = true;
        break;
      case 'text':
        this.addText();
        break;
      case 'rectangle':
        this.startDrawingRectangle();
        break;
      case 'circle':
        this.startDrawingCircle();
        break;
      case 'line':
        this.startDrawingLine();
        break;
      case 'arrow':
        this.startDrawingArrow();
        break;
      case 'freedraw':
        this.fabricCanvas.isDrawingMode = true;
        this.fabricCanvas.freeDrawingBrush.width = this.strokeWidth;
        this.fabricCanvas.freeDrawingBrush.color = this.strokeColor;
        break;
      case 'number':
        this.addNumberAnnotation();
        break;
    }
  }

  addText() {
    const text = new fabric.IText('双击编辑文本', {
      left: 100,
      top: 100,
      fontFamily: 'Arial',
      fontSize: 20,
      fill: this.strokeColor,
      editable: true
    });
    this.fabricCanvas.add(text);
    this.fabricCanvas.setActiveObject(text);
  }

  startDrawingRectangle() {
    let isDrawing = false;
    let startX, startY;
    let rect;

    this.fabricCanvas.on('mouse:down', (o) => {
      if (this.currentTool !== 'rectangle') return;
      isDrawing = true;
      const pointer = this.fabricCanvas.getPointer(o.e);
      startX = pointer.x;
      startY = pointer.y;
      
      rect = new fabric.Rect({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: this.strokeColor,
        strokeWidth: this.strokeWidth
      });
      this.fabricCanvas.add(rect);
    });

    this.fabricCanvas.on('mouse:move', (o) => {
      if (!isDrawing || this.currentTool !== 'rectangle') return;
      const pointer = this.fabricCanvas.getPointer(o.e);
      rect.set({
        width: Math.abs(pointer.x - startX),
        height: Math.abs(pointer.y - startY),
        left: Math.min(startX, pointer.x),
        top: Math.min(startY, pointer.y)
      });
      this.fabricCanvas.renderAll();
    });

    this.fabricCanvas.on('mouse:up', () => {
      if (this.currentTool !== 'rectangle') return;
      isDrawing = false;
    });
  }

  startDrawingCircle() {
    let isDrawing = false;
    let startX, startY;
    let circle;

    this.fabricCanvas.on('mouse:down', (o) => {
      if (this.currentTool !== 'circle') return;
      isDrawing = true;
      const pointer = this.fabricCanvas.getPointer(o.e);
      startX = pointer.x;
      startY = pointer.y;
      
      circle = new fabric.Circle({
        left: startX,
        top: startY,
        radius: 0,
        fill: 'transparent',
        stroke: this.strokeColor,
        strokeWidth: this.strokeWidth
      });
      this.fabricCanvas.add(circle);
    });

    this.fabricCanvas.on('mouse:move', (o) => {
      if (!isDrawing || this.currentTool !== 'circle') return;
      const pointer = this.fabricCanvas.getPointer(o.e);
      const radius = Math.sqrt(Math.pow(pointer.x - startX, 2) + Math.pow(pointer.y - startY, 2)) / 2;
      circle.set({
        radius: radius,
        left: startX - radius,
        top: startY - radius
      });
      this.fabricCanvas.renderAll();
    });

    this.fabricCanvas.on('mouse:up', () => {
      if (this.currentTool !== 'circle') return;
      isDrawing = false;
    });
  }

  startDrawingLine() {
    let isDrawing = false;
    let startX, startY;
    let line;

    this.fabricCanvas.on('mouse:down', (o) => {
      if (this.currentTool !== 'line') return;
      isDrawing = true;
      const pointer = this.fabricCanvas.getPointer(o.e);
      startX = pointer.x;
      startY = pointer.y;
      
      line = new fabric.Line([startX, startY, startX, startY], {
        stroke: this.strokeColor,
        strokeWidth: this.strokeWidth
      });
      this.fabricCanvas.add(line);
    });

    this.fabricCanvas.on('mouse:move', (o) => {
      if (!isDrawing || this.currentTool !== 'line') return;
      const pointer = this.fabricCanvas.getPointer(o.e);
      line.set({
        x2: pointer.x,
        y2: pointer.y
      });
      this.fabricCanvas.renderAll();
    });

    this.fabricCanvas.on('mouse:up', () => {
      if (this.currentTool !== 'line') return;
      isDrawing = false;
    });
  }

  startDrawingArrow() {
    let isDrawing = false;
    let startX, startY;
    let arrow;

    this.fabricCanvas.on('mouse:down', (o) => {
      if (this.currentTool !== 'arrow') return;
      isDrawing = true;
      const pointer = this.fabricCanvas.getPointer(o.e);
      startX = pointer.x;
      startY = pointer.y;
      
      arrow = this.createArrow(startX, startY, startX, startY);
      this.fabricCanvas.add(arrow);
    });

    this.fabricCanvas.on('mouse:move', (o) => {
      if (!isDrawing || this.currentTool !== 'arrow') return;
      const pointer = this.fabricCanvas.getPointer(o.e);
      this.fabricCanvas.remove(arrow);
      arrow = this.createArrow(startX, startY, pointer.x, pointer.y);
      this.fabricCanvas.add(arrow);
      this.fabricCanvas.renderAll();
    });

    this.fabricCanvas.on('mouse:up', () => {
      if (this.currentTool !== 'arrow') return;
      isDrawing = false;
    });
  }

  createArrow(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    // 若拖动距离太短，绘制一个小点避免异常箭头
    if (length < 8) {
      return new fabric.Circle({
        left: x1 - 2,
        top: y1 - 2,
        radius: 2,
        fill: this.strokeColor,
        selectable: false,
        evented: false
      });
    }

    const headLength = Math.min(20, length * 0.25);
    const headWidth = headLength * 0.8;
    const adjustedLength = Math.max(0, length - headLength);

    const line = new fabric.Line([0, 0, adjustedLength, 0], {
      stroke: this.strokeColor,
      strokeWidth: this.strokeWidth,
      strokeLineCap: 'round',
      originX: 'left',
      originY: 'center',
      selectable: false,
      evented: false
    });

    // 路径起点放在线段终点，往回画三角形，使尾部中心与线段终点重合
    const arrowHeadPath = `M ${adjustedLength} 0 L ${adjustedLength - headLength} ${-headWidth / 2} L ${adjustedLength - headLength} ${headWidth / 2} Z`;
    const arrowHead = new fabric.Path(arrowHeadPath, {
      fill: this.strokeColor,
      originX: 'center',   // 水平中心即尾部中心
      originY: 'center',
      selectable: false,
      evented: false
    });

    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    return new fabric.Group([line, arrowHead], {
      left: x1,
      top: y1,
      originX: 'left',
      originY: 'center',
      angle: angle
    });
  }

  addNumberAnnotation() {
    const circle = new fabric.Circle({
      left: 100,
      top: 100,
      radius: 15,
      fill: this.strokeColor,
      stroke: '#ffffff',
      strokeWidth: 2
    });
    
    const text = new fabric.Text(this.numberCounter.toString(), {
      left: 100,
      top: 100,
      fontSize: 16,
      fill: '#ffffff',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center'
    });
    
    const group = new fabric.Group([circle, text], {
      left: 100,
      top: 100
    });
    
    this.fabricCanvas.add(group);
    this.numberCounter++;
  }

  async saveEditedScreenshot() {
    if (this.currentEditingIndex === null || !this.fabricCanvas) return;
    
    // 获取编辑后的图片数据
    const editedScreenshot = this.fabricCanvas.toDataURL({
      format: 'jpeg',
      quality: 0.8
    });
    
    // 更新存储中的截图（优先包含已编辑的数据）
    const operations = await this.getOperationsData();
    
    if (this.currentEditingIndex < operations.length) {
      operations[this.currentEditingIndex].screenshot = editedScreenshot;
      operations[this.currentEditingIndex].isEdited = true;
      operations[this.currentEditingIndex].editTime = Date.now();
      
      // 保存最新的画布数据，确保主界面渲染与编辑保持一致
      const existingEditData = operations[this.currentEditingIndex].editData || {};
      const canvasData = this.fabricCanvas.toJSON([
        'selectable',
        'evented',
        'layerId',
        'pathOffset',
        'strokeUniform',
        'name',
        'id'
      ]);
      const annotationCanvasData = JSON.parse(JSON.stringify(canvasData));
      if (annotationCanvasData.objects) {
        annotationCanvasData.objects = annotationCanvasData.objects.filter(obj => obj.type !== 'image');
      }
      
      // 计算原始截图尺寸（背景图按照缩放比例还原）
      let originalWidth = this.editorOriginalWidth;
      let originalHeight = this.editorOriginalHeight;
      const backgroundImage = this.fabricCanvas.backgroundImage;
      if ((!originalWidth || !originalHeight) && backgroundImage) {
        const bgScaleX = backgroundImage.scaleX || 1;
        const bgScaleY = backgroundImage.scaleY || 1;
        originalWidth = backgroundImage.width ? backgroundImage.width / bgScaleX : this.fabricCanvas.getWidth() / bgScaleX;
        originalHeight = backgroundImage.height ? backgroundImage.height / bgScaleY : this.fabricCanvas.getHeight() / bgScaleY;
      }
      
      operations[this.currentEditingIndex].editData = {
        ...existingEditData,
        canvas: annotationCanvasData,
        canvasWidth: this.editorCanvasWidth || this.fabricCanvas.getWidth(),
        canvasHeight: this.editorCanvasHeight || this.fabricCanvas.getHeight(),
        originalImageWidth: originalWidth || existingEditData.originalImageWidth || this.fabricCanvas.getWidth(),
        originalImageHeight: originalHeight || existingEditData.originalImageHeight || this.fabricCanvas.getHeight(),
        scale: this.editorScale || existingEditData.scale || 1,
        lastModified: Date.now()
      };
      
      // 保留原有的文本块等附加数据
      if (existingEditData.textBlocks && !operations[this.currentEditingIndex].editData.textBlocks) {
        operations[this.currentEditingIndex].editData.textBlocks = existingEditData.textBlocks;
      }
      
      await chrome.storage.local.set({ 
        operations,
        editedOperations: operations
      });
      try {
        localStorage.setItem('operations', JSON.stringify(operations));
      } catch (e) {
        console.warn('本地同步编辑数据失败:', e);
      }
      
      // 刷新截图列表显示
      this.updateScreenshotsList(operations);
      
      console.log('截图编辑已保存');
    }
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

    if (confirm(`⚠️ 订阅即将到期

${message}

点击"确定"前往续费页面，点击"取消"稍后提醒。`)) {
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
    const message = `您的专业版订阅已过期，已自动切换为免费版。

免费版限制生成20页文档，如需继续使用专业版功能，请续费。

季度版：¥19.9
年费版：¥49.9（省37%）`;
    
    if (confirm(`🔔 订阅已过期

${message}

点击"确定"前往续费页面，点击"取消"继续使用免费版。`)) {
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
      if (status) {
        status.textContent = '正在记录...';
        status.className = 'status recording';
        
        // 强制应用样式（确保立即生效）
        status.style.backgroundColor = '#e8f5e8';
        status.style.color = '#2d5a2d';
        status.style.border = '1px solid #4caf50';
        
        // 强制DOM重绘
        void status.offsetWidth;
      }
      
      // 更新按钮状态
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
      if (clearBtn) {
        clearBtn.disabled = true; // 录制时禁用清空按钮
        clearBtn.style.opacity = '0.5';
      }
    } else {
      // 更新状态显示
      if (status) {
        status.textContent = '未开始记录';
        status.className = 'status stopped';
        
        // 强制应用样式（确保立即生效）
        status.style.backgroundColor = '#f5f5f5';
        status.style.color = '#666';
        status.style.border = '1px solid #ccc';
        
        // 强制DOM重绘
        void status.offsetWidth;
      }
      
      // 更新按钮状态
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
      if (clearBtn) {
        clearBtn.disabled = false; // 非录制时启用清空按钮
        clearBtn.style.opacity = '1';
      }
    }
  }

  async exportDocument() {
    try {
      // 获取所有操作记录（包含编辑内容）
      const operations = await this.getOperationsData();
      
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
    modal.id = 'exportModal_' + Date.now(); // 添加唯一ID
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

    // 创建关闭函数
    const closeModal = () => {
      console.log('关闭导出模态框');
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      // 移除所有事件监听器
      document.removeEventListener('keydown', escHandler);
      document.removeEventListener('click', globalClickHandler);
    };

    // 点击背景关闭模态框
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // 全局点击处理器（处理意外情况）
    const globalClickHandler = (e) => {
      // 如果点击的是模态框外部或按下了关闭键
      if (e.target === modal || e.target.classList.contains('modal-close')) {
        closeModal();
      }
    };
    document.addEventListener('click', globalClickHandler);

    // ESC键关闭模态框
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener('keydown', escHandler);

    // 双击背景关闭（额外保险）
    modal.addEventListener('dblclick', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
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
      closeModal();
      this.exportToPDF(operations);
    });

    document.getElementById('exportWord').addEventListener('click', () => {
      closeModal();
      this.exportToWord(operations);
    });

    document.getElementById('exportMarkdown').addEventListener('click', () => {
      closeModal();
      this.exportToMarkdown(operations);
    });

    document.getElementById('cancelExport').addEventListener('click', () => {
      closeModal();
    });

    // 添加超时关闭机制（防止意外情况）
    setTimeout(() => {
      if (document.body.contains(modal)) {
        console.log('模态框仍在页面中，执行强制关闭');
        closeModal();
      }
    }, 30000); // 30秒后自动关闭
  }


  
  async exportToPDF(operations) {
    try {
      // 预处理：生成所有带标注的截图
      const processedOperations = await this.preprocessOperationsForExport(operations);

      // 生成专门为PDF设计的HTML内容
      const htmlContent = this.generatePDFDocument(processedOperations);
      
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
      // 预处理：生成所有带标注的截图
      const processedOperations = await this.preprocessOperationsForExport(operations);

      // 使用HTML方式生成Word文档，这样更容易被Word打开
      const htmlContent = this.generateWordHTMLDocument(processedOperations);
      
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
      // 预处理：生成所有带标注的截图
      const processedOperations = await this.preprocessOperationsForExport(operations);

      // 生成Markdown内容
      const mdContent = this.generateMarkdownDocument(processedOperations);
      
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
    // 生成Markdown文档，优先使用编辑后的内容
    let mdContent = `# 操作流程文档\n\n`;

    operations.forEach((op, index) => {
      const stepNumber = index + 1;

      // 优先使用编辑后的Markdown内容
      if (op.markdownContent && op.markdownContent.trim()) {
        // 使用编辑器中编辑的Markdown内容
        mdContent += op.markdownContent.trim() + '\n\n';

        // 确保截图已包含在编辑内容中，如果没有则添加
        if (!op.markdownContent.includes(`![](${op.screenshot})`) && !op.markdownContent.includes(`![步骤${stepNumber}截图]`)) {
          mdContent += `![步骤${stepNumber}截图](${op.screenshot})\n\n`;
        }
      } else {
        // 如果没有编辑内容，使用默认格式
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

        // 添加基本操作信息
        if (op.action && op.element) {
          const elementText = op.text ? ` "${op.text}"` : '';
          mdContent += `**操作**: ${op.action}${elementText}\n\n`;
        }

        if (op.text) {
          mdContent += `**元素文本**: ${op.text}\n\n`;
        }

        if (op.url) {
          mdContent += `**页面**: ${op.url}\n\n`;
        }

        // 嵌入base64截图
        if (op.screenshot) {
          mdContent += `![步骤${stepNumber}截图](${op.screenshot})\n\n`;
        }
      }

      mdContent += `---\n\n`;
    });

    return mdContent;
  }



  async clearRecords() {
    if (confirm('确定要清空所有记录吗？')) {
      await chrome.storage.local.set({ operations: [], editedOperations: [] });
      try {
        localStorage.removeItem('operations');
        localStorage.removeItem('editorData');
      } catch (e) {
        console.warn('清理本地缓存失败:', e);
      }
      await this.loadPluginInfo();
      alert('记录已清空');
    }
  }
}

// 初始化控制器
document.addEventListener('DOMContentLoaded', () => {
  window.popupController = new PopupController();
});
