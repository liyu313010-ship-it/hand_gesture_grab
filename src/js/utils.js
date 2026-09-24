
// 记录上一次写入的文本；这些函数在检测循环中每帧调用，值未变化时跳过 DOM 写入，
// 避免每秒数十次无谓的样式重算（值抖动时的视觉闪烁也随写入次数一起减少）。
let lastStatusText = '';

// 更新状态显示
function updateStatus(message) {
    const text = '状态: ' + message;
    if (text === lastStatusText) return;
    lastStatusText = text;
    document.getElementById('status').textContent = text;
}

let lastInteractionText = '';

// 更新交互状态显示
function updateInteractionStatus(gesture) {
    const text = `手势状态: ${gesture}`;
    if (text === lastInteractionText) return;
    lastInteractionText = text;
    document.getElementById('interactionStatus').textContent = text;
}

let lastRecognitionSignature = '';

// 更新手指数与字母映射结果
function updateRecognitionStatus(fingerCount, letter, details = {}) {
    const paired = Boolean(details.paired);
    const soloCount = (details.leftCount ?? 0) + (details.rightCount ?? 0);
    // 所有展示值都包含在签名里，签名不变说明界面无需更新，直接返回。
    const signature = [
        fingerCount,
        letter,
        details.leftCount ?? 0,
        details.rightCount ?? 0,
        paired,
        soloCount,
        details.totalCount ?? fingerCount,
        details.code ?? 0
    ].join('|');
    if (signature === lastRecognitionSignature) return;
    lastRecognitionSignature = signature;

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
