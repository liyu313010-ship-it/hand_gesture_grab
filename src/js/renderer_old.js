// 清除画布
function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 绘制手部关键点
function drawHands(ctx, hands) {
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
    //   ctx.fillText(`${keypoint.name}`, x + 10, y);
    }

    // 绘制连接线
    if (hand.keypoints3D) {
      drawConnections(ctx, hand.keypoints, hand.keypoints3D);
    }
  }
}

// 绘制连接线（简化实现）
function drawConnections(ctx, keypoints, connections) {
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;

  for (const connection of connections) {
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

export { clearCanvas, drawHands, drawConnections };