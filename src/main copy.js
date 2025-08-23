
let voice = useSpeechSynthesis();
await voice.synthesizeSpeechSentenceBySentence("那些黑我的小黑子，我是你爹 mather fucker")

import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { useSpeechSynthesis } from "./js/voice";
// 全局变量
let video;
let canvas;
let ctx;
let detector;
let animationId;
let isCameraOn = false;
let currentGesture = '未检测到手势';
let grabbedObject = null;
let handPosition = { x: 0, y: 0 };

// 初始化函数
async function init() {
  video = document.getElementById('video');
  canvas = document.getElementById('output');
  ctx = canvas.getContext('2d');

  // 设置按钮事件监听
  document.getElementById('startBtn').addEventListener('click', toggleCamera);

  // 初始化手部检测模型
  try {
    detector = await handPoseDetection.createDetector(handPoseDetection.SupportedModels.MediaPipeHands, {
      runtime: 'mediapipe',
      modelType: 'full',
      maxHands: 2,
      // 模型资源
      // solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/'
      solutionPath: "node_modules/@mediapipe/hands/"
    });
    updateStatus('模型加载成功，请启动摄像头');
  } catch (error) {
    console.error('模型加载失败:', error);
    updateStatus('模型加载失败: ' + error.message);
  }
}

// 切换摄像头状态
async function toggleCamera() {
  if (isCameraOn) {
    // 关闭摄像头
    stopCamera();
    document.getElementById('startBtn').textContent = '启动摄像头';
    updateStatus('摄像头已关闭');
  } else {
    // 启动摄像头
    try {
      await setupCamera();
      isCameraOn = true;
      document.getElementById('startBtn').textContent = '关闭摄像头';
      updateStatus('摄像头启动中...');

      // 开始检测
      detectHands();
    } catch (error) {
      console.error('摄像头启动失败:', error);
      updateStatus('摄像头启动失败: ' + error.message);
    }
  }
}

// 设置摄像头
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 }
  });

  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      // 设置canvas尺寸与视频相同
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      resolve();
    };
  });
}

// 停止摄像头
function stopCamera() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    video.srcObject = null;
  }

  isCameraOn = false;

  // 清除画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 检测手部
async function detectHands() {
  if (!isCameraOn) return;

  try {
    // 检测手部
    const hands = await detector.estimateHands(video, { flipHorizontal: true });

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (hands.length > 0) {
      // 绘制手部关键点
      drawHands(hands);

      // 分析手势
      analyzeGesture(hands[0]);

      // 更新交互
      updateInteraction(hands[0]);
    } else {
      currentGesture = '未检测到手势';
      updateInteractionStatus();
    }

    // 更新状态
    updateStatus(`检测到 ${hands.length} 只手`);
  } catch (error) {
    console.error('手部检测错误:', error);
  }

  // 继续检测
  animationId = requestAnimationFrame(detectHands);
}

// 绘制手部关键点
function drawHands(hands) {
  for (const hand of hands) {
    // 绘制关键点
    for (const keypoint of hand.keypoints) {
      const { x, y } = keypoint;

      // 绘制点
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();

      // 绘制坐标文本
      ctx.font = '12px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText(`${keypoint.name}`, x + 10, y);
    }

    // 绘制连接线
    if (hand.keypoints3D) {
      // 这里可以添加关键点之间的连接线绘制逻辑
      // 简化实现，只绘制了几个主要连接线
      // drawConnections(ctx, hand.keypoints, handPoseDetection.util.getKeypointsConnections('MediaPipeHands'));
      drawConnections(ctx, hand.keypoints, hand.keypoints3D);
    }
  }
}

// 绘制连接线（简化实现）
function drawConnections(ctx, keypoints, connections) {
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;

  for (const connection of connections) {
    // const [start, end] = connection;
    const { start, end } = connection;
    const startPoint = keypoints.find(k => k.name === start);
    const endPoint = keypoints.find(k => k.name === end);

    if (startPoint && endPoint) {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
      ctx.stroke();
    }
  }
}

// 分析手势
function analyzeGesture(hand) {
  // 简化实现：根据拇指和食指指尖的距离判断手势
  const thumbTip = hand.keypoints.find(k => k.name === 'thumb_tip');
  const indexTip = hand.keypoints.find(k => k.name === 'index_finger_tip');

  if (thumbTip && indexTip) {
    // 计算两点之间的距离
    const distance = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));

    // 根据距离判断手势
    if (distance < 40) {
      currentGesture = '抓取手势';
    } else {
      currentGesture = '张开手势';
    }

    // 更新手部位置（使用掌心位置）
    const wrist = hand.keypoints.find(k => k.name === 'wrist');
    if (wrist) {
      handPosition.x = wrist.x;
      handPosition.y = wrist.y;
    }
  }

  updateInteractionStatus();
}

// 更新交互状态显示
function updateInteractionStatus() {
  document.getElementById('interactionStatus').textContent = `手势状态: ${currentGesture}`;
}

// 更新交互
function updateInteraction(hand) {
  // 将手部位置映射到交互区域
  const interactionArea = document.querySelector('.interaction-area');
  const rect = interactionArea.getBoundingClientRect();

  // 计算映射后的位置
  const mappedX = (handPosition.x / canvas.width) * rect.width;
  const mappedY = (handPosition.y / canvas.height) * rect.height;

  // 显示虚拟光标
  showCursor(interactionArea, mappedX, mappedY);

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
function showCursor(area, x, y) {
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

// 更新状态显示
function updateStatus(message) {
  document.getElementById('status').textContent = '状态: ' + message;
}

// 页面加载完成后初始化
window.addEventListener('load', init);
