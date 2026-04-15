// 编辑器主类
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
    this.isResettingCanvas = false;
        this.lastSaveTime = 0;
        this.autoSaveEnabled = true;  // 默认启用自动保存

        // 图片缩放相关信息
        this.originalImageWidth = null;
        this.originalImageHeight = null;
        this.currentScale = 1;
        this.backgroundImage = null;
        this.backgroundImageSource = null;
        this.targetCanvasWidth = null;
        this.targetCanvasHeight = null;
        this.canvasStates = {};
        this.historyStack = [];
        this.redoStack = [];
        this.lastCanvasState = null;
        this.localStorageLimited = localStorage.getItem('editorDataTrimmed') === 'true';
        this.storageWarningShown = this.localStorageLimited;

        // 防止无限保存循环
        this.isSaving = false;
        this.saveInProgress = false;
        this.currentSavePromise = null;
        this.pendingSaveRequested = false;
        this.isLoadingSnapshot = false;

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
            this.updateUI();
        } catch (error) {
            console.error('编辑器初始化失败:', error);
            this.showError('编辑器初始化失败，请刷新页面重试');
        }
    }

    updateUI() {
        this.updateCanvasInfo();
        const selectionInfo = document.getElementById('selectionInfo');
        if (selectionInfo) {
            selectionInfo.textContent = '未选择对象';
        }
    }

    updateUI() {
        this.updateCanvasInfo();
        const selectionInfo = document.getElementById('selectionInfo');
        if (selectionInfo) {
            selectionInfo.textContent = '未选择对象';
        }
    }

    getCurrentStepId() {
        const current = this.screenshots[this.currentScreenshotIndex];
        return this.currentCanvasStepId || this.ensureScreenshotId(current, this.currentScreenshotIndex);
    }

    getOperationKey(operation, fallbackIndex = 0) {
        if (!operation) {
            return `op_${fallbackIndex}`;
        }
        return (
            operation.id ||
            operation.operationId ||
            operation.recordId ||
            operation.timestamp ||
            `op_${fallbackIndex}`
        );
    }

    ensureScreenshotId(screenshot, fallbackIndex = 0) {
        if (!screenshot) {
            return `screenshot_${fallbackIndex}`;
        }
        if (!screenshot.__internalId) {
            const base =
                screenshot.id ||
                screenshot.operationId ||
                screenshot.recordId ||
                screenshot.timestamp ||
                `idx_${fallbackIndex}`;
            screenshot.__internalId = `shot_${base}_${fallbackIndex}`;
        }
        return screenshot.__internalId;
    }

    formatTimestamp(timestamp) {
        if (!timestamp) {
            return '-';
        }
        const date = new Date(timestamp);
        const options = {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleString('zh-CN', options);
    }

    addLayer(object) {
        if (!object) {
            return;
        }
        if (!object.layerId) {
            object.layerId = `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        }
    }

    markObjectStep(obj, stepId) {
        if (obj && stepId) {
            obj.__stepId = stepId;
        }
    }

    removeForeignObjects(stepId) {
        if (!this.canvas || !stepId) return;
        const foreignObjects = this.canvas
            .getObjects()
            .filter(obj => obj.__stepId && obj.__stepId !== stepId);
        if (foreignObjects.length) {
            foreignObjects.forEach(obj => this.canvas.remove(obj));
            this.canvas.renderAll();
        }
    }

    tagObjectWithCurrentStep(obj) {
        const stepId = this.getCurrentStepId();
        this.markObjectStep(obj, stepId);
    }

    // 加载项目数据
    async loadProjectData() {
        try {
            // 首先尝试从localStorage获取编辑器数据（由popup.js传递）
            const sessionEditorDataStr = this.localStorageLimited ? null : sessionStorage.getItem('editorData');
            if (sessionEditorDataStr) {
                const editorData = JSON.parse(sessionEditorDataStr);
                this.screenshots = editorData.operations || [];
                this.currentScreenshotIndex = editorData.currentIndex || 0;
                this.originalScreenshotIndex = editorData.currentIndex;
                return;
            }

            const editorDataStr = localStorage.getItem('editorData');
            if (editorDataStr) {
                const editorData = JSON.parse(editorDataStr);
                this.screenshots = editorData.operations || [];
                this.currentScreenshotIndex = editorData.currentIndex || 0;
                this.originalScreenshotIndex = editorData.currentIndex;

                this.writeLightweightRecoveryCache({
                    operations: this.screenshots,
                    currentIndex: this.currentScreenshotIndex
                }, this.screenshots);

                return;
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            const screenshotIndex = urlParams.get('screenshot');
            let storedEditorIndex = null;
            
            if (typeof chrome !== 'undefined' && chrome.storage) {
                try {
                    const result = await chrome.storage.local.get(['operations', 'editorCurrentIndex']);
                    this.projectData = result.operations || [];
                    if ((!this.projectData || this.projectData.length === 0) && !this.localStorageLimited && sessionStorage.getItem('editorData')) {
                        const cached = JSON.parse(sessionStorage.getItem('editorData'));
                        this.projectData = cached.operations || [];
                    } else if ((!this.projectData || this.projectData.length === 0) && localStorage.getItem('operations')) {
                        this.projectData = JSON.parse(localStorage.getItem('operations'));
                    }
                    storedEditorIndex = Number.isInteger(result.editorCurrentIndex) ? result.editorCurrentIndex : null;
                    console.log('从Chrome存储加载了数据:', this.projectData.length, '个操作');
                } catch (storageError) {
                    console.warn('从Chrome存储获取数据失败:', storageError);
                    this.projectData = this.projectData || [];
                }

                const withEditData = this.projectData.filter(op => op.editData);
                console.log('包含editData的操作:', withEditData.length, '个');

                if (withEditData.length > 0) {
                    withEditData.forEach((op, index) => {
                        console.log(`操作 ${index + 1} editData:`, {
                            hasCanvas: !!op.editData.canvas,
                            hasTextBlocks: !!op.editData.textBlocks,
                            objectsCount: op.editData.canvas?.objects?.length || 0
                        });
                    });
                }
            } else {
                const sessionCache = this.localStorageLimited ? null : sessionStorage.getItem('editorData');
        if (sessionCache) {
            const cacheData = JSON.parse(sessionCache);
            this.projectData = cacheData.operations || [];
            this.currentScreenshotIndex = cacheData.currentIndex || 0;
            console.log('从sessionStorage加载了数据:', this.projectData.length, '个操作');
        } else {
                    const operationsStr = localStorage.getItem('operations');
                    if (operationsStr) {
                        this.projectData = JSON.parse(operationsStr);
                        console.log('从localStorage加载了数据:', this.projectData.length, '个操作');
                    } else {
                        this.projectData = this.getMockData();
                        console.log('未找到本地数据，使用模拟数据');
                    }
                }
                const persistedIndexStr = localStorage.getItem('editorCurrentIndex');
                if (persistedIndexStr !== null) {
                    const persistedIndex = parseInt(persistedIndexStr, 10);
                    if (!Number.isNaN(persistedIndex)) {
                        storedEditorIndex = persistedIndex;
                    }
                }
            }
            
            // 过滤出包含截图的操作并克隆，避免引用同一对象导致跨步骤污染
            const allScreenshots = this.projectData
                .filter(op => op.screenshot)
                .map((op, idx) => {
                    const cloned = JSON.parse(JSON.stringify(op));
                    if (cloned.editData) {
                        const key = this.getOperationKey(cloned, idx);
                        this.canvasStates[key] = cloned.editData;
                    }
                    return cloned;
                });

            if (allScreenshots.length === 0) {
                // 如果没有截图数据，创建一个默认的
                this.screenshots = [this.createDefaultScreenshot()];
                this.currentScreenshotIndex = 0;
                return;
            }

            console.log('找到截图数据:', allScreenshots.length, '个');
            // 检查是否有编辑数据
            allScreenshots.forEach((screenshot, index) => {
                if (screenshot.editData) {
                    console.log(`截图 ${index + 1} 包含编辑数据:`, {
                        hasCanvas: !!screenshot.editData.canvas,
                        hasTextBlocks: !!screenshot.editData.textBlocks,
                        canvasWidth: screenshot.editData.canvasWidth,
                        canvasHeight: screenshot.editData.canvasHeight,
                        scale: screenshot.editData.scale
                    });
                } else {
                    console.log(`截图 ${index + 1} 无编辑数据`);
                }
            });

            // 如果指定了截图索引，则只加载该截图，否则加载所有截图
                if (screenshotIndex !== null && screenshotIndex !== undefined) {
                    const index = parseInt(screenshotIndex);
                    if (index >= 0 && index < allScreenshots.length) {
                        this.screenshots = [allScreenshots[index]];
                        this.currentScreenshotIndex = 0;
                        this.originalScreenshotIndex = index;
                    } else {
                        throw new Error('指定的截图索引无效');
                    }
                } else {
                    this.screenshots = allScreenshots;
                    if (storedEditorIndex !== null && storedEditorIndex >= 0 && storedEditorIndex < allScreenshots.length) {
                        this.currentScreenshotIndex = storedEditorIndex;
                    } else {
                        this.currentScreenshotIndex = 0;
                    }
                    this.originalScreenshotIndex = this.currentScreenshotIndex;
                }

                if (!this.localStorageLimited) {
                    try {
                        sessionStorage.setItem('editorData', JSON.stringify({
                            operations: this.screenshots,
                            currentIndex: this.currentScreenshotIndex
                        }));
                    } catch (err) {
                        console.warn('缓存编辑器数据失败:', err);
                        if (this.isQuotaExceededError(err)) {
                            this.activateLightweightMode(false);
                        }
                    }
                }
            
        } catch (error) {
            console.error('加载项目数据失败:', error);
            // 创建默认数据以便继续使用
            this.screenshots = [this.createDefaultScreenshot()];
            this.currentScreenshotIndex = 0;
        }
    }

    // 安全的Base64编码函数，支持中文字符
    safeBase64Encode(str) {
        try {
            // 使用 encodeURIComponent 和 btoa 来处理中文字符
            return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
                return String.fromCharCode('0x' + p1);
            }));
        } catch (e) {
            // 如果仍然失败，使用 URL 编码作为备用方案
            return encodeURIComponent(str);
        }
    }

    // 获取模拟数据（用于测试）
    getMockData() {
        const svgContent = `
            <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="600" fill="#f0f0f0"/>
                <text x="400" y="300" text-anchor="middle" font-size="24" fill="#666">
                    Sample Screenshot - Click toolbar to start editing
                </text>
            </svg>
        `;
        
        return [
            {
                screenshot: 'data:image/svg+xml;base64,' + this.safeBase64Encode(svgContent),
                timestamp: Date.now(),
                url: 'http://localhost:8000/editor.html',
                title: 'Editor Test Page'
            }
        ];
    }

    // 创建默认截图
    createDefaultScreenshot() {
        const svgContent = `
            <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="600" fill="#f8f9fa"/>
                <text x="400" y="280" text-anchor="middle" font-size="20" fill="#6c757d">
                    Welcome to Screenshot Editor
                </text>
                <text x="400" y="320" text-anchor="middle" font-size="16" fill="#6c757d">
                    Select tools from the left toolbar to start editing
                </text>
            </svg>
        `;
        
        return {
            screenshot: 'data:image/svg+xml;base64,' + this.safeBase64Encode(svgContent),
            timestamp: Date.now(),
            url: window.location.href,
            title: 'New Edit Project'
        };
    }

    // 初始化Fabric.js画布
    initCanvas() {
        this.createCanvasInstance();
        this.bindCanvasEvents();
    }

    createCanvasInstance() {
        const canvasElement = document.getElementById('fabricCanvas');
        this.canvas = new fabric.Canvas(canvasElement, {
            width: 1200,
            height: 800,
            backgroundColor: '#ffffff',
            selection: true,
            preserveObjectStacking: true
        });
    }

    bindCanvasEvents() {
        // 画布事件监听
        this.canvas.on('selection:created', (e) => this.onObjectSelected(e));
        this.canvas.on('selection:updated', (e) => this.onObjectSelected(e));
        this.canvas.on('selection:cleared', () => this.onObjectDeselected());

        // 使用立即保存而不是延迟自动保存
        this.canvas.on('object:modified', async () => {
            if (this.isDrawing || this.isResettingCanvas || this.isLoadingSnapshot) {
                console.log('正在绘制或重置画布，跳过object:modified保存');
                return;
            }
            this.pushHistorySnapshot();
            await this.immediateSave();
        });

        this.canvas.on('mouse:down', (e) => this.onCanvasMouseDown(e));
        this.canvas.on('mouse:move', (e) => this.onCanvasMouseMove(e));
        this.canvas.on('mouse:up', async (e) => {
            this.onCanvasMouseUp(e);
            await this.immediateSave();
        });

        this.canvas.on('path:created', async (e) => {
            if (this.isResettingCanvas || this.isLoadingSnapshot) {
                return;
            }
            this.tagObjectWithCurrentStep(e.path);
            this.addLayer(e.path);
            this.pushHistorySnapshot();
            this.markAsModified();
            await this.immediateSave();
        });

        this.canvas.on('object:added', async (e) => {
            if (this.isResettingCanvas || this.isLoadingSnapshot) {
                return;
            }
            if (e.target) {
                this.tagObjectWithCurrentStep(e.target);
            }
            if (this.isDrawing) {
                console.log('正在绘制中，跳过object:added保存');
                return;
            }
            if (e.target && !e.target.layerId) {
                this.addLayer(e.target);
                this.pushHistorySnapshot();
                await this.immediateSave();
            }
        });

        this.canvas.on('object:removed', async () => {
            if (this.isResettingCanvas || this.isLoadingSnapshot) {
                return;
            }
            if (this.isDrawing) {
                console.log('正在绘制中，跳过object:removed保存');
                return;
            }
            this.pushHistorySnapshot();
            await this.immediateSave();
        });
    }

    resetCanvasInstance() {
        this.isResettingCanvas = true;
        this.lastCanvasState = null;
        if (this.canvas) {
            this.canvas.dispose();
        }
        this.createCanvasInstance();
        this.bindCanvasEvents();
        this.isResettingCanvas = false;
        // 恢复当前工具
        const activeToolId = this.currentTool ? `${this.currentTool}Tool` : 'selectTool';
        const activeBtn = document.getElementById(activeToolId);
        if (activeBtn) {
            this.selectTool(activeToolId);
        } else {
            this.selectTool('selectTool');
        }
    }

    // 初始化富文本编辑器
    initTextEditor() {
        this.textEditor = new Quill('#textEditor', {
            theme: 'snow',
            placeholder: '输入文本内容...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'header': [1, 2, 3, false] }],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'size': ['small', false, 'large', 'huge'] }],
                    [{ 'align': [] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'blockquote'],
                    ['clean']
                ]
            }
        });

        // 监听文本编辑器内容变化
        this.textEditor.on('text-change', () => {
            this.markAsModified();
        });

        // 初始化文本块管理
        this.textBlocks = [];
        this.currentTextBlock = null;
    }

    // 添加文本块到画布
    addTextBlock(x, y, content = '') {
        const textBlock = {
            id: Date.now(),
            x: x || 100,
            y: y || 100,
            width: 200,
            height: 100,
            content: content,
            fontSize: 16,
            fontFamily: 'Arial',
            color: '#000000',
            backgroundColor: 'transparent',
            textAlign: 'left'
        };

        // 创建Fabric.js文本对象
        const fabricText = new fabric.Textbox(content, {
            left: textBlock.x,
            top: textBlock.y,
            width: textBlock.width,
            fontSize: textBlock.fontSize,
            fontFamily: textBlock.fontFamily,
            fill: textBlock.color,
            backgroundColor: textBlock.backgroundColor,
            textAlign: textBlock.textAlign,
            editable: true,
            selectable: true
        });

        // 添加自定义属性
        fabricText.textBlockId = textBlock.id;
        fabricText.isTextBlock = true;

        // 添加到画布
        this.canvas.add(fabricText);
        this.textBlocks.push(textBlock);

        // 选中新创建的文本块
        this.canvas.setActiveObject(fabricText);
        this.currentTextBlock = textBlock;

        this.markAsModified();
        return textBlock;
    }

    // 编辑文本块
    editTextBlock(textBlockId) {
        const textBlock = this.textBlocks.find(block => block.id === textBlockId);
        if (!textBlock) return;

        // 在富文本编辑器中加载文本内容
        this.textEditor.setContents([]);
        this.textEditor.insertText(0, textBlock.content);

        // 显示文本编辑器
        const textEditorOverlay = document.getElementById('textEditorOverlay');
        textEditorOverlay.style.display = 'block';

        this.currentTextBlock = textBlock;
    }

    // 更新文本块内容
    updateTextBlock(textBlockId, updates) {
        const textBlock = this.textBlocks.find(block => block.id === textBlockId);
        if (!textBlock) return;

        Object.assign(textBlock, updates);

        // 更新画布上的文本对象
        const fabricObjects = this.canvas.getObjects();
        const fabricText = fabricObjects.find(obj => obj.textBlockId === textBlockId);
        
        if (fabricText) {
            if (updates.content !== undefined) fabricText.set('text', updates.content);
            if (updates.fontSize !== undefined) fabricText.set('fontSize', updates.fontSize);
            if (updates.fontFamily !== undefined) fabricText.set('fontFamily', updates.fontFamily);
            if (updates.color !== undefined) fabricText.set('fill', updates.color);
            if (updates.backgroundColor !== undefined) fabricText.set('backgroundColor', updates.backgroundColor);
            if (updates.textAlign !== undefined) fabricText.set('textAlign', updates.textAlign);
            
            this.canvas.renderAll();
        }

        this.markAsModified();
    }

    // 删除文本块
    deleteTextBlock(textBlockId) {
        const index = this.textBlocks.findIndex(block => block.id === textBlockId);
        if (index === -1) return;

        // 从数组中移除
        this.textBlocks.splice(index, 1);

        // 从画布中移除
        const fabricObjects = this.canvas.getObjects();
        const fabricText = fabricObjects.find(obj => obj.textBlockId === textBlockId);
        if (fabricText) {
            this.canvas.remove(fabricText);
        }

        this.markAsModified();
    }

    // 获取所有文本块
    getTextBlocks() {
        return this.textBlocks;
    }

    // 绑定事件监听器
    bindEvents() {
        // 工具栏按钮
        document.getElementById('backBtn').addEventListener('click', () => this.goBack());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveAndSync());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        const deleteBtn = document.getElementById('deleteSelectionBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteSelectedAnnotations());
        }

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
        document.getElementById('arrowTool').addEventListener('click', async () => {
            await this.handleArrowToolSelection();
        });
        document.getElementById('penTool').addEventListener('click', () => this.selectTool('pen'));
        document.getElementById('lineTool').addEventListener('click', () => this.selectTool('line'));
        document.getElementById('highlighterTool').addEventListener('click', () => this.selectTool('highlighter'));

        // 侧边栏标签切换
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchSidebarTab(e.target.dataset.tab));
        });

        // 侧边栏折叠
        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());

        // 内容区域折叠/展开
        const contentToggle = document.getElementById('contentToggle');
        if (contentToggle) {
            contentToggle.addEventListener('click', () => this.toggleContentSection());
        }

        // 文本编辑器确认/取消
        document.getElementById('confirmTextEdit').addEventListener('click', () => this.confirmTextEdit());
        document.getElementById('cancelTextEdit').addEventListener('click', () => this.cancelTextEdit());

        // 文本块双击编辑
        this.canvas.on('mouse:dblclick', (e) => {
            if (e.target && e.target.isTextBlock) {
                this.editTextBlock(e.target.textBlockId);
            }
        });

        
        
        // 属性面板控件
        document.getElementById('colorPicker').addEventListener('change', (e) => this.updateObjectColor(e.target.value));
        document.getElementById('strokeWidth').addEventListener('input', (e) => this.updateStrokeWidth(e.target.value));
        document.getElementById('opacity').addEventListener('input', (e) => this.updateOpacity(e.target.value));

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // 页面可见性变化与刷新时的保护性保存
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden) {
                try {
                    await this.immediateSave();
                } catch (err) {
                    console.warn('visibilitychange 保存失败', err);
                }
            }
        });
        window.addEventListener('beforeunload', async (e) => {
            try {
                await this.immediateSave();
            } catch (err) {
                console.warn('beforeunload 保存失败', err);
            }
        });
    }

    bindScreenshotEvents() {
        const addBtn = document.getElementById('addScreenshotBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddScreenshotModal());
        }

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput && fileInput.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });
            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                this.handleFileDrop(e);
            });
        }
    }

    bindMarkdownEditorEvents() {
        const editModeBtn = document.getElementById('editModeBtn');
        const previewModeBtn = document.getElementById('previewModeBtn');
        const markdownTextarea = document.getElementById('markdownTextarea');

        if (editModeBtn) {
            editModeBtn.addEventListener('click', () => this.switchMarkdownMode('edit'));
        }

        if (previewModeBtn) {
            previewModeBtn.addEventListener('click', () => this.switchMarkdownMode('preview'));
        }

        if (markdownTextarea) {
            markdownTextarea.addEventListener('input', (e) => {
                this.saveMarkdownContent(e.target.value);
            });

            markdownTextarea.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.target.selectionStart;
                    const end = e.target.selectionEnd;
                    e.target.value = `${e.target.value.substring(0, start)}    ${e.target.value.substring(end)}`;
                    e.target.selectionStart = e.target.selectionEnd = start + 4;
                    this.saveMarkdownContent(e.target.value);
                }
            });
        }
    }

    handleKeyboard(event) {
        const target = event.target;
        const isEditable = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        );
        if (isEditable) {
            return;
        }

        const key = event.key.toLowerCase();
        const ctrl = event.ctrlKey || event.metaKey;

        if (ctrl && key === 'z' && !event.shiftKey) {
            event.preventDefault();
            this.undo();
            return;
        }

        if ((ctrl && key === 'z' && event.shiftKey) || (ctrl && key === 'y')) {
            event.preventDefault();
            this.redo();
            return;
        }

        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            this.deleteSelectedAnnotations();
            return;
        }
    }

    addBackgroundImageToCanvas() {
        if (!this.canvas || !this.backgroundImage) {
            return;
        }
        const objects = this.canvas.getObjects();
        const stale = objects.filter(obj => obj.isBackgroundImage && obj !== this.backgroundImage);
        stale.forEach(obj => this.canvas.remove(obj));
        if (!objects.includes(this.backgroundImage)) {
            this.canvas.add(this.backgroundImage);
        }
        this.canvas.sendToBack(this.backgroundImage);
        this.canvas.renderAll();
        this.scrollCanvasToTop();
    }

    scrollCanvasToTop() {
        const container = document.getElementById('canvasContainer');
        if (container) {
            container.scrollTop = 0;
            container.scrollLeft = 0;
        }
    }

    rescaleCanvasObjects() {
        if (!this.canvas || !this.targetCanvasWidth || !this.targetCanvasHeight) {
            return;
        }
        const originalWidth = this.canvas.getWidth();
        const originalHeight = this.canvas.getHeight();
        if (!originalWidth || !originalHeight) {
            return;
        }
        const scaleX = this.targetCanvasWidth / originalWidth;
        const scaleY = this.targetCanvasHeight / originalHeight;
        if (scaleX === 1 && scaleY === 1) {
            return;
        }
        this.canvas.setWidth(this.targetCanvasWidth);
        this.canvas.setHeight(this.targetCanvasHeight);
        this.canvas.getObjects().forEach(obj => {
            obj.scaleX *= scaleX;
            obj.scaleY *= scaleY;
            obj.left *= scaleX;
            obj.top *= scaleY;
            if (obj.strokeWidth) {
                obj.strokeWidth *= (scaleX + scaleY) / 2;
            }
            obj.setCoords();
        });
    }

    initializeDragAndDrop() {
        const screenshotsList = document.getElementById('screenshotsList');
        if (!screenshotsList || typeof Sortable === 'undefined') {
            return;
        }

        if (this.sortableInstance) {
            this.sortableInstance.destroy();
        }

        this.sortableInstance = new Sortable(screenshotsList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: (evt) => {
                Promise.resolve(this.reorderScreenshots(evt.oldIndex, evt.newIndex))
                    .catch(err => console.error('重新排序截图失败:', err));
            }
        });
    }

    updateCanvasInfo() {
        const canvasInfo = document.getElementById('canvasInfo');
        if (canvasInfo && this.canvas) {
            canvasInfo.textContent = `画布: ${Math.round(this.canvas.getWidth())} x ${Math.round(this.canvas.getHeight())}`;
        }
    }

    updateMarkdownEditor(screenshot, index) {
        const textarea = document.getElementById('markdownTextarea');
        if (!textarea) {
            return;
        }
        if (!screenshot) {
            textarea.value = '';
            return;
        }
        if (!screenshot.markdownContent) {
            screenshot.markdownContent = this.generateDefaultMarkdown(screenshot, index);
        }
        textarea.value = screenshot.markdownContent;
    }

    getCurrentMarkdownContent() {
        const textarea = document.getElementById('markdownTextarea');
        if (textarea) {
            return textarea.value || '';
        }
        if (this.currentScreenshotIndex >= 0 && this.currentScreenshotIndex < this.screenshots.length) {
            return this.screenshots[this.currentScreenshotIndex].markdownContent || '';
        }
        return '';
    }

    switchMarkdownMode(mode = 'edit') {
        const normalized = mode === 'preview' ? 'preview' : 'edit';
        const editBtn = document.getElementById('editModeBtn');
        const previewBtn = document.getElementById('previewModeBtn');
        const editor = document.getElementById('markdownEditor');
        const preview = document.getElementById('markdownPreview');
        const content = document.getElementById('markdownContent');

        if (!editBtn || !previewBtn || !editor || !preview || !content) {
            return;
        }

        editBtn.classList.toggle('active', normalized === 'edit');
        previewBtn.classList.toggle('active', normalized === 'preview');

        if (normalized === 'edit') {
            editor.style.display = 'block';
            preview.style.display = 'none';
            return;
        }

        const markdownText = this.getCurrentMarkdownContent() || '';
        if (window.marked && typeof window.marked.parse === 'function') {
            content.innerHTML = window.marked.parse(markdownText);
        } else {
            content.innerHTML = markdownText.replace(/\n/g, '<br>');
        }
        preview.style.display = 'block';
        editor.style.display = 'none';
    }

    generateDefaultMarkdown(screenshot, index = 0) {
        const stepNumber = index + 1;
        const lines = [
            `## 步骤 ${stepNumber}`,
            '',
            screenshot.text || '请在此描述该步骤的操作。'
        ];
        if (screenshot.url) {
            lines.push('', `**页面**: ${screenshot.url}`);
        }
        return lines.join('\n');
    }

    getCanvasStateSnapshot() {
        if (!this.canvas) {
            return null;
        }
        return this.canvas.toJSON([
            'src',
            'crossOrigin',
            'selectable',
            'evented',
            'layerId',
            '__stepId',
            'name',
            'id',
            'strokeUniform',
            'pathOffset',
            'rx',
            'ry',
            'points',
            'data',
            'isBackgroundImage'
        ]);
    }

    storeCurrentCanvasStateForHistory() {
        try {
            this.lastCanvasState = this.getCanvasStateSnapshot();
        } catch (error) {
            console.warn('记录画布基线失败:', error);
        }
    }

    pushHistorySnapshot(clearRedo = true) {
        if (!this.canvas || this.isLoadingSnapshot || this.isResettingCanvas) {
            return;
        }
        try {
            if (this.lastCanvasState) {
                const previousState = JSON.parse(JSON.stringify(this.lastCanvasState));
                this.historyStack.push(previousState);
                if (this.historyStack.length > 50) {
                    this.historyStack.shift();
                }
                if (clearRedo) {
                    this.redoStack = [];
                }
            }
            this.lastCanvasState = this.getCanvasStateSnapshot();
        } catch (error) {
            console.warn('记录历史快照失败:', error);
        }
    }

    restoreFromSnapshot(snapshot, targetStack) {
        if (!snapshot || !this.canvas) {
            return;
        }
        const currentState = this.getCanvasStateSnapshot();
        if (targetStack && currentState) {
            targetStack.push(JSON.parse(JSON.stringify(currentState)));
        }
        this.isLoadingSnapshot = true;
        let payload;
        if (typeof snapshot === 'string') {
            try {
                payload = JSON.parse(snapshot);
            } catch (err) {
                console.warn('解析历史快照失败:', err);
                this.isLoadingSnapshot = false;
                return;
            }
        } else {
            payload = JSON.parse(JSON.stringify(snapshot));
        }
        this.normalizeFabricCanvasData(payload);
        this.canvas.loadFromJSON(payload, () => {
            this.canvas.renderAll();
            this.isLoadingSnapshot = false;
            this.saveCurrentEditState();
            this.storeCurrentCanvasStateForHistory();
        });
    }

    undo() {
        if (this.historyStack.length === 0) {
            console.log('没有可撤销的操作');
            return;
        }
        const snapshot = this.historyStack.pop();
        const currentState = this.getCanvasStateSnapshot();
        if (currentState) {
            this.redoStack.push(JSON.parse(JSON.stringify(currentState)));
        }
        this.restoreFromSnapshot(snapshot);
    }

    redo() {
        if (this.redoStack.length === 0) {
            console.log('没有可重做的操作');
            return;
        }
        const snapshot = this.redoStack.pop();
        const currentState = this.getCanvasStateSnapshot();
        if (currentState) {
            this.historyStack.push(JSON.parse(JSON.stringify(currentState)));
        }
        this.restoreFromSnapshot(snapshot);
    }

    // 加载截图到侧边栏
    loadScreenshots() {
        const screenshotsList = document.getElementById('screenshotsList');
        screenshotsList.innerHTML = '';

        this.screenshots.forEach((screenshot, index) => {
            const item = this.createScreenshotItem(screenshot, index);
            screenshotsList.appendChild(item);
        });

        // 初始化拖拽排序
        this.initializeDragAndDrop();

        // 选择当前截图（从popup传递的索引）
        if (this.screenshots.length > 0) {
            this.selectScreenshot(this.currentScreenshotIndex);
        }
    }

    // 创建截图项目元素
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

        const meta = document.createElement('div');
        meta.className = 'screenshot-meta';
        meta.textContent = this.formatTimestamp(screenshot.timestamp);

        info.appendChild(title);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'screenshot-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'screenshot-action delete';
        deleteBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
            </svg>
        `;
        deleteBtn.title = '删除截图';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteScreenshot(index);
        });

        actions.appendChild(deleteBtn);

        item.appendChild(thumbnail);
        item.appendChild(info);
        item.appendChild(actions);

        // 点击选择截图
        item.addEventListener('click', () => this.selectScreenshot(index));

        return item;
    }

    // 选择截图
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
        // 持久化当前索引，防止被重置为步骤1
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ editorCurrentIndex: index });
            } else {
                localStorage.setItem('editorCurrentIndex', String(index));
            }
        } catch (e) {
            console.warn('持久化当前索引失败:', e);
        }
        const screenshot = this.screenshots[index];
        const screenshotStepId = this.ensureScreenshotId(screenshot, index);

        // 选择截图会触发编辑器重置，默认为选择工具
        this.selectTool('select');

        // 加载截图到画布
        this.loadScreenshotToCanvas(screenshot, screenshotStepId);
        this.historyStack = [];
        this.redoStack = [];

        // 更新右侧文字内容显示
        this.updateContentDisplay(screenshot, index);

        // 更新项目标题
        document.getElementById('projectTitle').textContent = `编辑步骤 ${screenshot.step || index + 1}`;
    }

    // 更新右侧内容显示
    updateContentDisplay(screenshot, index) {
        const stepNumber = index + 1;
        
        // 更新步骤标题
        const stepTitle = document.getElementById('stepTitle');
        if (stepTitle) {
            stepTitle.textContent = `步骤 ${stepNumber}`;
        }
        
        // 更新步骤描述
        const stepDescription = document.getElementById('stepDescription');
        if (stepDescription) {
            let description = '';
            
            // 根据操作数据生成描述
            if (screenshot.action && screenshot.element) {
                const elementText = screenshot.text ? ` "${screenshot.text}"` : '';
                description = `${screenshot.action}${elementText}`;
            } else if (screenshot.text) {
                description = screenshot.text;
            } else {
                description = '暂无描述信息';
            }
            
            stepDescription.innerHTML = `<p>${description}</p>`;
        }
        
        // 更新元数据
        const stepUrl = document.getElementById('stepUrl');
        if (stepUrl) {
            stepUrl.textContent = screenshot.url || '-';
        }
        
        const stepTime = document.getElementById('stepTime');
        if (stepTime) {
            stepTime.textContent = screenshot.timestamp ? 
                this.formatTimestamp(screenshot.timestamp) : '-';
        }
        
        const stepAction = document.getElementById('stepAction');
        if (stepAction) {
            let actionText = '-';
            if (screenshot.action) {
                actionText = screenshot.action;
                if (screenshot.element) {
                    actionText += ` (${screenshot.element})`;
                }
            }
            stepAction.textContent = actionText;
        }

        // 更新 Markdown 编辑器内容
        this.updateMarkdownEditor(screenshot, index);
    }

    // 加载截图到画布
    loadScreenshotToCanvas(screenshot, stepId) {
        if (!screenshot) {
            console.warn('loadScreenshotToCanvas: 未传入有效的截图数据');
            this.isLoadingSnapshot = false;
            return;
        }
        
        const currentStepId = stepId || this.ensureScreenshotId(screenshot);
        this.currentCanvasStepId = currentStepId;

        // 切换步骤时标记正在加载，避免过程中触发保存
        this.isLoadingSnapshot = true;
        this.lastCanvasState = null;

        // 如果该截图还没有 editData，但在内存缓存里有，就补回
        if (!screenshot.editData && this.canvasStates[currentStepId]) {
            screenshot.editData = this.canvasStates[currentStepId];
        }

        // 标记当前加载任务，避免旧截图异步回调覆盖新截图
        this.activeCanvasLoadToken = Symbol('canvasLoad');
        const loadToken = this.activeCanvasLoadToken;
        const finishLoading = () => {
            if (this.activeCanvasLoadToken === loadToken) {
                this.isLoadingSnapshot = false;
                this.storeCurrentCanvasStateForHistory();
            }
        };

        this.canvas.clear();
        this.backgroundImage = null;
        this.backgroundImageSource = null;
        if (this.canvas) {
            this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        }
        this.canvas.renderAll();
        // 切换截图时默认清空文本块，避免沿用上一张的标注
        this.textBlocks = [];

        // 加载背景图片（只显示截图，不显示其他内容）
        fabric.Image.fromURL(screenshot.screenshot, (img) => {
            if (this.activeCanvasLoadToken !== loadToken) {
                finishLoading();
                return;
            }
            // 调整画布大小以适应图片
            const container = document.getElementById('canvasContainer');
            const containerWidth = container ? Math.max(320, container.clientWidth - 40) : 1200;
            const scale = Math.min(containerWidth / img.width, 1);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;

            this.canvas.setWidth(scaledWidth);
            this.canvas.setHeight(scaledHeight);
            this.targetCanvasWidth = scaledWidth;
            this.targetCanvasHeight = scaledHeight;

            img.scale(scale);
            img.set({
                left: 0,
                top: 0,
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                objectCaching: false,
                src: screenshot.screenshot,
                crossOrigin: 'anonymous',
                isBackgroundImage: true
            });

            this.originalImageWidth = img.width;
            this.originalImageHeight = img.height;
            this.currentScale = scale;
            this.backgroundImage = img;
            this.backgroundImageSource = screenshot.screenshot;

            // 延迟加载编辑数据，确保背景图片已完全加载
            if (screenshot.editData) {
                setTimeout(() => {
                    if (this.activeCanvasLoadToken !== loadToken) return;
                    this.loadEditData(screenshot.editData, screenshot, loadToken, currentStepId, finishLoading);
                }, 100);
            } else {
                // 没有编辑数据时确保状态被清空
                this.textBlocks = [];
                this.removeForeignObjects(currentStepId);
                this.addBackgroundImageToCanvas();
                finishLoading();
            }

            this.updateCanvasInfo();
        });
    }

    // 加载编辑数据
    loadEditData(editData, screenshot, loadToken, stepId, onComplete = () => {}) {
        if (editData) {
            console.log('正在加载编辑数据...', {
                savedCanvasWidth: editData.canvasWidth,
                savedCanvasHeight: editData.canvasHeight,
                currentCanvasWidth: this.canvas.width,
                currentCanvasHeight: this.canvas.height,
                scale: editData.scale
            });

            // 检查序列化的数据
            if (editData.canvas) {
                console.log('序列化数据检查:', {
                    hasObjects: !!editData.canvas.objects,
                    objectCount: editData.canvas.objects ? editData.canvas.objects.length : 0,
                    serializedObjects: editData.canvas.objects ? editData.canvas.objects.map((obj, i) => ({
                        index: i,
                        type: obj.type,
                        left: obj.left,
                        top: obj.top,
                        radius: obj.radius,
                        visible: obj.visible
                    })) : []
                });
            }

            // 不要清空画布，直接加载编辑内容
            // 加载画布数据
            if (editData.canvas) {
                if (loadToken && this.activeCanvasLoadToken !== loadToken) {
                    return;
                }
                // 克隆数据，避免 loadFromJSON 过程中修改原始引用
                const canvasPayload = JSON.parse(JSON.stringify(editData.canvas));
                this.normalizeFabricCanvasData(canvasPayload);
                this.canvas.loadFromJSON(canvasPayload, () => {
                    if (loadToken && this.activeCanvasLoadToken !== loadToken) {
                        return;
                    }
                    // 移除旧数据里序列化进来的截图背景，避免覆盖当前截图
                    const screenshotSrc = screenshot ? screenshot.screenshot : null;
                    if (screenshotSrc) {
                        const legacyBackgrounds = this.canvas.getObjects().filter(obj =>
                            obj.type === 'image' &&
                            obj.src === screenshotSrc
                        );
                        legacyBackgrounds.forEach(obj => this.canvas.remove(obj));
                    }

                    this.rescaleCanvasObjects();
                    this.canvas.renderAll();
                    this.canvas.getObjects().forEach(obj => this.markObjectStep(obj, stepId));
                    this.removeForeignObjects(stepId);
                    console.log('编辑数据加载完成，对象数量:', this.canvas.getObjects().length);

                    // 调试：输出所有对象的信息
                    this.canvas.getObjects().forEach((obj, index) => {
                        const objInfo = {
                            type: obj.type,
                            left: obj.left,
                            top: obj.top,
                            width: obj.width,
                            height: obj.height,
                            radius: obj.radius,
                            scaleX: obj.scaleX,
                            scaleY: obj.scaleY,
                            stroke: obj.stroke,
                            strokeWidth: obj.strokeWidth,
                            fill: obj.fill,
                            opacity: obj.opacity,
                            visible: obj.visible
                        };

                        // 对于组对象，添加额外信息
                        if (obj.type === 'group') {
                            objInfo.objectCount = obj.objects ? obj.objects.length : 0;
                            objInfo.angle = obj.angle;
                            objInfo.groupLeft = obj.left;
                            objInfo.groupTop = obj.top;
                            if (obj.objects) {
                                objInfo.innerObjects = obj.objects.map(innerObj => ({
                                    type: innerObj.type,
                                    left: innerObj.left,
                                    top: innerObj.top
                                }));
                            }
                        }

                        // 对于圆形，添加中心点信息
                        if (obj.type === 'circle') {
                            objInfo.centerX = obj.left;
                            objInfo.centerY = obj.top;
                            objInfo.radius = obj.radius;
                        }

                        console.log(`对象 ${index + 1} (${obj.type}):`, objInfo);
                    });

                    // 验证加载后的对象
                    const hasNonImageObjects = this.canvas.getObjects().some(obj => obj.type !== 'image');
                    console.log('加载验证:', {
                        totalObjects: this.canvas.getObjects().length,
                        hasAnnotations: hasNonImageObjects,
                        annotationTypes: this.canvas.getObjects().filter(obj => obj.type !== 'image').map(obj => obj.type)
                    });
                    this.addBackgroundImageToCanvas();
                    onComplete();
                });
            } else {
                this.textBlocks = [];
                this.removeForeignObjects(stepId);
                this.addBackgroundImageToCanvas();
                onComplete();
            }

            // 加载文本块数据
            if (editData.textBlocks) {
                this.textBlocks = editData.textBlocks;
                console.log('文本块数据已加载，数量:', this.textBlocks.length);
            } else {
                this.textBlocks = [];
            }
        } else {
            console.log('没有编辑数据需要加载');
            this.textBlocks = [];
            this.removeForeignObjects(stepId);
            onComplete();
        }
    }

    normalizeFabricCanvasData(canvasData) {
        if (!canvasData || typeof canvasData !== 'object') {
            return canvasData;
        }
        const validBaselines = new Set(['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom']);
        const normalizeBaseline = (value) => {
            if (typeof value !== 'string') {
                return null;
            }
            const lower = value.toLowerCase();
            return validBaselines.has(lower) ? lower : 'alphabetic';
        };
        const processObject = (obj) => {
            if (!obj || typeof obj !== 'object') {
                return;
            }
            if (typeof obj.textBaseline === 'string') {
                obj.textBaseline = normalizeBaseline(obj.textBaseline);
            }
            if (obj.styles && typeof obj.styles === 'object') {
                Object.values(obj.styles).forEach(lineStyles => {
                    if (lineStyles && typeof lineStyles === 'object') {
                        Object.values(lineStyles).forEach(style => {
                            if (style && typeof style.textBaseline === 'string') {
                                style.textBaseline = normalizeBaseline(style.textBaseline);
                            }
                        });
                    }
                });
            }
            if (Array.isArray(obj.objects)) {
                obj.objects.forEach(processObject);
            }
            if (obj.clipPath) {
                processObject(obj.clipPath);
            }
        };
        if (Array.isArray(canvasData.objects)) {
            canvasData.objects.forEach(processObject);
        }
        if (canvasData.backgroundImage) {
            processObject(canvasData.backgroundImage);
        }
        return canvasData;
    }

    async handleArrowToolSelection() {
        try {
            if (typeof this.currentScreenshotIndex === 'number' && this.currentScreenshotIndex >= 0) {
                await this.selectScreenshot(this.currentScreenshotIndex);
            }
        } catch (error) {
            console.warn('重新加载当前步骤以激活箭头工具失败:', error);
        } finally {
            this.selectTool('arrow');
        }
    }

    // 工具选择
    selectTool(toolId) {
        const normalizedToolId = toolId && !toolId.endsWith('Tool') ? `${toolId}Tool` : (toolId || 'selectTool');
        // 清除之前的工具状态
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;

        // 移除所有工具状态类
        const canvasContainer = document.querySelector('.canvas-container');
        canvasContainer.classList.remove('drawing-rectangle', 'drawing-circle', 'drawing-arrow', 'drawing-line', 'drawing-pen', 'drawing-highlighter', 'selecting', 'text-mode');

        // 更新工具按钮状态
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.id === normalizedToolId);
        });

        const derivedTool = normalizedToolId.replace('Tool', '');
        this.currentTool = derivedTool;

        // 设置画布模式和光标
        switch (this.currentTool) {
            case 'select':
                this.canvas.isDrawingMode = false;
                this.canvas.selection = true;
                canvasContainer.classList.add('selecting');
                break;
            case 'text':
                this.canvas.isDrawingMode = false;
                this.canvas.selection = false;
                canvasContainer.classList.add('text-mode');
                break;
            case 'pen':
                this.canvas.isDrawingMode = true;
                this.canvas.selection = false;
                canvasContainer.classList.add('drawing-pen');
                this.canvas.freeDrawingBrush.width = parseInt(document.getElementById('strokeWidth').value);
                this.canvas.freeDrawingBrush.color = document.getElementById('colorPicker').value;
                this.canvas.freeDrawingBrush.onMouseUp = () => {
                    this.pushHistorySnapshot();
                    this.immediateSave();
                };
                break;
            case 'highlighter':
                this.canvas.isDrawingMode = true;
                this.canvas.selection = false;
                canvasContainer.classList.add('drawing-highlighter');
                this.canvas.freeDrawingBrush.width = parseInt(document.getElementById('strokeWidth').value);
                this.canvas.freeDrawingBrush.color = document.getElementById('colorPicker').value;
                // 设置高亮笔的透明度
                this.canvas.freeDrawingBrush.color = this.hexToRgba(document.getElementById('colorPicker').value, 0.3);
                this.canvas.freeDrawingBrush.onMouseUp = () => {
                    this.pushHistorySnapshot();
                    this.immediateSave();
                };
                break;
            case 'rectangle':
                this.canvas.isDrawingMode = false;
                this.canvas.selection = false;
                canvasContainer.classList.add('drawing-rectangle');
                break;
            case 'circle':
                this.canvas.isDrawingMode = false;
                this.canvas.selection = false;
                canvasContainer.classList.add('drawing-circle');
                break;
            case 'arrow':
                this.canvas.isDrawingMode = false;
                this.canvas.selection = true;
                canvasContainer.classList.add('drawing-arrow');
                break;
            case 'line':
                this.canvas.isDrawingMode = false;
                this.canvas.selection = false;
                canvasContainer.classList.add('drawing-line');
                break;
            default:
                this.canvas.isDrawingMode = false;
                this.canvas.selection = false;
        }
    }

    // 颜色转换工具函数
    hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // 画布鼠标事件处理
    onCanvasMouseDown(e) {
        const target = e ? e.target : null;
        if (this.currentTool === 'text' && !target) {
            this.startTextEdit(e.pointer);
            return;
        }

        if (this.currentTool === 'arrow') {
            if (target && !target.isBackgroundImage) {
                target.selectable = true;
                target.evented = true;
                this.canvas.setActiveObject(target);
                this.canvas.requestRenderAll();
                this.updatePropertiesPanel(target);
            } else if (!target) {
                this.startDrawing(e.pointer);
            }
            return;
        }

        if (['rectangle', 'circle'].includes(this.currentTool)) {
            this.startDrawing(e.pointer);
        }
    }

    onCanvasMouseMove(e) {
        if (this.isDrawing) {
            // 添加调试信息
            if (this.currentTool === 'arrow') {
                // 获取更详细的鼠标坐标信息
                const pointer = this.canvas.getPointer(e.e);
                console.log('鼠标移动 - 详细信息:', {
                    original: e.pointer,
                    getPointer: { x: pointer.x, y: pointer.y },
                    absolutePoint: e.absolutePointer ? { x: e.absolutePointer.x, y: e.absolutePointer.y } : 'undefined',
                    scenePoint: e.scenePoint ? { x: e.scenePoint.x, y: e.scenePoint.y } : 'undefined'
                });
                this.updateDrawing(pointer);
            } else {
                this.updateDrawing(e.pointer);
            }
        }
    }

    onCanvasMouseUp(e) {
        if (this.isDrawing) {
            this.finishDrawing();
        }
    }

    // 开始文本编辑
    startTextEdit(pointer) {
        // 如果点击的是文本工具，在点击位置添加文本块
        if (this.currentTool === 'text') {
            this.addTextBlock(pointer.x, pointer.y, '点击编辑文本');
        }
    }

    // 确认文本编辑
    confirmTextEdit() {
        if (this.currentTextBlock && this.textEditor) {
            const content = this.textEditor.getText().trim();
            
            // 更新文本块内容
            this.updateTextBlock(this.currentTextBlock.id, { content });
            
            // 隐藏文本编辑器
            const textEditorOverlay = document.getElementById('textEditorOverlay');
            textEditorOverlay.style.display = 'none';
            
            this.currentTextBlock = null;
            this.markAsModified();
        }
    }

    // 取消文本编辑
    cancelTextEdit() {
        // 隐藏文本编辑器
        const textEditorOverlay = document.getElementById('textEditorOverlay');
        textEditorOverlay.style.display = 'none';
        
        this.currentTextBlock = null;
    }

    // 开始绘制形状
    startDrawing(pointer) {
        this.isDrawing = true;
        this.startPoint = pointer;

        // 禁用自动保存，避免干扰绘制
        this.autoSaveEnabled = false;

        console.log('开始绘制:', {
            tool: this.currentTool,
            startPoint: this.startPoint,
            autoSaveDisabled: true
        });

        let shape;
        const color = document.getElementById('colorPicker').value;
        const strokeWidth = parseInt(document.getElementById('strokeWidth').value);

        switch (this.currentTool) {
            case 'rectangle':
                shape = new fabric.Rect({
                    left: pointer.x,
                    top: pointer.y,
                    width: 0,
                    height: 0,
                    fill: 'transparent',
                    stroke: color,
                    strokeWidth: strokeWidth
                });
                break;
            case 'circle':
                shape = new fabric.Circle({
                    left: pointer.x,
                    top: pointer.y,
                    radius: 0,
                    fill: 'transparent',
                    stroke: color,
                    strokeWidth: strokeWidth,
                    originX: 'center',
                    originY: 'center'
                });
                break;
            case 'arrow':
                console.log('创建初始箭头:', pointer);
                shape = this.createArrow(pointer.x, pointer.y, pointer.x, pointer.y, color, strokeWidth);
                break;
            case 'line':
                shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                    stroke: color,
                    strokeWidth: strokeWidth,
                    selectable: true
                });
                break;
            case 'pen':
                // 自由绘制模式
                this.canvas.isDrawingMode = true;
                this.canvas.freeDrawingBrush.width = strokeWidth;
                this.canvas.freeDrawingBrush.color = color;
                return;
            case 'highlighter':
                // 高亮笔模式
                this.canvas.isDrawingMode = true;
                this.canvas.freeDrawingBrush.width = strokeWidth * 3;
                this.canvas.freeDrawingBrush.color = this.hexToRgba(color, 0.3);
                return;
        }
        
        if (shape) {
            this.currentShape = shape;
            this.canvas.add(shape);

            // 对于箭头，确保不触发选择模式
            if (this.currentTool === 'arrow') {
                this.canvas.selection = false;
                shape.selectable = false;
            }
        }
    }

    // 创建箭头
    createArrow(x1, y1, x2, y2, color, strokeWidth) {
        // 计算箭头相对于起始点的偏移
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);

        // 如果长度太短，返回一个简单的点
        if (length < 10) {
            return new fabric.Circle({
                left: x1,
                top: y1,
                radius: 2,
                fill: color,
                selectable: true,
                evented: true,
                originX: 'center',
                originY: 'center'
            });
        }

        // 箭头头部大小
        const headLength = Math.min(20, length * 0.25);
        const headWidth = headLength * 0.8;

        // 算箭头主干 - 留出一整只头长空间，与导出逻辑保持一致
        const adjustedLength = Math.max(0, length - headLength);
        
        // 创建线条，起点为(0,0)，终点为调整后的长度
        const line = new fabric.Line([0, 0, adjustedLength, 0], {
            stroke: color,
            strokeWidth: strokeWidth,
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'center'
        });

        // 创建箭头头部（使用Triangle对象）
        // 线段终点即三角形底边中心
        const arrowHead = new fabric.Triangle({
            left: adjustedLength,
            top: 0,
            width: headLength,
            height: headWidth,
            fill: color,
            selectable: false,
            evented: false,
            originX: 'center',       // 水平中心即尾部中心
            originY: 'center',       // 垂直中心
            angle: 90                // 三角形默认朝上，旋转90度让它朝右
        });

        // 计算旋转角度
        const angle = Math.atan2(dy, dx);
        const angleDegrees = angle * 180 / Math.PI;
        
        // 创建箭头组合，放置在起始点，然后旋转到正确角度
        const arrow = new fabric.Group([line, arrowHead], {
            left: x1,
            top: y1,
            selectable: true,       // 改为true，使箭头可选择
            evented: true,          // 改为true，使箭头可交互
            originX: 'left',
            originY: 'center',
            angle: angleDegrees,
            subTargetCheck: false,  // 不检查子对象，作为整体选择
            hasControls: true,      // 显示控制点
            hasBorders: true        // 显示边框
        });

        console.log('创建箭头:', {
            startPoint: {x: x1, y: y1},
            endPoint: {x: x2, y: y2},
            length: length,
            angle: angleDegrees,
            headLength: headLength,
            headWidth: headWidth,
            lineLength: adjustedLength,
            groupBounds: arrow.getBoundingRect()
        });

        return arrow;
    }

    // 颜色转换为RGBA
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // 更新绘制
    updateDrawing(pointer) {
        if (!this.currentShape) return;
        
        switch (this.currentTool) {
            case 'rectangle':
                const width = pointer.x - this.startPoint.x;
                const height = pointer.y - this.startPoint.y;
                this.currentShape.set({
                    width: Math.abs(width),
                    height: Math.abs(height),
                    left: width > 0 ? this.startPoint.x : pointer.x,
                    top: height > 0 ? this.startPoint.y : pointer.y
                });
                break;
            case 'circle':
                const radius = Math.sqrt(
                    Math.pow(pointer.x - this.startPoint.x, 2) +
                    Math.pow(pointer.y - this.startPoint.y, 2)
                ) / 2;

                // 计算圆心位置（起始点和终点的中点）
                const centerX = (this.startPoint.x + pointer.x) / 2;
                const centerY = (this.startPoint.y + pointer.y) / 2;

                this.currentShape.set({
                    radius: radius,
                    left: centerX,
                    top: centerY,
                    originX: 'center',
                    originY: 'center'
                });
                break;
            case 'arrow':
                // 简化的箭头更新逻辑 - 完全避免保存干扰
                if (this.currentShape) {
                    console.log('简化箭头更新:', {
                        from: { x: this.startPoint.x, y: this.startPoint.y },
                        to: { x: pointer.x, y: pointer.y },
                        isDrawing: this.isDrawing
                    });

                    // 直接移除旧箭头
                    this.canvas.remove(this.currentShape);

                    // 创建新箭头
                    this.currentShape = this.createArrow(
                        this.startPoint.x,
                        this.startPoint.y,
                        pointer.x,
                        pointer.y,
                        document.getElementById('colorPicker').value,
                        parseInt(document.getElementById('strokeWidth').value)
                    );

                    // 添加到画布但不触发任何事件
                    this.currentShape.selectable = false;
                    this.canvas.add(this.currentShape);

                    // 直接渲染，不触发任何保存机制
                    this.canvas.renderAll();

                    console.log('箭头更新完成');
                }
                break;
            case 'line':
                this.currentShape.set({
                    x2: pointer.x,
                    y2: pointer.y
                });
                break;
        }
        
        this.canvas.renderAll();
    }

    // 完成绘制
    finishDrawing() {
        this.isDrawing = false;

        // 重新启用选择模式和事件处理
        if (this.currentShape) {
            this.currentShape.selectable = true;
            this.currentShape.evented = true;
            console.log('箭头对象设置为可选择:', this.currentShape.type);
        }
        this.canvas.selection = true;

        // 重新启用自动保存
        this.autoSaveEnabled = true;

        // 如果是自由绘制模式，关闭绘制模式
        if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
            this.canvas.isDrawingMode = false;
        }

        console.log('完成绘制:', {
            tool: this.currentTool,
            shape: this.currentShape ? this.currentShape.type : 'none',
            autoSaveReenabled: true
        });

        this.currentShape = null;
        this.pushHistorySnapshot();
        this.markAsModified();

        // 绘制完成后触发一次保存
        setTimeout(() => {
            if (this.autoSaveEnabled) {
                this.immediateSave();
            }
        }, 100);
    }

    // 对象选中事件
    onObjectSelected(e) {
        const obj = e.selected[0];
        if (obj) {
            this.updatePropertiesPanel(obj);
            document.getElementById('selectionInfo').textContent = `已选择: ${obj.type}`;
        }
    }

    // 对象取消选中事件
    onObjectDeselected() {
        document.getElementById('selectionInfo').textContent = '未选择对象';
    }

    // 更新属性面板
    updatePropertiesPanel(obj) {
        if (obj.stroke) {
            document.getElementById('colorPicker').value = obj.stroke;
        }
        if (obj.strokeWidth) {
            document.getElementById('strokeWidth').value = obj.strokeWidth;
            document.getElementById('strokeWidthValue').textContent = obj.strokeWidth + 'px';
        }
        if (obj.opacity !== undefined) {
            document.getElementById('opacity').value = obj.opacity * 100;
            document.getElementById('opacityValue').textContent = Math.round(obj.opacity * 100) + '%';
        }
    }

    // 更新对象颜色
    updateObjectColor(color) {
        const activeObj = this.canvas.getActiveObject();
        if (activeObj) {
            if (activeObj.type === 'text') {
                activeObj.set('fill', color);
            } else {
                activeObj.set('stroke', color);
            }
            this.canvas.renderAll();
            this.pushHistorySnapshot();
        }
    }

    // 更新线条粗细
    updateStrokeWidth(width) {
        document.getElementById('strokeWidthValue').textContent = width + 'px';
        
        const activeObj = this.canvas.getActiveObject();
        if (activeObj && activeObj.strokeWidth !== undefined) {
            activeObj.set('strokeWidth', parseInt(width));
            this.canvas.renderAll();
            this.pushHistorySnapshot();
        }
    }

    // 更新透明度
    updateOpacity(opacity) {
        const opacityValue = opacity / 100;
        document.getElementById('opacityValue').textContent = opacity + '%';
        
        const activeObj = this.canvas.getActiveObject();
        if (activeObj) {
            activeObj.set('opacity', opacityValue);
            this.canvas.renderAll();
            this.pushHistorySnapshot();
        }
    }

    deleteSelectedAnnotations() {
        if (!this.canvas) {
            return;
        }
        const selectedObjects = this.canvas.getActiveObjects();
        if (!selectedObjects || selectedObjects.length === 0) {
            alert('请先选择需要删除的标注');
            return;
        }
        this.pushHistorySnapshot();
        selectedObjects.forEach(obj => this.canvas.remove(obj));
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
        this.immediateSave();
    }

    // 侧边栏标签切换
    switchSidebarTab(tabName) {
        // 更新标签状态
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // 显示对应面板
        document.querySelectorAll('.sidebar-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(tabName + 'Panel').classList.add('active');
    }

    // 切换侧边栏
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        
        const toggleBtn = document.getElementById('sidebarToggle');
        const icon = toggleBtn.querySelector('svg path');
        if (sidebar.classList.contains('collapsed')) {
            icon.setAttribute('d', 'M15 18l-6-6 6-6');
        } else {
            icon.setAttribute('d', 'M9 18l6-6-6-6');
        }
    }

    // 切换内容区域显示/隐藏
    toggleContentSection() {
        const contentSection = document.getElementById('contentSection');
        const contentBody = document.getElementById('contentBody');
        const contentToggle = document.getElementById('contentToggle');
        
        if (contentSection && contentBody && contentToggle) {
            const isCollapsed = contentBody.style.display === 'none';
            
            if (isCollapsed) {
                // 展开
                contentBody.style.display = 'block';
                contentToggle.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 15l-6-6-6 6"/>
                    </svg>
                `;
                contentSection.style.width = '350px';
            } else {
                // 折叠
                contentBody.style.display = 'none';
                contentToggle.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                `;
                contentSection.style.width = '60px';
            }
        }
    }

    // 删除截图
    async deleteScreenshot(index) {
        if (this.screenshots.length <= 1) {
            this.showError('至少需要保留一个截图');
            return;
        }

        if (confirm('确定要删除这个截图吗？')) {
            this.screenshots.splice(index, 1);
            
            // 重新加载截图列表
            this.loadScreenshots();
            
            // 调整当前选中的截图索引
            if (this.currentScreenshotIndex >= this.screenshots.length) {
                this.currentScreenshotIndex = this.screenshots.length - 1;
            }
            
            this.selectScreenshot(this.currentScreenshotIndex);
            this.markAsModified();

            try {
                await this.syncEditedDataToMainStorage();
            } catch (error) {
                console.error('删除截图后同步数据失败:', error);
                this.showError('同步最新步骤列表失败，请稍后再试');
            }
        }
    }

    // 添加新截图
    addScreenshot() {
        const modal = document.getElementById('addScreenshotModal');
        modal.style.display = 'block';
    }

    // 处理截图上传
    handleScreenshotUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showError('请选择图片文件');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const newScreenshot = {
                screenshot: e.target.result,
                url: document.getElementById('screenshotUrl').value || 'New Screenshot',
                clickContent: document.getElementById('screenshotDescription').value || '',
                timestamp: Date.now(),
                step: this.screenshots.length + 1,
                editData: null,
                isNew: true
            };

            this.screenshots.push(newScreenshot);
            this.loadScreenshots();
            this.selectScreenshot(this.screenshots.length - 1);
            this.markAsModified();

            // 关闭模态框并重置表单
            this.closeModal('addScreenshotModal');
            document.getElementById('addScreenshotForm').reset();
        };

        reader.readAsDataURL(file);
    }

    // 标记为已修改
    markAsModified() {
        this.isModified = true;
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = false;
        }
        
        // 更新状态栏
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = '已修改 - 未保存';
        }
    }

    saveCurrentEditState() {
        if (this.isLoadingSnapshot) {
            console.log('画布正在加载，跳过保存状态');
            return;
        }
        if (!this.canvas || this.currentScreenshotIndex < 0 || this.currentScreenshotIndex >= this.screenshots.length) {
            return;
        }
        const screenshot = this.screenshots[this.currentScreenshotIndex];
        if (!screenshot) {
            return;
        }

        const allObjects = this.canvas.getObjects() || [];
        const annotationObjects = allObjects.filter(obj => !obj.isBackgroundImage);
        const serializedAnnotations = annotationObjects.map(obj =>
            JSON.parse(JSON.stringify(obj.toObject([
                'src',
                'crossOrigin',
                'selectable',
                'evented',
                'layerId',
                '__stepId',
                'name',
                'id',
                'strokeUniform',
                'pathOffset',
                'rx',
                'ry',
                'points',
                'data'
            ])))
        );

        const canvasData = {
            version: (typeof fabric !== 'undefined' && fabric.version) ? fabric.version : '5.0.0',
            objects: serializedAnnotations
        };

        const stepId = this.ensureScreenshotId(screenshot, this.currentScreenshotIndex);
        const editSnapshot = {
            canvas: canvasData,
            textBlocks: this.textBlocks || [],
            lastModified: Date.now(),
            canvasWidth: this.canvas.getWidth(),
            canvasHeight: this.canvas.getHeight(),
            originalImageWidth: this.originalImageWidth,
            originalImageHeight: this.originalImageHeight,
            scale: this.currentScale,
            objectCount: serializedAnnotations.length
        };
        screenshot.editData = editSnapshot;
        this.canvasStates[stepId] = editSnapshot;

        screenshot.markdownContent = this.getCurrentMarkdownContent();

        console.log('保存编辑状态:', {
            stepId,
            totalObjects: allObjects.length,
            annotations: serializedAnnotations.length
        });
    }

    // 重新排序截图
    async reorderScreenshots(oldIndex, newIndex) {
        if (
            typeof oldIndex !== 'number' ||
            typeof newIndex !== 'number' ||
            oldIndex === newIndex ||
            oldIndex < 0 ||
            newIndex < 0 ||
            oldIndex >= this.screenshots.length ||
            newIndex >= this.screenshots.length
        ) {
            return;
        }

        // 确保当前步骤的编辑内容已保存
        this.saveCurrentEditState();

        const moved = this.screenshots.splice(oldIndex, 1)[0];
        this.screenshots.splice(newIndex, 0, moved);

        // 调整当前索引
        if (this.currentScreenshotIndex === oldIndex) {
            this.currentScreenshotIndex = newIndex;
        } else if (oldIndex < this.currentScreenshotIndex && newIndex >= this.currentScreenshotIndex) {
            this.currentScreenshotIndex = Math.max(0, this.currentScreenshotIndex - 1);
        } else if (oldIndex > this.currentScreenshotIndex && newIndex <= this.currentScreenshotIndex) {
            this.currentScreenshotIndex = Math.min(this.screenshots.length - 1, this.currentScreenshotIndex + 1);
        }

        this.loadScreenshots();

        try {
            await this.syncEditedDataToMainStorage();
        } catch (error) {
            console.error('同步排序结果失败:', error);
            this.showError('保存最新顺序失败，请稍后重试');
        }
    }

    // 显示添加截图模态框
    showAddScreenshotModal() {
        this.showModal('addScreenshotModal');
    }

    // 显示保存版本模态框
    
    // 显示模态框
    showModal(modalId) {
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById(modalId).style.display = 'block';
    }

    // 关闭模态框
    closeModal(modalId) {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById(modalId).style.display = 'none';
    }

    // 文件上传处理
    handleFileUpload(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    // 文件拖拽处理
    handleFileDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    // 处理文件
    processFiles(files) {
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.addScreenshotFromDataURL(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
        
        this.closeModal('addScreenshotModal');
    }

    // 从DataURL添加截图
    addScreenshotFromDataURL(dataURL) {
        const newScreenshot = {
            screenshot: dataURL,
            timestamp: Date.now(),
            step: this.screenshots.length + 1,
            editData: null
        };
        
        this.screenshots.push(newScreenshot);
        this.loadScreenshots();
        this.selectScreenshot(this.screenshots.length - 1);
    }

    // 保存版本
    async saveVersion() {
        const versionName = document.getElementById('versionName').value.trim();
        const versionDescription = document.getElementById('versionDescription').value.trim();

        if (!versionName) {
            this.showError('请输入版本名称');
            return;
        }

        try {
            // 保存当前编辑状态并同步
            this.saveCurrentEditState();
            await this.syncEditedDataToMainStorage();

            const currentScreenshot = this.screenshots[this.currentScreenshotIndex];
            if (!currentScreenshot) {
                this.showError('没有可保存的截图');
                return;
            }

            const versionId = `version_${Date.now()}`;
            const versionData = {
                id: versionId,
                name: versionName,
                description: versionDescription,
                timestamp: Date.now(),
                screenshot: currentScreenshot.screenshot,
                editData: currentScreenshot.editData,
                url: currentScreenshot.url,
                title: currentScreenshot.title
            };

            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['editedVersions']);
                const versions = result.editedVersions || [];
                versions.unshift({ id: versionId, name: versionName, timestamp: versionData.timestamp });
                await chrome.storage.local.set({
                    editedVersions: versions,
                    [`edited_${versionId}`]: versionData
                });
            } else if (!this.localStorageLimited) {
                const existing = localStorage.getItem('editedVersions');
                const versions = existing ? JSON.parse(existing) : [];
                versions.unshift({ id: versionId, name: versionName, timestamp: versionData.timestamp });
                localStorage.setItem('editedVersions', JSON.stringify(versions));
                localStorage.setItem(`edited_${versionId}`, JSON.stringify(versionData));
            } else {
                this.showMessage('浏览器缓存空间不足，无法在本地保存历史版本。', 'error');
            }

            this.showSuccess('版本保存成功！');
            this.closeModal('saveVersionModal');
            document.getElementById('versionName').value = '';
            document.getElementById('versionDescription').value = '';
        } catch (error) {
            console.error('保存版本失败:', error);
            this.showError('保存版本失败: ' + error.message);
        }
    }

    mergeOperationsData(existingOps, updatedOps) {
        if (!Array.isArray(updatedOps) || updatedOps.length === 0) {
            return existingOps || [];
        }
        if (!Array.isArray(existingOps) || existingOps.length === 0) {
            return updatedOps;
        }

        const existingMap = new Map();
        existingOps.forEach((op, idx) => {
            const key = this.getOperationKey(op, idx);
            existingMap.set(key, op);
        });

        const merged = updatedOps.map((updatedOp, idx) => {
            const key = this.getOperationKey(updatedOp, idx);
            if (existingMap.has(key)) {
                const originalOp = existingMap.get(key);
                existingMap.delete(key);
                return { ...originalOp, ...updatedOp };
            }
            return updatedOp;
        });

        // updatedOps 是最新权威数据，未匹配的旧数据视为已删除，因此不再附加
        return merged;
    }

    async syncEditedDataToMainStorage() {
        try {
            const operationsSnapshot = JSON.parse(JSON.stringify(this.screenshots || []));
            const editorSnapshot = {
                operations: operationsSnapshot,
                currentIndex: this.currentScreenshotIndex
            };

            // localStorage/sessionStorage 仅作为轻量恢复缓存：剥离 base64 截图与 editData，
            // 避免 20+ 张截图时触发 QuotaExceededError。完整数据以 chrome.storage.local 为准。
            this.writeLightweightRecoveryCache(editorSnapshot, operationsSnapshot);

            if (typeof chrome !== 'undefined' && chrome.storage) {
                const stored = await chrome.storage.local.get(['operations']);
                const existingOps = stored.operations ? JSON.parse(JSON.stringify(stored.operations)) : [];
                const mergedOps = this.mergeOperationsData(existingOps, operationsSnapshot);
                await chrome.storage.local.set({
                    operations: mergedOps,
                    hasEditedContent: true,
                    lastEditTime: Date.now()
                });
            }

            this.projectData = operationsSnapshot;
            console.log('编辑后的数据已同步到主存储');
        } catch (error) {
            console.error('同步数据到主存储失败:', error);
        }
    }

    buildLightweightOperations(operationsSnapshot) {
        return operationsSnapshot.map(op => {
            const { screenshot, editData, ...rest } = op || {};
            const trimmed = { ...rest, hasScreenshot: !!screenshot };
            if (editData) {
                trimmed.editDataMeta = {
                    canvasWidth: editData.canvasWidth,
                    canvasHeight: editData.canvasHeight,
                    scale: editData.scale,
                    lastModified: editData.lastModified
                };
            }
            return trimmed;
        });
    }

    writeLightweightRecoveryCache(editorSnapshot, operationsSnapshot) {
        try {
            const lightweightOps = this.buildLightweightOperations(operationsSnapshot);
            const lightweightSnapshot = {
                ...editorSnapshot,
                operations: lightweightOps
            };
            const serialized = JSON.stringify(lightweightSnapshot);
            localStorage.setItem('editorDataLight', serialized);
            localStorage.setItem('operationsLight', JSON.stringify(lightweightOps));
            localStorage.setItem('hasEditedContent', 'true');
            localStorage.setItem('lastEditTime', Date.now().toString());
            try {
                sessionStorage.setItem('editorDataLight', serialized);
            } catch (sessionErr) {
                // sessionStorage 失败不致命，忽略
            }
        } catch (err) {
            if (this.isQuotaExceededError(err)) {
                try {
                    localStorage.removeItem('editorDataLight');
                    localStorage.removeItem('operationsLight');
                    localStorage.removeItem('editorData');
                    localStorage.removeItem('operations');
                } catch (_) {}
            } else {
                console.warn('写入轻量恢复缓存失败:', err);
            }
        }
    }

    isQuotaExceededError(error) {
        if (!error) {
            return false;
        }
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            return true;
        }
        if (typeof error.code === 'number' && (error.code === 22 || error.code === 1014)) {
            return true;
        }
        return typeof error.message === 'string' && error.message.includes('QuotaExceededError');
    }

    activateLightweightMode(showPrompt = true) {
        if (this.localStorageLimited) {
            return;
        }
        this.localStorageLimited = true;
        try {
            localStorage.setItem('editorDataTrimmed', 'true');
        } catch (err) {
            console.warn('写入editorDataTrimmed失败:', err);
        }
        try {
            sessionStorage.removeItem('editorData');
        } catch (err) {
            console.warn('清理sessionStorage失败:', err);
        }
        if (showPrompt && !this.storageWarningShown) {
            this.storageWarningShown = true;
            this.showMessage('浏览器缓存空间不足，已改用精简模式保存。完整截图依旧保存在插件记录中。', 'error');
        }
    }

    handleLocalStorageQuotaExceeded(editorSnapshot, operationsSnapshot) {
        console.warn('localStorage空间不足，启用精简保存模式');
        this.activateLightweightMode(true);
        try {
            localStorage.removeItem('editorData');
            localStorage.removeItem('operations');
            sessionStorage.removeItem('editorData');
        } catch (cleanupError) {
            console.warn('清理localStorage失败:', cleanupError);
        }

        try {
            const lightweightOps = operationsSnapshot.map(op => {
                const { screenshot, editData, ...rest } = op || {};
                const trimmed = { ...rest, hasScreenshot: !!screenshot };
                if (editData) {
                    trimmed.editDataMeta = {
                        canvasWidth: editData.canvasWidth,
                        canvasHeight: editData.canvasHeight,
                        scale: editData.scale,
                        lastModified: editData.lastModified
                    };
                }
                return trimmed;
            });

            const lightweightSnapshot = {
                ...editorSnapshot,
                operations: lightweightOps
            };

            localStorage.setItem('editorDataLight', JSON.stringify(lightweightSnapshot));
            localStorage.setItem('operationsLight', JSON.stringify(lightweightOps));
            localStorage.setItem('editorDataTrimmed', 'true');
            localStorage.setItem('lastEditTime', Date.now().toString());
        } catch (lightError) {
            console.error('精简模式写入仍失败:', lightError);
        }

        this.storageWarningShown = true;
    }



    // 手动同步按钮事件
    async manualSyncToMainStorage() {
        await this.syncEditedDataToMainStorage();
        this.showSuccess('数据已同步，可以正常导出了！');
    }

    // 自动保存功能
    autoSave() {
        // 检查是否应该禁用自动保存
        if (!this.autoSaveEnabled || this.isDrawing) {
            return;
        }

        const now = Date.now();

        // 防止频繁保存，至少间隔2秒
        if (now - this.lastSaveTime < 2000) {
            return;
        }

        // 清除之前的定时器
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // 设置新的定时器，延迟500ms后保存
        this.autoSaveTimer = setTimeout(async () => {
            // 再次检查是否还在绘制或自动保存被禁用
            if (!this.autoSaveEnabled || this.isDrawing) {
                return;
            }
            try {
                await this.immediateSave();
            } catch (error) {
                console.error('自动保存失败:', error);
            }
        }, 500);
    }

    // 立即保存到主存储（用于关键操作）
    async immediateSave() {
        // 绘制过程中仅记录需要保存，等待绘制结束
        if (this.isDrawing) {
            console.log('正在绘制中，记录待保存请求');
            this.pendingSaveRequested = true;
            return;
        }

        // 已有保存任务在进行，则等待其完成并标记需要再次保存
        if (this.saveInProgress) {
            console.log('保存正在进行中，排队等待');
            this.pendingSaveRequested = true;
            if (this.currentSavePromise) {
                await this.currentSavePromise;
            }
            return;
        }

        this.saveInProgress = true;
        this.pendingSaveRequested = false;
        this.currentSavePromise = (async () => {
            try {
                console.log('执行立即保存...');
                this.saveCurrentEditState();
                await this.syncEditedDataToMainStorage();
                this.lastSaveTime = Date.now();
                console.log('立即保存完成');
                this.showAutoSaveIndicator();
            } catch (error) {
                console.error('立即保存失败:', error);
            } finally {
                this.saveInProgress = false;
                const needsResave = this.pendingSaveRequested;
                this.currentSavePromise = null;
                this.pendingSaveRequested = false;
                if (needsResave) {
                    await this.immediateSave();
                }
            }
        })();

        await this.currentSavePromise;
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

    // 触发自动保存
    triggerAutoSave() {
        this.autoSave();
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

    // 获取修改状态
    isModified() {
        return this.hasUnsavedChanges();
    }

    // 初始化模态框事件监听器
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
