let grabbedObject = null;
import { initSpeechSynthesis } from './voice.js';
import { isCameraOn } from './camera.js';
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
    '魔法星星': magicReaction
};

// 飘落球内素材池：把“19套表情包素材”与“静态素材图片”里的全部素材都纳入轮换，
// 保证飘落出现的是全部素材而不是固定几个。
const ballAssetModules = import.meta.glob('../../19套表情包素材/*.gif', { eager: true, query: '?url', import: 'default' });
const ballStaticModules = import.meta.glob('../../静态素材图片/*.png', { eager: true, query: '?url', import: 'default' });
const ballAssetPool = [...Object.entries(ballAssetModules), ...Object.entries(ballStaticModules)]
    .map(([path, url]) => ({
        url,
        name: path.split('/').pop().replace(/\.[^.]+$/, '')
    }));

// 每轮把全部素材洗牌后排入队列逐个取用，一轮用完后重新洗牌，长期累计可覆盖所有素材。
let ballAssetQueue = [];
function takeBallAsset() {
    if (!ballAssetPool.length) return null;
    if (!ballAssetQueue.length) {
        ballAssetQueue = ballAssetPool.map((_, index) => index);
        for (let index = ballAssetQueue.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.random() * (index + 1));
            [ballAssetQueue[index], ballAssetQueue[swap]] = [ballAssetQueue[swap], ballAssetQueue[index]];
        }
    }
    return ballAssetPool[ballAssetQueue.pop()];
}

// 五颜六色的毛玻璃球体配色：每次飘落重生都为球随机换一种玻璃颜色。
const BALL_PALETTE = [
    { tint: 'rgba(255, 94, 90, .5)', glow: 'rgba(255, 83, 105, .5)', solid: '#ff5e5a' },
    { tint: 'rgba(45, 206, 235, .5)', glow: 'rgba(38, 221, 239, .48)', solid: '#2dceeb' },
    { tint: 'rgba(170, 105, 255, .5)', glow: 'rgba(166, 91, 255, .5)', solid: '#aa69ff' },
    { tint: 'rgba(150, 225, 95, .5)', glow: 'rgba(123, 226, 92, .46)', solid: '#96e15f' },
    { tint: 'rgba(255, 196, 84, .52)', glow: 'rgba(255, 190, 70, .48)', solid: '#ffc454' },
    { tint: 'rgba(255, 118, 212, .5)', glow: 'rgba(255, 105, 215, .48)', solid: '#ff76d4' },
    { tint: 'rgba(96, 158, 255, .5)', glow: 'rgba(80, 150, 255, .48)', solid: '#609eff' },
    { tint: 'rgba(94, 226, 178, .5)', glow: 'rgba(94, 227, 171, .46)', solid: '#5ee2b2' },
    { tint: 'rgba(255, 146, 70, .5)', glow: 'rgba(255, 140, 60, .48)', solid: '#ff9246' }
];

// 六种数字材质共享同一套手势，但拥有不同重力、阻尼、弹性与特殊行为。
const BALL_MATERIALS = [
    { id: 'water', label: '水球', gravity: .72, drag: .986, bounce: .62, merge: true },
    { id: 'gel', label: '果冻', gravity: .82, drag: .978, bounce: .84, merge: true },
    { id: 'glass', label: '玻璃', gravity: 1.08, drag: .995, bounce: .94, brittle: true },
    { id: 'fire', label: '火焰', gravity: .28, drag: .991, bounce: .7, buoyant: true },
    { id: 'magnet', label: '磁力', gravity: .74, drag: .988, bounce: .8, magnetic: true },
    { id: 'bubble', label: '泡泡', gravity: .16, drag: .972, bounce: .9, merge: true }
];
const MATERIAL_CLASS_NAMES = BALL_MATERIALS.map(material => `material-${material.id}`);
const BALL_MOODS = [
    { id: 'curious', label: '好奇' },
    { id: 'shy', label: '害羞' },
    { id: 'happy', label: '开心' },
    { id: 'calm', label: '平静' },
    { id: 'playful', label: '调皮' }
];
const MOOD_CLASS_NAMES = [...BALL_MOODS.map(mood => `mood-${mood.id}`), 'mood-angry', 'mood-lonely'];

function materialById(id) {
    return BALL_MATERIALS.find(material => material.id === id) || BALL_MATERIALS[0];
}

function moodLabel(id) {
    return BALL_MOODS.find(mood => mood.id === id)?.label || ({ angry: '生气', lonely: '孤独' }[id] ?? '平静');
}

function setBallMood(ball, state, mood) {
    ball.classList.remove(...MOOD_CLASS_NAMES);
    ball.classList.add(`mood-${mood}`);
    ball.dataset.mood = mood;
    if (state) state.mood = mood;
    const badge = ball.querySelector('.ball-material-tag');
    if (badge) badge.textContent = `${ball.dataset.materialLabel || '球体'} · ${moodLabel(mood)}`;
}

// 球体外观刷新：换上一张新素材、换一种玻璃颜色与随机大小；素材名写入 alt / title 便于识别。
function applyBallLook(ball) {
    const asset = takeBallAsset();
    const image = ball.querySelector('.ball-asset');
    if (image && asset) {
        image.src = asset.url;
        image.alt = asset.name;
        image.title = asset.name;
    }
    // 球体大小每次刷洗都随机（画面里的球有大有小），素材显示比例随之变化（有的放大有的缩小），
    // 占比贴近球径，使素材最长边尽量贴着球体边缘。
    ball.style.setProperty('--ball-size', `${58 + Math.random() * 34}px`);
    ball.style.setProperty('--asset-scale', `${62 + Math.random() * 18}%`);
    let paletteIndex = Math.floor(Math.random() * BALL_PALETTE.length);
    if (String(paletteIndex) === ball.dataset.paletteIndex) {
        paletteIndex = (paletteIndex + 1) % BALL_PALETTE.length;
    }
    ball.dataset.paletteIndex = String(paletteIndex);
    ball.style.setProperty('--ball-tint', BALL_PALETTE[paletteIndex].tint);
    ball.style.setProperty('--ball-glow', BALL_PALETTE[paletteIndex].glow);
    ball.style.setProperty('--ball-solid', BALL_PALETTE[paletteIndex].solid);
    const previousMaterial = ball.dataset.material;
    let material = BALL_MATERIALS[Math.floor(Math.random() * BALL_MATERIALS.length)];
    if (material.id === previousMaterial) {
        material = BALL_MATERIALS[(BALL_MATERIALS.indexOf(material) + 1) % BALL_MATERIALS.length];
    }
    ball.classList.remove(...MATERIAL_CLASS_NAMES);
    ball.classList.add(`material-${material.id}`);
    ball.dataset.material = material.id;
    ball.dataset.materialLabel = material.label;
    let badge = ball.querySelector('.ball-material-tag');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ball-material-tag';
        ball.appendChild(badge);
    }
    const mood = BALL_MOODS[Math.floor(Math.random() * BALL_MOODS.length)];
    setBallMood(ball, null, mood.id);
}

// 指尖向上戳的判定速度（px/s，屏幕坐标向上为负），达到即触发球体爆裂。
const EXPLODE_UPWARD_SPEED = 150;
// 爆裂粒子的多彩配色。
const BURST_COLORS = ['#ff5e5a', '#ffc857', '#2dceeb', '#aa69ff', '#96e15f', '#ff76d4', '#609eff', '#5ee2b2'];

// 抓取时的偏移量（记录光标与物品抓取点的偏移）
let grabOffset = { x: 0, y: 0 };

// 鼠标/触屏拖拽进行中的物品（null 表示当前没有指针拖拽）
let pointerDrag = null;
let ballPhysicsStarted = false;
let previousFrameTime = 0;
let twoHandStretch = null;
let airScore = 0;
const ballStates = new Map();
const liveHandState = {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    points: [],
    angle: 0,
    angularVelocity: 0,
    spread: 1,
    tilt: 0,
    gesture: '未检测到手势',
    updatedAt: 0
};
const dualHandState = {
    active: false,
    left: null,
    right: null,
    midpoint: null,
    distance: 0,
    distanceVelocity: 0,
    portalActive: false,
    updatedAt: 0
};
const liveBodyState = { segments: [], updatedAt: 0 };
let fingerPath = [];
let lastPathParticleAt = 0;
let pathOrbit = null;

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
    // 专用实色变量，供粒子、拖尾与冲击环使用，避免读取半透明的玻璃色。
    return getComputedStyle(ball).getPropertyValue('--ball-solid').trim() || '#ffffff';
}

