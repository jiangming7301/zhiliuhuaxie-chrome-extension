// Chrome扩展后台服务脚本
console.log('智流华写插件后台脚本已加载');

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('智流华写助手插件已安装');
  
  try {
    // 等待确保storage API可用
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 初始化默认设置
    const defaultSettings = {
      isPremium: false,
      usageCount: 0,
      maxFreePages: 20,
      userInfo: {
        nickname: "用户",
        email: ""
      }
    };
    
    await chrome.storage.local.set(defaultSettings);
    console.log('插件设置已初始化');
  } catch (error) {
    console.error('初始化插件设置失败:', error);
  }
});

// 监听来自popup和content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request);
  
  const messageHandlers = {
    ping: () => handlePing(),
    getPluginInfo: () => getPluginInfo(),
    checkUsage: () => checkUsage(),
    startRecording: () => startRecording(),
    stopRecording: () => stopRecording(),
    captureScreenshot: () => captureScreenshot(request.data, sender.tab),
    updateRecordingStatus: () => updateRecordingIndicator(request.isRecording),
    GET_RECORDING_STATE: () => getRecordingState(),
    injectContentScript: () => injectContentScript(sender.tab)
  };
  
  const handler = messageHandlers[request.action];
  if (handler) {
    handler().then(sendResponse).catch(error => {
      console.error(`处理${request.action}失败:`, error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // 保持消息通道开放
  } else {
    sendResponse({ success: false, error: '未知操作' });
  }
});

// 处理ping消息
async function handlePing() {
  console.log('收到ping消息，runtime正常');
  return { success: true, message: 'pong' };
}

// 获取插件信息
async function getPluginInfo() {
  try {
    const result = await chrome.storage.local.get(['isPremium', 'userInfo', 'authToken', 'subscriptionExpire']);
    
    return {
      success: true,
      isPremium: result.isPremium || false,
      userInfo: result.userInfo || { nickname: "用户", email: "" },
      authToken: result.authToken || null,
      subscriptionExpire: result.subscriptionExpire || null
    };
  } catch (error) {
    console.error('获取插件信息失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 检查使用情况
async function checkUsage() {
  try {
    const result = await chrome.storage.local.get([
      'usageCount', 
      'isPremium', 
      'maxFreePages', 
      'subscriptionExpire',
      'userInfo'
    ]);
    
    const isPremium = result.isPremium || false;
    const maxFreePages = result.maxFreePages || 20;
    const usageCount = result.usageCount || 0;
    const userInfo = result.userInfo || { nickname: "用户", email: "" };
    
    return {
      success: true,
      isPremium: isPremium,
      usedPages: usageCount,
      remainingPages: isPremium ? -1 : Math.max(0, maxFreePages - usageCount),
      maxFreePages: maxFreePages,
      subscriptionExpire: result.subscriptionExpire,
      userInfo: userInfo
    };
  } catch (error) {
    console.error('检查使用情况失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 检查使用限制
async function checkUsageLimit() {
  try {
    const result = await chrome.storage.local.get(['isPremium', 'usageCount', 'maxFreePages']);
    
    if (result.isPremium) {
      return { allowed: true, message: '专业版可以无限制使用' };
    }
    
    const used = result.usageCount || 0;
    const limit = result.maxFreePages || 20;
    
    if (used >= limit) {
      return {
        allowed: false,
        error: 'USAGE_LIMIT_EXCEEDED',
        message: `免费版已达到${limit}张截图限制，请升级专业版继续使用`,
        usedPages: used,
        maxPages: limit
      };
    }
    
    return {
      allowed: true,
      remainingPages: limit - used
    };
  } catch (error) {
    console.error('检查使用限制失败:', error);
    return {
      allowed: false,
      error: error.message
    };
  }
}

// 开始录制
async function startRecording() {
  try {
    console.log('开始录制函数被调用');
    
    // 检查使用限制
    const limitCheck = await checkUsageLimit();
    
    if (!limitCheck.allowed) {
      return {
        success: false,
        error: limitCheck.error,
        message: limitCheck.message
      };
    }
    
    // 设置录制状态
    await chrome.storage.local.set({
      isRecording: true,
      recordingStartTime: Date.now()
    });
    
    console.log('录制状态已设置为true');
    
    // 启动录制指示器
    updateRecordingIndicator(true);
    
    // 向当前活动标签页注入并启动录制
    try {
      const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (activeTab && (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))) {
        // 动态注入content script
        const injectResult = await injectContentScript(activeTab);
        console.log('注入结果:', injectResult);
        
        // 等待content script初始化
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 发送开始录制消息
        await chrome.tabs.sendMessage(activeTab.id, { action: 'startRecording' });
        console.log('成功向当前标签页发送录制消息:', activeTab.url);
      }
    } catch (error) {
      console.log('向当前标签页发送消息失败:', error.message);
    }
    
    return {
      success: true,
      message: '开始录制成功'
    };
  } catch (error) {
    console.error('开始录制失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 停止录制
async function stopRecording() {
  try {
    console.log('停止录制函数被调用');
    
    // 更新使用计数（免费版）
    const result = await chrome.storage.local.get(['isPremium', 'usageCount']);
    
    if (!result.isPremium) {
      const newUsageCount = (result.usageCount || 0) + 1;
      await chrome.storage.local.set({ usageCount: newUsageCount });
    }
    
    // 设置录制状态
    await chrome.storage.local.set({
      isRecording: false,
      recordingStartTime: null
    });
    
    console.log('录制状态已设置为false');
    
    // 停止录制指示器
    updateRecordingIndicator(false);
    
    // 向当前活动标签页发送停止录制消息
    try {
      const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (activeTab && (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))) {
        await chrome.tabs.sendMessage(activeTab.id, { action: 'stopRecording' });
        console.log('成功向当前标签页发送停止录制消息:', activeTab.url);
      }
    } catch (error) {
      console.log('向当前标签页发送停止消息失败:', error.message);
    }
    
    return {
      success: true,
      message: '停止录制成功'
    };
  } catch (error) {
    console.error('停止录制失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 截图功能
async function captureScreenshot(data, tab) {
  try {
    console.log('开始截图:', data);
    
    // 检查录制状态
    const result = await chrome.storage.local.get(['isRecording']);
    if (!result.isRecording) {
      return {
        success: false,
        error: '未在录制状态'
      };
    }
    
    // 检查使用限制
    const limitCheck = await checkUsageLimit();
    if (!limitCheck.allowed) {
      return {
        success: false,
        error: limitCheck.error,
        message: limitCheck.message
      };
    }
    
    // 获取现有的操作记录
    const storage = await chrome.storage.local.get(['operations']);
    const operations = storage.operations || [];
    
    // 限制操作记录数量
    const MAX_OPERATIONS = 100;
    if (operations.length >= MAX_OPERATIONS) {
      operations.splice(0, operations.length - MAX_OPERATIONS + 1);
    }
    
    let screenshotUrl = null;
    
    try {
      // 截图
      screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: 80
      });
      
    } catch (captureError) {
      console.warn('截图失败，将记录操作但不包含截图:', captureError);
      
      if (captureError.message && captureError.message.includes('quota exceeded')) {
        return {
          success: false,
          error: 'quota_exceeded',
          message: '截图配额超限，请稍后再试或降低截图频率'
        };
      }
    }
    
    // 添加新的操作记录
    const operation = {
      type: 'click',
      timestamp: data.timestamp || Date.now(),
      url: data.url,
      title: data.title,
      element: data.element,
      text: data.text,
      coordinates: { x: data.x, y: data.y },
      screenshot: screenshotUrl,
      id: Date.now() + Math.random()
    };
    
    operations.push(operation);
    
    // 保存到storage
    await chrome.storage.local.set({ operations });
    
    console.log('操作记录已保存:', operation.id, screenshotUrl ? '包含截图' : '无截图');
    
    return {
      success: true,
      message: screenshotUrl ? '截图成功' : '操作已记录（截图失败）',
      operationId: operation.id,
      totalOperations: operations.length,
      hasScreenshot: !!screenshotUrl
    };
    
  } catch (error) {
    console.error('截图失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 获取录制状态
async function getRecordingState() {
  const result = await chrome.storage.local.get(['isRecording']);
  return { isRecording: result.isRecording || false };
}

// 动态注入content script
async function injectContentScript(tab) {
  try {
    // 检查是否为有效的HTTP/HTTPS页面
    if (!tab || !tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
      return {
        success: false,
        error: '当前页面不支持插件功能'
      };
    }
    
    // 检查content script是否已经注入
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      console.log('Content script已存在，ping响应:', response);
      return {
        success: true,
        message: 'Content script已存在'
      };
    } catch (error) {
      console.log('需要注入content script到标签页:', tab.url);
    }
    
    // 注入CSS文件
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content.css']
    });
    console.log('CSS注入完成');
    
    // 注入JavaScript文件
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    console.log('JS注入完成');
    
    // 验证注入是否成功
    let retryCount = 0;
    const maxRetries = 10;
    
    while (retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        console.log('注入后验证成功，ping响应:', response);
        return {
          success: true,
          message: 'Content script注入并验证成功'
        };
      } catch (pingError) {
        retryCount++;
        console.log(`验证注入失败，重试 ${retryCount}/${maxRetries}:`, pingError.message);
      }
    }
    
    console.warn('无法验证content script，但注入操作已完成');
    return {
      success: true,
      message: 'Content script注入完成（验证超时）'
    };
    
  } catch (error) {
    console.error('注入content script失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 录制指示器管理
let recordingBlinkInterval = null;

function updateRecordingIndicator(isRecording) {
  if (isRecording) {
    startRecordingBlink();
  } else {
    stopRecordingBlink();
  }
}

function startRecordingBlink() {
  if (recordingBlinkInterval) {
    clearInterval(recordingBlinkInterval);
  }
  
  chrome.action.setBadgeText({ text: "●" });
  chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
  
  let isVisible = true;
  recordingBlinkInterval = setInterval(() => {
    chrome.action.setBadgeText({ text: isVisible ? "●" : "" });
    isVisible = !isVisible;
  }, 800);
}

function stopRecordingBlink() {
  if (recordingBlinkInterval) {
    clearInterval(recordingBlinkInterval);
    recordingBlinkInterval = null;
  }
  
  chrome.action.setBadgeText({ text: "" });
}

// Service Worker生命周期事件
chrome.runtime.onStartup.addListener(() => {
  console.log('Chrome启动，service worker重新激活');
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker即将挂起');
});

// 保持service worker活跃
setInterval(() => {
  console.log('Service worker心跳检查:', new Date().toLocaleTimeString());
}, 30000);

console.log('Service Worker ID:', chrome.runtime.id);
console.log('Service Worker状态: 正常运行');