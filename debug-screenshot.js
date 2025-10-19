// 调试截图功能的测试脚本
console.log('开始调试截图功能...');

// 1. 检查runtime状态
function checkRuntime() {
  console.log('=== Runtime 状态检查 ===');
  console.log('chrome.runtime存在:', !!chrome.runtime);
  console.log('chrome.runtime.id:', chrome.runtime?.id);
  console.log('chrome.tabs存在:', !!chrome.tabs);
  console.log('chrome.scripting存在:', !!chrome.scripting);
  console.log('chrome.storage存在:', !!chrome.storage);
}

// 2. 检查当前标签页
async function checkCurrentTab() {
  console.log('=== 当前标签页检查 ===');
  try {
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    console.log('当前标签页:', activeTab);
    console.log('URL:', activeTab?.url);
    console.log('是否为HTTP/HTTPS:', activeTab?.url?.startsWith('http'));
    return activeTab;
  } catch (error) {
    console.error('获取当前标签页失败:', error);
    return null;
  }
}

// 3. 测试content script注入
async function testContentScriptInjection(tab) {
  console.log('=== Content Script 注入测试 ===');
  if (!tab) return false;
  
  try {
    // 检查是否已注入
    const pingResult = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    console.log('Content script已存在:', pingResult);
    return true;
  } catch (error) {
    console.log('Content script不存在，开始注入...');
    
    try {
      // 注入CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });
      console.log('CSS注入成功');
      
      // 注入JS
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('JS注入成功');
      
      // 再次测试ping
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
      const pingResult = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      console.log('注入后ping测试:', pingResult);
      return true;
    } catch (injectError) {
      console.error('注入失败:', injectError);
      return false;
    }
  }
}

// 4. 测试录制状态
async function testRecordingState() {
  console.log('=== 录制状态测试 ===');
  try {
    const result = await chrome.storage.local.get(['isRecording']);
    console.log('存储中的录制状态:', result.isRecording);
    return result.isRecording;
  } catch (error) {
    console.error('获取录制状态失败:', error);
    return false;
  }
}

// 5. 测试截图功能
async function testScreenshot(tab) {
  console.log('=== 截图功能测试 ===');
  if (!tab) return false;
  
  try {
    const screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 85
    });
    
    console.log('截图成功!');
    console.log('截图数据长度:', screenshotUrl.length);
    console.log('截图前缀:', screenshotUrl.substring(0, 50) + '...');
    return true;
  } catch (error) {
    console.error('截图失败:', error);
    console.error('错误详情:', error.message);
    return false;
  }
}

// 6. 完整的端到端测试
async function fullEndToEndTest() {
  console.log('=== 完整端到端测试 ===');
  
  // 检查runtime
  checkRuntime();
  
  // 获取当前标签页
  const tab = await checkCurrentTab();
  if (!tab) {
    console.error('无法获取当前标签页，测试终止');
    return;
  }
  
  // 测试content script注入
  const contentInjected = await testContentScriptInjection(tab);
  if (!contentInjected) {
    console.error('Content script注入失败，测试终止');
    return;
  }
  
  // 测试录制状态
  const isRecording = await testRecordingState();
  console.log('当前录制状态:', isRecording);
  
  // 如果没有录制，先启动录制
  if (!isRecording) {
    console.log('启动录制状态...');
    try {
      await chrome.storage.local.set({
        isRecording: true,
        recordingStartTime: Date.now()
      });
      console.log('录制状态已设置');
    } catch (error) {
      console.error('设置录制状态失败:', error);
      return;
    }
  }
  
  // 测试截图
  const screenshotSuccess = await testScreenshot(tab);
  
  // 发送截图请求到background script
  console.log('测试通过background script截图...');
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'captureScreenshot',
      data: {
        x: 100,
        y: 100,
        url: tab.url,
        title: tab.title,
        element: { tagName: 'TEST', id: 'test', className: 'test' },
        text: '测试点击',
        timestamp: Date.now()
      }
    });
    console.log('Background截图响应:', response);
  } catch (error) {
    console.error('Background截图失败:', error);
  }
  
  console.log('=== 测试完成 ===');
}

// 执行测试
fullEndToEndTest();