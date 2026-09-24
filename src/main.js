import { setupCamera, stopCamera, isCameraOn } from './js/camera.js';
import { initDetector, detectHands, stopDetection } from './js/detector.js';
import { resetInteraction, resetVideoBalls } from './js/interaction.js';
import { updateStatus, updateInteractionStatus } from './js/utils.js';
import { initSpeechSynthesis } from './js/voice.js';
let voice = initSpeechSynthesis();
// 全局变量
let video;
let canvas;
let detector;
let animationId;

const MODE_CONFIG = {
  letters: {
    index: '02 / LETTER',
    title: '字母识别台',
    chip: 'SHOW LETTER',
    stageTitle: 'LETTER RECOGNITION',
    stageHint: '握拳为0，手指数与双手编码映射A—Z',
    status: '字母识别模式'
  },
  collection: {
    index: '02 / COLLECTION',
    title: '动态收藏台',
    chip: 'PINCH TO PICK',
    stageTitle: 'MY MOTION SHELF',
    stageHint: '手势抓取 · 鼠标拖拽布置',
    status: '收藏品抓取模式'
  },
  ball: {
    index: '02 / SPHERE',
    title: '球体交互台',
    chip: 'GRAB THE BALL',
    stageTitle: 'GESTURE SPHERE',
    stageHint: '张掌托举或拍击，捏合抓取，张开放下',
    status: '球体抓取模式'
  }
};

function setMode(mode) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.letters;
  const selectedMode = MODE_CONFIG[mode] ? mode : 'letters';
  document.body.dataset.mode = selectedMode;
  resetInteraction();

  document.querySelectorAll('.mode-button').forEach((button) => {
    const active = button.dataset.mode === selectedMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-mode-layer]').forEach((layer) => {
    layer.classList.toggle('active', layer.dataset.modeLayer === selectedMode);
  });

  const sectionIndex = document.getElementById('modeSectionIndex');
  const sectionTitle = document.getElementById('modeSectionTitle');
  const sectionChip = document.getElementById('modeSectionChip');
  const stageTitle = document.querySelector('#stageTitle span');
  const stageHint = document.querySelector('#stageTitle small');
  if (sectionIndex) sectionIndex.textContent = config.index;
  if (sectionTitle) sectionTitle.textContent = config.title;
  if (sectionChip) sectionChip.textContent = config.chip;
  if (stageTitle) stageTitle.textContent = config.stageTitle;
  if (stageHint) stageHint.textContent = config.stageHint;
  updateInteractionStatus(config.status);
  if (selectedMode === 'ball') resetVideoBalls();
}

// 初始化函数
async function init() {
  video = document.getElementById('video');
  canvas = document.getElementById('output');
  const alphabetMap = document.getElementById('alphabetMap');
  if (alphabetMap) {
    alphabetMap.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      .split('')
      .map((letter, index) => `<span class="alphabet-key" data-letter="${letter}"><small>${index + 1}</small>${letter}</span>`)
      .join('');
  }
  // 设置按钮事件监听
  document.getElementById('startBtn').addEventListener('click', toggleCamera);
  document.querySelectorAll('.mode-button').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });
  setMode('letters');
  // 初始化手部检测模型
  try {
    detector = await initDetector();
    updateStatus('模型加载成功，请启动摄像头');
    voice.synthesizeSpeechSentenceBySentence("模型加载成功，请启动摄像头")
    
  } catch (error) {
    console.error('模型加载失败:', error);
    updateStatus('模型加载失败: ' + error.message);
  }
}
// 更新“本地实时识别”状态灯：识别链路连接（摄像头与检测运行中）时绿色，否则红色
function setConnectionDot(online) {
  const dot = document.getElementById('connectionDot');
  if (!dot) return;
  dot.classList.toggle('dot-online', online);
  dot.classList.toggle('dot-offline', !online);
}

// 切换摄像头状态
async function toggleCamera() {
  if (isCameraOn) {
    voice.synthesizeSpeechSentenceBySentence("摄像头已关闭")

    // 关闭摄像头
    stopCamera(video);
    stopDetection(animationId);
    setConnectionDot(false);
    document.getElementById('startBtn').textContent = '启动摄像头';
    updateStatus('摄像头已关闭');
  } else {
    // 启动摄像头
    try {
      await voice.synthesizeSpeechSentenceBySentence("摄像头启动中")
      await setupCamera(video, canvas);
      document.getElementById('startBtn').textContent = '关闭摄像头';
      updateStatus('摄像头启动中...');

      // 开始检测
      animationId = detectHands(video, canvas, detector);
      setConnectionDot(true);
    
    } catch (error) {
      console.error('摄像头启动失败:', error);
      setConnectionDot(false);
      updateStatus('摄像头启动失败: ' + error.message);
    }
  }
}

// 页面加载完成后初始化
window.addEventListener('load', init);

// 导出供其他模块使用
export { video, canvas, animationId };
