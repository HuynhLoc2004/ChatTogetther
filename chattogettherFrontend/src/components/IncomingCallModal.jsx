import React, { useEffect } from 'react';
import { Phone, PhoneOff, Volume2 } from 'lucide-react';

export const IncomingCallModal = ({ 
  call, 
  onAccept, 
  onDecline 
}) => {
  if (!call) return null;

  // Web Audio chime generator
  useEffect(() => {
    let intervalId = null;
    const playChime = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.3); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.45); // C6

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.85);
      } catch (e) {}
    };

    playChime();
    intervalId = setInterval(playChime, 3200);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 text-center shadow-2xl overflow-hidden flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow rings in background */}
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Pulsing Avatar Area */}
        <div className="relative my-4 flex items-center justify-center">
          <span className="absolute w-24 h-24 rounded-full bg-emerald-500/20 animate-ping"></span>
          <span className="absolute w-20 h-20 rounded-full bg-emerald-500/30 animate-pulse"></span>
          <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-500 shadow-lg flex items-center justify-center bg-zinc-800">
            {call.callerAvatar ? (
              <img src={call.callerAvatar} alt={call.callerName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-zinc-100 uppercase">
                {(call.callerName || 'U').charAt(0)}
              </span>
            )}
          </div>
        </div>

        {/* Call Info */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-2">
          <Volume2 size={12} className="animate-pulse" />
          <span>Cuộc gọi đàm thoại đến</span>
        </div>

        <h3 className="text-lg font-bold text-zinc-100 tracking-tight mb-1">
          {call.callerName || 'Thành viên'}
        </h3>
        <p className="text-xs text-zinc-400 font-sans mb-6">
          đang bắt đầu cuộc gọi nhóm trong <strong className="text-zinc-200">#{call.roomName || 'Phòng đàm thoại'}</strong>
        </p>

        {/* Action Buttons: 🟢 Nghe / 🔴 Từ chối */}
        <div className="flex items-center justify-center gap-4 w-full">
          <button
            onClick={() => onDecline(call)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-zinc-800 hover:bg-rose-950/40 border border-zinc-700/80 hover:border-rose-500/50 text-zinc-300 hover:text-rose-400 transition-all font-medium text-xs shadow-md"
          >
            <PhoneOff size={15} />
            <span>Từ chối</span>
          </button>

          <button
            onClick={() => onAccept(call)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all shadow-lg shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Phone size={15} className="animate-bounce" />
            <span>Nghe</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;

