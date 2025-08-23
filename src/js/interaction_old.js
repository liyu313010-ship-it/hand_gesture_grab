let grabbedObject = null;
import { initSpeechSynthesis } from './voice.js';
let voice = initSpeechSynthesis();
// 更新交互
function updateInteraction(hand, canvas, currentGesture, handPosition) {
    // 将手部位置映射到交互区域
    const interactionArea = document.querySelector('.interaction-area');
    const rect = interactionArea.getBoundingClientRect();

    // 计算映射后的位置
    const mappedX = (handPosition.x / canvas.width) * rect.width;
    const mappedY = (handPosition.y / canvas.height) * rect.height;

    // 显示虚拟光标
    showCursor(interactionArea, mappedX, mappedY, currentGesture);

    // 处理抓取逻辑
    if (currentGesture === '抓取手势' && !grabbedObject) {
        // 尝试抓取物品
        tryGrabObject(mappedX, mappedY);
    } else if (currentGesture === '张开手势' && grabbedObject) {
        // 释放物品
        releaseObject();
    }

    // 移动已抓取的物品
    if (grabbedObject) {
        moveObject(mappedX, mappedY);
    }
}
// 显示虚拟光标
function showCursor(area, x, y, currentGesture) {
    // 移除旧的光标
    let cursor = document.getElementById('hand-cursor');

    if (!cursor) {
        // 创建新光标
        cursor = document.createElement('div');
        cursor.id = 'hand-cursor';
        cursor.style.position = 'absolute';
        cursor.style.width = '20px';
        cursor.style.height = '20px';
        cursor.style.borderRadius = '50%';
        cursor.style.background = currentGesture === '抓取手势' ? 'red' : 'green';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '10';
        cursor.style.transform = 'translate(-50%, -50%)';
        area.appendChild(cursor);
    }

    // 更新光标位置和颜色
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    cursor.style.background = currentGesture === '抓取手势' ? 'red' : 'green';
}
let timer = null
// 尝试抓取物品
function tryGrabObject(x, y) {
    const objects = document.querySelectorAll('.object');

    for (const obj of objects) {
        const rect = obj.getBoundingClientRect();
        const areaRect = document.querySelector('.interaction-area').getBoundingClientRect();

        // 计算物品在交互区域内的位置
        const objX = rect.left - areaRect.left + rect.width / 2;
        const objY = rect.top - areaRect.top + rect.height / 2;

        // 计算距离
        const distance = Math.sqrt(Math.pow(x - objX, 2) + Math.pow(y - objY, 2));

        // 如果距离足够近，则抓取物品
        if (distance < 50) {
            if(timer){
                clearTimeout(timer)
            }
            timer = setTimeout(() => {
                voice.synthesizeSpeechSentenceBySentence("抓取"+obj.innerHTML)
            }, 500)

            grabbedObject = obj;
            obj.classList.add('grabbing');
            break;
        }
    }
}

// 移动物品
function moveObject(x, y) {
    if (grabbedObject) {
        grabbedObject.style.left = x - grabbedObject.offsetWidth / 2 + 'px';
        grabbedObject.style.top = y - grabbedObject.offsetHeight / 2 + 'px';
    }
}

// 释放物品
function releaseObject() {
    if (grabbedObject) {
        grabbedObject.classList.remove('grabbing');
        grabbedObject = null;
    }
}

export { updateInteraction, grabbedObject };