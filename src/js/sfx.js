/**
 * 交互音效模块：全部用 WebAudio 现场合成，不依赖任何音频素材文件。
 * 统一走「主增益 → 压缩器 → 输出」，多音叠加不爆音；
 * 同时限制并发声部数与同名音效触发间隔，连续碰撞时音效不会糊成一片。
 * 用法：import { playSfx, unlockSfx } from './sfx.js';
 *      playSfx('hit', { material: 'glass', intensity: 220 });
 */
const VOICE_LIMIT = 9;
const THROTTLE_MS = { hit: 75, grab: 90, release: 90, explode: 140, merge: 160, split: 160, portal: 320 };

let audioContext = null;
let masterGain = null;
let noiseBuffer = null;
const activeVoices = new Set();
const lastPlayedAt = new Map();

function ensureContext() {
    if (audioContext) return audioContext;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 14;
    compressor.ratio.value = 6;
    masterGain = audioContext.createGain();
    masterGain.gain.value = .46;
    masterGain.connect(compressor);
    compressor.connect(audioContext.destination);
    return audioContext;
}

// 音频上下文创建后可能仍是 suspended：只在用户手势里尝试恢复，失败就先跳过本次音效。
function runningContext() {
    const context = ensureContext();
    if (!context) return null;
    if (context.state === 'running') return context;
    if (context.state === 'suspended') context.resume().catch(() => {});
    return null;
}

// 采集一段白噪声做素材，所有噪声类音效（水流、碎裂、风声）都复用它。
function getNoiseBuffer(context) {
    if (noiseBuffer) return noiseBuffer;
    const length = Math.floor(context.sampleRate * .8);
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    return noiseBuffer;
}

function trackVoice(source, nodes) {
    if (activeVoices.size >= VOICE_LIMIT) return false;
    activeVoices.add(source);
    source.onended = () => {
        activeVoices.delete(source);
        nodes.forEach(node => node.disconnect?.());
    };
    return true;
}

// 单音：振荡器 + 增益包络，支持起止频率扫频（水滴下坠、泡泡上弹都靠它）。
function tone({ type = 'sine', from, to = from, duration = .18, gain = .1, delay = 0, attack = .006 }) {
    const context = runningContext();
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(24, from), start);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, to), start + duration);
    const amp = context.createGain();
    amp.gain.setValueAtTime(.0001, start);
    amp.gain.linearRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(amp);
    amp.connect(masterGain);
    if (!trackVoice(oscillator, [oscillator, amp])) return;
    oscillator.start(start);
    oscillator.stop(start + duration + .05);
}

// 噪声：白噪声 → 双二阶滤波（可扫频）→ 包络，用于水花、碎裂、能量爆裂。
function noise({ duration = .2, gain = .08, filterType = 'bandpass', from = 800, to = from, q = 1, delay = 0 }) {
    const context = runningContext();
    if (!context) return;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = getNoiseBuffer(context);
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(40, from), start);
    if (to !== from) filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), start + duration);
    filter.Q.value = q;
    const amp = context.createGain();
    amp.gain.setValueAtTime(.0001, start);
    amp.gain.linearRampToValueAtTime(gain, start + .012);
    amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(masterGain);
    if (!trackVoice(source, [source, filter, amp])) return;
    source.start(start);
    source.stop(start + duration + .06);
}

