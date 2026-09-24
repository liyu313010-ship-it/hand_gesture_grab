let isCameraOn = false;

// 设置摄像头
async function setupCamera(video, canvas) {
  // 用 ideal 让浏览器在能力允许时给到 720p，全屏球体模式画面更清晰，识别也更稳。
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      aspectRatio: { ideal: 16 / 9 },
      frameRate: { ideal: 30, min: 20 },
      facingMode: 'user'
    }
  });

  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      // 设置canvas尺寸与视频相同
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      isCameraOn = true;
      resolve();
    };
  });
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

export { setupCamera, stopCamera, isCameraOn };
