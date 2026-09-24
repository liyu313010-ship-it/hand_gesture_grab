let grabbedObject = null;
import { initSpeechSynthesis } from './voice.js';
import candyReaction from '../../19套表情包素材/蹦蹦跳跳，开心.gif';
import giftReaction from '../../19套表情包素材/给你惊喜.gif';
import flowerReaction from '../../19套表情包素材/拿着花花，开心的手舞足蹈.gif';
import heartReaction from '../../19套表情包素材/开心，爱心包围.gif';
import headphoneReaction from '../../19套表情包素材/戴耳机，摇摆.gif';
import angelReaction from '../../19套表情包素材/变出一颗心.gif';
import celebrateReaction from '../../19套表情包素材/举高高.gif';
import magicReaction from '../../19套表情包素材/惊喜，滚球，变成心.gif';

let voice = initSpeechSynthesis();

const reactionImages = {
    '彩虹棒棒糖': candyReaction,
    '惊喜礼盒': giftReaction,
    '向日葵花束': flowerReaction,
    '爱心抱枕': heartReaction,
    '节拍耳机': headphoneReaction,
    '守护天使': angelReaction,
    '庆祝彩带': celebrateReaction,
    '魔法星星': magicReaction,
    '能量球': magicReaction,
    '珊瑚光球': magicReaction,
    '青空光球': magicReaction,
    '星云光球': magicReaction,
    '极光光球': magicReaction
};

// 抓取时的偏移量（记录光标与物品抓取点的偏移）
let grabOffset = { x: 0, y: 0 };

// 鼠标/触屏拖拽进行中的物品（null 表示当前没有指针拖拽）
let pointerDrag = null;
let ballPhysicsStarted = false;
let previousFrameTime = 0;
const ballStates = new Map();
const liveHandState = {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    gesture: '未检测到手势',
    updatedAt: 0
};

// 把物品抬到最上层，后触碰的收藏品始终显示在前面
function bringToFront(object) {
    document.querySelectorAll('.grabbable').forEach((item) => {
        item.style.zIndex = '';
    });
    object.style.zIndex = '6';
}

function getActiveMode() {
    return document.body.dataset.mode || 'letters';
}

function removeCursor() {
    document.getElementById('hand-cursor')?.remove();
}

function getInteractionArea(mode = getActiveMode()) {
    return mode === 'ball'
        ? document.querySelector('.video-container')
        : document.querySelector('.interaction-area');
}

function ballColor(ball) {
    return getComputedStyle(ball).getPropertyValue('--ball-main').trim() || '#ffffff';
}

