import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { drawHands, clearCanvas, createRenderContext } from './renderer.js';
import { updateInteraction, handleHandsMissing } from './interaction.js';
import { recognizeAlphabet, fingerCountToLetter, countExtendedFingers } from './gesture-recognition.js';
import { updateStatus, updateInteractionStatus, updateRecognitionStatus } from './utils.js';
import { initSpeechSynthesis } from './voice.js';
import { updateBodyTracking } from './body-tracking.js';

let detector;
let currentGesture = '未检测到手势';
let handPosition = { x: 0, y: 0 };
let currentFingerCount = 0;
let currentLetter = '—';
// 捏合使用迟滞阈值：进入抓取后允许两指略微抖开，避免球体在手中频繁抓取/释放。
let pinchActive = false;
const SMOOTH_WINDOW = 6;
let leftCountHistory = [];
let rightCountHistory = [];
let lastSpokenLetter = '';
let pinchMissFrames = 0;
let missingHandFrames = 0;
const letterVoice = initSpeechSynthesis();

function pushWindow(list, value) {
  list.push(value);
  if (list.length > SMOOTH_WINDOW) list.shift();
}

function modeOf(values) {
  const frequencies = new Map();
  for (const value of values) {
    frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
  }
  return [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// 对左右两侧的手指数分别做多帧多数表决再拼接编码，
// 避免单帧关键点抖动造成手指数跳变、字母频繁闪烁。
function smoothRecognition(nextRecognition) {
  // 已检测到手但五指均收拢时立即显示0，不让前几帧的伸指结果继续占多数。
  if (nextRecognition.totalCount === 0) {
    leftCountHistory = [0];
    rightCountHistory = [0];
    return { ...nextRecognition, code: 0, paired: false, letter: '—' };
  }

  pushWindow(leftCountHistory, nextRecognition.leftCount);
  pushWindow(rightCountHistory, nextRecognition.rightCount);

  const leftCount = modeOf(leftCountHistory);
  const rightCount = modeOf(rightCountHistory);
  const totalCount = leftCount + rightCount;
  const paired = leftCount >= 1 && rightCount >= 1;
  const code = paired ? Number(`${leftCount}${rightCount}`) : totalCount;

  return { leftCount, rightCount, totalCount, code, paired, letter: fingerCountToLetter(code) };
}

// 初始化检测器
async function initDetector() {
  // MediaPipe浏览器运行时通过WebGL执行模型推理。主动申请高性能上下文并记录实际GPU；
  // 若浏览器关闭了硬件加速则标记为软件回退，便于直接定位卡顿原因。
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2', { powerPreference: 'high-performance', antialias: false }) ||
    probe.getContext('webgl', { powerPreference: 'high-performance', antialias: false });
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    document.body.dataset.computeBackend = 'webgl-gpu';
    document.body.dataset.gpuRenderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : 'WebGL hardware acceleration';
    const computeChip = document.querySelector('.camera-section .model-chip');
    if (computeChip) {
      computeChip.textContent = '21 KEYPOINTS · GPU';
      computeChip.title = document.body.dataset.gpuRenderer;
    }
    console.info(`GPU加速已启用：${document.body.dataset.gpuRenderer}`);
  } else {
    document.body.dataset.computeBackend = 'software-fallback';
    const computeChip = document.querySelector('.camera-section .model-chip');
    if (computeChip) computeChip.textContent = '21 KEYPOINTS · CPU';
    console.warn('WebGL不可用，浏览器正在使用软件回退；请在浏览器设置中开启硬件加速。');
  }
  detector = await handPoseDetection.createDetector(
    handPoseDetection.SupportedModels.MediaPipeHands, 
    {
      runtime: 'mediapipe',
      modelType: 'full',
      maxHands: 2,
      // 稍微降低检测/跟踪门槛，改善手掌较远、靠近画面边缘或光线一般时的连续识别。
      minDetectionConfidence: 0.4,
      minTrackingConfidence: 0.4,
      // 资源位于 public/mediapipe/hands/，dev 与 build 后都能按同一路径加载（原来指向 node_modules 的路径在构建产物中会 404）。
      solutionPath: `${import.meta.env.BASE_URL}mediapipe/hands/`
    }
  );
  return detector;
}

// 检测手部
function detectHands(video, canvas, detector) {
  let animationId;
  
  const ctx = createRenderContext(canvas);
  
  async function detect() {
    try {
      // 检测手部 水平翻转检测结果
      const hands = await detector.estimateHands(video, { flipHorizontal: true });
      updateBodyTracking(video, canvas);
      // 清除画布
      clearCanvas(ctx, canvas);

      if (hands.length > 0) {
        missingHandFrames = 0;
        // 绘制手部关键点
        drawHands(ctx, hands);

        // 优先选择正在捏合的手作为主交互手。两只手都能抓球，避免模型调整
        // Left / Right 返回顺序时，正在操作的手突然失去控制。
        const interactionHand = selectInteractionHand(hands);
        analyzeGesture(interactionHand);
        if (document.body.dataset.mode === 'letters') {
          analyzeLetters(hands);
        } else {
          // 收藏品和球体模式只保留手势交互，不执行字母编码与英文播报。
          currentFingerCount = 0;
          currentLetter = '—';
          leftCountHistory = [];
          rightCountHistory = [];
          lastSpokenLetter = '';
        }

        // 更新交互
        updateInteraction(interactionHand, canvas, currentGesture, handPosition, hands);
      } else {
        missingHandFrames += 1;
        // 短暂漏检不立即松球；连续漏检后才清空捏合状态。
        if (missingHandFrames >= 3) {
          pinchActive = false;
          pinchMissFrames = 0;
        }
        currentGesture = '未检测到手势';
        currentFingerCount = 0;
        currentLetter = '—';
        leftCountHistory = [];
        rightCountHistory = [];
        lastSpokenLetter = '';
        updateInteractionStatus(currentGesture);
        updateRecognitionStatus(currentFingerCount, currentLetter, {
          leftCount: 0,
          rightCount: 0,
          totalCount: 0,
          code: 0,
          paired: false
        });
        handleHandsMissing();
      }

      // 更新状态
      updateStatus(`检测到 ${hands.length} 只手`);
    } catch (error) {
      console.error('手部检测错误:', error);
    }

    // 继续检测
    animationId = requestAnimationFrame(detect);
  }
  
  // 开始检测循环
  detect();
  return animationId;
}

// 停止检测
function stopDetection(animationId) {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
}

// 分析手势
function analyzeGesture(hand) {
  // 简化实现：根据拇指和食指指尖的距离判断手势
  const thumbTip = hand.keypoints.find(k => k.name === 'thumb_tip');
  const indexTip = hand.keypoints.find(k => k.name === 'index_finger_tip');

  if (thumbTip && indexTip) {
    // 计算两点之间的距离
    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // 根据距离判断手势
    const indexPip = hand.keypoints.find(k => k.name === 'index_finger_pip');
    const wrist = hand.keypoints.find(k => k.name === 'wrist');
    const extendedCount = countExtendedFingers(hand);
    const indexExtended = indexPip && wrist &&
      Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) >
      Math.hypot(indexPip.x - wrist.x, indexPip.y - wrist.y) * 1.14;

    const indexMcp = hand.keypoints.find(k => k.name === 'index_finger_mcp');
    const pinkyMcp = hand.keypoints.find(k => k.name === 'pinky_finger_mcp');
    const palmWidth = indexMcp && pinkyMcp
      ? Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y)
      : 80;
    // 使用掌宽比例与迟滞判断捏合：开始抓取的门槛较宽，已抓住后再略微张开也不会立刻掉球。
    // 这样既适应手离镜头远近，也能吸收关键点的逐帧抖动。
    const pinchStartThreshold = Math.max(32, Math.min(72, palmWidth * .7));
    const pinchReleaseThreshold = Math.max(42, Math.min(88, palmWidth * .9));
    const withinPinchRange = pinchActive
      ? distance < pinchReleaseThreshold
      : distance < pinchStartThreshold;
    if (withinPinchRange) pinchMissFrames = 0;
    else if (pinchActive) pinchMissFrames += 1;
    // 连续三帧确认松开，吸收关键点偶发跳动，抓住的球不会无故掉落。
    const isPinching = withinPinchRange || (pinchActive && pinchMissFrames < 3);

    const middleTip = hand.keypoints.find(k => k.name === 'middle_finger_tip');
    const middlePip = hand.keypoints.find(k => k.name === 'middle_finger_pip');
    const middleExtended = middleTip && middlePip && wrist &&
      Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) >
      Math.hypot(middlePip.x - wrist.x, middlePip.y - wrist.y) * 1.1;

    if (isPinching) {
      pinchActive = true;
      currentGesture = '抓取手势';
    } else if (extendedCount === 0 || (currentGesture === '握拳吸引' && extendedCount <= 1 && !indexExtended)) {
      pinchActive = false;
      pinchMissFrames = 0;
      currentGesture = '握拳吸引';
    } else if (indexExtended && !middleExtended) {
      pinchActive = false;
      currentGesture = '指尖点按';
    } else {
      pinchActive = false;
      currentGesture = '张开手势';
    }

    if (currentGesture === '抓取手势') {
      // 捏合时使用两指中点，球体会在真实捏合位置被抓住。
      handPosition.x = (thumbTip.x + indexTip.x) / 2;
      handPosition.y = (thumbTip.y + indexTip.y) / 2;
    } else if (currentGesture === '指尖点按') {
      handPosition.x = indexTip.x;
      handPosition.y = indexTip.y;
    } else {
      // 张开手掌时使用掌心位置，便于从下方托举或快速拍击球体。
      const palmNames = ['wrist', 'index_finger_mcp', 'middle_finger_mcp', 'ring_finger_mcp', 'pinky_finger_mcp'];
      const palmPoints = palmNames
        .map(name => hand.keypoints.find(point => point.name === name))
        .filter(Boolean);
      handPosition.x = palmPoints.reduce((sum, point) => sum + point.x, 0) / palmPoints.length;
      handPosition.y = palmPoints.reduce((sum, point) => sum + point.y, 0) / palmPoints.length;
    }
  }

  updateInteractionStatus(currentGesture);
}

