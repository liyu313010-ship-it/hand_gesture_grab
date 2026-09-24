let isCameraOn = false;

function getVideoConstraints(mode = 'letters') {
  if (mode === 'ball') {
    // 球体模式优先请求手机式竖屏比例；不支持竖屏的电脑摄像头会自动回退到可用比例。
    return {
      width: { ideal: 720 },
      height: { ideal: 1280 },
      aspectRatio: { ideal: 9 / 16 },
      frameRate: { ideal: 30, min: 20 },
      facingMode: 'user'
    };
  }
  return {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    aspectRatio: { ideal: 16 / 9 },
    frameRate: { ideal: 30, min: 20 },
    facingMode: 'user'
  };
}

function syncCanvasToVideo(video, canvas) {
  if (!video.videoWidth || !video.videoHeight) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

// 设置摄像头
async function setupCamera(video, canvas, mode = document.body.dataset.mode) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: getVideoConstraints(mode)
  });

  video.srcObject = stream;
  video.onresize = () => syncCanvasToVideo(video, canvas);

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      syncCanvasToVideo(video, canvas);
      isCameraOn = true;
      resolve();
    };
  });
}

// 摄像头已开启时切换模式，不重启识别循环，只调整当前视频轨道的目标比例。
async function updateCameraMode(video, canvas, mode) {
  const track = video.srcObject?.getVideoTracks?.()[0];
  if (!track) return;
  await track.applyConstraints(getVideoConstraints(mode));
  await new Promise(resolve => window.setTimeout(resolve, 120));
  syncCanvasToVideo(video, canvas);
}

// 停止摄像头
function stopCamera(video) {
  if (video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    video.srcObject = null;
  }
  
  isCameraOn = false;
}

export { setupCamera, updateCameraMode, stopCamera, isCameraOn };
