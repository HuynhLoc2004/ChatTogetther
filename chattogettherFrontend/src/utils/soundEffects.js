// Utility âm thanh phản hồi xúc giác cao cấp (Web Audio API - Không dùng file MP3 ngoài)
// Âm thanh pha lê trong trẻo, sạch sẽ, triệt tiêu 100% âm trầm đục (muddy / low-thud)

let sharedAudioCtx = null;

const DEFAULT_SOUND_CONFIG = {
  theme: 'CRYSTAL_POP', // 'CRYSTAL_POP' | 'BUBBLE_DROP' | 'MODERN_SNAP' | 'MUTED'
  volume: 70, // 0 -> 100
  reactionEnabled: true,
  commentEnabled: true
};

// Đọc cấu hình khởi tạo từ localStorage nếu có
let activeSoundConfig = { ...DEFAULT_SOUND_CONFIG };

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('talovin_sound_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      activeSoundConfig = { ...DEFAULT_SOUND_CONFIG, ...parsed };
    }
  }
} catch (_) {}

export const getSoundConfig = () => ({ ...activeSoundConfig });

export const updateSoundConfig = (newConfig = {}, shouldPersist = true) => {
  activeSoundConfig = {
    ...activeSoundConfig,
    ...newConfig
  };

  // Chuẩn hóa volume về số 0 - 100
  if (activeSoundConfig.volume !== undefined) {
    activeSoundConfig.volume = Math.max(0, Math.min(100, Number(activeSoundConfig.volume) || 0));
  }

  if (shouldPersist && typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('talovin_sound_config', JSON.stringify(activeSoundConfig));
    } catch (_) {}
  }
  return activeSoundConfig;
};

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

// Tự động mở khóa AudioContext khi có bất kỳ tương tác người dùng nào
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

/**
 * 1. playReactionPop() - Âm thanh khi Thả Cảm Xúc / Tim bài viết & bình luận
 * Chuẩn Apple/iOS & Telegram: Tiếng bọt nước / búng tay pha lê trong vắt, tuyệt đối không bị đục
 */
export const playReactionPop = (overrideTheme = null, overrideVolume = null) => {
  try {
    const theme = overrideTheme || activeSoundConfig.theme;
    if (theme === 'MUTED') return;

    if (!overrideTheme && !activeSoundConfig.reactionEnabled) return;

    const volumePercent = overrideVolume !== null ? overrideVolume : activeSoundConfig.volume;
    if (volumePercent <= 0) return;

    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime((volumePercent / 100) * 0.22, now);
    masterGain.connect(ctx.destination);

    if (theme === 'BUBBLE_DROP') {
      // Giọt nước tự nhiên (Telegram style) - Mượt, tròn trịa
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, now);
      osc.frequency.exponentialRampToValueAtTime(1150, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(820, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.85, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.1);
      return;
    }

    if (theme === 'MODERN_SNAP') {
      // Snap công nghệ hiện đại - Tách nhẹ dứt khoát
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1250, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.025);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.7, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.04);
      return;
    }

    // Default: 'CRYSTAL_POP' (Pha lê trong suốt - Chuẩn Apple iOS iMessage / Heart)
    // Tần số dao động cao từ 820Hz vút lên 1520Hz, kèm tia lấp lánh 2400Hz, triệt tiêu hoàn toàn âm bass đục
    const oscMain = ctx.createOscillator();
    const gainMain = ctx.createGain();
    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(820, now);
    oscMain.frequency.exponentialRampToValueAtTime(1520, now + 0.028);
    oscMain.frequency.exponentialRampToValueAtTime(1120, now + 0.065);

    gainMain.gain.setValueAtTime(0.001, now);
    gainMain.gain.linearRampToValueAtTime(0.8, now + 0.004);
    gainMain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    // Tia lấp lánh (Sparkle snap) tạo độ trong suốt tinh khiết
    const oscSparkle = ctx.createOscillator();
    const gainSparkle = ctx.createGain();
    oscSparkle.type = 'sine';
    oscSparkle.frequency.setValueAtTime(2450, now);
    gainSparkle.gain.setValueAtTime(0.001, now);
    gainSparkle.gain.linearRampToValueAtTime(0.25, now + 0.003);
    gainSparkle.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    oscMain.connect(gainMain);
    gainMain.connect(masterGain);

    oscSparkle.connect(gainSparkle);
    gainSparkle.connect(masterGain);

    oscMain.start(now);
    oscMain.stop(now + 0.08);

    oscSparkle.start(now);
    oscSparkle.stop(now + 0.025);
  } catch (_) {}
};

