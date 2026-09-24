import { setupCamera, updateCameraMode, stopCamera, isCameraOn } from './js/camera.js';
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
    status: '字母识别模式',
    guide: {
      kicker: 'LETTER RECOGNITION',
      intro: '用手指数组合出编码，点亮对应字母并语音播报。',
      steps: [
        { title: '单手识别', detail: '握拳为 0，伸出 1—5 根手指依次识别 A—E' },
        { title: '双手组合', detail: '双手手指数拼成两位数（2 与 3 拼成 23），1—26 依次对应 A—Z' },
        { title: '保持完整入镜', detail: '光线充足，让手掌完整出现在镜头中' }
      ]
    }
  },
  collection: {
    index: '02 / COLLECTION',
    title: '动态收藏台',
    chip: 'PINCH TO PICK',
    stageTitle: 'MY MOTION SHELF',
    stageHint: '手势抓取 · 鼠标拖拽布置',
    status: '收藏品抓取模式',
    guide: {
      kicker: 'PINCH TO PICK',
      intro: '用捏合手势从收藏台拾取动态素材。',
      steps: [
        { title: '捏合抓取', detail: '拇指与食指捏合，对准收藏品即可抓住' },
        { title: '拖动与放下', detail: '移动手掌拖动物品，张开手指放下' },
        { title: '鼠标也支持', detail: '不用手势时，可直接用鼠标拖拽摆放' }
      ]
    }
  },
  ball: {
    index: '02 / SPHERE',
    title: '球体交互台',
    chip: 'GRAB THE BALL',
    stageTitle: 'GESTURE SPHERE',
    stageHint: '张掌托举或拍击，捏合抓取，张开放下',
    status: '球体抓取模式',
    guide: {
      kicker: 'GRAB THE BALL',
      intro: '数字生命场：保留抓取与托举，并加入力场、材质、融合、身体碰撞和轨迹绘制。',
      steps: [
        { title: '原有交互', detail: '张掌托举或拍击，捏合抓取，握拳吸引，投入目标计分' },
        { title: '连续力场', detail: '张掌斥力、握拳引力、旋转手掌形成涡流，手指张幅控制范围' },
        { title: '双手空间', detail: '双手靠近或展开压缩/膨胀球群，两掌之间形成传送门和能量绳' },
        { title: '六种材质', detail: '水、果冻、玻璃、火焰、磁力和泡泡拥有不同重力、弹性与特殊反应' },
        { title: '融合与分裂', detail: '低速相碰的同材质球会融合，双手捏合拉开可把大球分裂' },
        { title: '身体场景', detail: '球可与肩、手臂、身体和腿部轮廓碰撞并沿轮廓滚动' },
        { title: '指尖绘轨', detail: '单独伸出食指画路径；闭合成圆后，附近球体会沿圆环运动' }
      ]
    }
  }
};

function setMode(mode) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.letters;
  const selectedMode = MODE_CONFIG[mode] ? mode : 'letters';
  document.body.dataset.mode = selectedMode;
  resetInteraction();
  if (selectedMode !== 'letters') window.speechSynthesis?.cancel();

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
  if (isCameraOn && video && canvas) {
    updateCameraMode(video, canvas, selectedMode).catch((error) => {
      // 某些电脑摄像头不提供竖屏输出，保留设备当前画面即可，CSS仍以竖框完整显示。
      console.warn('摄像头比例切换失败，继续使用设备默认比例:', error);
    });
  }
}

// 点击功能按钮时弹出交互说明弹窗；点 ✕ 关闭后即可继续交互。
function showModeGuide(mode) {
  const config = MODE_CONFIG[mode];
  const popup = document.getElementById('modeGuidePopup');
  if (!config?.guide || !popup) return;
  document.getElementById('modeGuideKicker').textContent = config.guide.kicker;
  document.getElementById('modeGuideTitle').textContent = config.title;
  document.getElementById('modeGuideIntro').textContent = config.guide.intro;
  const stepList = document.getElementById('modeGuideSteps');
  if (stepList) {
    stepList.innerHTML = config.guide.steps
      .map((step, index) => `<li><b>0${index + 1}</b><div><strong>${step.title}</strong><span>${step.detail}</span></div></li>`)
      .join('');
  }
  popup.classList.add('show');
  popup.setAttribute('aria-hidden', 'false');
  document.body.classList.add('guide-open');
}

function hideModeGuide() {
  const popup = document.getElementById('modeGuidePopup');
  if (!popup) return;
  popup.classList.remove('show');
  popup.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('guide-open');
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
    button.addEventListener('click', () => {
      setMode(button.dataset.mode);
      // 每次点击功能入口都弹出该功能的交互说明，关闭后再继续交互。
      showModeGuide(button.dataset.mode);
    });
  });
  document.getElementById('modeGuideClose')?.addEventListener('click', hideModeGuide);
  setMode('letters');
  // 初始化手部检测模型
  const loading = document.getElementById('modelLoading');
  const loadingText = document.getElementById('modelLoadingText');
  try {
    detector = await initDetector();
    // 模型就绪只更新文字状态，不进行语音播报。
    updateStatus('模型已就绪');
    loading?.classList.add('hidden');
  } catch (error) {
    console.error('模型加载失败:', error);
    updateStatus('模型加载失败: ' + error.message);
    loading?.classList.add('failed');
    if (loadingText) loadingText.textContent = '模型加载失败，请刷新页面重试';
  }
}
// 更新“本地实时识别”状态灯：识别链路连接（摄像头与检测运行中）时绿色，否则红色
function setConnectionDot(online) {
  const dot = document.getElementById('connectionDot');
  if (!dot) return;
  dot.classList.toggle('dot-online', online);
  dot.classList.toggle('dot-offline', !online);
}

// 同步启动按钮的开关视觉：切换状态图标与文案，已启动时加 camera-on 类。
function setCameraButtonState(on) {
  const button = document.getElementById('startBtn');
  const label = document.getElementById('startBtnLabel');
  if (button) button.classList.toggle('camera-on', on);
  // body 级状态类：控制占位提示隐藏与球体模式彩球出现。
  document.body.classList.toggle('camera-on', on);
  if (label) label.textContent = on ? '关闭摄像头' : '启动摄像头';
}

// 切换摄像头状态
async function toggleCamera() {
  if (isCameraOn) {
    voice.synthesizeSpeechSentenceBySentence("摄像头已关闭")

    // 关闭摄像头
    stopCamera(video);
    stopDetection(animationId);
    setConnectionDot(false);
    setCameraButtonState(false);
    updateStatus('摄像头已关闭');
  } else {
    // 启动摄像头
    try {
      // 播报与摄像头启动并行，避免部分浏览器的语音事件不返回时阻塞摄像头。
      voice.synthesizeSpeechSentenceBySentence("摄像头启动中")
      await setupCamera(video, canvas, document.body.dataset.mode);
      setCameraButtonState(true);
      updateStatus('摄像头启动中...');

      // 开始检测
      animationId = detectHands(video, canvas, detector);
      setConnectionDot(true);
      // 摄像头就绪后，球体模式才开始让彩球从顶部依次下落。
      if (document.body.dataset.mode === 'ball') resetVideoBalls();
    
    } catch (error) {
      console.error('摄像头启动失败:', error);
      setConnectionDot(false);
      setCameraButtonState(false);
      updateStatus('摄像头启动失败: ' + error.message);
    }
  }
}

// 页面加载完成后初始化
window.addEventListener('load', init);

// 导出供其他模块使用
export { video, canvas, animationId };