// 六种材质各有自己的碰撞音色：水滴下坠、果冻弹跳、玻璃脆响、火焰呼啸、磁力电弧、泡泡上弹。
function playMaterialHit(material, power) {
    switch (material) {
        case 'water':
            tone({ type: 'sine', from: 330 + power * 260, to: 148, duration: .15, gain: .11 * power });
            noise({ duration: .09, gain: .05 * power, filterType: 'bandpass', from: 2400, to: 700, q: .9 });
            break;
        case 'gel':
            tone({ type: 'triangle', from: 430, to: 168, duration: .22, gain: .1 * power });
            tone({ type: 'triangle', from: 640, to: 240, duration: .16, gain: .05 * power, delay: .035 });
            break;
        case 'glass':
            tone({ type: 'sine', from: 2350, to: 1650, duration: .1, gain: .06 * power });
            noise({ duration: .13, gain: .08 * power, filterType: 'highpass', from: 3200, q: .8 });
            break;
        case 'fire':
            noise({ duration: .24, gain: .09 * power, filterType: 'bandpass', from: 460, to: 1500, q: 1.3 });
            tone({ type: 'sine', from: 208, to: 480, duration: .2, gain: .045 * power });
            break;
        case 'magnet':
            tone({ type: 'sawtooth', from: 920, to: 1500, duration: .07, gain: .055 * power });
            tone({ type: 'square', from: 1300, to: 210, duration: .12, gain: .05 * power, delay: .045 });
            break;
        case 'bubble':
            tone({ type: 'sine', from: 280, to: 880, duration: .11, gain: .11 * power });
            noise({ duration: .03, gain: .04 * power, filterType: 'highpass', from: 2600 });
            break;
        default:
            tone({ type: 'sine', from: 420, to: 180, duration: .16, gain: .09 * power });
    }
}

function playExplosion(material, power) {
    tone({ type: 'sine', from: 156, to: 42, duration: .5, gain: .19 * power });
    noise({ duration: .48, gain: .13 * power, filterType: 'lowpass', from: 1600, to: 190, q: .7 });
    playMaterialHit(material, .8);
}

function playSfxInternal(name, options) {
    const power = Math.min(1.2, Math.max(.35, (options.intensity || 160) / 200));
    switch (name) {
        case 'hit':
            playMaterialHit(options.material, power);
            break;
        case 'grab':
            tone({ type: 'sine', from: 330, to: 560, duration: .13, gain: .07 });
            noise({ duration: .1, gain: .03, filterType: 'bandpass', from: 900, to: 1600, q: .8 });
            break;
        case 'release':
            noise({ duration: .28, gain: .07, filterType: 'bandpass', from: 1400, to: 320, q: .8 });
            tone({ type: 'sine', from: 620, to: 220, duration: .22, gain: .05 });
            break;
        case 'explode':
            playExplosion(options.material, Math.min(1.2, Math.max(.5, power)));
            break;
        case 'merge':
            tone({ type: 'sine', from: 660, duration: .18, gain: .07 });
            tone({ type: 'sine', from: 990, duration: .24, gain: .06, delay: .09 });
            break;
        case 'split':
            noise({ duration: .08, gain: .09, filterType: 'highpass', from: 1800 });
            noise({ duration: .12, gain: .06, filterType: 'highpass', from: 2600, delay: .05 });
            tone({ type: 'sine', from: 1500, to: 520, duration: .2, gain: .05, delay: .03 });
            break;
        case 'portal':
            tone({ type: 'sine', from: 300, to: 1220, duration: .42, gain: .07 });
            tone({ type: 'sine', from: 318, to: 1265, duration: .42, gain: .05, delay: .02 });
            noise({ duration: .4, gain: .05, filterType: 'bandpass', from: 900, to: 3200, q: 1.2 });
            break;
        default:
            break;
    }
}

export function playSfx(name, options = {}) {
    if (!name || document.hidden) return;
    const now = performance.now();
    const interval = THROTTLE_MS[name] ?? 120;
    if (now - (lastPlayedAt.get(name) || 0) < interval) return;
    lastPlayedAt.set(name, now);
    if (!runningContext()) return;
    try {
        playSfxInternal(name, options);
    } catch (error) {
        // 音效只是反馈，任何合成异常都不应影响手势交互。
        console.warn('音效播放失败:', error);
    }
}

// 浏览器要求音频必须由用户手势解锁：提前挂一次性监听，第一次点击/按键就能获得上下文。
export function unlockSfx() {
    const context = ensureContext();
    if (context?.state === 'suspended') context.resume().catch(() => {});
    return context;
}

if (typeof window !== 'undefined') {
    const unlockOnce = () => {
        const context = unlockSfx();
        if (context?.state === 'running') {
            window.removeEventListener('pointerdown', unlockOnce);
            window.removeEventListener('keydown', unlockOnce);
        }
    };
    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    window.addEventListener('keydown', unlockOnce);
}