/**
 * 2. playCommentSend() - Âm thanh khi Gửi Phản Hồi / Bình Luận thành công
 * Chime đôi 2 nốt pha lê ngân thanh thoát (E6 1318Hz & B6 1975Hz), tinh tế, sang trọng, không đục
 */
export const playCommentSend = (overrideTheme = null, overrideVolume = null) => {
  try {
    const theme = overrideTheme || activeSoundConfig.theme;
    if (theme === 'MUTED') return;

    if (!overrideTheme && !activeSoundConfig.commentEnabled) return;

    const volumePercent = overrideVolume !== null ? overrideVolume : activeSoundConfig.volume;
    if (volumePercent <= 0) return;

    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime((volumePercent / 100) * 0.2, now);
    masterGain.connect(ctx.destination);

    if (theme === 'BUBBLE_DROP') {
      // Âm mộc 2 nốt ấm nhẹ (A5 880Hz & D6 1174Hz)
      const notes = [
        { freq: 880, start: 0, dur: 0.08, gain: 0.65 },
        { freq: 1174, start: 0.038, dur: 0.12, gain: 0.85 }
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        g.gain.setValueAtTime(0.001, now + n.start);
        g.gain.linearRampToValueAtTime(n.gain, now + n.start + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.01);
      });
      return;
    }

    if (theme === 'MODERN_SNAP') {
      // Nốt chime đơn công nghệ thanh gọn (G6 1568Hz)
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1567.98, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.75, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.1);
      return;
    }

    // Default: 'CRYSTAL_POP' (Pha lê đôi thánh thót - Chuẩn ứng dụng cao cấp)
    // Nốt 1: E6 (1318.51Hz) thanh thoát
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.65, now + 0.004);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    // Nốt 2: B6 (1975.53Hz) vút cao trong vắt tạo cảm giác hoàn tất nhẹ nhàng
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1975.53, now + 0.036);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.001, now + 0.036);
    gain2.gain.linearRampToValueAtTime(0.85, now + 0.041);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc1.connect(gain1);
    gain1.connect(masterGain);

    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + 0.09);

    osc2.start(now + 0.036);
    osc2.stop(now + 0.14);
  } catch (_) {}
};

/**
 * 3. playRemoveTick() - Tiếng tick cực khẽ khi hủy phản hồi / bỏ tim (~18ms, siêu nhẹ, không ồn)
 */
export const playRemoveTick = (overrideVolume = null) => {
  try {
    if (activeSoundConfig.theme === 'MUTED') return;
    const volumePercent = overrideVolume !== null ? overrideVolume : activeSoundConfig.volume;
    if (volumePercent <= 0) return;

    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.016);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime((volumePercent / 100) * 0.12, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  } catch (_) {}
};

/**
 * 4. playMessageIncoming() - Âm báo tin nhắn nhóm tới thanh thoát, dễ chịu
 * 2 nốt ding-dong nhẹ 660Hz -> 990Hz, thời lượng ~110ms, âm lượng 0.12, dùng chung 1 AudioContext
 */
const triggerDingDong = (ctx, volumePercent) => {
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime((volumePercent / 100) * 0.16, now);
  masterGain.connect(ctx.destination);

  // Nốt 1: 660Hz (ding)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(660, now);

  gain1.gain.setValueAtTime(0.001, now);
  gain1.gain.linearRampToValueAtTime(0.8, now + 0.008);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.09);

  // Nốt 2: 990Hz (dong)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(990, now + 0.045);

  gain2.gain.setValueAtTime(0.001, now + 0.045);
  gain2.gain.linearRampToValueAtTime(0.9, now + 0.052);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now + 0.045);
  osc2.stop(now + 0.14);
};

export const playMessageIncoming = (overrideVolume = null) => {
  try {
    if (activeSoundConfig.theme === 'MUTED') return;
    const volumePercent = overrideVolume !== null ? overrideVolume : activeSoundConfig.volume;
    if (volumePercent <= 0) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        triggerDingDong(ctx, volumePercent);
      }).catch(() => {});
    } else {
      triggerDingDong(ctx, volumePercent);
    }
  } catch (_) {}
};