// 记录上一次写入的 HUD 文本；物理循环每帧都会调用本函数，值未变化时跳过 DOM 写入。
let lastHudGestureText = '';
let lastHudScoreText = '';
let lastFieldText = '';
let lastMaterialText = '';

function updateAirHud(gesture) {
    const gestureElement = document.getElementById('airGesture');
    const scoreElement = document.getElementById('airScore');
    const labels = {
        '抓取手势': '捏合控制 · 可移动抛出',
        '张开手势': '张掌控制 · 托举或拍击',
        '握拳吸引': '引力场开启 · 隔空吸引',
        '指尖点按': '食指控制 · 轻触弹开'
    };
    const gestureText = labels[gesture] || gesture || '等待手势';
    if (gestureElement && gestureText !== lastHudGestureText) {
        gestureElement.textContent = gestureText;
        lastHudGestureText = gestureText;
    }
    const scoreText = String(airScore);
    if (scoreElement && scoreText !== lastHudScoreText) {
        scoreElement.textContent = scoreText;
        lastHudScoreText = scoreText;
    }
}

function updateFieldHud(text, materialText) {
    const field = document.getElementById('fieldMode');
    const material = document.getElementById('materialMode');
    if (field && text && text !== lastFieldText) {
        field.textContent = `力场：${text}`;
        lastFieldText = text;
    }
    if (material && materialText && materialText !== lastMaterialText) {
        material.textContent = `材质：${materialText}`;
        lastMaterialText = materialText;
    }
}

function mapPointToArea(point, canvas, areaRect) {
    if (getActiveMode() === 'ball' && canvas.width && canvas.height) {
        // 球体竖屏使用 object-fit: cover：横屏摄像头只裁左右两侧，竖向人物画面保持完整。
        // 这里复现 cover 的缩放与负偏移，保证裁切后画面里的手和虚拟光标仍严格重合。
        const mediaAspect = canvas.width / canvas.height;
        const areaAspect = areaRect.width / areaRect.height;
        let drawWidth;
        let drawHeight;
        let offsetX = 0;
        let offsetY = 0;
        if (mediaAspect > areaAspect) {
            drawHeight = areaRect.height;
            drawWidth = drawHeight * mediaAspect;
            offsetX = (areaRect.width - drawWidth) / 2;
        } else {
            drawWidth = areaRect.width;
            drawHeight = areaRect.width / mediaAspect;
            offsetY = (areaRect.height - drawHeight) / 2;
        }
        return {
            x: offsetX + (point.x / canvas.width) * drawWidth,
            y: offsetY + (point.y / canvas.height) * drawHeight
        };
    }
    return {
        x: (point.x / canvas.width) * areaRect.width,
        y: (point.y / canvas.height) * areaRect.height
    };
}

const BODY_SEGMENT_NAMES = [
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'], ['right_hip', 'right_knee']
];

function renderBodyColliders(segments) {
    const layer = document.querySelector('.ball-particle-layer');
    if (!layer) return;
    let lines = [...layer.querySelectorAll('.body-collider-line')];
    while (lines.length < segments.length) {
        const line = document.createElement('i');
        line.className = 'body-collider-line';
        layer.appendChild(line);
        lines.push(line);
    }
    lines.forEach((line, index) => {
        const segment = segments[index];
        if (!segment) {
            line.hidden = true;
            return;
        }
        line.hidden = false;
        const dx = segment.b.x - segment.a.x;
        const dy = segment.b.y - segment.a.y;
        line.style.left = `${segment.a.x}px`;
        line.style.top = `${segment.a.y}px`;
        line.style.width = `${Math.hypot(dx, dy)}px`;
        line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    });
}

function updateBodyPose(pose, canvas) {
    if (getActiveMode() !== 'ball') return;
    const area = document.querySelector('.video-container');
    if (!area || !pose?.keypoints) return;
    const rect = area.getBoundingClientRect();
    const points = new Map();
    pose.keypoints.forEach((point) => {
        if ((point.score ?? 1) < .38 || !point.name) return;
        points.set(point.name, mapPointToArea(point, canvas, rect));
    });
    liveBodyState.segments = BODY_SEGMENT_NAMES
        .map(([from, to]) => points.has(from) && points.has(to) ? { a: points.get(from), b: points.get(to) } : null)
        .filter(Boolean);
    liveBodyState.updatedAt = performance.now();
    renderBodyColliders(liveBodyState.segments);
}

function clearBodyPose() {
    liveBodyState.segments = [];
    document.querySelectorAll('.body-collider-line').forEach(line => { line.hidden = true; });
}

function closestPointOnSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    return { x: a.x + dx * t, y: a.y + dy * t, dx, dy };
}

function applyBodyCollision(state, size, frameTime) {
    if (frameTime - liveBodyState.updatedAt > 380) return;
    const center = { x: state.x + size / 2, y: state.y + size / 2 };
    const collisionDistance = size / 2 + 15;
    for (const segment of liveBodyState.segments) {
        const closest = closestPointOnSegment(center, segment.a, segment.b);
        const dx = center.x - closest.x;
        const dy = center.y - closest.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance >= collisionDistance) continue;
        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = collisionDistance - distance;
        state.x += nx * overlap;
        state.y += ny * overlap;
        const normalSpeed = state.vx * nx + state.vy * ny;
        if (normalSpeed < 0) {
            state.vx -= normalSpeed * 1.35 * nx;
            state.vy -= normalSpeed * 1.35 * ny;
        }
        // 沿手臂或身体轮廓的坡度缓慢滚动。
        const segmentLength = Math.hypot(closest.dx, closest.dy) || 1;
        state.vx += closest.dx / segmentLength * 8;
        state.vy += closest.dy / segmentLength * 8;
        state.touched = true;
        break;
    }
}

