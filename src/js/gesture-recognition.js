const FINGER_JOINTS = [
  ['thumb_tip', 'thumb_ip'],
  ['index_finger_tip', 'index_finger_pip'],
  ['middle_finger_tip', 'middle_finger_pip'],
  ['ring_finger_tip', 'ring_finger_pip'],
  ['pinky_tip', 'pinky_pip']
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 通过“指尖到手腕”和“中间关节到手腕”的相对距离判断手指是否伸直。
// 使用相对比例而不是固定像素值，可适应手掌离摄像头远近的变化。
function countExtendedFingers(hand) {
  const keypoints = new Map(hand.keypoints.map(point => [point.name, point]));
  const wrist = keypoints.get('wrist');
  if (!wrist) return 0;

  return FINGER_JOINTS.reduce((count, [tipName, jointName]) => {
    const tip = keypoints.get(tipName);
    const joint = keypoints.get(jointName);
    if (!tip || !joint) return count;

    const extensionRatio = tipName === 'thumb_tip' ? 1.12 : 1.18;
    const isExtended = distance(tip, wrist) > distance(joint, wrist) * extensionRatio;
    return count + Number(isExtended);
  }, 0);
}

function fingerCountToLetter(count) {
  return count >= 1 && count <= 26 ? ALPHABET[count - 1] : '—';
}

function wristX(hand) {
  return hand.keypoints.find(point => point.name === 'wrist')?.x ?? 0;
}

function recognizeAlphabet(hands) {
  if (!hands.length) {
    return { leftCount: 0, rightCount: 0, totalCount: 0, code: 0, letter: '—' };
  }

  if (hands.length === 1) {
    const count = countExtendedFingers(hands[0]);
    return {
      leftCount: count,
      rightCount: 0,
      totalCount: count,
      code: count,
      letter: fingerCountToLetter(count)
    };
  }

  // 摄像头画面已镜像，按屏幕横坐标区分左侧手和右侧手，避免设备的handedness差异。
  const [leftHand, rightHand] = [...hands].sort((a, b) => wristX(a) - wristX(b));
  const leftCount = countExtendedFingers(leftHand);
  const rightCount = countExtendedFingers(rightHand);
  const totalCount = leftCount + rightCount;
  const code = leftCount * 6 + rightCount;

  return {
    leftCount,
    rightCount,
    totalCount,
    code,
    letter: fingerCountToLetter(code)
  };
}

export { countExtendedFingers, fingerCountToLetter, recognizeAlphabet, ALPHABET };
