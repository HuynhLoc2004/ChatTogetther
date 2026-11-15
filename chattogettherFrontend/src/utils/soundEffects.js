// Utility âm thanh phản hồi xúc giác cao cấp (Web Audio API - Zero External MP3 Delay)
let sharedAudioCtx = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
};

/**
 * 1. playReactionPop() - Tiếng bong bóng / giọt nước hữu cơ siêu êm, tròn trịa (Modern iOS / Telegram style)
 * Sử dụng 2 dao động hình sin hài hòa + bộ lọc Low-Pass Filter để triệt tiêu tiếng chói gắt
 */
export const playReactionPop = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Bộ lọc âm làm ấm và làm tròn âm sắc
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(2.2, now);

    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    subOsc.type = 'sine';

    // Tần số trượt mượt mà tạo cảm giác giọt nước tròn trịa
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.045);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);

    subOsc.frequency.setValueAtTime(180, now);
    subOsc.frequency.exponentialRampToValueAtTime(310, now + 0.045);

    // Envelope âm lượng: mềm mại lúc chạm (3ms attack) và giảm dần tự nhiên
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(filter);
    filter.connect(ctx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.09);
    subOsc.stop(now + 0.09);
  } catch (err) {
    // Silent fail if audio disabled
  }
};

/**
 * 2. playCommentSend() - Tiếng gửi tin nhắn / bình luận thanh thoát, hiện đại (Chime 2 nốt tinh tế)
 * Tạo cảm giác thành công nhẹ nhàng, sang trọng chuẩn mạng xã hội cao cấp
 */
export const playCommentSend = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, now);

    // Nốt 1: E5 (659Hz) nhẹ
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.09, now + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    // Nốt 2: B5 (987Hz) vút nhẹ tạo cảm giác hoàn tất vui tươi
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.035);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.001, now + 0.035);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.042);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc1.connect(gain1);
    gain1.connect(filter);

    osc2.connect(gain2);
    gain2.connect(filter);

    filter.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.075);

    osc2.start(now + 0.035);
    osc2.stop(now + 0.15);
  } catch (err) {
    // Silent fail
  }
};

/**
 * 3. playRemoveTick() - Tiếng click trầm cực nhẹ khi hủy phản hồi (~25ms, ấm áp, không chói)
 */
export const playRemoveTick = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.025);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch (err) {
    // Silent fail
  }
};
