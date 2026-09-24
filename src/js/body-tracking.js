import { updateBodyPose, clearBodyPose } from './interaction.js';

let poseDetector = null;
let poseLoading = null;
let poseBusy = false;
let lastPoseAt = 0;

async function initBodyTracking() {
  if (poseDetector) return poseDetector;
  if (poseLoading) return poseLoading;
  poseLoading = import('@tensorflow-models/pose-detection').then((poseDetection) =>
    poseDetection.createDetector(
      poseDetection.SupportedModels.BlazePose,
      {
        runtime: 'mediapipe',
        modelType: 'lite',
        enableSmoothing: true,
        solutionPath: `${import.meta.env.BASE_URL}mediapipe/pose/`
      }
    )
  ).then((loaded) => {
    poseDetector = loaded;
    document.body.dataset.poseReady = 'true';
    return loaded;
  }).catch((error) => {
    document.body.dataset.poseReady = 'false';
    console.warn('身体姿态模型加载失败，手势功能继续可用:', error);
    return null;
  });
  return poseLoading;
}

function updateBodyTracking(video, canvas) {
  if (document.body.dataset.mode !== 'ball') return;
  if (!poseDetector) {
    initBodyTracking();
    return;
  }
  if (poseBusy) return;
  const now = performance.now();
  // 姿态模型低频运行，手部模型继续保持高帧率，兼顾身体碰撞与抓取响应。
  if (now - lastPoseAt < 180) return;
  lastPoseAt = now;
  poseBusy = true;
  poseDetector.estimatePoses(video, { flipHorizontal: true })
    .then((poses) => {
      if (poses[0]) updateBodyPose(poses[0], canvas);
      else clearBodyPose();
    })
    .catch((error) => console.warn('身体姿态检测跳过一帧:', error))
    .finally(() => { poseBusy = false; });
}

export { initBodyTracking, updateBodyTracking };
