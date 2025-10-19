// 插件初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('智流华写专业版插件已安装')
  
  try {
    // 等待一小段时间确保storage API可用
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 强制设置为专业版
    const defaultSettings = {
      isPremium: true,
      usageCount: 0,
      maxFreePages: 999999,
      subscriptionExpire: new Date(2099, 11, 31).toISOString(), // 设置为2099年底过期
      userInfo: {
        nickname: "专业版用户",
        email: "premium@zhiliuhuaxie.com"
      },
      authToken: "premium-token-" + Date.now()
    }
    
    // 初始化默认设置
    await chrome.storage.local.set(defaultSettings)
    console.log('插件专业版设置已初始化')
  } catch (error) {
    console.error('初始化插件设置失败:', error)
    // 延迟重试
    setTimeout(async () => {
      try {
        await chrome.storage.local.set({
          isPremium: true,
          usageCount: 0,
          maxFreePages: 999999,
          subscriptionExpire: new Date(2099, 11, 31).toISOString(),
          userInfo: {
            nickname: "专业版用户",
            email: "premium@zhiliuhuaxie.com"
          },
          authToken: "premium-token-" + Date.now()
        })
        console.log('插件专业版设置重试初始化成功')
      } catch (retryError) {
        console.error('插件专业版设置重试初始化失败:', retryError)
      }
    }, 1000)
  }
})

// 监听来自popup和content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request)
  
  switch (request.action) {
    case 'ping':
      // 处理ping消息，用于检查runtime是否可用
      console.log('收到ping消息，runtime正常')
      sendResponse({ success: true, message: 'pong' })
      return true
      
    case 'getPluginInfo':
      getPluginInfo().then(sendResponse)
      return true
      
    case 'checkUsage':
      checkUsage().then(sendResponse)
      return true
      
    case 'startRecording':
      startRecording().then(sendResponse)
      return true
      
    case 'stopRecording':
      stopRecording().then(sendResponse)
      return true
      
    case 'captureScreenshot':
      captureScreenshot(request.data, sender.tab).then(sendResponse)
      return true
      
    case 'activatePlugin':
      activatePlugin(request.authCode).then(sendResponse)
      return true
      
    case 'openUpgradePage':
      chrome.tabs.create({ url: 'http://localhost:3000/#pricing' })
      sendResponse({ success: true })
      return true
      
    case 'updateSubscriptionStatus':
      updateSubscriptionStatus(request.isPremium, request.subscriptionExpire).then(sendResponse)
      return true
      
    case 'updateRecordingStatus':
      updateRecordingIndicator(request.isRecording)
      sendResponse({ success: true })
      return true
      
    case 'GET_RECORDING_STATE':
      chrome.storage.local.get(['isRecording']).then(result => {
        sendResponse({ isRecording: result.isRecording || false })
      })
      return true
      
    case 'injectContentScript':
      // 新增：处理动态注入content script的请求
      injectContentScript(sender.tab).then(sendResponse)
      return true
      
    default:
      sendResponse({ error: '未知操作' })
  }
})

