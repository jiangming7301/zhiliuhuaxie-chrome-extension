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
    injectContentScript: () => injectContentScript(sender.tab),
    startRerecording: () => startRerecording(request.index, request.url),
    startRerecordingWithTab: () => startRerecordingWithTab(request.index, request.url),
    handleRerecordScreenshot: () => handleRerecordScreenshot(request.data, sender.tab),
    singleStepRecorded: () => handleSingleStepRecorded(request, sender.tab)
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
    
    // 检查录制状态 - 对于单步录制，不需要检查全局录制状态
    const result = await chrome.storage.local.get(['isRecording', 'isRerecording']);
    const isSingleStepRecording = data && (data.element === 'single-step-recording' || result.isRerecording);
    
    if (!result.isRecording && !isSingleStepRecording) {
      return {
        success: false,
        error: '未在录制状态'
      };
    }
    
    console.log('截图状态检查:', {
      isRecording: result.isRecording,
      isRerecording: result.isRerecording,
      isSingleStepRecording: isSingleStepRecording
    });
    
    // 如果是重录模式，不创建新的操作记录，直接返回成功
    if (result.isRerecording) {
      console.log('重录模式下，不创建新的操作记录');
      return {
        success: true,
        message: '重录模式，操作已记录',
        isRerecording: true
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
    console.log('开始注入content script，标签页信息:', { id: tab.id, url: tab.url });
    
    // 检查标签页是否有效
    if (!tab || !tab.id) {
      console.warn('无效的标签页信息:', tab);
      return {
        success: false,
        error: '无效的标签页'
      };
    }
    
    // 检查是否为特殊页面（Chrome内部页面等）
    const restrictedDomains = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'edge://',
      'about:blank',
      'about:newtab'
    ];
    
    // 如果URL为空或者是受限制的页面，尝试等待页面加载
    if (!tab.url || restrictedDomains.some(domain => tab.url.startsWith(domain))) {
      console.log('页面可能还在加载中，等待页面完成加载...');
      
      // 等待页面加载完成
      await new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkTab = async () => {
          attempts++;
          try {
            const updatedTab = await chrome.tabs.get(tab.id);
            console.log(`检查标签页状态 ${attempts}/${maxAttempts}:`, { url: updatedTab.url, status: updatedTab.status });
            
            // 如果页面已加载且不是受限制的页面
            if (updatedTab.url && 
                (updatedTab.url.startsWith('http://') || updatedTab.url.startsWith('https://')) &&
                !restrictedDomains.some(domain => updatedTab.url.startsWith(domain))) {
              tab = updatedTab; // 更新tab信息
              resolve();
              return;
            }
            
            if (attempts >= maxAttempts) {
              resolve();
              return;
            }
            
            setTimeout(checkTab, 1000);
          } catch (error) {
            console.warn('检查标签页失败:', error);
            resolve();
          }
        };
        
        checkTab();
      });
    }
    
    // 最终检查URL是否有效
    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
      console.warn('页面URL不支持:', tab?.url);
      return {
        success: false,
        error: '当前页面不支持插件功能（仅支持HTTP/HTTPS页面）'
      };
    }
    
    // 再次检查是否为受限制的页面
    if (restrictedDomains.some(domain => tab.url.startsWith(domain))) {
      console.warn('受限制的页面URL:', tab.url);
      return {
        success: false,
        error: '当前页面不支持插件功能（系统页面）'
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
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });
      console.log('CSS注入完成');
    } catch (cssError) {
      console.warn('CSS注入失败:', cssError.message);
      // CSS注入失败不影响主要功能，继续执行
    }
    
    // 注入JavaScript文件
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-clean.js']
      });
      console.log('JS注入完成');
    } catch (jsError) {
      console.error('JS注入失败:', jsError);
      return {
        success: false,
        error: `脚本注入失败: ${jsError.message}`
      };
    }
    
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
      error: `注入失败: ${error.message}`
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
  
  // 清除徽章文本和背景色，并重置图标
  chrome.action.setBadgeText({ text: "" });
  chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] }); // 透明背景
  
  // 显式重置图标到默认状态
  chrome.action.setIcon({
    path: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png", 
      "128": "icons/icon128.png"
    }
  });
}

