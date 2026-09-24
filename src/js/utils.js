
// 更新状态显示
function updateStatus(message) {
    document.getElementById('status').textContent = '状态: ' + message;
}

// 更新交互状态显示
function updateInteractionStatus(gesture) {
    document.getElementById('interactionStatus').textContent = `手势状态: ${gesture}`;
}

// 更新手指数与字母映射结果
function updateRecognitionStatus(fingerCount, letter, details = {}) {
    const countElement = document.getElementById('fingerCount');
    const letterElement = document.getElementById('letterResult');
    const leftElement = document.getElementById('leftCount');
    const rightElement = document.getElementById('rightCount');
    const leftCodeElement = document.getElementById('leftCode');
    const rightCodeElement = document.getElementById('rightCode');
    const sumElement = document.getElementById('sumCount');
    const codeElement = document.getElementById('letterCode');
    if (countElement) countElement.textContent = String(fingerCount);
    if (letterElement) letterElement.textContent = letter;
    if (leftElement) leftElement.textContent = String(details.leftCount ?? 0);
    if (rightElement) rightElement.textContent = String(details.rightCount ?? 0);
    if (leftCodeElement) leftCodeElement.textContent = String(details.leftCount ?? 0);
    if (rightCodeElement) rightCodeElement.textContent = String(details.rightCount ?? 0);
    if (sumElement) sumElement.textContent = String(details.totalCount ?? fingerCount);
    if (codeElement) codeElement.textContent = String(details.code ?? 0);

    document.querySelectorAll('.alphabet-key').forEach(key => {
        key.classList.toggle('active', key.dataset.letter === letter);
    });
}

export { updateStatus, updateInteractionStatus, updateRecognitionStatus };
