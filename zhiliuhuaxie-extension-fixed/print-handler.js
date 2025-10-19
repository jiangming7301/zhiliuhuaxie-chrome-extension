// 打印处理脚本 - 避免CSP内联脚本问题
document.addEventListener('DOMContentLoaded', function() {
    // 为打印按钮添加事件监听器
    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.addEventListener('click', function() {
            window.print();
        });
    }
    
    // 自动触发打印对话框
    setTimeout(function() {
        window.print();
    }, 1000);
});