// 获取插件信息
async function getPluginInfo() {
  try {
    const result = await chrome.storage.local.get(['isPremium', 'userInfo', 'authToken', 'subscriptionExpire'])
    
    return {
      success: true,
      isPremium: result.isPremium || false,
      userInfo: result.userInfo || null,
      authToken: result.authToken || null,
      subscriptionExpire: result.subscriptionExpire || null
    }
  } catch (error) {
    console.error('获取插件信息失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 检查使用情况和订阅状态
async function checkUsage() {
  try {
    const result = await chrome.storage.local.get([
      'usageCount', 
      'isPremium', 
      'maxFreePages', 
      'subscriptionExpire',
      'userInfo'
    ])
    
    // 强制设置为专业版
    const isPremium = true
    const maxFreePages = 999999
    const usageCount = result.usageCount || 0
    const subscriptionExpire = result.subscriptionExpire || new Date(2099, 11, 31).toISOString()
    const userInfo = result.userInfo || {
      nickname: "专业版用户",
      email: "premium@zhiliuhuaxie.com"
    }
    
    // 确保永远是专业版
    if (!result.isPremium) {
      await chrome.storage.local.set({ 
        isPremium: true, 
        subscriptionExpire: new Date(2099, 11, 31).toISOString(),
        userInfo: userInfo
      })
    }
    
    return {
      success: true,
      isPremium: true,
      usedPages: usageCount,
      remainingPages: -1, // 无限制
      maxFreePages: maxFreePages,
      subscriptionExpire: subscriptionExpire,
      userInfo: userInfo
    }
  } catch (error) {
    console.error('检查使用情况失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 检查使用限制和订阅状态
async function checkUsageLimit() {
  // 专业版无需检查限制，直接返回允许
  return {
    allowed: true,
    message: '专业版可以无限制使用',
    remainingPages: -1
  }
}

// 开始录制
async function startRecording() {
  try {
    console.log('Background: 开始录制函数被调用')
    
    // 检查使用限制
    const limitCheck = await checkUsageLimit()
    
    if (!limitCheck.allowed) {
      return {
        success: false,
        error: limitCheck.error,
        message: limitCheck.message
      }
    }
    
    // 设置录制状态
    await chrome.storage.local.set({
      isRecording: true,
      recordingStartTime: Date.now()
    })
    
    console.log('Background: 录制状态已设置为true')
    
    // 启动录制指示器
    updateRecordingIndicator(true)
    
    // 只向当前活动标签页发送开始录制消息（使用activeTab权限）
    try {
      const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true})
      if (activeTab && (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))) {
        // 先动态注入content script
        const injectResult = await injectContentScript(activeTab)
        console.log('Background: 注入结果:', injectResult)
        
        // 等待一段时间确保content script完全初始化
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // 再发送开始录制消息
        await chrome.tabs.sendMessage(activeTab.id, { action: 'startRecording' })
        console.log('Background: 成功向当前标签页发送录制消息:', activeTab.url)
      }
    } catch (error) {
      console.log('Background: 向当前标签页发送消息失败:', error.message)
    }
    
    return {
      success: true,
      message: '开始录制成功'
    }
  } catch (error) {
    console.error('开始录制失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 停止录制
async function stopRecording() {
  try {
    console.log('Background: 停止录制函数被调用')
    
    // 更新使用计数（免费版）
    const result = await chrome.storage.local.get(['isPremium', 'usageCount'])
    
    if (!result.isPremium) {
      const newUsageCount = (result.usageCount || 0) + 1
      await chrome.storage.local.set({ usageCount: newUsageCount })
    }
    
    // 设置录制状态
    await chrome.storage.local.set({
      isRecording: false,
      recordingStartTime: null
    })
    
    console.log('Background: 录制状态已设置为false')
    
    // 停止录制指示器
    updateRecordingIndicator(false)
    
    // 只向当前活动标签页发送停止录制消息（使用activeTab权限）
    try {
      const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true})
      if (activeTab && (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))) {
        // 先动态注入content script
        const injectResult = await injectContentScript(activeTab)
        console.log('Background: 注入结果:', injectResult)
        
        // 等待一段时间确保content script完全初始化
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // 再发送停止录制消息
        await chrome.tabs.sendMessage(activeTab.id, { action: 'stopRecording' })
        console.log('Background: 成功向当前标签页发送停止录制消息:', activeTab.url)
      }
    } catch (error) {
      console.log('Background: 向当前标签页发送停止消息失败:', error.message)
    }
    
    return {
      success: true,
      message: '停止录制成功'
    }
  } catch (error) {
    console.error('停止录制失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 截图功能
async function captureScreenshot(data, tab) {
  try {
    console.log('开始截图:', data)
    
    // 检查录制状态
    const result = await chrome.storage.local.get(['isRecording'])
    if (!result.isRecording) {
      return {
        success: false,
        error: '未在录制状态'
      }
    }
    
    // 获取现有的操作记录
    const storage = await chrome.storage.local.get(['operations'])
    const operations = storage.operations || []
    
    // 专业版可以保存更多操作记录
    const MAX_OPERATIONS = 500
    if (operations.length >= MAX_OPERATIONS) {
      // 删除最旧的记录
      operations.splice(0, operations.length - MAX_OPERATIONS + 1)
    }
    
    let screenshotUrl = null
    
    try {
      // 使用更高质量的截图
      screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: 85     // 提高质量
      })
      
      // 压缩截图数据
      screenshotUrl = await compressImage(screenshotUrl, 0.8)
      
    } catch (captureError) {
      console.warn('截图失败，将记录操作但不包含截图:', captureError);
      // 即使截图失败，也要记录操作
      
      // 如果是配额超限错误，返回特定错误信息
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
      screenshot: screenshotUrl, // 可能为null
      id: Date.now() + Math.random()
    }
    
    operations.push(operation)
    
    // 保存到storage
    await chrome.storage.local.set({ operations })
    
    console.log('操作记录已保存:', operation.id, screenshotUrl ? '包含截图' : '无截图')
    
    return {
      success: true,
      message: screenshotUrl ? '截图成功' : '操作已记录（截图失败）',
      operationId: operation.id,
      totalOperations: operations.length,
      hasScreenshot: !!screenshotUrl
    }
    
  } catch (error) {
    console.error('截图失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 压缩图片函数 - 简化版本，适用于service worker环境
async function compressImage(dataUrl, quality = 0.7) {
  try {
    // 在service worker环境中，我们直接返回原图
    // 因为OffscreenCanvas和Image在这里不可用
    return dataUrl;
  } catch (error) {
    console.warn('图片压缩失败，返回原图:', error);
    return dataUrl;
  }
}

// 激活插件 - 专业版无需激活，直接返回成功
async function activatePlugin(authCode) {
  try {
    // 无论输入什么授权码，都返回成功
    const now = new Date()
    const expireDate = new Date(2099, 11, 31)
    
    // 保存激活信息
    await chrome.storage.local.set({
      isPremium: true,
      authToken: "premium-token-" + Date.now(),
      userInfo: {
        nickname: "专业版用户",
        email: "premium@zhiliuhuaxie.com"
      },
      subscriptionExpire: expireDate.toISOString(),
      activatedAt: now.toISOString(),
      authCode: authCode || "ZLH-PREM-FULL-VERS"
    })
    
    return {
      success: true,
      message: '激活成功！您正在使用专业版功能。',
      expireDate: expireDate.toISOString()
    }
  } catch (error) {
    console.error('激活插件失败:', error)
    // 即使出错也返回成功
    return {
      success: true,
      message: '激活成功！您正在使用专业版功能。',
      expireDate: new Date(2099, 11, 31).toISOString()
    }
  }
}

// 更新订阅状态
async function updateSubscriptionStatus(isPremium, subscriptionExpire) {
  try {
    await chrome.storage.local.set({
      isPremium: isPremium,
      subscriptionExpire: subscriptionExpire
    })
    
    return {
      success: true,
      message: '订阅状态已更新'
    }
  } catch (error) {
    console.error('更新订阅状态失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 定期检查订阅状态 - 专业版无需检查，确保永远是专业版
setInterval(async () => {
  try {
    const result = await chrome.storage.local.get(['isPremium', 'subscriptionExpire'])
    
    // 确保永远是专业版
    if (!result.isPremium || !result.subscriptionExpire) {
      await chrome.storage.local.set({
        isPremium: true,
        subscriptionExpire: new Date(2099, 11, 31).toISOString(),
        userInfo: {
          nickname: "专业版用户",
          email: "premium@zhiliuhuaxie.com"
        }
      })
      console.log('已恢复专业版状态')
    }
  } catch (error) {
    console.error('检查订阅状态失败:', error)
  }
}, 60 * 60 * 1000) // 每小时检查一次

// 监听通知点击事件
chrome.notifications.onClicked.addListener((notificationId) => {
  // 打开续费页面
  chrome.tabs.create({ url: 'http://localhost:3000/#pricing' })
  chrome.notifications.clear(notificationId)
})

// 更新录制指示器
let recordingBlinkInterval = null

function updateRecordingIndicator(isRecording) {
  if (isRecording) {
    // 开始闪烁红点
    startRecordingBlink()
  } else {
    // 停止闪烁，恢复正常状态
    stopRecordingBlink()
  }
}

function startRecordingBlink() {
  // 清除之前的闪烁
  if (recordingBlinkInterval) {
    clearInterval(recordingBlinkInterval)
  }
  
  // 使用badge来显示录制状态，避免图标格式问题
  chrome.action.setBadgeText({ text: "●" })
  chrome.action.setBadgeBackgroundColor({ color: "#ff0000" })
  
  // 闪烁效果
  let isVisible = true
  recordingBlinkInterval = setInterval(() => {
    chrome.action.setBadgeText({ text: isVisible ? "●" : "" })
    isVisible = !isVisible
  }, 800) // 每800ms闪烁一次
}

function stopRecordingBlink() {
  if (recordingBlinkInterval) {
    clearInterval(recordingBlinkInterval)
    recordingBlinkInterval = null
  }
  
  // 清除badge，恢复正常状态
  chrome.action.setBadgeText({ text: "" })
}

// 动态注入content script函数
async function injectContentScript(tab) {
  try {
    // 检查是否为有效的HTTP/HTTPS页面
    if (!tab || !tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
      return {
        success: false,
        error: '当前页面不支持插件功能'
      }
    }
    
    // 检查content script是否已经注入
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' })
      // 如果没有抛出异常，说明content script已经存在
      console.log('Content script已存在，ping响应:', response)
      return {
        success: true,
        message: 'Content script已存在'
      }
    } catch (error) {
      // content script不存在，需要注入
      console.log('需要注入content script到标签页:', tab.url)
    }
    
    // 注入CSS文件
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content.css']
    })
    console.log('CSS注入完成')
    
    // 注入JavaScript文件
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    })
    console.log('JS注入完成')
    
    // 等待content script初始化完成，并验证注入是否成功
    let retryCount = 0
    const maxRetries = 10
    
    while (retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 200)) // 等待200ms
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' })
        console.log('注入后验证成功，ping响应:', response)
        return {
          success: true,
          message: 'Content script注入并验证成功'
        }
      } catch (pingError) {
        retryCount++
        console.log(`验证注入失败，重试 ${retryCount}/${maxRetries}:`, pingError.message)
      }
    }
    
    // 如果验证失败，但注入没有报错，返回成功
    console.warn('无法验证content script，但注入操作已完成')
    return {
      success: true,
      message: 'Content script注入完成（验证超时）'
    }
    
  } catch (error) {
    console.error('注入content script失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Service Worker启动时的调试信息
console.log('智流华写插件后台脚本已加载')
console.log('Service Worker ID:', chrome.runtime.id)
console.log('Service Worker状态: 正常运行')

// 确保service worker保持活跃
chrome.runtime.onStartup.addListener(() => {
  console.log('Chrome启动，service worker重新激活')
})

// 监听扩展启动事件
chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker即将挂起')
})

// 定期保持service worker活跃（每30秒）
setInterval(() => {
  console.log('Service worker心跳检查:', new Date().toLocaleTimeString())
}, 30000)