function getPinchData(hand, canvas, areaRect) {
    const thumb = hand?.keypoints?.find(point => point.name === 'thumb_tip');
    const index = hand?.keypoints?.find(point => point.name === 'index_finger_tip');
    if (!thumb || !index) return null;
    const thumbPoint = mapPointToArea(thumb, canvas, areaRect);
    const indexPoint = mapPointToArea(index, canvas, areaRect);
    const distance = Math.hypot(thumbPoint.x - indexPoint.x, thumbPoint.y - indexPoint.y);
    const indexMcp = hand.keypoints.find(point => point.name === 'index_finger_mcp');
    const pinkyMcp = hand.keypoints.find(point => point.name === 'pinky_finger_mcp');
    const mappedIndexMcp = indexMcp ? mapPointToArea(indexMcp, canvas, areaRect) : null;
    const mappedPinkyMcp = pinkyMcp ? mapPointToArea(pinkyMcp, canvas, areaRect) : null;
    const palmWidth = mappedIndexMcp && mappedPinkyMcp
        ? Math.hypot(mappedIndexMcp.x - mappedPinkyMcp.x, mappedIndexMcp.y - mappedPinkyMcp.y)
        : 70;
    const pinchThreshold = Math.max(34, Math.min(76, palmWidth * .72));
    return {
        x: (thumbPoint.x + indexPoint.x) / 2,
        y: (thumbPoint.y + indexPoint.y) / 2,
        distance,
        pinchThreshold,
        pinching: distance < pinchThreshold
    };
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

function createMotionTrail(ball) {
    const layer = document.querySelector('.ball-particle-layer');
    if (!layer) return;
    const trail = document.createElement('i');
    trail.className = 'ball-motion-trail';
    trail.style.left = `${ball.offsetLeft + ball.offsetWidth / 2}px`;
    trail.style.top = `${ball.offsetTop + ball.offsetHeight / 2}px`;
    trail.style.setProperty('--particle-color', ballColor(ball));
    layer.appendChild(trail);
    trail.addEventListener('animationend', () => trail.remove(), { once: true });
}

// 爆裂粒子：比普通命中更多、更远的多彩粒子，从球心向四周炸开。
function createBurstParticles(ball, amount = 42) {
    if (!ball?.classList.contains('video-gesture-ball')) return;
    const layer = document.querySelector('.ball-particle-layer');
    const area = ball.closest('.video-container');
    if (!layer || !area) return;

    const centerX = ball.offsetLeft + ball.offsetWidth / 2;
    const centerY = ball.offsetTop + ball.offsetHeight / 2;
    for (let index = 0; index < amount; index += 1) {
        const particle = document.createElement('i');
        const angle = (Math.PI * 2 * index) / amount + Math.random() * .45;
        const distance = 65 + Math.random() * 135;
        particle.className = 'soft-particle is-burst';
        particle.style.left = `${centerX}px`;
        particle.style.top = `${centerY}px`;
        particle.style.setProperty('--particle-x', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--particle-y', `${Math.sin(angle) * distance}px`);
        particle.style.setProperty('--particle-size', `${5 + Math.random() * 8}px`);
        particle.style.setProperty('--particle-color', BURST_COLORS[index % BURST_COLORS.length]);
        layer.appendChild(particle);
        particle.addEventListener('animationend', () => particle.remove(), { once: true });
    }
}

// 冲击环：从爆裂点快速扩散的圆环，强调爆炸的冲击波。
function createBlastRing(ball) {
    const layer = document.querySelector('.ball-particle-layer');
    if (!layer) return;
    const ring = document.createElement('i');
    ring.className = 'ball-blast-ring';
    ring.style.left = `${ball.offsetLeft + ball.offsetWidth / 2}px`;
    ring.style.top = `${ball.offsetTop + ball.offsetHeight / 2}px`;
    ring.style.setProperty('--particle-color', ballColor(ball));
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
}

function pulseBall(ball, className = 'ball-bounce') {
    ball.classList.remove(className);
    void ball.offsetWidth;
    ball.classList.add(className);
    window.setTimeout(() => ball.classList.remove(className), 360);
}

// 指尖向上戳中球体时爆裂：球体爆闪淡出 + 多彩粒子炸开 + 冲击环扩散，
// 短暂停顿后从顶部重生为一颗新素材、新颜色的球。
function explodeBall(ball, state, index) {
    const area = ball.closest('.video-container');
    if (!area || ball.classList.contains('exploding')) return;
    ball.classList.add('ball-explode', 'exploding');
    createBurstParticles(ball, 42);
    createBlastRing(ball);
    window.setTimeout(() => {
        ball.classList.remove('ball-explode', 'exploding');
        respawnBall(ball, state, index, area);
    }, 440);
}

function syncLiveHand(x, y, gesture, hand, canvas, areaRect) {
    const now = performance.now();
    const elapsed = Math.max((now - liveHandState.updatedAt) / 1000, .016);
    if (liveHandState.updatedAt > 0 && elapsed < .18) {
        const smoothing = .62;
        liveHandState.vx = liveHandState.vx * (1 - smoothing) + ((x - liveHandState.x) / elapsed) * smoothing;
        liveHandState.vy = liveHandState.vy * (1 - smoothing) + ((y - liveHandState.y) / elapsed) * smoothing;
    } else {
        liveHandState.vx = 0;
        liveHandState.vy = 0;
    }
    liveHandState.active = true;
    liveHandState.x = x;
    liveHandState.y = y;
    // 保存整只手的关键点碰撞轮廓。张掌拍球时不再只看一个掌心点，
    // 指尖、指节或掌边碰到球体也能立刻产生响应。
    const mappedPoints = hand?.keypoints?.map(point => ({ ...mapPointToArea(point, canvas, areaRect), name: point.name })) ?? [];
    liveHandState.points = mappedPoints;
    const pointByName = new Map(mappedPoints.map(point => [point.name, point]));
    const wrist = pointByName.get('wrist');
    const middleMcp = pointByName.get('middle_finger_mcp');
    const indexMcp = pointByName.get('index_finger_mcp');
    const pinkyMcp = pointByName.get('pinky_finger_mcp');
    if (wrist && middleMcp) {
        const angle = Math.atan2(middleMcp.y - wrist.y, middleMcp.x - wrist.x);
        let delta = angle - liveHandState.angle;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        liveHandState.angularVelocity = liveHandState.angularVelocity * .45 + delta / elapsed * .55;
        liveHandState.angle = angle;
    }
    if (indexMcp && pinkyMcp && wrist) {
        const palmWidth = Math.max(18, Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y));
        const tipNames = ['thumb_tip', 'index_finger_tip', 'middle_finger_tip', 'ring_finger_tip', 'pinky_finger_tip'];
        const spreadTotal = tipNames.reduce((sum, name) => {
            const point = pointByName.get(name);
            return sum + (point ? Math.hypot(point.x - wrist.x, point.y - wrist.y) / palmWidth : 0);
        }, 0);
        liveHandState.spread = Math.max(.7, Math.min(3.2, spreadTotal / tipNames.length));
        liveHandState.tilt = Math.atan2(pinkyMcp.y - indexMcp.y, pinkyMcp.x - indexMcp.x);
    }
    liveHandState.gesture = gesture;
    liveHandState.updatedAt = now;
    if (gesture === '指尖点按') {
        const indexTip = pointByName.get('index_finger_tip');
        if (indexTip) recordFingerPath(indexTip, now);
    }
}

function recordFingerPath(point, now) {
    if (now - lastPathParticleAt < 38) return;
    lastPathParticleAt = now;
    fingerPath.push({ x: point.x, y: point.y, at: now });
    fingerPath = fingerPath.filter(item => now - item.at < 5200).slice(-90);
    const layer = document.querySelector('.ball-particle-layer');
    if (layer) {
        const dot = document.createElement('i');
        dot.className = 'gesture-path-point';
        dot.style.left = `${point.x}px`;
        dot.style.top = `${point.y}px`;
        layer.appendChild(dot);
        window.setTimeout(() => dot.remove(), 5200);
    }
    if (fingerPath.length < 24) return;
    const recent = fingerPath.slice(-36);
    const first = recent[0];
    const last = recent.at(-1);
    const xs = recent.map(item => item.x);
    const ys = recent.map(item => item.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    if (Math.hypot(last.x - first.x, last.y - first.y) < 54 && width > 90 && height > 90) {
        const center = {
            x: recent.reduce((sum, item) => sum + item.x, 0) / recent.length,
            y: recent.reduce((sum, item) => sum + item.y, 0) / recent.length
        };
        pathOrbit = { ...center, radius: (width + height) / 4, expiresAt: now + 5200 };
        updateFieldHud('轨迹圆环 · 球体沿轨道运动');
    }
}

function nearestLiveHandPoint(x, y, includeAllPoints = true) {
    const candidates = includeAllPoints && liveHandState.points.length
        ? liveHandState.points
        : [liveHandState];
    return candidates.reduce((nearest, point) => {
        const distance = Math.hypot(x - point.x, y - point.y);
        return distance < nearest.distance ? { point, distance } : nearest;
    }, { point: liveHandState, distance: Infinity });
}

function handFieldMetrics(hand, canvas, areaRect) {
    if (!hand?.keypoints?.length) return null;
    const mapped = new Map(hand.keypoints.map(point => [point.name, mapPointToArea(point, canvas, areaRect)]));
    const wrist = mapped.get('wrist');
    const indexMcp = mapped.get('index_finger_mcp');
    const middleMcp = mapped.get('middle_finger_mcp');
    const ringMcp = mapped.get('ring_finger_mcp');
    const pinkyMcp = mapped.get('pinky_finger_mcp');
    if (!wrist || !indexMcp || !middleMcp || !ringMcp || !pinkyMcp) return null;
    const palm = {
        x: (wrist.x + indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 5,
        y: (wrist.y + indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 5
    };
    const palmWidth = Math.max(20, Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y));
    const tips = ['thumb_tip', 'index_finger_tip', 'middle_finger_tip', 'ring_finger_tip', 'pinky_finger_tip']
        .map(name => mapped.get(name)).filter(Boolean);
    const spread = tips.reduce((sum, tip) => sum + Math.hypot(tip.x - palm.x, tip.y - palm.y), 0) /
        Math.max(1, tips.length) / palmWidth;
    return { ...palm, spread, palmWidth };
}

function renderEnergyRope(first, second, active) {
    const layer = document.querySelector('.ball-particle-layer');
    if (!layer) return;
    let rope = layer.querySelector('.energy-rope');
    if (!rope) {
        rope = document.createElement('i');
        rope.className = 'energy-rope';
        layer.appendChild(rope);
    }
    rope.hidden = !active;
    if (!active) return;
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    rope.style.left = `${first.x}px`;
    rope.style.top = `${first.y}px`;
    rope.style.width = `${Math.hypot(dx, dy)}px`;
    rope.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
}

function updateDualHandField(hands, canvas, areaRect) {
    const metrics = (hands || []).map(hand => handFieldMetrics(hand, canvas, areaRect)).filter(Boolean);
    if (metrics.length < 2) {
        dualHandState.active = false;
        dualHandState.portalActive = false;
        renderEnergyRope(null, null, false);
        return;
    }
    metrics.sort((a, b) => a.x - b.x);
    const [left, right] = metrics;
    const now = performance.now();
    const distance = Math.hypot(right.x - left.x, right.y - left.y);
    const elapsed = Math.max(.016, (now - dualHandState.updatedAt) / 1000);
    const rawVelocity = dualHandState.updatedAt ? (distance - dualHandState.distance) / elapsed : 0;
    dualHandState.distanceVelocity = dualHandState.distanceVelocity * .5 + rawVelocity * .5;
    dualHandState.active = true;
    dualHandState.left = left;
    dualHandState.right = right;
    dualHandState.midpoint = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    dualHandState.distance = distance;
    // 双手张开且保持一定距离时形成传送门；能量绳同时作为可碰撞的弹性边界。
    dualHandState.portalActive = left.spread > 1.45 && right.spread > 1.45 && distance > 150;
    dualHandState.updatedAt = now;
    renderEnergyRope(left, right, true);
}

function applyImmediateHandHit() {
    const isFingerPoke = liveHandState.gesture === '指尖点按';
    if (liveHandState.gesture !== '张开手势' && !isFingerPoke) return;
    const speed = Math.hypot(liveHandState.vx, liveHandState.vy);
    if (speed < (isFingerPoke ? 24 : 75)) return;
    const now = performance.now();
    [...document.querySelectorAll('.video-gesture-ball')].forEach((ball, index) => {
        if (ball.classList.contains('grabbing') || ball.classList.contains('exploding')) return;
        const state = ballStates.get(ball);
        if (!state || now - state.lastHit < 160) return;
        const radius = ball.offsetWidth / 2;
        // 使用当前绘制位置做命中检测，避免物理状态与像素取整产生偏差。
        const ballX = ball.offsetLeft + radius;
        const ballY = ball.offsetTop + radius;
        const contact = nearestLiveHandPoint(ballX, ballY, !isFingerPoke);
        const dx = ballX - contact.point.x;
        const dy = ballY - contact.point.y;
        const distance = contact.distance || 1;
        if (distance > radius + (isFingerPoke ? 40 : 48)) return;

        // 指尖朝上快速戳中球体：触发爆裂，不再走弹开分支。
        if (isFingerPoke && liveHandState.vy <= -EXPLODE_UPWARD_SPEED) {
            explodeBall(ball, state, index);
            return;
        }

        const nx = dx / distance;
        const ny = dy / distance;
        const strength = Math.min(440, Math.max(isFingerPoke ? 105 : 155, speed * (isFingerPoke ? .52 : .7)));
        const material = materialById(state.material || ball.dataset.material);
        if (material.brittle && speed > 285) {
            explodeBall(ball, state, index);
            updateFieldHud('玻璃碎裂 · 粒子释放', material.label);
            return;
        }
        state.vx += nx * strength + liveHandState.vx * .5;
        state.vy += ny * strength + liveHandState.vy * .5;
        state.lastHit = now;
        state.touched = true;
        state.lastTouchedAt = now;
        state.moodChangedAt = now;
        setBallMood(ball, state, speed > 220 ? 'angry' : 'playful');
        pulseBall(ball);
        createSoftParticles(ball, 'hit', isFingerPoke ? 6 : 9);
        updateFieldHud(isFingerPoke ? '指尖弹击' : '整手拍击', material.label);
    });
}

function initialiseBallState(ball, index, area, force = false) {
    let state = ballStates.get(ball);
    if (state && !force) return state;
    // 先随机球体外观（素材、玻璃颜色与大小），再按新尺寸计算初始位置，避免尺寸与落点错位。
    applyBallLook(ball);
    const size = ball.offsetWidth || 80;
    const spawn = Number(ball.dataset.spawn ?? .5);
    state = {
        x: Math.max(0, Math.min(area.clientWidth - size, spawn * area.clientWidth - size / 2)),
        y: -size - index * 68,
        vx: (index % 2 ? -1 : 1) * (24 + index * 7),
        vy: 10 + index * 5,
        size,
        material: ball.dataset.material || 'water',
        mood: ball.dataset.mood || 'calm',
        polarity: index % 2 ? -1 : 1,
        lastTouchedAt: performance.now(),
        moodChangedAt: performance.now(),
        portalCooldown: 0,
        mergeCooldown: 0,
        lastHit: 0,
        lastFieldParticle: 0,
        lastTrail: 0,
        lastWallHit: 0,
        lastGoalCheck: 0,
        touched: false
    };
    ballStates.set(ball, state);
    ball.style.left = `${state.x}px`;
    ball.style.top = `${state.y}px`;
    return state;
}

function respawnBall(ball, state, index, area) {
    // 每次从顶部重新飘落时更换球内素材、玻璃颜色与球体大小，让全部素材依次出现且球有大有小。
    applyBallLook(ball);
    const size = ball.offsetWidth || 80;
    const lane = Number(ball.dataset.spawn ?? .5);
    const randomOffset = (Math.random() - .5) * area.clientWidth * .18;
    state.x = Math.max(0, Math.min(area.clientWidth - size, lane * area.clientWidth - size / 2 + randomOffset));
    state.y = -size - 24 - index * 18;
    state.vx = (Math.random() - .5) * 86;
    state.vy = 10 + Math.random() * 9;
    state.size = size;
    state.material = ball.dataset.material || 'water';
    state.mood = ball.dataset.mood || 'calm';
    state.polarity = Math.random() > .5 ? 1 : -1;
    state.lastTouchedAt = performance.now();
    state.moodChangedAt = performance.now();
    state.portalCooldown = 0;
    state.mergeCooldown = performance.now() + 700;
    state.lastHit = 0;
    state.lastFieldParticle = 0;
    state.lastTrail = 0;
    state.lastPoke = 0;
    state.lastWallHit = 0;
    state.lastGoalCheck = 0;
    state.touched = false;
    ball.classList.remove('ball-respawn');
    void ball.offsetWidth;
    ball.classList.add('ball-respawn');
    window.setTimeout(() => ball.classList.remove('ball-respawn'), 520);
}

function mergeBalls(first, firstState, second, secondState, area, secondIndex, frameTime) {
    const firstSize = firstState.size || first.offsetWidth;
    const secondSize = secondState.size || second.offsetWidth;
    const mergedSize = Math.min(126, Math.sqrt(firstSize * firstSize + secondSize * secondSize));
    firstState.x = (firstState.x + secondState.x) / 2;
    firstState.y = (firstState.y + secondState.y) / 2;
    firstState.vx = (firstState.vx + secondState.vx) / 2;
    firstState.vy = (firstState.vy + secondState.vy) / 2;
    firstState.size = mergedSize;
    firstState.mergeCooldown = frameTime + 1500;
    first.style.setProperty('--ball-size', `${mergedSize}px`);
    pulseBall(first);
    createSoftParticles(first, 'grab', 20);
    updateFieldHud('同材质融合 · 体积增长', materialById(firstState.material).label);
    respawnBall(second, secondState, secondIndex, area);
}

function resolveBallCollisions(balls, area, frameTime) {
    for (let firstIndex = 0; firstIndex < balls.length; firstIndex += 1) {
        const first = balls[firstIndex];
        if (first.classList.contains('grabbing') || first.classList.contains('exploding')) continue;
        const firstState = ballStates.get(first);
        for (let secondIndex = firstIndex + 1; secondIndex < balls.length; secondIndex += 1) {
            const second = balls[secondIndex];
            if (second.classList.contains('grabbing') || second.classList.contains('exploding')) continue;
            const secondState = ballStates.get(second);
            // 复用物理循环写入的尺寸缓存，避免每帧强制布局。
            const firstRadius = (firstState.size || first.offsetWidth) / 2;
            const secondRadius = (secondState.size || second.offsetWidth) / 2;
            const dx = secondState.x + secondRadius - firstState.x - firstRadius;
            const dy = secondState.y + secondRadius - firstState.y - firstRadius;
            const distance = Math.hypot(dx, dy) || 1;
            const minimumDistance = firstRadius + secondRadius;
            if (distance >= minimumDistance) continue;

            const relativeSpeed = Math.hypot(secondState.vx - firstState.vx, secondState.vy - firstState.vy);
            const firstMaterial = materialById(firstState.material);
            const canMerge = firstState.material === secondState.material && firstMaterial.merge &&
                (firstState.touched || secondState.touched) && relativeSpeed < 72 &&
                frameTime > (firstState.mergeCooldown || 0) && frameTime > (secondState.mergeCooldown || 0) &&
                firstRadius + secondRadius < 118;
            if (canMerge) {
                mergeBalls(first, firstState, second, secondState, area, secondIndex, frameTime);
                continue;
            }

            const nx = dx / distance;
            const ny = dy / distance;
            const overlap = minimumDistance - distance;
            firstState.x -= nx * overlap / 2;
            firstState.y -= ny * overlap / 2;
            secondState.x += nx * overlap / 2;
            secondState.y += ny * overlap / 2;
            const relativeVelocity = (secondState.vx - firstState.vx) * nx + (secondState.vy - firstState.vy) * ny;
            if (relativeVelocity < 0) {
                const bounce = (materialById(firstState.material).bounce + materialById(secondState.material).bounce) / 2;
                const impulse = -relativeVelocity * bounce;
                firstState.vx -= impulse * nx;
                firstState.vy -= impulse * ny;
                secondState.vx += impulse * nx;
                secondState.vy += impulse * ny;
            }
        }
    }
}

// 球体堆叠支撑：掌上静止的球会成为上方球体的柔软支撑面，使平放手掌时多颗球逐层叠起；
// 支撑球滑走或速度过快时支撑自然消失，堆叠的球继续下落。
function settleBallStack(balls) {
    const stack = balls
        .map((ball) => ({ ball, state: ballStates.get(ball) }))
        .filter((item) => item.state && !item.ball.classList.contains('grabbing') && !item.ball.classList.contains('exploding'))
        .sort((a, b) => b.state.y - a.state.y);
    stack.forEach((upper, index) => {
        const size = upper.state.size || upper.ball.offsetWidth;
        if (!size) return;
        const centerX = upper.state.x + size / 2;
        const bottom = upper.state.y + size;
        let support = null;
        // 只把排序中更靠下（已先行结算）且近乎静止的球视为支撑候选，避免把共同下落的球连在一起。
        for (let candidateIndex = 0; candidateIndex < index; candidateIndex += 1) {
            const lower = stack[candidateIndex];
            const lowerSize = lower.state.size || lower.ball.offsetWidth;
            if (!lowerSize || Math.abs(lower.state.vy) > 60) continue;
            const lowerCenterX = lower.state.x + lowerSize / 2;
            if (Math.abs(centerX - lowerCenterX) > (size + lowerSize) / 2 * .84) continue;
            const lowerTop = lower.state.y;
            if (bottom < lowerTop - 4 || bottom > lowerTop + 72) continue;
            if (!support || lowerTop < support.top) support = { top: lowerTop, vx: lower.state.vx };
        }
        if (!support) return;
        // 吸附到支撑顶面：消掉下坠速度与横向漂移，并跟随支撑球平移，保证堆叠不塌。
        upper.state.y = support.top - size;
        if (upper.state.vy > 0) upper.state.vy = 0;
        upper.state.vx = upper.state.vx * .55 + support.vx * .45;
        upper.state.touched = true;
    });
}

function checkAirGoal(ball, state, index, area, frameTime) {
    if (!state.touched) return false;
    // 每帧读取 rect 会强制同步布局，这里限制到约 8 次/秒，对判定精度无影响。
    if (frameTime - state.lastGoalCheck < 120) return false;
    state.lastGoalCheck = frameTime;
    const goal = document.querySelector('.air-goal');
    if (!goal) return false;
    const areaRect = area.getBoundingClientRect();
    const goalRect = goal.getBoundingClientRect();
    const goalCenterX = goalRect.left - areaRect.left + goalRect.width / 2;
    const goalCenterY = goalRect.top - areaRect.top + goalRect.height / 2;
    const ballCenterX = state.x + ball.offsetWidth / 2;
    const ballCenterY = state.y + ball.offsetHeight / 2;
    const normalizedDistance = Math.hypot(
        (ballCenterX - goalCenterX) / (goalRect.width / 2),
        (ballCenterY - goalCenterY) / (goalRect.height / 2)
    );
    if (normalizedDistance > .82) return false;

    airScore += 1;
    updateAirHud('投入目标 · 得分 +1');
    createSoftParticles(ball, 'hit', 24);
    goal.classList.remove('goal-flash');
    void goal.offsetWidth;
    goal.classList.add('goal-flash');
    window.setTimeout(() => goal.classList.remove('goal-flash'), 680);
    respawnBall(ball, state, index, area);
    return true;
}

function applyMagneticForces(balls, elapsed) {
    for (let firstIndex = 0; firstIndex < balls.length; firstIndex += 1) {
        const first = balls[firstIndex];
        const firstState = ballStates.get(first);
        if (!firstState || first.classList.contains('grabbing')) continue;
        for (let secondIndex = firstIndex + 1; secondIndex < balls.length; secondIndex += 1) {
            const second = balls[secondIndex];
            const secondState = ballStates.get(second);
            if (!secondState || second.classList.contains('grabbing')) continue;
            if (firstState.material !== 'magnet' && secondState.material !== 'magnet') continue;
            const firstSize = firstState.size || first.offsetWidth;
            const secondSize = secondState.size || second.offsetWidth;
            const dx = secondState.x + secondSize / 2 - firstState.x - firstSize / 2;
            const dy = secondState.y + secondSize / 2 - firstState.y - firstSize / 2;
            const distance = Math.hypot(dx, dy) || 1;
            if (distance > 260) continue;
            const samePolarity = firstState.material === 'magnet' && secondState.material === 'magnet' &&
                firstState.polarity === secondState.polarity;
            const direction = samePolarity ? -1 : 1;
            const force = direction * 260 * (1 - distance / 260);
            const impulseX = dx / distance * force * elapsed;
            const impulseY = dy / distance * force * elapsed;
            firstState.vx += impulseX;
            firstState.vy += impulseY;
            secondState.vx -= impulseX;
            secondState.vy -= impulseY;
        }
    }
}

function applyEnergyRopeCollision(state, size) {
    if (!dualHandState.active || !dualHandState.left || !dualHandState.right) return;
    const center = { x: state.x + size / 2, y: state.y + size / 2 };
    const closest = closestPointOnSegment(center, dualHandState.left, dualHandState.right);
    const dx = center.x - closest.x;
    const dy = center.y - closest.y;
    const distance = Math.hypot(dx, dy) || 1;
    const limit = size / 2 + 9;
    if (distance >= limit) return;
    const nx = dx / distance;
    const ny = dy / distance;
    state.x += nx * (limit - distance);
    state.y += ny * (limit - distance);
    const normalSpeed = state.vx * nx + state.vy * ny;
    if (normalSpeed < 0) {
        state.vx -= normalSpeed * 1.7 * nx;
        state.vy -= normalSpeed * 1.7 * ny;
    }
    state.touched = true;
}

function applyPortalAndGroupField(ball, state, size, elapsed, frameTime, area) {
    if (!dualHandState.active || frameTime - dualHandState.updatedAt > 300) return;
    const centerX = state.x + size / 2;
    const centerY = state.y + size / 2;
    const midpoint = dualHandState.midpoint;
    const dx = centerX - midpoint.x;
    const dy = centerY - midpoint.y;
    const distance = Math.hypot(dx, dy) || 1;

    // 双手距离连续变化控制整个球群压缩/膨胀，不需要切换模式或点击按钮。
    if (Math.abs(dualHandState.distanceVelocity) > 28 && distance < Math.max(260, dualHandState.distance * .95)) {
        const force = Math.max(-480, Math.min(480, dualHandState.distanceVelocity * .72));
        state.vx += dx / distance * force * elapsed;
        state.vy += dy / distance * force * elapsed;
        state.touched = true;
        updateFieldHud(force > 0 ? '双手展开 · 球群膨胀' : '双手靠近 · 球群压缩');
    }

    if (dualHandState.portalActive && frameTime > (state.portalCooldown || 0)) {
        const leftDistance = Math.hypot(centerX - dualHandState.left.x, centerY - dualHandState.left.y);
        const rightDistance = Math.hypot(centerX - dualHandState.right.x, centerY - dualHandState.right.y);
        const portalRadius = Math.max(42, size * .72);
        let destination = null;
        if (leftDistance < portalRadius) destination = dualHandState.right;
        else if (rightDistance < portalRadius) destination = dualHandState.left;
        if (destination) {
            state.x = Math.max(0, Math.min(area.clientWidth - size, destination.x - size / 2));
            state.y = Math.max(0, Math.min(area.clientHeight - size, destination.y - size / 2));
            state.portalCooldown = frameTime + 900;
            state.touched = true;
            createSoftParticles(ball, 'hit', 16);
            updateFieldHud('双手传送门 · 瞬移');
        }
    }
    applyEnergyRopeCollision(state, size);
}

function applyGestureFields(state, size, elapsed, frameTime) {
    if (!liveHandState.active || frameTime - liveHandState.updatedAt > 260) return;
    const centerX = state.x + size / 2;
    const centerY = state.y + size / 2;
    const dx = centerX - liveHandState.x;
    const dy = centerY - liveHandState.y;
    const distance = Math.hypot(dx, dy) || 1;
    const handSpeed = Math.hypot(liveHandState.vx, liveHandState.vy);
    const fieldRadius = 150 + liveHandState.spread * 72;

    // 手掌旋转速度直接生成切向涡流；旋转越快，轨道速度越高。
    if (liveHandState.gesture === '张开手势' && Math.abs(liveHandState.angularVelocity) > .72 && distance < fieldRadius) {
        const strength = Math.max(-520, Math.min(520, liveHandState.angularVelocity * 135)) * (1 - distance / fieldRadius);
        state.vx += -dy / distance * strength * elapsed;
        state.vy += dx / distance * strength * elapsed;
        state.touched = true;
        updateFieldHud('旋转手掌 · 涡流');
    }

    // 缓慢移动时形成黏性跟随，手掌倾斜则给球一个连续的横向滚动力。
    if (liveHandState.gesture === '张开手势' && distance < 150 && handSpeed < 105) {
        state.vx += (liveHandState.x - centerX) * elapsed * 1.7;
        state.vy += (liveHandState.y - centerY) * elapsed * 1.7;
        state.vx += Math.cos(liveHandState.tilt) * 22 * elapsed;
        updateFieldHud('慢手黏附 · 倾斜滚动');
    }

    const now = performance.now();
    fingerPath = fingerPath.filter(point => now - point.at < 5200);
    if (fingerPath.length > 2) {
        let nearestIndex = -1;
        let nearestDistance = 105;
        fingerPath.forEach((point, index) => {
            const pointDistance = Math.hypot(centerX - point.x, centerY - point.y);
            if (pointDistance < nearestDistance) {
                nearestDistance = pointDistance;
                nearestIndex = index;
            }
        });
        if (nearestIndex >= 0) {
            const target = fingerPath[Math.min(fingerPath.length - 1, nearestIndex + 3)];
            state.vx += (target.x - centerX) * elapsed * 3.2;
            state.vy += (target.y - centerY) * elapsed * 3.2;
            state.touched = true;
        }
    }
    if (pathOrbit && frameTime < pathOrbit.expiresAt) {
        const orbitDx = centerX - pathOrbit.x;
        const orbitDy = centerY - pathOrbit.y;
        const orbitDistance = Math.hypot(orbitDx, orbitDy) || 1;
        if (Math.abs(orbitDistance - pathOrbit.radius) < 120) {
            const radial = (pathOrbit.radius - orbitDistance) * 2.4;
            state.vx += orbitDx / orbitDistance * radial * elapsed;
            state.vy += orbitDy / orbitDistance * radial * elapsed;
            state.vx += -orbitDy / orbitDistance * 95 * elapsed;
            state.vy += orbitDx / orbitDistance * 95 * elapsed;
        }
    } else if (pathOrbit) {
        pathOrbit = null;
    }
}

function applyAutonomousBehavior(ball, state, size, elapsed, frameTime, index) {
    const centerX = state.x + size / 2;
    const centerY = state.y + size / 2;
    const handVisible = liveHandState.active && frameTime - liveHandState.updatedAt < 320;

    if (frameTime - (state.lastTouchedAt || 0) > 8200 && state.mood !== 'lonely') {
        state.moodChangedAt = frameTime;
        setBallMood(ball, state, 'lonely');
    }
    if (!handVisible) {
        // 没有人靠近时仍保留轻微自主漂移，让球体看起来是“活着的”。
        state.vx += Math.sin(frameTime / 720 + index * 1.7) * 5 * elapsed;
        return;
    }

    const dx = liveHandState.x - centerX;
    const dy = liveHandState.y - centerY;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const influence = Math.max(0, 1 - distance / 330);
    if (!influence) return;

    switch (state.mood) {
        case 'curious':
        case 'lonely':
            state.vx += nx * 42 * influence * elapsed;
            state.vy += ny * 42 * influence * elapsed;
            break;
        case 'shy':
            state.vx -= nx * 58 * influence * elapsed;
            state.vy -= ny * 58 * influence * elapsed;
            break;
        case 'happy':
        case 'playful':
            state.vx += -ny * 46 * influence * elapsed;
            state.vy += nx * 46 * influence * elapsed;
            break;
        case 'angry':
            state.vx += nx * 78 * influence * elapsed;
            state.vy += ny * 78 * influence * elapsed;
            if (frameTime - state.moodChangedAt > 2600) setBallMood(ball, state, 'calm');
            break;
        default:
            state.vx += Math.sin(frameTime / 900 + index) * 3 * elapsed;
    }
}

function animateVideoBalls(frameTime) {
    const elapsed = Math.min((frameTime - previousFrameTime) / 1000 || .016, .034);
    previousFrameTime = frameTime;
    const area = document.querySelector('.video-container');
    const balls = [...document.querySelectorAll('.video-gesture-ball')];
    // 球体只在「球体模式 + 摄像头已启动」时下落：未启动时画面保持占位提示，没有球出现。
    const active = getActiveMode() === 'ball' && area && isCameraOn;

    if (active) {
        // 允许约四分之一秒的短暂漏帧，避免关键点偶尔丢失时托举、吸引或抓取反馈瞬间中断。
        const handIsLive = liveHandState.active && frameTime - liveHandState.updatedAt < 260;
        if (!handIsLive) updateAirHud('等待手势');
        balls.forEach((ball, index) => initialiseBallState(ball, index, area));
        applyMagneticForces(balls, elapsed);
        balls.forEach((ball, index) => {
            const state = initialiseBallState(ball, index, area);
            const size = ball.offsetWidth;
            if (size) state.size = size;
            state.material = ball.dataset.material || state.material || 'water';
            const material = materialById(state.material);
            if (ball.classList.contains('grabbing')) {
                state.x = ball.offsetLeft;
                state.y = ball.offsetTop;
                // 记录抓取过程中的手速，释放瞬间自然继承为抛掷速度。
                state.vx = Math.max(-520, Math.min(520, liveHandState.vx * .72));
                state.vy = Math.max(-520, Math.min(520, liveHandState.vy * .72));
                state.touched = true;
                state.lastTouchedAt = frameTime;
                if (state.mood !== 'happy') setBallMood(ball, state, 'happy');
                return;
            }
            // 爆裂动画期间暂停物理，等待重生。
            if (ball.classList.contains('exploding')) return;

            // 较缓的重力和终端速度，为摄像头手势托举、拍击与抓取留出反应时间。
            const gravity = 95 * material.gravity;
            state.vy = Math.min(state.vy + gravity * elapsed, material.id === 'bubble' ? 54 : 125);
            const drag = Math.pow(material.drag, elapsed * 60);
            state.vx *= drag;
            state.vy *= drag;
            if (material.buoyant) {
                state.vy -= 16 * elapsed;
                state.vx += Math.sin(frameTime / 280 + index) * 10 * elapsed;
            }

            applyGestureFields(state, size, elapsed, frameTime);
            applyAutonomousBehavior(ball, state, size, elapsed, frameTime, index);
            applyPortalAndGroupField(ball, state, size, elapsed, frameTime, area);
            applyBodyCollision(state, size, frameTime);

            if (handIsLive && liveHandState.gesture === '握拳吸引') {
                const ballX = state.x + size / 2;
                const ballY = state.y + size / 2;
                const dx = liveHandState.x - ballX;
                const dy = liveHandState.y - ballY;
                const distance = Math.hypot(dx, dy) || 1;
                const fieldRadius = Math.max(210, Math.min(area.clientWidth * .7, 170 + liveHandState.spread * 96));
                if (distance < fieldRadius) {
                    // 引力场同时消减球原有惯性，保证高速抛出的球也能被稳定拉回掌心。
                    state.vx *= .92;
                    state.vy *= .92;
                    const force = 760 * (1 - distance / fieldRadius);
                    state.vx += (dx / distance) * force * elapsed;
                    state.vy += (dy / distance) * force * elapsed;
                    state.touched = true;
                    state.lastTouchedAt = frameTime;
                    updateFieldHud(`握拳引力 · 范围 ${Math.round(fieldRadius)}px`);
                    if (frameTime - state.lastFieldParticle > 360 && distance < fieldRadius * .75) {
                        createSoftParticles(ball, 'grab', 5);
                        state.lastFieldParticle = frameTime;
                    }
                }
            } else if (handIsLive && liveHandState.gesture === '张开手势') {
                const ballX = state.x + size / 2;
                const ballY = state.y + size / 2;
                const contact = nearestLiveHandPoint(ballX, ballY, true);
                const dx = ballX - contact.point.x;
                const dy = ballY - contact.point.y;
                const distance = contact.distance || 1;
                const handSpeed = Math.hypot(liveHandState.vx, liveHandState.vy);
                const palmSurface = liveHandState.y - 8;
                const ballBottom = state.y + size;
                // 平放的手掌形成一块有宽度的托举面：掌心范围内的球落到掌面即被托住，
                // 配合 settleBallStack 的球体堆叠，多颗球可以由低到高叠在掌上。
                const inPalmColumn = Math.abs(ballX - liveHandState.x) < 156 + size * .3;
                const sinkingIntoPalm = ballBottom > palmSurface - 10 && ballBottom < palmSurface + 124;
                if (handSpeed < 480 && inPalmColumn && sinkingIntoPalm) {
                    state.y = palmSurface - size;
                    state.vy = Math.min(liveHandState.vy * .72, 18);
                    state.vx += liveHandState.vx * elapsed * 1.8;
                    state.touched = true;
                    state.lastTouchedAt = frameTime;
                    updateFieldHud('张掌托举 · 慢速黏附', material.label);
                } else if (distance < size / 2 + 54 && frameTime - state.lastHit > 115) {
                    // 快速扫过球体视作拍击，手速越快，球获得的弹性冲量越大。
                    const nx = dx / distance;
                    const ny = dy / distance;
                    const strength = Math.min(430, Math.max(145, handSpeed * .72));
                    state.vx += nx * strength + liveHandState.vx * .48;
                    state.vy += ny * strength + liveHandState.vy * .48;
                    state.lastHit = frameTime;
                    state.touched = true;
                    state.lastTouchedAt = frameTime;
                    state.moodChangedAt = frameTime;
                    setBallMood(ball, state, handSpeed > 220 ? 'angry' : 'playful');
                    pulseBall(ball);
                    createSoftParticles(ball, 'hit', 9);
                } else {
                    // 静止张掌也会形成连续斥力；五指张得越开，作用范围越大。
                    const repelRadius = size / 2 + 48 + liveHandState.spread * 28;
                    if (distance < repelRadius) {
                        const force = 120 * (1 - distance / repelRadius);
                        state.vx += dx / distance * force * elapsed;
                        state.vy += dy / distance * force * elapsed;
                        state.touched = true;
                        state.lastTouchedAt = frameTime;
                        updateFieldHud(`张掌斥力 · 强度 ${Math.round(liveHandState.spread * 32)}%`, material.label);
                    }
                }
            } else if (handIsLive && liveHandState.gesture === '指尖点按') {
                const ballX = state.x + size / 2;
                const ballY = state.y + size / 2;
                const dx = ballX - liveHandState.x;
                const dy = ballY - liveHandState.y;
                const distance = Math.hypot(dx, dy) || 1;
                const touchDistance = size / 2 + 16;
                if (distance < touchDistance) {
                    // 指尖静止或普通移动碰到球体：像碰到实物一样被轻推开，不爆裂，随后继续下坠。
                    const overlap = touchDistance - distance;
                    const nx = dx / distance;
                    const ny = dy / distance;
                    state.x += nx * overlap;
                    state.y += ny * overlap;
                    // 新接触瞬间给一次轻微冲量让球滑开；持续接触不反复加力，避免被顶飞。
                    if (frameTime - (state.lastPoke ?? -999) > 240) {
                        state.vx += nx * (34 + Math.random() * 26);
                        state.vy += ny * 12;
                        state.lastPoke = frameTime;
                    }
                    state.touched = true;
                    state.lastTouchedAt = frameTime;
                }
            }

            state.x += state.vx * elapsed;
            state.y += state.vy * elapsed;
            if (Math.hypot(state.vx, state.vy) > 185 && frameTime - state.lastTrail > 110) {
                createMotionTrail(ball);
                state.lastTrail = frameTime;
            }
            if (checkAirGoal(ball, state, index, area, frameTime)) return;
            const maxX = Math.max(0, area.clientWidth - size);
            if (state.x <= 0 || state.x >= maxX) {
                state.x = Math.max(0, Math.min(state.x, maxX));
                state.vx *= -material.bounce;
                // 球被压在画面边缘时每隔一段时间才脉冲一次，避免每帧重启动画造成闪烁。
                if (frameTime - state.lastWallHit > 260) {
                    pulseBall(ball);
                    state.lastWallHit = frameTime;
                }
            }
            if (state.y >= area.clientHeight + size * .25) {
                // 不设置“地面”：球从画面底部自由离场并消失，再从顶部重新进入。
                respawnBall(ball, state, index, area);
            }
            ball.style.left = `${state.x}px`;
            ball.style.top = `${state.y}px`;
        });

        resolveBallCollisions(balls, area, frameTime);
        settleBallStack(balls);
        balls.forEach((ball) => {
            if (ball.classList.contains('grabbing') || ball.classList.contains('exploding')) return;
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
    airScore = 0;
    updateAirHud('等待手势');
    [...document.querySelectorAll('.video-gesture-ball')].forEach((ball, index) => {
        initialiseBallState(ball, index, area, true);
    });
    if (!ballPhysicsStarted) {
        ballPhysicsStarted = true;
        previousFrameTime = performance.now();
        requestAnimationFrame(animateVideoBalls);
    }
}

function nearestBallTo(x, y, maximumDistance = 110) {
    let nearest = null;
    let nearestDistance = maximumDistance;
    document.querySelectorAll('.video-gesture-ball').forEach((ball) => {
        const distance = Math.hypot(
            ball.offsetLeft + ball.offsetWidth / 2 - x,
            ball.offsetTop + ball.offsetHeight / 2 - y
        );
        if (distance < nearestDistance) {
            nearest = ball;
            nearestDistance = distance;
        }
    });
    return nearest;
}

function splitBall(ball) {
    const area = ball.closest('.video-container');
    const state = ballStates.get(ball);
    const currentBalls = [...document.querySelectorAll('.video-gesture-ball')];
    if (!area || !state || currentBalls.length >= 12 || (state.size || ball.offsetWidth) < 52) return;
    const originalSize = state.size || ball.offsetWidth;
    const childSize = Math.max(42, originalSize * .72);
    const clone = ball.cloneNode(true);
    clone.classList.remove('grabbing', 'two-hand-stretch', 'ball-bounce', 'exploding', 'ball-explode');
    clone.style.setProperty('--ball-size', `${childSize}px`);
    clone.style.removeProperty('--stretch-scale-x');
    clone.style.removeProperty('--stretch-scale-y');
    clone.style.removeProperty('--stretch-angle');
    area.insertBefore(clone, area.querySelector('.air-goal'));
    ball.style.setProperty('--ball-size', `${childSize}px`);
    state.size = childSize;
    state.x = Math.max(0, state.x - childSize * .42);
    state.vx = -145;
    state.vy = -45;
    state.mergeCooldown = performance.now() + 1700;
    const cloneState = {
        ...state,
        x: Math.min(area.clientWidth - childSize, state.x + childSize * 1.25),
        vx: 145,
        vy: -45,
        lastHit: 0,
        mergeCooldown: performance.now() + 1700,
        portalCooldown: 0
    };
    ballStates.set(clone, cloneState);
    clone.style.left = `${cloneState.x}px`;
    clone.style.top = `${cloneState.y}px`;
    createSoftParticles(ball, 'hit', 26);
    updateFieldHud('双手拉裂 · 一球分为两球', materialById(state.material).label);
}

function finishTwoHandStretch() {
    if (!twoHandStretch) return;
    const ball = twoHandStretch.ball;
    ball.classList.remove('two-hand-stretch', 'grabbing');
    ball.style.removeProperty('--stretch-scale-x');
    ball.style.removeProperty('--stretch-scale-y');
    ball.style.removeProperty('--stretch-angle');
    createSoftParticles(ball, 'release', 18);
    if (twoHandStretch.peakStretch > 1.52) splitBall(ball);
    if (grabbedObject === ball) grabbedObject = null;
    twoHandStretch = null;
}

function updateTwoHandStretch(hands, canvas, area) {
    const areaRect = area.getBoundingClientRect();
    const pinches = (hands || [])
        .map(hand => getPinchData(hand, canvas, areaRect))
        .filter(Boolean);
    if (pinches.length < 2 || !pinches[0].pinching || !pinches[1].pinching) {
        finishTwoHandStretch();
        return false;
    }

    const [first, second] = pinches;
    const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    if (!twoHandStretch) {
        const ball = grabbedObject?.classList.contains('video-gesture-ball')
            ? grabbedObject
            : nearestBallTo(midpoint.x, midpoint.y, 135);
        if (!ball) return false;
        grabbedObject = ball;
        bringToFront(ball);
        ball.classList.add('grabbing', 'two-hand-stretch');
        createSoftParticles(ball, 'grab', 18);
        twoHandStretch = {
            ball,
            initialDistance: Math.max(distance, 70),
            peakStretch: 1
        };
    }

    const ball = twoHandStretch.ball;
    const stretch = Math.max(.72, Math.min(1.75, distance / twoHandStretch.initialDistance));
    twoHandStretch.peakStretch = Math.max(twoHandStretch.peakStretch, stretch);
    const angle = Math.atan2(second.y - first.y, second.x - first.x) * 180 / Math.PI;
    ball.style.setProperty('--stretch-scale-x', stretch.toFixed(3));
    ball.style.setProperty('--stretch-scale-y', Math.max(.72, 1 / Math.sqrt(stretch)).toFixed(3));
    ball.style.setProperty('--stretch-angle', `${angle.toFixed(1)}deg`);
    moveObjectTo(ball, midpoint.x - ball.offsetWidth / 2, midpoint.y - ball.offsetHeight / 2);
    const state = ballStates.get(ball);
    if (state) state.touched = true;
    updateAirHud('双手拉伸 · 松开即可抛出');
    return true;
}

function updateGrabDeformation(hand, canvas, area) {
    if (!grabbedObject?.classList.contains('video-gesture-ball') || twoHandStretch) return;
    const pinch = getPinchData(hand, canvas, area.getBoundingClientRect());
    if (!pinch) return;
    const compression = Math.max(0, Math.min(1, (pinch.pinchThreshold - pinch.distance) / Math.max(22, pinch.pinchThreshold * .58)));
    grabbedObject.style.setProperty('--grab-scale-x', (1 + compression * .16).toFixed(3));
    grabbedObject.style.setProperty('--grab-scale-y', (1.02 - compression * .24).toFixed(3));
}

// 更新交互
function updateInteraction(hand, canvas, currentGesture, handPosition, allHands = [hand]) {
    // 功能说明弹窗打开时暂停手势交互，点 ✕ 关闭后立刻恢复。
    if (document.body.classList.contains('guide-open')) {
        removeCursor();
        releaseObject();
        return;
    }
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
    const mappedPoint = mapPointToArea(handPosition, canvas, rect);
    const mappedX = mappedPoint.x;
    const mappedY = mappedPoint.y;

    if (activeMode === 'ball') {
        syncLiveHand(mappedX, mappedY, currentGesture, hand, canvas, rect);
        updateDualHandField(allHands, canvas, rect);
        applyImmediateHandHit();
        updateAirHud(currentGesture);
    } else {
        // 收藏品模式：光标靠近收藏品时提前高亮，提示可以抓取。
        updateCollectionHover(mappedX, mappedY);
    }

    // 显示虚拟光标
    showCursor(interactionArea, mappedX, mappedY, currentGesture);

    // 鼠标正在拖拽时暂停手势对物品的操控，避免两边同时抢夺收藏品
    if (pointerDrag) return;

    if (activeMode === 'ball' && updateTwoHandStretch(allHands, canvas, interactionArea)) {
        return;
    }

    // 处理抓取逻辑
    if (currentGesture === '抓取手势' && !grabbedObject) {
        // 尝试抓取物品
        tryGrabObject(mappedX, mappedY);
    } else if (currentGesture !== '抓取手势' && grabbedObject) {
        // 释放物品
        releaseObject();
    }

    // 移动已抓取的物品
    if (grabbedObject) {
        moveObject(mappedX, mappedY);
        if (activeMode === 'ball') updateGrabDeformation(hand, canvas, interactionArea);
    }
}

let hoveredObject = null;
let lastHoverCheck = 0;

// 收藏品模式：手势光标靠近收藏品时给它高亮，提示当前可以抓取。
function updateCollectionHover(x, y) {
    const now = performance.now();
    if (now - lastHoverCheck < 130) return;
    lastHoverCheck = now;
    const layer = document.querySelector('.mode-layer[data-mode-layer="collection"]');
    if (!layer) return;
    const layerRect = layer.getBoundingClientRect();
    const padding = 56;
    let nearest = null;
    let nearestDistance = Infinity;
    layer.querySelectorAll('.object').forEach((object) => {
        const rect = object.getBoundingClientRect();
        const left = rect.left - layerRect.left;
        const top = rect.top - layerRect.top;
        const insideX = x > left - padding && x < left + rect.width + padding;
        const insideY = y > top - padding && y < top + rect.height + padding;
        if (!insideX || !insideY) return;
        const distance = Math.hypot(x - (left + rect.width / 2), y - (top + rect.height / 2));
        if (distance < nearestDistance) {
            nearest = object;
            nearestDistance = distance;
        }
    });
    if (nearest === hoveredObject) return;
    hoveredObject?.classList.remove('nearby');
    hoveredObject = nearest;
    hoveredObject?.classList.add('nearby');
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
        cursor.style.background = currentGesture === '抓取手势' ? '#ff4d61' : currentGesture === '握拳吸引' ? '#8b5cf6' : '#22c55e';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '10';
        cursor.style.transform = 'translate(-50%, -50%)';
        area.appendChild(cursor);
    }

    // 更新光标位置和颜色
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    const isField = currentGesture === '握拳吸引';
    const isFinger = currentGesture === '指尖点按';
    cursor.style.width = isField ? '46px' : isFinger ? '15px' : '20px';
    cursor.style.height = isField ? '46px' : isFinger ? '15px' : '20px';
    cursor.style.background = currentGesture === '抓取手势' ? '#ff4d61' : isField ? 'rgba(139,92,246,.42)' : isFinger ? '#ffb020' : '#22c55e';
    cursor.style.border = isField ? '2px solid rgba(216,190,255,.9)' : '0';
    cursor.style.boxShadow = isField ? '0 0 24px rgba(139,92,246,.75)' : 'none';
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
        // 爆裂动画中的球体不可被抓取，等待重生。
        if (obj.classList.contains('exploding')) continue;
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
        const grabRadius = obj.classList.contains('gesture-ball') ? Math.max(78, objRect.width * 1.12) : 58;
        if (distance < grabRadius) {
            const isVideoBall = obj.classList.contains('video-gesture-ball');
            if (!isVideoBall) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    voice.synthesizeSpeechSentenceBySentence("抓取" + (obj.dataset.name || '收藏品'));
                }, 500);
            }

            // 正确计算偏移量：光标位置 - 物品当前位置
            grabOffset = {
                x: cursorX - objLeft,
                y: cursorY - objTop
            };

            grabbedObject = obj;
            bringToFront(obj);
            obj.classList.add('grabbing');
            const ballState = ballStates.get(obj);
            if (ballState) {
                ballState.touched = true;
                ballState.lastTouchedAt = performance.now();
                ballState.moodChangedAt = performance.now();
                setBallMood(obj, ballState, 'happy');
            }
            createSoftParticles(obj, 'grab');
            if (!isVideoBall) showReaction(obj);
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
    const ballState = ballStates.get(object);
    if (ballState) ballState.touched = true;
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
    element.classList.remove('grabbing', 'two-hand-stretch');
    element.style.removeProperty('--grab-scale-x');
    element.style.removeProperty('--grab-scale-y');
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
        grabbedObject.classList.remove('grabbing', 'two-hand-stretch');
        grabbedObject.style.removeProperty('--grab-scale-x');
        grabbedObject.style.removeProperty('--grab-scale-y');
        grabbedObject.style.removeProperty('--stretch-scale-x');
        grabbedObject.style.removeProperty('--stretch-scale-y');
        grabbedObject.style.removeProperty('--stretch-angle');
        grabbedObject = null;
        createSoftParticles(releasedObject, 'release');
        // 重置偏移量
        grabOffset = { x: 0, y: 0 };
    }
}

function resetInteraction() {
    finishTwoHandStretch();
    releaseObject();
    endPointerDrag();
    removeCursor();
    liveHandState.active = false;
    dualHandState.active = false;
    dualHandState.portalActive = false;
    fingerPath = [];
    pathOrbit = null;
    clearBodyPose();
    renderEnergyRope(null, null, false);
    if (reactionTimer) clearTimeout(reactionTimer);
    const popup = document.getElementById('reactionPopup');
    popup?.classList.remove('show');
    popup?.setAttribute('aria-hidden', 'true');
}

export { updateInteraction, updateBodyPose, clearBodyPose, resetInteraction, resetVideoBalls, grabbedObject };