function createSoftParticles(ball, type = 'release', amount = 13) {
    if (!ball?.classList.contains('video-gesture-ball')) return;
    const layer = document.querySelector('.ball-particle-layer');
    const area = ball.closest('.video-container');
    if (!layer || !area) return;

    const centerX = ball.offsetLeft + ball.offsetWidth / 2;
    const centerY = ball.offsetTop + ball.offsetHeight / 2;
    const color = ballColor(ball);
    for (let index = 0; index < amount; index += 1) {
        const particle = document.createElement('i');
        const angle = (Math.PI * 2 * index) / amount + Math.random() * .35;
        const distance = 30 + Math.random() * (type === 'hit' ? 58 : 42);
        particle.className = `soft-particle${type === 'grab' ? ' is-grab' : ''}`;
        particle.style.left = `${centerX}px`;
        particle.style.top = `${centerY}px`;
        particle.style.setProperty('--particle-x', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--particle-y', `${Math.sin(angle) * distance}px`);
        particle.style.setProperty('--particle-size', `${4 + Math.random() * 7}px`);
        particle.style.setProperty('--particle-color', color);
        layer.appendChild(particle);
        particle.addEventListener('animationend', () => particle.remove(), { once: true });
    }
}

function pulseBall(ball, className = 'ball-bounce') {
    ball.classList.remove(className);
    void ball.offsetWidth;
    ball.classList.add(className);
    window.setTimeout(() => ball.classList.remove(className), 360);
}

function syncLiveHand(x, y, gesture) {
    const now = performance.now();
    const elapsed = Math.max((now - liveHandState.updatedAt) / 1000, .016);
    if (liveHandState.updatedAt > 0 && elapsed < .18) {
        const smoothing = .42;
        liveHandState.vx = liveHandState.vx * (1 - smoothing) + ((x - liveHandState.x) / elapsed) * smoothing;
        liveHandState.vy = liveHandState.vy * (1 - smoothing) + ((y - liveHandState.y) / elapsed) * smoothing;
    } else {
        liveHandState.vx = 0;
        liveHandState.vy = 0;
    }
    liveHandState.active = true;
    liveHandState.x = x;
    liveHandState.y = y;
    liveHandState.gesture = gesture;
    liveHandState.updatedAt = now;
}

function applyImmediateHandHit() {
    if (liveHandState.gesture !== '张开手势') return;
    const speed = Math.hypot(liveHandState.vx, liveHandState.vy);
    if (speed < 180) return;
    const now = performance.now();
    document.querySelectorAll('.video-gesture-ball').forEach((ball) => {
        if (ball.classList.contains('grabbing')) return;
        const state = ballStates.get(ball);
        if (!state || now - state.lastHit < 160) return;
        const radius = ball.offsetWidth / 2;
        // 使用当前绘制位置做命中检测，避免物理状态与像素取整产生偏差。
        const dx = ball.offsetLeft + radius - liveHandState.x;
        const dy = ball.offsetTop + radius - liveHandState.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance > radius + 72) return;
        const nx = dx / distance;
        const ny = dy / distance;
        const strength = Math.min(440, Math.max(155, speed * .7));
        state.vx += nx * strength + liveHandState.vx * .5;
        state.vy += ny * strength + liveHandState.vy * .5;
        state.lastHit = now;
        pulseBall(ball);
        createSoftParticles(ball, 'hit', 9);
    });
}

function initialiseBallState(ball, index, area, force = false) {
    let state = ballStates.get(ball);
    if (state && !force) return state;
    const size = ball.offsetWidth || 80;
    const spawn = Number(ball.dataset.spawn ?? .5);
    state = {
        x: Math.max(0, Math.min(area.clientWidth - size, spawn * area.clientWidth - size / 2)),
        y: -size - index * 68,
        vx: (index % 2 ? -1 : 1) * (24 + index * 7),
        vy: 28 + index * 12,
        lastHit: 0
    };
    ballStates.set(ball, state);
    ball.style.left = `${state.x}px`;
    ball.style.top = `${state.y}px`;
    return state;
}

function resolveBallCollisions(balls) {
    for (let firstIndex = 0; firstIndex < balls.length; firstIndex += 1) {
        const first = balls[firstIndex];
        if (first.classList.contains('grabbing')) continue;
        const firstState = ballStates.get(first);
        for (let secondIndex = firstIndex + 1; secondIndex < balls.length; secondIndex += 1) {
            const second = balls[secondIndex];
            if (second.classList.contains('grabbing')) continue;
            const secondState = ballStates.get(second);
            const firstRadius = first.offsetWidth / 2;
            const secondRadius = second.offsetWidth / 2;
            const dx = secondState.x + secondRadius - firstState.x - firstRadius;
            const dy = secondState.y + secondRadius - firstState.y - firstRadius;
            const distance = Math.hypot(dx, dy) || 1;
            const minimumDistance = firstRadius + secondRadius;
            if (distance >= minimumDistance) continue;

            const nx = dx / distance;
            const ny = dy / distance;
            const overlap = minimumDistance - distance;
            firstState.x -= nx * overlap / 2;
            firstState.y -= ny * overlap / 2;
            secondState.x += nx * overlap / 2;
            secondState.y += ny * overlap / 2;
            const relativeVelocity = (secondState.vx - firstState.vx) * nx + (secondState.vy - firstState.vy) * ny;
            if (relativeVelocity < 0) {
                const impulse = -relativeVelocity * .88;
                firstState.vx -= impulse * nx;
                firstState.vy -= impulse * ny;
                secondState.vx += impulse * nx;
                secondState.vy += impulse * ny;
            }
        }
    }
}

