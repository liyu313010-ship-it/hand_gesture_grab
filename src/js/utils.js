
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
    const operatorElement = document.getElementById('codeOperator');
    const sumElement = document.getElementById('sumCount');
    const codeElement = document.getElementById('letterCode');
    const modeLetterElement = document.getElementById('modeLetterResult');
    const modeCodeElement = document.getElementById('modeCodeResult');
    if (countElement) countElement.textContent = String(fingerCount);
    if (letterElement) letterElement.textContent = letter;
    if (leftElement) leftElement.textContent = String(details.leftCount ?? 0);
    if (rightElement) rightElement.textContent = String(details.rightCount ?? 0);

    // 字母编码行：两侧都有手指数时展示“2 与 3 → 23”，否则只展示单侧数字“3 → 3”。
    const paired = Boolean(details.paired);
    const soloCount = (details.leftCount ?? 0) + (details.rightCount ?? 0);
    if (leftCodeElement) leftCodeElement.textContent = String(paired ? details.leftCount ?? 0 : soloCount);
    if (rightCodeElement) rightCodeElement.textContent = paired ? String(details.rightCount ?? 0) : '';
    if (operatorElement) operatorElement.textContent = paired ? '与' : '';
    if (sumElement) sumElement.textContent = String(details.totalCount ?? fingerCount);
    if (codeElement) codeElement.textContent = String(details.code ?? 0);
    if (modeLetterElement) modeLetterElement.textContent = letter;
    if (modeCodeElement) modeCodeElement.textContent = String(details.code ?? fingerCount);

    document.querySelectorAll('.alphabet-key').forEach(key => {
        key.classList.toggle('active', key.dataset.letter === letter);
    });
}

export { updateStatus, updateInteractionStatus, updateRecognitionStatus };
