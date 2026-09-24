const LONG_FINGER_JOINTS = [
  ['index_finger_tip', 'index_finger_pip'],
  ['middle_finger_tip', 'middle_finger_pip'],
  ['ring_finger_tip', 'ring_finger_pip'],
  ['pinky_finger_tip', 'pinky_finger_pip']
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// 各手指“伸直”的判定比例：完全伸直时，指尖到手腕的距离相对中间关节到手腕的距离会明显变大。
// 小指最短，伸直时的增幅最小（很多人小指还伸不直），统一用大比例会把小指误判为弯曲，需单独放宽；
// 手指弯曲时比例会降到 1.0 以下，因此放宽后依然不易误判。
const FINGER_EXTENSION_RATIOS = {
  index_finger_tip: 1.16,
  middle_finger_tip: 1.16,
  ring_finger_tip: 1.12,
  pinky_finger_tip: 1.05
};

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 通过“指尖到手腕”和“中间关节到手腕”的相对距离判断手指是否伸直。
// 使用相对比例而不是固定像素值，可适应手掌离摄像头远近的变化。
function countExtendedFingers(hand) {
  const keypoints = new Map(hand.keypoints.map(point => [point.name, point]));
  const wrist = keypoints.get('wrist');
  if (!wrist) return 0;

  const longFingerCount = LONG_FINGER_JOINTS.reduce((count, [tipName, jointName]) => {
    const tip = keypoints.get(tipName);
    const joint = keypoints.get(jointName);
    if (!tip || !joint) return count;

    const extensionRatio = FINGER_EXTENSION_RATIOS[tipName] ?? 1.16;
    const isExtended = distance(tip, wrist) > distance(joint, wrist) * extensionRatio;
    return count + Number(isExtended);
  }, 0);

  // 拇指不能只用“到手腕的距离”判断：握拳时拇指贴在拳头侧面，仍可能比拇指关节离手腕更远。
  // 同时检查拇指是否远离掌心、是否越过拇指关节，只有明显张开时才计数。
  const thumbTip = keypoints.get('thumb_tip');
  const thumbIp = keypoints.get('thumb_ip');
  const indexMcp = keypoints.get('index_finger_mcp');
  const pinkyMcp = keypoints.get('pinky_finger_mcp');
  let thumbExtended = false;
  if (thumbTip && thumbIp && indexMcp && pinkyMcp) {
    const palmWidth = Math.max(distance(indexMcp, pinkyMcp), 1);
    const thumbToPalm = distance(thumbTip, indexMcp);
    thumbExtended =
      thumbToPalm > palmWidth * .9 &&
      thumbToPalm > distance(thumbIp, indexMcp) * 1.12 &&
      distance(thumbTip, wrist) > distance(thumbIp, wrist) * 1.04;
  }

  // 四根长手指均弯曲且拇指收在掌内时，明确判定为握拳0。
  if (longFingerCount === 0 && !thumbExtended) return 0;
  return longFingerCount + Number(thumbExtended);
}

function fingerCountToLetter(count) {
  return count >= 1 && count <= 26 ? ALPHABET[count - 1] : '—';
}

function wristX(hand) {
  return hand.keypoints.find(point => point.name === 'wrist')?.x ?? 0;
}

function recognizeAlphabet(hands) {
  if (!hands.length) {
    return { leftCount: 0, rightCount: 0, totalCount: 0, code: 0, paired: false, letter: '—' };
  }

  if (hands.length === 1) {
    const count = countExtendedFingers(hands[0]);
    return {
      leftCount: count,
      rightCount: 0,
      totalCount: count,
      code: count,
      paired: false,
      letter: fingerCountToLetter(count)
    };
  }

  // 摄像头画面已镜像，按屏幕横坐标区分左侧手和右侧手，避免设备的handedness差异。
  const [leftHand, rightHand] = [...hands].sort((a, b) => wristX(a) - wristX(b));
  const leftCount = countExtendedFingers(leftHand);
  const rightCount = countExtendedFingers(rightHand);
  const totalCount = leftCount + rightCount;
  // 两侧都伸出手指时，把两个数字直接拼成一个两位数（2与3拼成23），而不是相加或加权。
  const paired = leftCount >= 1 && rightCount >= 1;
  const code = paired ? Number(`${leftCount}${rightCount}`) : totalCount;

  return {
    leftCount,
    rightCount,
    totalCount,
    code,
    paired,
    letter: fingerCountToLetter(code)
  };
}

export { countExtendedFingers, fingerCountToLetter, recognizeAlphabet, ALPHABET };