function animateVideoBalls(frameTime) {
    const elapsed = Math.min((frameTime - previousFrameTime) / 1000 || .016, .034);
    previousFrameTime = frameTime;
    const area = document.querySelector('.video-container');
    const balls = [...document.querySelectorAll('.video-gesture-ball')];
    const active = getActiveMode() === 'ball' && area;

    if (active) {
        const handIsLive = liveHandState.active && frameTime - liveHandState.updatedAt < 180;
        balls.forEach((ball, index) => {
            const state = initialiseBallState(ball, index, area);
            const size = ball.offsetWidth;
            if (ball.classList.contains('grabbing')) {
                state.x = ball.offsetLeft;
                state.y = ball.offsetTop;
                state.vx = liveHandState.vx * .25;
                state.vy = liveHandState.vy * .25;
                return;
            }

            state.vy = Math.min(state.vy + 285 * elapsed, 310);

            if (handIsLive && liveHandState.gesture === '张开手势') {
                const ballX = state.x + size / 2;
                const ballY = state.y + size / 2;
                const dx = ballX - liveHandState.x;
                const dy = ballY - liveHandState.y;
                const distance = Math.hypot(dx, dy) || 1;
                const collisionDistance = size / 2 + 42;
                if (distance < collisionDistance) {
                    const handSpeed = Math.hypot(liveHandState.vx, liveHandState.vy);
                    const palmBelowBall = liveHandState.y > ballY - size * .12 && Math.abs(dx) < size * .75;
                    if (palmBelowBall && handSpeed < 420) {
                        // 手掌在球下方时形成柔软托举面，向上移动手掌即可把球托起。
                        state.y = Math.min(state.y, liveHandState.y - size - 8);
                        state.vy = Math.min(liveHandState.vy * .72, 18);
                        state.vx += liveHandState.vx * elapsed * 1.8;
                    } else if (frameTime - state.lastHit > 150) {
                        // 快速扫过球体视作拍击，手速越快，球获得的弹性冲量越大。
                        const nx = dx / distance;
                        const ny = dy / distance;
                        const strength = Math.min(430, Math.max(145, handSpeed * .72));
                        state.vx += nx * strength + liveHandState.vx * .48;
                        state.vy += ny * strength + liveHandState.vy * .48;
                        state.lastHit = frameTime;
                        pulseBall(ball);
                        createSoftParticles(ball, 'hit', 9);
                    }
                }
            }

            state.x += state.vx * elapsed;
            state.y += state.vy * elapsed;
            const maxX = Math.max(0, area.clientWidth - size);
            const maxY = Math.max(0, area.clientHeight - size);
            if (state.x <= 0 || state.x >= maxX) {
                state.x = Math.max(0, Math.min(state.x, maxX));
                state.vx *= -.76;
                pulseBall(ball);
            }
            if (state.y >= maxY) {
                state.y = maxY;
                state.vy = -Math.max(105, Math.abs(state.vy) * .68);
                state.vx *= .985;
                pulseBall(ball);
            }
            ball.style.left = `${state.x}px`;
            ball.style.top = `${state.y}px`;
        });

        resolveBallCollisions(balls);
        balls.forEach((ball) => {
            if (ball.classList.contains('grabbing')) return;
            const state = ballStates.get(ball);
            ball.style.left = `${state.x}px`;
            ball.style.top = `${state.y}px`;
        });
    }
    requestAnimationFrame(animateVideoBalls);
}

