import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Headphones, Laptop, MessageCircle, Sparkles, Radio, Mic, MicOff, 
  Volume2, VolumeX, Play, Pause, RefreshCw, PhoneCall, ArrowLeft, 
  X, Check, AlertCircle, Signal, Disc3, ShieldCheck, ChevronLeft, ChevronRight, Square
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import toast from 'react-hot-toast';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

// Map icon string từ backend sang Lucide component
const ICON_MAP = {
  Headphones: Headphones,
  Laptop: Laptop,
  MessageCircle: MessageCircle,
  Sparkles: Sparkles,
  Radio: Radio
};

export const ResonanceMatchModal = ({ 
  isOpen, 
  onClose, 
  currentUserId, 
  currentUserAccount, 
  currentUserName,
  navigate
}) => {
  // Dữ liệu từ Server
  const [stations, setStations] = useState([]);
  const [intents, setIntents] = useState([]);
  const [musicTracks, setMusicTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userPersonalFrequency, setUserPersonalFrequency] = useState(96.4);

  // Trạng thái Tần số FM hiện tại (88.0 - 108.0 MHz)
  const [frequency, setFrequency] = useState(96.4);
  const [selectedIntentFilter, setSelectedIntentFilter] = useState('ALL');
  const [isMuted, setIsMuted] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  // Trạng thái Phát sóng cá nhân (Broadcast 5s)
  const [showBroadcastDrawer, setShowBroadcastDrawer] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastInfo, setBroadcastInfo] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [broadcastIntentCode, setBroadcastIntentCode] = useState('DEEP_TALK');
  const [broadcastFreqInput, setBroadcastFreqInput] = useState(96.4);
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);

  // Audio References
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordIntervalRef = useRef(null);
  const previewAudioRef = useRef(null);
  const stationAudioRef = useRef(null);

  // Web Audio API White/Pink Noise Radio Static
  const audioContextRef = useRef(null);
  const noiseSourceRef = useRef(null);
  const noiseGainRef = useRef(null);
  const isAudioReadyRef = useRef(false);

  // Fetch guard ref (ngăn chặn vòng lặp gọi API vô tận)
  const hasFetchedRef = useRef(false);
  const stompClientRef = useRef(null);

  // Thước đo vạch vĩ mô
  const rulerRef = useRef(null);
  const isDraggingRulerRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartFreqRef = useRef(96.4);

  // 1. Tải dữ liệu trạm sóng & cấu hình song song đúng 1 lần khi mở Modal
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [stationsRes, configRes, meRes] = await Promise.allSettled([
        axiosClient.get('/match/stations'),
        axiosClient.get('/public/lobby-config'),
        axiosClient.get('/users/profile')
      ]);

      // Nạp trạm sóng online
      if (stationsRes.status === 'fulfilled' && stationsRes.value?.data) {
        const raw = stationsRes.value.data;
        const list = Array.isArray(raw.data) ? raw.data : (Array.isArray(raw) ? raw : []);
        setStations(list);
      } else {
        setStations([]);
      }

      // Nạp danh mục Băng tần & Kênh nhạc
      if (configRes.status === 'fulfilled' && configRes.value?.data?.data) {
        const cfg = configRes.value.data.data;
        setIntents(cfg.intents || []);
        setMusicTracks(cfg.tracks || cfg.musicTracks || []);
        if (cfg.intents && cfg.intents.length > 0) {
          setBroadcastIntentCode(cfg.intents[0].code);
        }
      }

      // Nạp tần số cá nhân của user
      if (meRes.status === 'fulfilled' && meRes.value?.data?.data) {
        const me = meRes.value.data.data;
        if (me.personalFrequency) {
          const pf = Number(me.personalFrequency);
          setUserPersonalFrequency(pf);
          setFrequency(pf);
          setBroadcastFreqInput(pf);
        }
        if (me.matchIntentCode) {
          setBroadcastIntentCode(me.matchIntentCode);
        }
      }
    } catch (err) {
      console.warn("Lỗi tải dữ liệu đài Radio FM:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchData();
        initWebAudioNoise();
      }
    } else {
      hasFetchedRef.current = false;
      stopWebAudioNoise();
      if (stationAudioRef.current) {
        stationAudioRef.current.pause();
      }
    }
  }, [isOpen, fetchData]);

  // Phím ESC đóng modal & Phím Mũi tên trái/phải tinh chỉnh tần số
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleModalClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFrequency(prev => Math.max(88.0, Number((prev - 0.1).toFixed(1))));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFrequency(prev => Math.min(108.0, Number((prev + 0.1).toFixed(1))));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 2. Khởi tạo Web Audio API giả lập tiếng rè Radio tĩnh điện
  const initWebAudioNoise = () => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (noiseSourceRef.current) {
        try { noiseSourceRef.current.stop(); } catch (e) {}
      }

      // Tạo buffer 2 giây tiếng rè tĩnh điện
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.12;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Bộ lọc Low-Pass 2200Hz để âm rè ấm áp, dịu tai (như đài radio bán dẫn xưa)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, ctx.currentTime);
      filter.Q.setValueAtTime(1.2, ctx.currentTime);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(isMuted ? 0 : 0.018, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      whiteNoise.start();
      noiseSourceRef.current = whiteNoise;
      noiseGainRef.current = gainNode;
      isAudioReadyRef.current = true;
    } catch (err) {
      console.warn("Web Audio API không được hỗ trợ hoặc bị chặn autoplay:", err);
    }
  };

  const stopWebAudioNoise = () => {
    if (noiseSourceRef.current) {
      try { noiseSourceRef.current.stop(); } catch (e) {}
      noiseSourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.suspend(); } catch (e) {}
    }
    isAudioReadyRef.current = false;
  };

  // 3. Tương tác dò sóng: kiểm tra tần số khớp trạm online trong khoảng ±0.1 MHz
  const matchedStation = stations.find(s => {
    if (!s || s.frequency == null) return false;
    const diff = Math.abs(Number(s.frequency) - frequency);
    return diff <= 0.12;
  });

  useEffect(() => {
    if (!isOpen) return;

    if (matchedStation) {
      // Khi kim chạm đúng trạm: ngắt tiếng rè, tự động phát audio của trạm đó
      if (noiseGainRef.current && audioContextRef.current) {
        noiseGainRef.current.gain.setTargetAtTime(0, audioContextRef.current.currentTime, 0.05);
      }

      if (stationAudioRef.current && matchedStation.audioUrl) {
        const fullUrl = matchedStation.audioUrl.startsWith('http')
          ? matchedStation.audioUrl
          : `${BACKEND_URL || ''}${matchedStation.audioUrl}`;

        if (stationAudioRef.current.src !== fullUrl) {
          stationAudioRef.current.src = fullUrl;
          stationAudioRef.current.volume = isMuted ? 0 : 1;
          stationAudioRef.current.play().catch(() => {});
        }
      }
    } else {
      // Khi kim ở tần số trống: trả lại tiếng rè FM nhẹ nhàng
      if (noiseGainRef.current && audioContextRef.current) {
        const targetVol = isMuted ? 0 : 0.018;
        noiseGainRef.current.gain.setTargetAtTime(targetVol, audioContextRef.current.currentTime, 0.08);
      }

      if (stationAudioRef.current) {
        stationAudioRef.current.pause();
      }
    }
  }, [frequency, matchedStation, isOpen, isMuted]);

  // Cập nhật âm lượng khi toggle Mute
  useEffect(() => {
    if (noiseGainRef.current && audioContextRef.current) {
      const vol = isMuted ? 0 : (matchedStation ? 0 : 0.018);
      noiseGainRef.current.gain.setValueAtTime(vol, audioContextRef.current.currentTime);
    }
    if (stationAudioRef.current) {
      stationAudioRef.current.volume = isMuted ? 0 : 1;
    }
  }, [isMuted, matchedStation]);

  // 4. Kéo vuốt trên Thước chia vạch (Mouse Drag & Touch Swipe)
  const handleRulerMouseDown = (e) => {
    isDraggingRulerRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartFreqRef.current = frequency;
  };

  const handleRulerMouseMove = (e) => {
    if (!isDraggingRulerRef.current) return;
    const deltaX = dragStartXRef.current - e.clientX; // Kéo sang trái -> tăng tần số
    const deltaFreq = (deltaX / 14) * 0.1; // Mỗi 14px tương ứng 0.1 MHz
    const nextFreq = Math.min(108.0, Math.max(88.0, Number((dragStartFreqRef.current + deltaFreq).toFixed(1))));
    setFrequency(nextFreq);
  };

  const handleRulerMouseUp = () => {
    isDraggingRulerRef.current = false;
  };

  const handleRulerTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      isDraggingRulerRef.current = true;
      dragStartXRef.current = e.touches[0].clientX;
      dragStartFreqRef.current = frequency;
    }
  };

  const handleRulerTouchMove = (e) => {
    if (!isDraggingRulerRef.current || !e.touches || !e.touches[0]) return;
    const deltaX = dragStartXRef.current - e.touches[0].clientX;
    const deltaFreq = (deltaX / 14) * 0.1;
    const nextFreq = Math.min(108.0, Math.max(88.0, Number((dragStartFreqRef.current + deltaFreq).toFixed(1))));
    setFrequency(nextFreq);
  };

  const handleRulerTouchEnd = () => {
    isDraggingRulerRef.current = false;
  };

  const handleRulerWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? -0.1 : 0.1;
    setFrequency(prev => Math.min(108.0, Math.max(88.0, Number((prev + delta).toFixed(1)))));
  };

  // 5. Kết nối Call 1-1 với trạm bắt sóng được
  const handleConnectCall = async (station) => {
    if (!station) return;
    try {
      setIsLocking(true);
      const res = await axiosClient.post('/match/lock', {
        targetUserId: station.userId,
        frequency: station.frequency
      });

      handleModalClose();
      if (res.data?.data?.roomId) {
        toast.success(`Đã kết nối tần số ${station.frequency} MHz! Đang vào phòng thoại 1-1...`);
        navigate(`/call/room/${res.data.data.roomId}?type=audio`);
      } else {
        navigate(`/call/direct/${station.userId}?type=audio`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể kết nối trạm này. Đang quét lại...");
      fetchData();
    } finally {
      setIsLocking(false);
    }
  };

  // 6. Ghi âm 5s và Phát sóng cá nhân
  const startRecording5s = async () => {
    try {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
      }
      setRecordedBlob(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4');

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        setIsRecording(false);
        setRecordProgress(0);
        clearInterval(recordIntervalRef.current);
      };

      recorder.start();
      setIsRecording(true);
      setRecordProgress(0);

      let elapsed = 0;
      recordIntervalRef.current = setInterval(() => {
        elapsed += 100;
        setRecordProgress(Math.min(100, (elapsed / 5000) * 100));
        if (elapsed >= 5000) {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }
      }, 100);
    } catch (err) {
      toast.error("Không thể mở Microphone thiết bị! Vui lòng cấp quyền.");
    }
  };

  const stopRecording5s = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handlePublishBroadcast = async () => {
    if (!recordedBlob) {
      toast.error("Vui lòng ghi âm 5 giây giọng nói của bạn trước khi phát sóng!");
      return;
    }
    try {
      setIsSubmittingBroadcast(true);
      const formData = new FormData();
      formData.append('audioSample', recordedBlob, 'voice_signal.webm');
      formData.append('intentCode', broadcastIntentCode || 'DEEP_TALK');
      formData.append('frequency', broadcastFreqInput || frequency);

      const res = await axiosClient.post('/match/broadcast', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.data) {
        const b = res.data.data;
        setBroadcastInfo(b);
        setIsBroadcasting(true);
        setShowBroadcastDrawer(false);
        toast.success(`Đã phát sóng giọng nói lên tần số ${b.frequency} MHz!`);
        fetchData(); // Cập nhật danh sách trạm
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể phát sóng lúc này!");
    } finally {
      setIsSubmittingBroadcast(false);
    }
  };

  const handleStopBroadcast = async () => {
    try {
      await axiosClient.delete('/match/broadcast');
      toast.success("Đã dừng trạm phát sóng FM cá nhân.");
    } catch (e) {}
    setIsBroadcasting(false);
    setBroadcastInfo(null);
    fetchData();
  };

  const handleModalClose = () => {
    stopWebAudioNoise();
    if (stationAudioRef.current) {
      stationAudioRef.current.pause();
    }
    setShowBroadcastDrawer(false);
    onClose();
  };

  if (!isOpen) return null;

  // Lọc danh sách trạm hiển thị theo intent nếu có
  const filteredStations = selectedIntentFilter === 'ALL'
    ? stations
    : stations.filter(s => s.intentCode === selectedIntentFilter);

  // Tính toán vị trí dịch chuyển của dải vạch thước (Ruler Strip)
  // Dải tần 88.0 đến 108.0 MHz (tổng 20 MHz, mỗi 0.1 MHz là 1 tick = 14px)
  const totalOffsetPx = (frequency - 88.0) * 140;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans"
      onClick={handleModalClose}
    >
      {/* Audio Element ẩn phát voice trạm bắt được */}
      <audio ref={stationAudioRef} loop className="hidden" />
      <audio ref={previewAudioRef} onEnded={() => setIsPlayingPreview(false)} className="hidden" />

      <div 
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL ĐƠN SẮC DARK ZINC */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
              <Radio size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white tracking-tight">Trạm Dò Sóng FM</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {stations.length} trạm online
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Rà kim tần số để bắt sóng giọng nói người lạ ngẫu nhiên</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title={isMuted ? "Bật tiếng rè radio" : "Tắt tiếng rè radio"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              type="button"
              onClick={handleModalClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Đóng (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* THÂN MODAL DÒ SÓNG */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar">

          {/* DẢI CHIP LỌC NHANH THEO BĂNG TẦN / INTENTS */}
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0.5">
            <button
              type="button"
              onClick={() => setSelectedIntentFilter('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-mono whitespace-nowrap transition-all border ${
                selectedIntentFilter === 'ALL'
                  ? 'bg-white text-zinc-950 font-medium border-white'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
              }`}
            >
              Tất cả (88 - 108 MHz)
            </button>
            {intents.map(it => {
              const isSelected = selectedIntentFilter === it.code;
              return (
                <button
                  key={it.code}
                  type="button"
                  onClick={() => {
                    setSelectedIntentFilter(it.code);
                    if (it.freqStart) {
                      setFrequency(Number(it.freqStart.toFixed(1)));
                    }
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-mono whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-white text-zinc-950 font-medium border-white'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  {it.title} ({it.freqStart?.toFixed(0)}-{it.freqEnd?.toFixed(0)})
                </button>
              );
            })}
          </div>

          {/* MẶT ĐỒNG HỒ TẦN SỐ CỠ LỚN */}
          <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800/90 text-center relative shadow-inner space-y-3">
            
            {/* Tín hiệu bắt sóng */}
            <div className="flex items-center justify-center">
              {matchedStation ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 text-zinc-200 border border-zinc-700 text-xs font-mono shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Đã bắt được sóng: <strong>{matchedStation.displayName || matchedStation.username}</strong></span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/60 text-zinc-500 border border-zinc-800/80 text-xs font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  <span>Tần số tĩnh • Kéo kim để rà sóng</span>
                </span>
              )}
            </div>

            {/* Con số Tần số lớn chuẩn JetBrains Mono tabular-nums */}
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-5xl sm:text-6xl font-mono font-extrabold text-white tracking-tight tabular-nums select-none">
                {frequency.toFixed(1)}
              </span>
              <span className="text-xl sm:text-2xl font-mono text-zinc-500 font-semibold">
                MHz
              </span>
            </div>

            {/* THƯỚC CHIA VẠCH NGANG (ANALOG FREQUENCY RULER) */}
            <div 
              ref={rulerRef}
              onMouseDown={handleRulerMouseDown}
              onMouseMove={handleRulerMouseMove}
              onMouseUp={handleRulerMouseUp}
              onMouseLeave={handleRulerMouseUp}
              onTouchStart={handleRulerTouchStart}
              onTouchMove={handleRulerTouchMove}
              onTouchEnd={handleRulerTouchEnd}
              onWheel={handleRulerWheel}
              className="relative h-20 bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden cursor-ew-resize select-none touch-none shadow-inner"
            >
              {/* KIM CHỈ ĐỎ / TRẮNG NẰM CHÍNH GIỮA */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-rose-500 -translate-x-1/2 z-20 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.9)]">
                <div className="w-2 h-2 bg-rose-500 rotate-45 -translate-x-[3px] -translate-y-1 mx-auto" />
              </div>

              {/* Dải vạch thước trượt theo tần số (Center aligned: 50% - totalOffsetPx) */}
              <div 
                className="absolute top-0 bottom-0 flex items-end pb-2.5 transition-transform duration-75 will-change-transform"
                style={{
                  transform: `translateX(calc(50% - ${totalOffsetPx}px))`
                }}
              >
                {Array.from({ length: 201 }).map((_, idx) => {
                  const tickFreq = Number((88.0 + idx * 0.1).toFixed(1));
                  const isMajor = idx % 10 === 0;
                  const isHalf = idx % 5 === 0 && !isMajor;

                  // Kiểm tra có trạm online nào ở tần số này không
                  const hasStationHere = stations.some(s => Math.abs(Number(s.frequency) - tickFreq) < 0.05);

                  return (
                    <div 
                      key={idx}
                      className="flex flex-col items-center justify-end relative"
                      style={{ width: '14px', flexShrink: 0 }}
                    >
                      {/* Chấm sáng biểu thị trạm sóng online */}
                      {hasStationHere && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
                      )}

                      {/* Vạch chia */}
                      <div 
                        className={`rounded-full transition-colors ${
                          isMajor 
                            ? 'w-[2px] h-7 bg-zinc-300' 
                            : isHalf 
                            ? 'w-[1.5px] h-4 bg-zinc-500' 
                            : 'w-[1px] h-2 bg-zinc-700'
                        }`} 
                      />

                      {/* Nhãn số ở mỗi vạch 1.0 MHz */}
                      {isMajor && (
                        <span className="text-[10px] font-mono text-zinc-400 mt-1 select-none pointer-events-none">
                          {tickFreq.toFixed(0)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* THANH TRƯỢT RANGE PHỤ TRỢ & NÚT TINH CHỈNH +/- 0.1 MHz */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setFrequency(prev => Math.max(88.0, Number((prev - 0.1).toFixed(1))))}
                className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors active:scale-95 flex items-center gap-1"
                title="Giảm 0.1 MHz"
              >
                <ChevronLeft size={14} /> -0.1
              </button>

              <input 
                type="range"
                min="88.0"
                max="108.0"
                step="0.1"
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
                className="flex-1 accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                onClick={() => setFrequency(prev => Math.min(108.0, Number((prev + 0.1).toFixed(1))))}
                className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors active:scale-95 flex items-center gap-1"
                title="Tăng 0.1 MHz"
              >
                +0.1 <ChevronRight size={14} />
              </button>
            </div>

          </div>

          {/* THẺ TRẠM SÓNG BẮT ĐƯỢC (HIỂN THỊ KHI KIM TRÚNG ±0.1 MHz) */}
          {matchedStation ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3.5 shadow-lg animate-fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-base text-zinc-100 overflow-hidden shrink-0 shadow-inner">
                    {matchedStation.avatarUrl ? (
                      <img src={matchedStation.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{(matchedStation.displayName || matchedStation.username || 'U').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white truncate">
                        {matchedStation.displayName || matchedStation.username}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {Number(matchedStation.frequency).toFixed(1)} MHz
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 block font-sans truncate">
                      @{matchedStation.username || 'user'} • {matchedStation.intentTitle || 'Tâm sự đêm muộn'}
                    </span>
                  </div>
                </div>

                {/* NÚT KẾT NỐI CALL 1-1 */}
                <button
                  type="button"
                  onClick={() => handleConnectCall(matchedStation)}
                  disabled={isLocking}
                  className="h-10 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0"
                >
                  <PhoneCall size={14} />
                  <span>{isLocking ? "Đang kết nối..." : "Kết nối Call 1-1"}</span>
                </button>
              </div>

              {matchedStation.bio && (
                <p className="text-xs text-zinc-400 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80 leading-relaxed font-sans">
                  "{matchedStation.bio}"
                </p>
              )}

              {/* Tín hiệu giọng nói đang phát */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Đang phát tín hiệu giọng nói 5s...</span>
                </div>
                <span className="text-[11px] text-zinc-500">Tự động lặp</span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-zinc-950/40 border border-dashed border-zinc-800 text-center space-y-1">
              <p className="text-xs text-zinc-400">Không có tín hiệu người phát tại tần số <strong>{frequency.toFixed(1)} MHz</strong>.</p>
              <p className="text-[11px] text-zinc-500">Hãy trượt kim sang các tần số có chấm sáng xanh hoặc bấm nút bên dưới để tự phát sóng!</p>
            </div>
          )}

          {/* KHU VỰC PHÁT SÓNG CÁ NHÂN (DRAWER / FORM GHI ÂM 5S) */}
          {showBroadcastDrawer ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Mic size={16} className="text-zinc-300" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Thu âm 5s & Phát sóng lên đài FM
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBroadcastDrawer(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Chọn Băng tần & Tần số phát sóng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 font-mono block mb-1">Mục đích phát sóng</label>
                  <select
                    value={broadcastIntentCode}
                    onChange={(e) => setBroadcastIntentCode(e.target.value)}
                    className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 text-xs text-white focus:outline-none focus:border-zinc-600 font-mono"
                  >
                    {intents.map(it => (
                      <option key={it.code} value={it.code} className="bg-zinc-900 text-white">
                        {it.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 font-mono block mb-1">Tần số phát (MHz)</label>
                  <input 
                    type="number"
                    step="0.1"
                    min="88.0"
                    max="108.0"
                    value={broadcastFreqInput}
                    onChange={(e) => setBroadcastFreqInput(Number(e.target.value))}
                    className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 text-xs text-white focus:outline-none focus:border-zinc-600 font-mono"
                  />
                </div>
              </div>

              {/* KHUNG GHI ÂM 5S */}
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center space-y-3">
                {isRecording ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-rose-400 text-xs font-mono">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Đang ghi âm tín hiệu giọng nói... {((5000 * (100 - recordProgress)) / 100000).toFixed(1)}s</span>
                    </div>
                    {/* Thanh tiến trình ghi âm */}
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 transition-all duration-100" 
                        style={{ width: `${recordProgress}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={stopRecording5s}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 mx-auto active:scale-95"
                    >
                      <Square size={13} /> Dừng thu
                    </button>
                  </div>
                ) : recordedBlob ? (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!previewAudioRef.current) return;
                          if (isPlayingPreview) {
                            previewAudioRef.current.pause();
                            setIsPlayingPreview(false);
                          } else {
                            previewAudioRef.current.src = audioPreviewUrl;
                            previewAudioRef.current.play();
                            setIsPlayingPreview(true);
                          }
                        }}
                        className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition-colors"
                      >
                        {isPlayingPreview ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <span className="text-xs font-mono text-zinc-300">Đoạn thu âm 5 giây sẵn sàng</span>
                    </div>

                    <button
                      type="button"
                      onClick={startRecording5s}
                      className="text-xs font-mono text-zinc-400 hover:text-white underline px-2"
                    >
                      Ghi lại
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400">Ghi lại một lời chào 5 giây để phát lên đài FM</p>
                    <button
                      type="button"
                      onClick={startRecording5s}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium flex items-center gap-1.5 mx-auto active:scale-95 shadow-sm"
                    >
                      <Mic size={14} />
                      <span>Bấm để bắt đầu thu âm 5s</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Nút Submit Phát sóng */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBroadcastDrawer(false)}
                  className="h-9 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handlePublishBroadcast}
                  disabled={!recordedBlob || isSubmittingBroadcast}
                  className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium disabled:opacity-50 transition-all active:scale-95 shadow-sm"
                >
                  {isSubmittingBroadcast ? "Đang phát sóng..." : "Kích hoạt phát sóng"}
                </button>
              </div>
            </div>
          ) : (
            /* HÀNG NÚT DƯỚI CÙNG */
            <div className="flex items-center justify-between gap-3 pt-2">
              {isBroadcasting ? (
                <div className="flex items-center justify-between w-full p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-mono text-zinc-200">
                      Đang phát sóng tại: <strong>{broadcastInfo?.frequency || userPersonalFrequency} MHz</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleStopBroadcast}
                    className="h-8 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors active:scale-95"
                  >
                    Dừng phát
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBroadcastDrawer(true)}
                  className="w-full py-3 px-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
                >
                  <Mic size={15} />
                  <span>Phát sóng giọng nói (5s) lên tần số riêng</span>
                </button>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default ResonanceMatchModal;
