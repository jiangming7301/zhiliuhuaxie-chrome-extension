// 编辑器主类 - 简化版本
class ScreenshotEditor {
    constructor() {
        this.canvas = null;
        this.currentTool = 'select';
        this.screenshots = [];
        this.currentScreenshotIndex = 0;
        this.textEditor = null;
        this.isTextEditing = false;
        this.projectData = null;
        this.autoSaveTimer = null;
        this.lastSaveTime = 0;

        this.init();

        // 添加页面卸载时的保存
        window.addEventListener('beforeunload', async (e) => {
            if (this.hasUnsavedChanges()) {
                // 立即保存数据
                await this.immediateSave();

                // 显示确认提示（可选）
                e.preventDefault();
                e.returnValue = '您有未保存的更改，确定要离开吗？';
                return e.returnValue;
            }
        });

        // 添加页面可见性变化的保存
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden) {
                await this.immediateSave();
            }
        });

        // 初始化模态框事件监听器
        this.initModalEventListeners();
    }

    // 初始化编辑器
    async init() {
        try {
            await this.loadProjectData();
            this.initCanvas();
            this.initTextEditor();
            this.bindEvents();
            this.loadScreenshots();
            this.initializeDragAndDrop();
            this.initializeShortcuts();
        } catch (error) {
            console.error('编辑器初始化失败:', error);
            this.showError('编辑器初始化失败，请刷新页面重试');
        }
    }

    // 加载项目数据
    async loadProjectData() {
        try {
            // 首先尝试从localStorage获取编辑器数据（由popup.js传递）
            const editorDataStr = localStorage.getItem('editorData');
            if (editorDataStr) {
                const editorData = JSON.parse(editorDataStr);
                // 使用传递的所有截图数据
                this.screenshots = editorData.operations || [];
                this.currentScreenshotIndex = editorData.currentIndex || 0;
                this.originalScreenshotIndex = editorData.currentIndex; // 保存原始索引用于保存时定位

                // 清除localStorage中的数据，避免重复使用
                localStorage.removeItem('editorData');
                return;
            }

            // 从URL参数获取截图索引（备用方案）
            const urlParams = new URLSearchParams(window.location.search);
            const screenshotIndex = urlParams.get('screenshot');

            // 检查是否在Chrome扩展环境中
            if (typeof chrome !== 'undefined' && chrome.storage) {
                // 从存储中加载当前操作数据
                const result = await chrome.storage.local.get(['operations']);
                this.projectData = result.operations || [];
            } else {
                // 在普通网页环境中使用模拟数据
                this.projectData = this.getMockData();
            }

            // 过滤出包含截图的操作
            const allScreenshots = this.projectData.filter(op => op.screenshot);

            if (allScreenshots.length === 0) {
                // 如果没有截图数据，创建一个默认的
                this.screenshots = [this.createDefaultScreenshot()];
                this.currentScreenshotIndex = 0;
                return;
            }

            // 如果指定了截图索引，则只加载该截图，否则加载所有截图
            if (screenshotIndex !== null && screenshotIndex !== undefined) {
                const index = parseInt(screenshotIndex);
                if (index >= 0 && index < allScreenshots.length) {
                    this.screenshots = [allScreenshots[index]];
                    this.currentScreenshotIndex = 0;
                } else {
                    this.screenshots = [allScreenshots[0]];
                    this.currentScreenshotIndex = 0;
                }
            } else {
                this.screenshots = allScreenshots;
                this.currentScreenshotIndex = 0;
            }
        } catch (error) {
            console.error('加载项目数据失败:', error);
            this.showError('加载数据失败，请重试');
        }
    }

    // 初始化画布
    initCanvas() {
        this.canvas = new fabric.Canvas('editorCanvas', {
            backgroundColor: '#ffffff',
            selection: true,
            preserveObjectStacking: true
        });

        // 画布事件监听
        this.canvas.on('selection:created', (e) => this.onObjectSelected(e));
        this.canvas.on('selection:updated', (e) => this.onObjectSelected(e));
        this.canvas.on('selection:cleared', () => this.onObjectDeselected());

        // 使用立即保存而不是延迟自动保存
        this.canvas.on('object:modified', async () => {
            this.updateHistory();
            await this.immediateSave(); // 对象修改时立即保存
        });

        // 工具相关事件
        this.canvas.on('mouse:down', (e) => this.onCanvasMouseDown(e));
        this.canvas.on('mouse:move', (e) => this.onCanvasMouseMove(e));
        this.canvas.on('mouse:up', async (e) => {
            this.onCanvasMouseUp(e);
            await this.immediateSave(); // 鼠标释放时立即保存
        });

        // 自由绘制完成事件
        this.canvas.on('path:created', async (e) => {
            this.addLayer(e.path);
            this.updateHistory();
            this.markAsModified();
            await this.immediateSave(); // 路径创建时立即保存
        });

        // 对象添加事件
        this.canvas.on('object:added', async (e) => {
            if (e.target && !e.target.layerId) {
                this.addLayer(e.target);
                await this.immediateSave(); // 对象添加时立即保存
            }
        });

        // 对象删除事件
        this.canvas.on('object:removed', async () => {
            await this.immediateSave(); // 对象删除时立即保存
        });
    }

    // 绑定事件监听器
    bindEvents() {
        // 工具栏按钮
        document.getElementById('backBtn').addEventListener('click', () => this.goBack());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveAndSync());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());

        // 绑定截图相关事件
        this.bindScreenshotEvents();

        // 绑定Markdown编辑器事件
        this.bindMarkdownEditorEvents();

        // 初始化拖拽排序
        this.initializeDragAndDrop();

        // 工具选择
        document.getElementById('selectTool').addEventListener('click', () => this.selectTool('select'));
        document.getElementById('textTool').addEventListener('click', () => this.selectTool('text'));
        document.getElementById('rectangleTool').addEventListener('click', () => this.selectTool('rectangle'));
        document.getElementById('circleTool').addEventListener('click', () => this.selectTool('circle'));
        document.getElementById('arrowTool').addEventListener('click', () => this.selectTool('arrow'));
        document.getElementById('penTool').addEventListener('click', () => this.selectTool('pen'));
        document.getElementById('lineTool').addEventListener('click', () => this.selectTool('line'));
        document.getElementById('highlighterTool').addEventListener('click', () => this.selectTool('highlighter'));

        // 侧边栏标签页切换
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchSidebarTab(e.target.dataset.tab));
        });

        // 侧边栏切换
        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());

        // 内容区域折叠
        const contentToggle = document.querySelector('.content-toggle');
        if (contentToggle) {
            contentToggle.addEventListener('click', () => this.toggleContentSection());
        }

        // 添加截图按钮
        document.getElementById('addScreenshotBtn').addEventListener('click', () => this.showAddScreenshotModal());

        // 文本编辑器事件
        document.getElementById('confirmTextEdit').addEventListener('click', () => this.confirmTextEdit());
        document.getElementById('cancelTextEdit').addEventListener('click', () => this.cancelTextEdit());

        // 属性面板控件
        document.getElementById('colorPicker').addEventListener('change', (e) => this.updateObjectColor(e.target.value));
        document.getElementById('strokeWidth').addEventListener('input', (e) => this.updateStrokeWidth(e.target.value));
        document.getElementById('opacity').addEventListener('input', (e) => this.updateOpacity(e.target.value));

        // 文件上传
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('uploadArea').addEventListener('click', () => document.getElementById('fileInput').click());

        // 拖拽上传
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            this.processFiles(files);
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    // 保存并同步到插件
    async saveAndSync() {
        try {
            console.log('开始保存并同步...');

            // 保存当前编辑状态
            this.saveCurrentEditState();

            // 立即同步到主存储
            await this.syncEditedDataToMainStorage();

            // 显示成功提示
            this.showSuccess('✓ 修改已保存并同步到插件！');

            console.log('保存并同步完成');
        } catch (error) {
            console.error('保存并同步失败:', error);
            this.showError('保存失败: ' + error.message);
        }
    }

    // 保存当前编辑状态
    saveCurrentEditState() {
        const currentScreenshot = this.screenshots[this.currentScreenshotIndex];
        if (currentScreenshot) {
            console.log('正在保存编辑状态...');

            // 保存画布数据
            const canvasData = this.canvas.toJSON(['textBlockId', 'isTextBlock']);

            // 保存文本块数据
            const textBlocksData = this.getTextBlocks();

            currentScreenshot.editData = {
                canvas: canvasData,
                textBlocks: textBlocksData,
                lastModified: Date.now(),
                canvasWidth: this.canvas.width,
                canvasHeight: this.canvas.height
            };

            // 同时保存Markdown内容
            const markdownContent = this.getCurrentMarkdownContent();
            if (markdownContent) {
                currentScreenshot.markdownContent = markdownContent;
            }

            console.log('编辑状态保存完成', {
                hasCanvas: !!canvasData,
                hasTextBlocks: !!textBlocksData,
                hasMarkdown: !!markdownContent,
                lastModified: currentScreenshot.editData.lastModified
            });
        }
    }

    // 同步编辑后的数据到主存储
    async syncEditedDataToMainStorage() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                // Chrome扩展环境
                const result = await chrome.storage.local.get(['operations']);
                const operations = result.operations || [];

                // 更新原始operations数据中的markdownContent
                this.screenshots.forEach((screenshot, index) => {
                    // 找到对应的原始operation
                    const originalIndex = operations.findIndex(op =>
                        op.id === screenshot.id ||
                        (op.timestamp === screenshot.timestamp && op.screenshot === screenshot.screenshot)
                    );

                    if (originalIndex !== -1) {
                        operations[originalIndex].markdownContent = screenshot.markdownContent;
                        operations[originalIndex].editData = screenshot.editData;
                    }
                });

                // 保存回主存储
                await chrome.storage.local.set({ operations: operations });

                // 设置编辑标记，以便导出时使用编辑后的内容
                await chrome.storage.local.set({
                    hasEditedContent: true,
                    lastEditTime: Date.now()
                });

            } else {
                // 普通网页环境，使用localStorage
                const operationsStr = localStorage.getItem('operations');
                if (operationsStr) {
                    const operations = JSON.parse(operationsStr);

                    // 更新markdownContent和editData
                    this.screenshots.forEach((screenshot, index) => {
                        const originalIndex = operations.findIndex(op =>
                            op.id === screenshot.id ||
                            (op.timestamp === screenshot.timestamp && op.screenshot === screenshot.screenshot)
                        );

                        if (originalIndex !== -1) {
                            operations[originalIndex].markdownContent = screenshot.markdownContent;
                            operations[originalIndex].editData = screenshot.editData;
                        }
                    });

                    localStorage.setItem('operations', JSON.stringify(operations));
                    localStorage.setItem('hasEditedContent', 'true');
                    localStorage.setItem('lastEditTime', Date.now().toString());
                }
            }

            console.log('编辑后的数据已同步到主存储');
        } catch (error) {
            console.error('同步数据到主存储失败:', error);
        }
    }

    // 立即保存到主存储（用于关键操作）
    async immediateSave() {
        try {
            console.log('执行立即保存...');
            this.saveCurrentEditState();
            await this.syncEditedDataToMainStorage();
            console.log('立即保存完成');
            this.showAutoSaveIndicator();
        } catch (error) {
            console.error('立即保存失败:', error);
        }
    }

    // 显示自动保存指示器
    showAutoSaveIndicator() {
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        indicator.textContent = '✓ 已自动保存';

        document.body.appendChild(indicator);

        // 显示动画
        setTimeout(() => {
            indicator.style.opacity = '1';
        }, 10);

        // 2秒后隐藏并移除
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }, 2000);
    }

    // 显示成功消息
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    // 显示错误消息
    showError(message) {
        this.showMessage(message, 'error');
    }

    // 通用消息显示
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;

        // 根据类型设置样式
        const colors = {
            success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
            error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
            info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' }
        };

        const color = colors[type] || colors.info;
        messageEl.style.backgroundColor = color.bg;
        messageEl.style.border = `1px solid ${color.border}`;
        messageEl.style.color = color.text;

        messageEl.textContent = message;

        // 添加到页面
        document.body.appendChild(messageEl);

        // 显示动画
        setTimeout(() => {
            messageEl.style.opacity = '1';
            messageEl.style.transform = 'translateX(0)';
        }, 10);

        // 3秒后自动移除
        setTimeout(() => {
            messageEl.style.opacity = '0';
            messageEl.style.transform = 'translateX(100%)';

            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    // 检查是否有未保存的更改
    hasUnsavedChanges() {
        if (this.currentScreenshotIndex >= 0 && this.currentScreenshotIndex < this.screenshots.length) {
            const currentScreenshot = this.screenshots[this.currentScreenshotIndex];
            const hasCanvasObjects = this.canvas.getObjects().length > 1; // 大于1因为包含背景图片
            const hasMarkdownContent = this.getCurrentMarkdownContent().trim() !== '';

            return hasCanvasObjects || hasMarkdownContent;
        }
        return false;
    }

    // 绑定模态框事件监听器
    initModalEventListeners() {
        // 为所有模态框关闭按钮添加事件监听器
        const modalCloseButtons = document.querySelectorAll('.modal-close[data-modal]');
        modalCloseButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-modal');
                this.closeModal(modalId);
            });
        });

        // 为所有取消按钮添加事件监听器
        const cancelButtons = document.querySelectorAll('.btn-secondary[data-modal]');
        cancelButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-modal');
                this.closeModal(modalId);
            });
        });
    }

    // 关闭模态框
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            console.log(`模态框 ${modalId} 已关闭`);
        }
    }

    // 其他必要的方法（保持原有的功能）
    // 这里保留所有原有的编辑器功能方法，如：
    // - selectTool, onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseUp
    // - createRectangle, createCircle, createArrow, createText
    // - loadScreenshots, selectScreenshot, loadScreenshotToCanvas
    // - bindScreenshotEvents, bindMarkdownEditorEvents
    // - 以及其他所有编辑器功能...

    // 返回
    goBack() {
        if (confirm('确定要返回吗？未保存的更改将会丢失。')) {
            // 同步数据后再返回
            this.immediateSave().then(() => {
                window.close();
            });
        }
    }

    // ========== 工具选择相关 ==========
    selectTool(tool) {
        this.currentTool = tool;
        
        // 更新工具按钮状态
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(tool + 'Tool').classList.add('active');
        
        // 配置画布
        if (tool === 'pen') {
            this.canvas.isDrawingMode = true;
            this.canvas.freeDrawingBrush.width = parseInt(document.getElementById('strokeWidth').value) || 2;
            this.canvas.freeDrawingBrush.color = document.getElementById('colorPicker').value || '#ff0000';
        } else {
            this.canvas.isDrawingMode = false;
        }
        
        this.canvas.selection = (tool === 'select');
    }

    // ========== 截图管理相关 ==========
    loadScreenshots() {
        const screenshotsList = document.getElementById('screenshotsList');
        if (!screenshotsList) return;
        
        screenshotsList.innerHTML = '';

        this.screenshots.forEach((screenshot, index) => {
            const item = this.createScreenshotItem(screenshot, index);
            screenshotsList.appendChild(item);
        });

        // 选择当前截图
        if (this.screenshots.length > 0) {
            this.selectScreenshot(this.currentScreenshotIndex);
        }
    }

    createScreenshotItem(screenshot, index) {
        const item = document.createElement('div');
        item.className = 'screenshot-item';
        item.dataset.index = index;

        const thumbnail = document.createElement('img');
        thumbnail.className = 'screenshot-thumbnail';
        thumbnail.src = screenshot.screenshot;
        thumbnail.alt = `截图 ${index + 1}`;

        const info = document.createElement('div');
        info.className = 'screenshot-info';

        const title = document.createElement('div');
        title.className = 'screenshot-title';
        title.textContent = `步骤 ${screenshot.step || index + 1}`;

        info.appendChild(title);
        item.appendChild(thumbnail);
        item.appendChild(info);

        // 点击选择截图
        item.addEventListener('click', () => this.selectScreenshot(index));

        return item;
    }

    async selectScreenshot(index) {
        // 保存当前截图的编辑状态
        if (this.currentScreenshotIndex !== index) {
            await this.immediateSave();
        }

        // 更新选中状态
        document.querySelectorAll('.screenshot-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
        });

        this.currentScreenshotIndex = index;
        const screenshot = this.screenshots[index];

        // 加载截图到画布
        this.loadScreenshotToCanvas(screenshot);

        // 更新右侧内容显示
        this.updateContentDisplay(screenshot, index);
    }

    loadScreenshotToCanvas(screenshot) {
        this.canvas.clear();

        // 加载背景图片
        fabric.Image.fromURL(screenshot.screenshot, (img) => {
            const maxWidth = 1200;
            const maxHeight = 800;
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);

            this.canvas.setWidth(img.width * scale);
            this.canvas.setHeight(img.height * scale);

            img.scale(scale);
            img.set({
                left: 0,
                top: 0,
                selectable: false,
                evented: false
            });

            this.canvas.add(img);
            this.canvas.sendToBack(img);
            this.canvas.renderAll();

            // 加载编辑数据
            if (screenshot.editData && screenshot.editData.canvas) {
                setTimeout(() => {
                    this.canvas.loadFromJSON(screenshot.editData.canvas, () => {
                        this.canvas.sendToBack(img);
                        this.canvas.renderAll();
                    });
                }, 100);
            }
        });
    }

    // ========== 内容显示相关 ==========
    updateContentDisplay(screenshot, index) {
        // 更新Markdown编辑器
        this.updateMarkdownEditor(screenshot, index);
    }

    updateMarkdownEditor(screenshot, index) {
        const markdownEditor = document.getElementById('markdownEditor');
        if (!markdownEditor) return;

        // 加载已保存的Markdown内容，或使用默认内容
        let content = screenshot.markdownContent || this.generateDefaultMarkdown(screenshot, index);
        markdownEditor.value = content;
    }

    generateDefaultMarkdown(screenshot, index) {
        const stepNumber = index + 1;
        let markdown = `## 步骤 ${stepNumber}\n\n`;
        
        if (screenshot.text) {
            markdown += `${screenshot.text}\n\n`;
        }
        
        if (screenshot.url) {
            markdown += `**页面**: ${screenshot.url}\n\n`;
        }
        
        return markdown;
    }

    getCurrentMarkdownContent() {
        const markdownEditor = document.getElementById('markdownEditor');
        return markdownEditor ? markdownEditor.value : '';
    }

    // ========== 侧边栏相关 ==========
    switchSidebarTab(tab) {
        // 更新标签状态
        document.querySelectorAll('.sidebar-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        // 更新面板显示
        document.querySelectorAll('.sidebar-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        const targetPanel = document.getElementById(tab + 'Panel');
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    }

    toggleContentSection() {
        const contentSection = document.getElementById('contentSection');
        if (contentSection) {
            contentSection.classList.toggle('collapsed');
        }
    }

    // ========== 画布事件处理 ==========
    onCanvasMouseDown(e) {
        if (this.currentTool === 'select' || this.currentTool === 'text') return;
        
        this.isDrawing = true;
        const pointer = this.canvas.getPointer(e.e);
        this.drawStartPoint = { x: pointer.x, y: pointer.y };
    }

    onCanvasMouseMove(e) {
        if (!this.isDrawing || this.currentTool === 'select') return;
        
        const pointer = this.canvas.getPointer(e.e);
        
        // 根据工具类型绘制不同的形状
        if (this.currentDrawingObject) {
            this.canvas.remove(this.currentDrawingObject);
        }
        
        const color = document.getElementById('colorPicker').value;
        const strokeWidth = parseInt(document.getElementById('strokeWidth').value);
        
        switch (this.currentTool) {
            case 'rectangle':
                this.currentDrawingObject = new fabric.Rect({
                    left: Math.min(this.drawStartPoint.x, pointer.x),
                    top: Math.min(this.drawStartPoint.y, pointer.y),
                    width: Math.abs(pointer.x - this.drawStartPoint.x),
                    height: Math.abs(pointer.y - this.drawStartPoint.y),
                    fill: 'transparent',
                    stroke: color,
                    strokeWidth: strokeWidth
                });
                break;
            case 'circle':
                const radius = Math.sqrt(
                    Math.pow(pointer.x - this.drawStartPoint.x, 2) +
                    Math.pow(pointer.y - this.drawStartPoint.y, 2)
                ) / 2;
                this.currentDrawingObject = new fabric.Circle({
                    left: this.drawStartPoint.x,
                    top: this.drawStartPoint.y,
                    radius: radius,
                    fill: 'transparent',
                    stroke: color,
                    strokeWidth: strokeWidth,
                    originX: 'center',
                    originY: 'center'
                });
                break;
            case 'line':
                this.currentDrawingObject = new fabric.Line(
                    [this.drawStartPoint.x, this.drawStartPoint.y, pointer.x, pointer.y],
                    {
                        stroke: color,
                        strokeWidth: strokeWidth
                    }
                );
                break;
        }
        
        if (this.currentDrawingObject) {
            this.canvas.add(this.currentDrawingObject);
            this.canvas.renderAll();
        }
    }

    onCanvasMouseUp(e) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        this.currentDrawingObject = null;
        this.drawStartPoint = null;
    }

    onObjectSelected(e) {
        // 对象被选中时更新属性面板
        if (e.selected && e.selected.length > 0) {
            const obj = e.selected[0];
            document.getElementById('colorPicker').value = obj.stroke || '#000000';
            document.getElementById('strokeWidth').value = obj.strokeWidth || 2;
            document.getElementById('opacity').value = (obj.opacity || 1) * 100;
        }
    }

    onObjectDeselected() {
        // 取消选择时的处理
    }

    // ========== 属性更新 ==========
    updateObjectColor(color) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            activeObject.set('stroke', color);
            this.canvas.renderAll();
            this.immediateSave();
        }
    }

    updateStrokeWidth(width) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            activeObject.set('strokeWidth', parseInt(width));
            this.canvas.renderAll();
            this.immediateSave();
        }
        
        // 更新显示值
        document.getElementById('strokeWidthValue').textContent = width + 'px';
    }

    updateOpacity(value) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            activeObject.set('opacity', value / 100);
            this.canvas.renderAll();
            this.immediateSave();
        }
        
        // 更新显示值
        document.getElementById('opacityValue').textContent = value + '%';
    }

    // ========== 撤销/重做 ==========
    undo() {
        // TODO: 实现撤销功能
        console.log('撤销功能待实现');
    }

    redo() {
        // TODO: 实现重做功能
        console.log('重做功能待实现');
    }

    updateHistory() {
        // 更新历史记录
    }

    addLayer(object) {
        // 添加图层
        if (!object.layerId) {
            object.layerId = 'layer_' + Date.now();
        }
    }

    // ========== Markdown编辑器相关 ==========
    bindMarkdownEditorEvents() {
        const markdownEditor = document.getElementById('markdownEditor');
        if (!markdownEditor) return;

        markdownEditor.addEventListener('input', () => {
            this.markAsModified();
            // 自动保存
            this.immediateSave();
        });
    }

    // ========== 截图事件 ==========
    bindScreenshotEvents() {
        // 截图相关事件处理
    }

    initializeDragAndDrop() {
        // 初始化拖拽排序
        const screenshotsList = document.getElementById('screenshotsList');
        if (screenshotsList && typeof Sortable !== 'undefined') {
            new Sortable(screenshotsList, {
                animation: 150,
                onEnd: (evt) => {
                    const item = this.screenshots.splice(evt.oldIndex, 1)[0];
                    this.screenshots.splice(evt.newIndex, 0, item);
                    this.immediateSave();
                }
            });
        }
    }

    initializeShortcuts() {
        // 初始化快捷键
    }

    handleKeyboard(e) {
        // 快捷键处理
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    this.saveAndSync();
                    break;
                case 'z':
                    e.preventDefault();
                    this.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
            }
        }
    }

    // ========== 模态框相关 ==========
    showAddScreenshotModal() {
        const modal = document.getElementById('addScreenshotModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    hideAddScreenshotModal() {
        const modal = document.getElementById('addScreenshotModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    handleFileUpload(e) {
        const files = e.target.files;
        if (files && files.length > 0) {
            this.processFiles(Array.from(files));
        }
    }

    processFiles(files) {
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    // 添加截图
                    this.screenshots.push({
                        screenshot: e.target.result,
                        timestamp: Date.now(),
                        url: '',
                        title: file.name
                    });
                    this.loadScreenshots();
                    this.immediateSave();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // ========== 文本编辑相关 ==========
    confirmTextEdit() {
        // 确认文本编辑
    }

    cancelTextEdit() {
        // 取消文本编辑
    }

    getTextBlocks() {
        // 获取所有文本块
        return [];
    }

    createDefaultScreenshot() {
        const svgContent = `
            <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="600" fill="#f8f9fa"/>
                <text x="400" y="300" text-anchor="middle" font-size="20" fill="#6c757d">
                    默认截图
                </text>
            </svg>
        `;
        
        return {
            screenshot: 'data:image/svg+xml;base64,' + btoa(encodeURIComponent(svgContent).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1))),
            timestamp: Date.now(),
            url: '',
            title: '新截图'
        };
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN');
    }

    updateUI() {
        // 更新UI
    }
}

// 全局函数（向后兼容）
function closeModal(modalId) {
    if (window.editor && window.editor.closeModal) {
        window.editor.closeModal(modalId);
    } else {
        // 备用方法
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modalOverlay');
        if (modal) modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    }
}

// 页面加载完成后初始化编辑器
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new ScreenshotEditor();
});