function resetVideoBalls() {
    const area = document.querySelector('.video-container');
    if (!area) return;
    [...document.querySelectorAll('.video-gesture-ball')].forEach((ball, index) => {
        initialiseBallState(ball, index, area, true);
    });
    if (!ballPhysicsStarted) {
        ballPhysicsStarted = true;
        previousFrameTime = performance.now();
        requestAnimationFrame(animateVideoBalls);
    }
}

// 更新交互
function updateInteraction(hand, canvas, currentGesture, handPosition) {
    const activeMode = getActiveMode();
    if (activeMode === 'letters') {
        removeCursor();
        releaseObject();
        return;
    }

    // 将手部位置映射到交互区域
    const interactionArea = getInteractionArea(activeMode);
    if (!interactionArea) return;
    const rect = interactionArea.getBoundingClientRect();

    // 计算映射后的位置 1:1映射
    const mappedX = (handPosition.x / canvas.width) * rect.width;
    const mappedY = (handPosition.y / canvas.height) * rect.height;

    if (activeMode === 'ball') {
        syncLiveHand(mappedX, mappedY, currentGesture);
        applyImmediateHandHit();
    }

    // 显示虚拟光标
    showCursor(interactionArea, mappedX, mappedY, currentGesture);

    // 鼠标正在拖拽时暂停手势对物品的操控，避免两边同时抢夺收藏品
    if (pointerDrag) return;

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

let timer = null;
let reactionTimer = null;

function showReaction(object) {
    const popup = document.getElementById('reactionPopup');
    const image = document.getElementById('reactionImage');
    const text = document.getElementById('reactionText');
    const objectName = object.dataset.name || '收藏品';

    if (!popup || !image || !text) return;
    image.src = reactionImages[objectName] || object.querySelector('img')?.src || '';
    text.textContent = `已抓取 · ${objectName}`;
    popup.setAttribute('aria-hidden', 'false');
    popup.classList.remove('show');
    void popup.offsetWidth;
    popup.classList.add('show');

    if (reactionTimer) clearTimeout(reactionTimer);
    reactionTimer = setTimeout(() => {
        popup.classList.remove('show');
        popup.setAttribute('aria-hidden', 'true');
    }, 1800);
}

// 尝试抓取物品
function tryGrabObject(cursorX, cursorY) {
    const activeMode = getActiveMode();
    const objects = activeMode === 'ball'
        ? document.querySelectorAll('.video-gesture-ball')
        : document.querySelectorAll('.mode-layer.active .grabbable');
    const interactionArea = getInteractionArea(activeMode);
    if (!interactionArea) return;

    for (const obj of objects) {
        // 获取物品的当前位置（相对于交互区域）
        const objRect = obj.getBoundingClientRect();
        const areaRect = interactionArea.getBoundingClientRect();
        
        const objLeft = objRect.left - areaRect.left;
        const objTop = objRect.top - areaRect.top;
        const objCenterX = objLeft + objRect.width / 2;
        const objCenterY = objTop + objRect.height / 2;

        // 计算距离（从光标到物品中心）
        const distance = Math.sqrt(
            Math.pow(cursorX - objCenterX, 2) + 
            Math.pow(cursorY - objCenterY, 2)
        );

        // 如果距离足够近，则抓取物品
        const grabRadius = obj.classList.contains('gesture-ball') ? objRect.width * .58 : 50;
        if (distance < grabRadius) {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                voice.synthesizeSpeechSentenceBySentence("抓取" + (obj.dataset.name || '收藏品'));
            }, 500);

            // 正确计算偏移量：光标位置 - 物品当前位置
            grabOffset = {
                x: cursorX - objLeft,
                y: cursorY - objTop
            };

            grabbedObject = obj;
            bringToFront(obj);
            obj.classList.add('grabbing');
            createSoftParticles(obj, 'grab');
            showReaction(obj);
            break;
        }
    }
}

// 移动物品（手势抓取）
function moveObject(cursorX, cursorY) {
    if (grabbedObject) {
        // 根据偏移量计算物品的新位置
        moveObjectTo(grabbedObject, cursorX - grabOffset.x, cursorY - grabOffset.y);
    }
}