// 重新记录功能 - 带标签页创建
async function startRerecordingWithTab(index, url) {
  try {
    console.log(`开始重新记录第${index}步截图，URL: ${url}`);
    
    // 启动录制指示器，显示重录进行中
    updateRecordingIndicator(true);
    
    // 设置重新记录状态
    await chrome.storage.local.set({
      isRerecording: true,
      rerecordIndex: index,
      rerecordUrl: url,
      rerecordMode: 'single'
    });
    
    console.log('重新记录状态已设置');
    
    // 创建新标签页
    const newTab = await chrome.tabs.create({
      url: url,
      active: true
    });
    
    console.log('新标签页已创建，ID:', newTab.id);
    
    // 等待页面加载完成
    await new Promise((resolve) => {
      const listener = (tabId, changeInfo) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          console.log('页面加载完成，开始注入脚本');
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      
      // 设置超时，防止无限等待
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        console.log('页面加载超时，继续执行');
        resolve();
      }, 10000);
    });
    
    // 等待额外时间确保页面完全加载
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 获取最新的标签页信息
    const updatedTab = await chrome.tabs.get(newTab.id);
    console.log('获取到更新后的标签页信息:', { id: updatedTab.id, url: updatedTab.url, status: updatedTab.status });
    
    // 检查URL是否支持
    if (!updatedTab.url || (!updatedTab.url.startsWith('http://') && !updatedTab.url.startsWith('https://'))) {
      // 关闭新创建的标签页
      try {
        await chrome.tabs.remove(newTab.id);
      } catch (e) {
        console.warn('关闭标签页失败:', e);
      }
      
      // 清理重新记录状态
      await chrome.storage.local.set({
        isRerecording: false,
        rerecordIndex: -1,
        rerecordUrl: '',
        rerecordMode: ''
      });
      
      // 停止录制指示器
      updateRecordingIndicator(false);
      
      // 直接返回错误，不抛出异常
      return {
        success: false,
        error: '该页面不支持录制功能。\n\n请确保：\n1. URL以 http:// 或 https:// 开头\n2. 不是浏览器内部页面（chrome://等）\n3. 页面已完全加载\n\n当前URL: ' + (updatedTab.url || '未知')
      };
    }
    
    // 注入content script
    const injectResult = await injectContentScript(updatedTab);
    console.log('脚本注入结果:', injectResult);
    
    if (!injectResult.success) {
      // 关闭新创建的标签页
      try {
        await chrome.tabs.remove(newTab.id);
      } catch (e) {
        console.warn('关闭标签页失败:', e);
      }
      
      // 清理重新记录状态
      await chrome.storage.local.set({
        isRerecording: false,
        rerecordIndex: -1,
        rerecordUrl: '',
        rerecordMode: ''
      });
      
      // 停止录制指示器
      updateRecordingIndicator(false);
      
      // 提取友好的错误信息
      let errorMessage = injectResult.error || '脚本注入失败';
      if (errorMessage.includes('仅支持HTTP/HTTPS页面')) {
        errorMessage = '该页面不支持录制功能。\n\n可能的原因：\n1. 页面URL不是标准的HTTP/HTTPS协议\n2. 这是浏览器内部页面（chrome://等）\n3. 页面加载未完成\n\n请确保目标页面是正常的网页后再试。';
      }
      
      // 直接返回错误，不抛出异常
      return {
        success: false,
        error: errorMessage
      };
    }
    
    // 多次尝试启动单步录制
    let attempts = 0;
    const maxAttempts = 5;
    let success = false;
    
    while (attempts < maxAttempts && !success) {
      attempts++;
      console.log(`尝试启动单步录制 ${attempts}/${maxAttempts}`);
      
      try {
        // 等待一段时间确保content script完全初始化
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await chrome.tabs.sendMessage(updatedTab.id, {
          action: 'startSingleStepRecording',
          targetIndex: index
        });
        
        console.log('单步录制启动响应:', response);
        
        if (response && response.success) {
          console.log('单步录制启动成功');
          success = true;
        } else {
          console.warn(`单步录制启动失败 (尝试 ${attempts}/${maxAttempts}):`, response?.error);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        console.warn(`单步录制启动异常 (尝试 ${attempts}/${maxAttempts}):`, error.message);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!success) {
      // 关闭新创建的标签页
      try {
        await chrome.tabs.remove(newTab.id);
      } catch (e) {
        console.warn('关闭标签页失败:', e);
      }
      
      // 清理重新记录状态
      await chrome.storage.local.set({
        isRerecording: false,
        rerecordIndex: -1,
        rerecordUrl: '',
        rerecordMode: ''
      });
      
      // 停止录制指示器
      updateRecordingIndicator(false);
      
      // 直接返回错误，不抛出异常
      return {
        success: false,
        error: '无法启动单步录制。\n\n可能的原因：\n1. 页面加载未完成\n2. 页面有JavaScript错误\n3. 网络连接不稳定\n\n建议：\n- 等待页面完全加载后再试\n- 检查控制台是否有错误\n- 刷新页面后重试'
      };
    }
    
    return { success: true, tabId: newTab.id };
    
  } catch (error) {
    console.error('启动重新记录失败:', error);
    
    // 清理重新记录状态
    await chrome.storage.local.set({
      isRerecording: false,
      rerecordIndex: -1,
      rerecordUrl: '',
      rerecordMode: ''
    });
    
    // 停止录制指示器
    updateRecordingIndicator(false);
    
    // 返回更友好的错误信息而不是直接抛出
    return {
      success: false,
      error: error.message || '重新记录启动失败',
      details: error.stack
    };
  }
}