function selectInteractionHand(hands) {
  if (!hands?.length) return null;
  const pinchingHand = hands.find((hand) => {
    const thumb = hand.keypoints?.find(point => point.name === 'thumb_tip');
    const index = hand.keypoints?.find(point => point.name === 'index_finger_tip');
    const indexMcp = hand.keypoints?.find(point => point.name === 'index_finger_mcp');
    const pinkyMcp = hand.keypoints?.find(point => point.name === 'pinky_finger_mcp');
    if (!thumb || !index) return false;
    const palmWidth = indexMcp && pinkyMcp
      ? Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y)
      : 80;
    return Math.hypot(thumb.x - index.x, thumb.y - index.y) < Math.max(34, Math.min(76, palmWidth * .74));
  });
  return pinchingHand || hands[0];
}

function analyzeLetters(hands) {
  const recognition = smoothRecognition(recognizeAlphabet(hands));
  // 顶部大数字展示最终编码，与字母保持一致：单手 1—5 指，双手为拼接数字。
  currentFingerCount = recognition.code;
  currentLetter = recognition.letter;
  updateRecognitionStatus(currentFingerCount, currentLetter, recognition);

  if (currentLetter !== '—' && currentLetter !== lastSpokenLetter) {
    lastSpokenLetter = currentLetter;
    letterVoice.speakEnglishLetter(currentLetter);
  }
}

export { 
  initDetector, 
  detectHands, 
  stopDetection, 
  currentGesture, 
  handPosition,
  currentFingerCount,
  currentLetter
};