// 把物品移动到指定位置，并确保不超出交互区域
function moveObjectTo(element, left, top) {
    const interactionArea = element.closest('.video-container') || document.querySelector('.interaction-area');
    // 物品的 left/top 相对内容盒定位，用 clientWidth/clientHeight 扣掉边框，避免贴边时压线。
    const maxX = interactionArea.clientWidth - element.offsetWidth;
    const maxY = interactionArea.clientHeight - element.offsetHeight;

    element.style.left = Math.max(0, Math.min(left, maxX)) + 'px';
    element.style.top = Math.max(0, Math.min(top, maxY)) + 'px';
}

// —— 鼠标/触屏拖拽：不依赖摄像头即可自由布置收藏品，与手势抓取互不干扰。 ——
function beginPointerDrag(event) {
    if (pointerDrag) return;
    const object = event.target.closest('.grabbable');
    const validTarget = object?.classList.contains('video-gesture-ball')
        ? getActiveMode() === 'ball'
        : Boolean(object?.closest('.mode-layer.active'));
    if (!object || !validTarget) return;

    // 鼠标接管前先释放手势正抓着的物品，避免两边同时操控同一个收藏品
    releaseObject();

    const area = object.closest('.video-container') || document.querySelector('.interaction-area');
    const areaRect = area.getBoundingClientRect();
    pointerDrag = {
        element: object,
        area,
        offsetX: event.clientX - areaRect.left - object.offsetLeft,
        offsetY: event.clientY - areaRect.top - object.offsetTop
    };
    bringToFront(object);
    object.classList.add('grabbing');
    object.setPointerCapture?.(event.pointerId);
    event.preventDefault();
}

function movePointerDrag(event) {
    if (!pointerDrag) return;

    // 鼠标按键已松开（如在窗口外释放）时直接结束拖拽
    if (event.pointerType === 'mouse' && event.buttons === 0) {
        endPointerDrag(event);
        return;
    }

    const areaRect = pointerDrag.area.getBoundingClientRect();
    moveObjectTo(
        pointerDrag.element,
        event.clientX - areaRect.left - pointerDrag.offsetX,
        event.clientY - areaRect.top - pointerDrag.offsetY
    );
}

function endPointerDrag(event) {
    if (!pointerDrag) return;

    const { element } = pointerDrag;
    element.classList.remove('grabbing');
    createSoftParticles(element, 'release');
    const pointerId = event?.pointerId;
    if (typeof pointerId === 'number' && element.hasPointerCapture?.(pointerId)) {
        element.releasePointerCapture(pointerId);
    }
    pointerDrag = null;
}

function initPointerDragging() {
    const interactionAreas = document.querySelectorAll('.interaction-area, .video-container');
    interactionAreas.forEach((interactionArea) => {
        interactionArea.addEventListener('pointerdown', beginPointerDrag);
        interactionArea.addEventListener('pointermove', movePointerDrag);
        interactionArea.addEventListener('pointerup', endPointerDrag);
        interactionArea.addEventListener('pointercancel', endPointerDrag);
    });
    window.addEventListener('blur', endPointerDrag);
}

// 模块脚本在 DOM 解析完成后执行，这里再兜底判断一次
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPointerDragging);
} else {
    initPointerDragging();
}

// 释放物品
function releaseObject() {
    if (grabbedObject) {
        const releasedObject = grabbedObject;
        grabbedObject.classList.remove('grabbing');
        grabbedObject = null;
        createSoftParticles(releasedObject, 'release');
        // 重置偏移量
        grabOffset = { x: 0, y: 0 };
    }
}

function resetInteraction() {
    releaseObject();
    endPointerDrag();
    removeCursor();
    liveHandState.active = false;
}

export { updateInteraction, resetInteraction, resetVideoBalls, grabbedObject };