// 重新记录功能
async function startRerecording(index, url) {
  try {
    console.log(`开始重新记录第${index}步截图，URL: ${url}`);
    
    // 设置重新记录状态
    await chrome.storage.local.set({
      isRerecording: true,
      rerecordIndex: index,
      rerecordUrl: url,
      rerecordMode: 'single-step'
    });
    
    return {
      success: true,
      message: '重新记录模式已启动'
    };
  } catch (error) {
    console.error('启动重新记录失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 处理重新记录的截图数据
async function handleRerecordScreenshot(data, tab) {
  try {
    const result = await chrome.storage.local.get(['isRerecording', 'rerecordIndex', 'operations']);
    
    if (!result.isRerecording) {
      throw new Error('当前不在重新记录模式');
    }
    
    const operations = result.operations || [];
    const targetIndex = result.rerecordIndex;
    
    if (targetIndex >= operations.length) {
      throw new Error('目标索引超出范围');
    }
    
    // 截图
    let screenshotUrl = null;
    try {
      screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: 80
      });
    } catch (captureError) {
      console.warn('重新记录截图失败:', captureError);
      throw new Error('截图失败：' + captureError.message);
    }
    
    // 更新指定索引的截图数据
    operations[targetIndex] = {
      ...operations[targetIndex],
      screenshot: screenshotUrl,
      url: data.url,
      title: data.title,
      element: data.element,
      text: data.text,
      coordinates: { x: data.x, y: data.y },
      isRerecorded: true,
      rerecordTime: Date.now(),
      rerecordCount: (operations[targetIndex].rerecordCount || 0) + 1
    };
    
    // 保存更新后的数据
    await chrome.storage.local.set({ 
      operations: operations,
      isRerecording: false,
      rerecordIndex: -1,
      rerecordUrl: '',
      rerecordMode: ''
    });
    
    console.log(`第${targetIndex}步截图已重新记录`);
    
    return {
      success: true,
      message: '截图重新记录成功',
      updatedOperation: operations[targetIndex]
    };
  } catch (error) {
    console.error('处理重新记录截图失败:', error);
    
    // 清除重新记录状态
    await chrome.storage.local.set({
      isRerecording: false,
      rerecordIndex: -1,
      rerecordUrl: '',
      rerecordMode: ''
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 处理单步录制完成
async function handleSingleStepRecorded(request, tab) {
  try {
    console.log('处理单步录制完成:', request);
    
    // 获取当前重录状态和操作记录
    const result = await chrome.storage.local.get(['isRerecording', 'rerecordIndex', 'operations']);
    
    if (result.isRerecording && result.rerecordIndex >= 0) {
      // 如果是重录模式，需要更新指定索引的操作记录
      const operations = result.operations || [];
      const targetIndex = result.rerecordIndex;
      
      if (targetIndex < operations.length) {
        // 截图
        let screenshotUrl = null;
        try {
          screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'jpeg',
            quality: 80
          });
        } catch (captureError) {
          console.warn('单步录制截图失败:', captureError);
          throw new Error('截图失败：' + captureError.message);
        }
        
        // 保留原有的操作信息，只更新截图和相关元数据
        const originalOperation = operations[targetIndex];
        operations[targetIndex] = {
          ...originalOperation, // 保留原有的所有字段
          screenshot: screenshotUrl, // 只更新截图
          url: request.url || tab.url, // 更新URL（可能发生了跳转）
          title: tab.title, // 更新页面标题
          isRerecorded: true,
          rerecordTime: Date.now(),
          rerecordCount: (originalOperation.rerecordCount || 0) + 1
        };
        
        // 保存更新后的数据
        await chrome.storage.local.set({ 
          operations: operations
        });
        
        console.log(`第${targetIndex}步截图已通过单步录制重新记录，保留原有点击信息:`, {
          element: originalOperation.element,
          text: originalOperation.text,
          coordinates: originalOperation.coordinates
        });
      }
    }
    
    // 清除重新记录状态
    await chrome.storage.local.set({
      isRerecording: false,
      rerecordIndex: -1,
      rerecordUrl: '',
      rerecordMode: ''
    });
    
    // 停止录制指示器的闪烁
    updateRecordingIndicator(false);
    
    console.log('单步录制完成，已清理重新记录状态');
    
    return {
      success: true,
      message: '单步录制完成'
    };
  } catch (error) {
    console.error('处理单步录制完成失败:', error);
    
    // 发生错误时也要清理状态并停止指示器
    await chrome.storage.local.set({
      isRerecording: false,
      rerecordIndex: -1,
      rerecordUrl: '',
      rerecordMode: ''
    });
    
    // 停止录制指示器的闪烁
    updateRecordingIndicator(false);
    
    return {
      success: false,
      error: error.message
    };
  }
}

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