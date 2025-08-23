
// 更新状态显示
function updateStatus(message) {
    document.getElementById('status').textContent = '状态: ' + message;
}

// 更新交互状态显示
function updateInteractionStatus(gesture) {
    document.getElementById('interactionStatus').textContent = `手势状态: ${gesture}`;
}

export { updateStatus, updateInteractionStatus };