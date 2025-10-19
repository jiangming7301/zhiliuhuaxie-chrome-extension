// Chrome Web Store 提交问题诊断脚本
// 在Chrome Web Store开发者控制台页面运行此脚本来诊断问题

console.log('=== Chrome Web Store 提交问题诊断 ===');

// 检查页面必填字段
function checkRequiredFields() {
    console.log('\n1. 检查必填字段...');
    
    // 检查应用名称
    const appName = document.querySelector('input[aria-label*="名称"], input[placeholder*="名称"]');
    if (appName && appName.value) {
        console.log('✅ 应用名称已填写:', appName.value);
    } else {
        console.log('❌ 应用名称未填写');
    }
    
    // 检查描述
    const description = document.querySelector('textarea[aria-label*="描述"], textarea[placeholder*="描述"]');
    if (description && description.value && description.value.length > 50) {
        console.log('✅ 应用描述已填写，长度:', description.value.length);
    } else {
        console.log('❌ 应用描述未填写或过短');
    }
    
    // 检查类别
    const category = document.querySelector('select[aria-label*="类别"], [data-value*="category"]');
    if (category) {
        console.log('✅ 类别选择器找到');
    } else {
        console.log('❌ 未找到类别选择器');
    }
}

// 检查隐私政策
function checkPrivacyPolicy() {
    console.log('\n2. 检查隐私政策...');
    
    // 检查隐私政策URL
    const privacyUrl = document.querySelector('input[placeholder*="隐私"], input[aria-label*="隐私"]');
    if (privacyUrl && privacyUrl.value) {
        console.log('✅ 隐私政策URL已填写:', privacyUrl.value);
        
        // 验证URL是否可访问
        fetch(privacyUrl.value)
            .then(response => {
                if (response.ok) {
                    console.log('✅ 隐私政策URL可访问');
                } else {
                    console.log('❌ 隐私政策URL无法访问，状态码:', response.status);
                }
            })
            .catch(error => {
                console.log('❌ 隐私政策URL验证失败:', error.message);
            });
    } else {
        console.log('❌ 隐私政策URL未填写');
    }
}

// 检查权限说明
function checkPermissions() {
    console.log('\n3. 检查权限说明...');
    
    // 查找权限相关的文本框
    const permissionTexts = document.querySelectorAll('textarea[aria-label*="权限"], textarea[placeholder*="用途"]');
    console.log('找到权限说明框数量:', permissionTexts.length);
    
    permissionTexts.forEach((textarea, index) => {
        if (textarea.value && textarea.value.length > 10) {
            console.log(`✅ 权限说明 ${index + 1} 已填写，长度:`, textarea.value.length);
        } else {
            console.log(`❌ 权限说明 ${index + 1} 未填写或过短`);
        }
    });
}

// 检查开发者信息
function checkDeveloperInfo() {
    console.log('\n4. 检查开发者信息...');
    
    // 检查邮箱
    const email = document.querySelector('input[type="email"], input[aria-label*="邮箱"]');
    if (email && email.value && email.value.includes('@')) {
        console.log('✅ 开发者邮箱已填写:', email.value);
    } else {
        console.log('❌ 开发者邮箱未填写或格式不正确');
    }
    
    // 检查网站
    const website = document.querySelector('input[placeholder*="网站"], input[aria-label*="网站"]');
    if (website && website.value) {
        console.log('✅ 官方网站已填写:', website.value);
    } else {
        console.log('❌ 官方网站未填写');
    }
}

// 检查提交按钮状态
function checkSubmitButton() {
    console.log('\n5. 检查提交按钮状态...');
    
    const submitButtons = document.querySelectorAll(
        'button[aria-label*="提交"], button[aria-label*="submit"], ' +
        'button:contains("提交审核"), button:contains("Submit for review"), ' +
        '[data-action*="submit"], .submit-button'
    );
    
    console.log('找到可能的提交按钮数量:', submitButtons.length);
    
    submitButtons.forEach((button, index) => {
        const isDisabled = button.disabled || button.classList.contains('disabled') || 
                          button.getAttribute('aria-disabled') === 'true';
        
        console.log(`按钮 ${index + 1}:`, {
            text: button.textContent.trim(),
            disabled: isDisabled,
            classes: button.className
        });
    });
}

// 检查错误信息
function checkErrors() {
    console.log('\n6. 检查页面错误信息...');
    
    // 查找错误信息
    const errors = document.querySelectorAll(
        '.error, .error-message, [role="alert"], .warning, ' +
        '[class*="error"], [class*="warning"], [aria-live="polite"]'
    );
    
    if (errors.length > 0) {
        console.log('❌ 发现错误信息:');
        errors.forEach((error, index) => {
            if (error.textContent.trim()) {
                console.log(`错误 ${index + 1}:`, error.textContent.trim());
            }
        });
    } else {
        console.log('✅ 未发现明显的错误信息');
    }
}

// 运行所有检查
function runDiagnostics() {
    try {
        checkRequiredFields();
        checkPrivacyPolicy();
        checkPermissions();
        checkDeveloperInfo();
        checkSubmitButton();
        checkErrors();
        
        console.log('\n=== 诊断完成 ===');
        console.log('如果发现问题，请根据提示修复后重试。');
        console.log('如果所有检查都通过但仍无法提交，请尝试刷新页面或清除浏览器缓存。');
        
    } catch (error) {
        console.error('诊断过程中出现错误:', error);
    }
}

// 开始诊断
runDiagnostics();

// 提供手动检查建议
console.log('\n=== 手动检查建议 ===');
console.log('1. 确保所有必填字段都已填写完整');
console.log('2. 检查隐私政策URL是否可正常访问');
console.log('3. 确认每个权限都有详细的用途说明');
console.log('4. 验证开发者联系信息的准确性');
console.log('5. 检查是否有红色错误提示信息');
console.log('6. 尝试保存草稿后重新进入编辑页面');