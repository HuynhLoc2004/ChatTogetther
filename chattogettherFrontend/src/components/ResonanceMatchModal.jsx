import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Headphones, Laptop, MessageCircle, Sparkles, Radio, Mic, MicOff, 
  Volume2, VolumeX, Play, Pause, RefreshCw, PhoneCall, ArrowLeft, 
  X, Check, AlertCircle, Signal, Disc3, ShieldCheck
} from 'lucide-react';
import { UserAvatar } from '../pages/Home';
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
  // Screen: 'select' (Màn 1) | 'broadcast' (Màn 2) | 'scan' (Màn 3)
  const [screen, setScreen] = useState('select');

  // Config từ backend GET /api/match/config
  const [intents, setIntents] = useState([]);
  const [audioChannels, setAudioChannels] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [selectedIntent, setSelectedIntent] = useState(null);

  // Màn 2: Broadcast State
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [musicTasteInput, setMusicTasteInput] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastInfo, setBroadcastInfo] = useState(null); // { frequency, intentCode, ... }
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);

  // Màn 3: Scanner State
  const [stations, setStations] = useState([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [currentFrequency, setCurrentFrequency] = useState(88.0);
  const [activeStation, setActiveStation] = useState(null);
  const [seenUserIds, setSeenUserIds] = useState(new Set());
  const [isLocking, setIsLocking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Refs cho Audio & Recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordIntervalRef = useRef(null);
  const previewAudioRef = useRef(null);
  const stationAudioRef = useRef(null);

  // Web Audio API Static Noise
  const audioContextRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const noiseGainNodeRef = useRef(null);
  const isAudioInitializedRef = useRef(false);

  // Stomp Ref cho Broadcast Listener
  const stompClientRef = useRef(null);

  // 1. Tải cấu hình Băng tần & Kênh nhạc từ Backend
  const loadConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const res = await axiosClient.get('/match/config');
      if (res.data) {
        const fetchedIntents = res.data.intents || [];
        const fetchedChannels = res.data.channels || [];
        setIntents(fetchedIntents);
        setAudioChannels(fetchedChannels);
        if (fetchedIntents.length > 0 && !selectedIntent) {
          setSelectedIntent(fetchedIntents[0]);
          setCurrentFrequency(fetchedIntents[0].freqStart || 88.0);
        }
      }
    } catch (err) {
      console.warn("Lỗi tải cấu hình tần số:", err);
      // Fallback mặc định
      const fallback = [
        { code: 'CHILL_MUSIC', title: 'Nghe nhạc & Chill', subtitle: 'Thưởng thức Lo-Fi, xả stress', iconName: 'Headphones', freqStart: 88.0, freqEnd: 92.9 },
        { code: 'DEADLINE_SPRINT', title: 'Cùng chạy deadline', subtitle: 'Co-working tập trung, học tập', iconName: 'Laptop', freqStart: 93.0, freqEnd: 97.9 },
        { code: 'DEEP_TALK', title: 'Tâm sự đêm muộn', subtitle: 'Trò chuyện cởi mở, lắng nghe chân thành', iconName: 'MessageCircle', freqStart: 98.0, freqEnd: 102.9 },
        { code: 'FREE_CONNECT', title: 'Kết nối tự do', subtitle: 'Gặp gỡ ngẫu nhiên người có chung năng lượng', iconName: 'Sparkles', freqStart: 103.0, freqEnd: 108.0 }
      ];
      setIntents(fallback);
      setSelectedIntent(fallback[0]);
      setCurrentFrequency(fallback[0].freqStart);
    } finally {
      setLoadingConfig(false);
    }
  }, [selectedIntent]);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen, loadConfig]);

  // Khởi tạo Web Audio Noise Generator (Pink / White noise nhẹ)
  const initWebAudioNoise = () => {
    if (isAudioInitializedRef.current && audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      // Tạo White Noise Buffer (2 giây lặp)
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0; // Filter mô phỏng Pink Noise dịu hơn
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.08;
      }

      const whiteNoiseSource = ctx.createBufferSource();
      whiteNoiseSource.buffer = noiseBuffer;
      whiteNoiseSource.loop = true;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.025, ctx.currentTime);

      whiteNoiseSource.connect(gainNode);
      gainNode.connect(ctx.destination);
      whiteNoiseSource.start(0);

      noiseNodeRef.current = whiteNoiseSource;
      noiseGainNodeRef.current = gainNode;
      isAudioInitializedRef.current = true;
    } catch (e) {
      console.warn("Web Audio API không được hỗ trợ hoặc bị chặn:", e);
    }
  };

  const stopWebAudioNoise = () => {
    if (noiseGainNodeRef.current && audioContextRef.current) {
      try {
        noiseGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      } catch (e) {}
    }
  };

  // Reset và dọn dẹp khi đóng modal
  const handleModalClose = () => {
    // Nếu đang phát sóng, hủy broadcast trên server
    if (isBroadcasting) {
      axiosClient.delete('/match/broadcast').catch(() => {});
    }
    // Dừng âm thanh & noise
    stopWebAudioNoise();
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    if (stationAudioRef.current) {
      stationAudioRef.current.pause();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (stompClientRef.current) {
      try {
        stompClientRef.current.disconnect();
      } catch (e) {}
    }
    setScreen('select');
    setIsBroadcasting(false);
    setBroadcastInfo(null);
    setRecordedBlob(null);
    setAudioPreviewUrl(null);
    onClose();
  };

  // ==========================================
  // LOGIC MÀN 2: THU ÂM & PHÁT SÓNG TRẠM FM
  // ==========================================
  const startRecording = async () => {
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

      // Đếm ngược tối đa 5 giây (5000ms / 50 bước = 100ms)
      let elapsedMs = 0;
      recordIntervalRef.current = setInterval(() => {
        elapsedMs += 100;
        setRecordProgress(Math.min(100, (elapsedMs / 5000) * 100));
        if (elapsedMs >= 5000) {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }
      }, 100);
    } catch (err) {
      toast.error("Không thể truy cập Microphone! Vui lòng cấp quyền ghi âm.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePlayPreview = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  // Gửi phát sóng lên server
  const handlePublishBroadcast = async () => {
    if (!recordedBlob) {
      toast.error("Vui lòng ghi âm giọng nói 5 giây trước khi phát sóng!");
      return;
    }
    if (!selectedIntent) {
      toast.error("Vui lòng chọn băng tần mục đích phát sóng!");
      return;
    }
    try {
      setIsSubmittingBroadcast(true);
      const formData = new FormData();
      formData.append('voiceSample', recordedBlob, 'voice_sample.webm');
      formData.append('intentCode', selectedIntent.code);
      formData.append('bio', bioInput.trim() || 'Chào bạn, mình đang mở đài phát sóng lắng nghe!');
      formData.append('musicTaste', musicTasteInput.trim() || 'Lo-Fi Chill & Acoustic');

      const res = await axiosClient.post('/match/broadcast', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data) {
        setBroadcastInfo(res.data);
        setIsBroadcasting(true);
        toast.success(`Đài phát sóng đã kích hoạt ở tần số ${res.data.frequency} MHz!`);

        // Kết nối WebSocket lắng nghe có người khóa sóng để vào phòng
        connectBroadcastWebSocket(currentUserId);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi phát sóng đài FM!");
    } finally {
      setIsSubmittingBroadcast(false);
    }
  };

  const handleStopBroadcast = async () => {
    try {
      await axiosClient.delete('/match/broadcast');
      toast.success("Đã dừng trạm phát sóng FM.");
    } catch (e) {}
    setIsBroadcasting(false);
    setBroadcastInfo(null);
    if (stompClientRef.current) {
      try { stompClientRef.current.disconnect(); } catch (e) {}
    }
  };

  const connectBroadcastWebSocket = (myUserId) => {
    try {
      const socketUrl = BACKEND_URL ? `${BACKEND_URL}/ws-gs-guide` : '/ws-gs-guide';
      const socket = new SockJS(socketUrl);
      const stomp = Stomp.over(socket);
      stomp.debug = () => {};
      stomp.connect({}, () => {
        stomp.subscribe(`/topic/match-locked/${myUserId}`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            toast.success(`Đã có thính giả bắt sóng trên tần số ${data.frequency} MHz! Đang chuyển vào phòng...`);
            handleModalClose();
            if (data.roomId) {
              navigate(`/call/room/${data.roomId}?video=false`);
            }
          } catch (e) {
            console.error("Lỗi parse match event:", e);
          }
        });
      });
      stompClientRef.current = stomp;
    } catch (e) {
      console.warn("WebSocket kết nối thất bại:", e);
    }
  };

  // ==========================================
  // LOGIC MÀN 3: DÒ SÓNG TẦN SỐ FM (TUNER SCANNER)
  // ==========================================
  const handleStartScan = async (intentToScan) => {
    const targetIntent = intentToScan || selectedIntent;
    if (!targetIntent) return;
    setSelectedIntent(targetIntent);
    setScreen('scan');
    initWebAudioNoise();

    try {
      setLoadingScan(true);
      const res = await axiosClient.post('/match/scan', {
        intentCode: targetIntent.code,
        excludedUserIds: Array.from(seenUserIds)
      });
      const stationList = Array.isArray(res.data) ? res.data : [];
      setStations(stationList);

      // Nếu có trạm phát, đặt kim ngay gần trạm phát đầu tiên để người dùng dễ bắt sóng
      if (stationList.length > 0) {
        setCurrentFrequency(stationList[0].frequency);
      } else {
        setCurrentFrequency(targetIntent.freqStart || 88.0);
      }
    } catch (err) {
      console.warn("Lỗi quét trạm FM:", err);
      toast.error("Không thể quét dải tần lúc này.");
    } finally {
      setLoadingScan(false);
    }
  };

  // Hiệu ứng dò sóng: Khi currentFrequency thay đổi, kiểm tra trạm phát gần nhất
  useEffect(() => {
    if (screen !== 'scan') return;

    // Tìm trạm trong bán kính ±0.3 MHz
    const match = stations.find(s => Math.abs(s.frequency - currentFrequency) <= 0.3);
    
    if (match) {
      setActiveStation(match);
      setSeenUserIds(prev => new Set(prev).add(match.userId));

      // Giảm dần hoặc tắt Noise gain
      if (noiseGainNodeRef.current && audioContextRef.current) {
        const dist = Math.abs(match.frequency - currentFrequency);
        // Càng gần (dist=0) noise càng về 0, dist=0.3 noise bắt đầu tăng
        const noiseLevel = isMuted ? 0 : (dist / 0.3) * 0.015;
        noiseGainNodeRef.current.gain.setValueAtTime(noiseLevel, audioContextRef.current.currentTime);
      }

      // Phát voice sample của trạm đó
      if (stationAudioRef.current && match.audioUrl) {
        const fullAudioUrl = match.audioUrl.startsWith('http') 
          ? match.audioUrl 
          : `${BACKEND_URL || ''}${match.audioUrl}`;
        
        if (stationAudioRef.current.src !== fullAudioUrl) {
          stationAudioRef.current.src = fullAudioUrl;
          stationAudioRef.current.volume = isMuted ? 0 : 1;
          stationAudioRef.current.play().catch(() => {});
        }
      }
    } else {
      setActiveStation(null);

      // Trả lại tiếng rè White Noise ở vùng trống
      if (noiseGainNodeRef.current && audioContextRef.current) {
        noiseGainNodeRef.current.gain.setValueAtTime(isMuted ? 0 : 0.025, audioContextRef.current.currentTime);
      }

      // Tắt voice trạm
      if (stationAudioRef.current) {
        stationAudioRef.current.pause();
      }
    }
  }, [currentFrequency, stations, screen, isMuted]);

  // Điều khiển phím mũi tên Trái / Phải & Enter khi đang ở Màn Dò Sóng
  useEffect(() => {
    if (screen !== 'scan' || !isOpen) return;

    const handleKeyDown = (e) => {
      const minFreq = selectedIntent?.freqStart || 88.0;
      const maxFreq = selectedIntent?.freqEnd || 108.0;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentFrequency(prev => Math.max(minFreq, Number((prev - 0.1).toFixed(1))));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentFrequency(prev => Math.min(maxFreq, Number((prev + 0.1).toFixed(1))));
      } else if (e.key === 'Enter' && activeStation && !isLocking) {
        e.preventDefault();
        handleLockStation(activeStation);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, isOpen, selectedIntent, activeStation, isLocking]);

  // Cuộn chuột trên thước đo tần số
  const handleWheelFrequency = (e) => {
    e.preventDefault();
    const minFreq = selectedIntent?.freqStart || 88.0;
    const maxFreq = selectedIntent?.freqEnd || 108.0;
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setCurrentFrequency(prev => {
      const next = Number((prev + delta).toFixed(1));
      return Math.min(maxFreq, Math.max(minFreq, next));
    });
  };

  // Khóa tần số & Tạo phòng đàm thoại 1-1
  const handleLockStation = async (station) => {
    if (!station) return;
    try {
      setIsLocking(true);
      const res = await axiosClient.post('/match/lock', {
        targetUserId: station.userId,
        frequency: station.frequency
      });

      if (res.data && res.data.roomId) {
        toast.success(`Đã khóa thành công tần số ${station.frequency} MHz! Đang vào phòng thoại 1-1...`);
        handleModalClose();
        navigate(`/call/room/${res.data.roomId}?video=false`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể khóa tần số này!");
      // Quét lại trạm mới
      handleStartScan(selectedIntent);
    } finally {
      setIsLocking(false);
    }
  };

  if (!isOpen) return null;

  const minFreq = selectedIntent?.freqStart || 88.0;
  const maxFreq = selectedIntent?.freqEnd || 108.0;
  const totalTicks = Math.round((maxFreq - minFreq) * 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      {/* Audio tags ẩn để xử lý phát âm */}
      <audio ref={previewAudioRef} onEnded={() => setIsPlayingPreview(false)} className="hidden" />
      <audio ref={stationAudioRef} loop className="hidden" />

      <div className="relative w-full max-w-2xl bg-[#09090b] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100 max-h-[92vh]">
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            {screen !== 'select' && (
              <button 
                type="button"
                onClick={() => {
                  stopWebAudioNoise();
                  if (stationAudioRef.current) stationAudioRef.current.pause();
                  setScreen('select');
                }}
                className="p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
                title="Quay lại chọn băng tần"
              >
                <ArrowLeft size={17} />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Radio size={17} />
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-wide flex items-center gap-2">
                Trạm Dò Sóng FM Thời Gian Thực
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  LIVE TUNER
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">Khám phá giọng nói & tần số đồng điệu trên nền tảng Talovin</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {screen === 'scan' && (
              <button 
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-xl border transition-colors ${
                  isMuted 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                    : 'bg-zinc-850 border-zinc-750 text-zinc-300 hover:text-white'
                }`}
                title={isMuted ? "Bật âm thanh rè FM" : "Tắt âm thanh rè FM"}
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
            )}
            <button 
              type="button" 
              onClick={handleModalClose}
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-850 transition-colors"
              title="Đóng modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* MÀN 1: CHỌN BĂNG TẦN & MỤC TIÊU PHÁT SÓNG */}
        {/* ============================================================== */}
        {screen === 'select' && (
          <div className="p-6 overflow-y-auto space-y-6">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                1. Chọn dải băng tần kết nối
              </h4>
              <p className="text-xs text-zinc-500">Mỗi mục đích được cấp một khoảng tần số FM riêng để lọc nhiễu tự nhiên.</p>
            </div>

            {loadingConfig ? (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-400 gap-3">
                <RefreshCw size={22} className="animate-spin text-emerald-400" />
                <span className="text-xs font-mono">Đang đồng bộ dải tần phát sóng...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {intents.map((intent) => {
                  const IconComp = ICON_MAP[intent.iconName] || Radio;
                  const isSelected = selectedIntent?.code === intent.code;
                  return (
                    <div 
                      key={intent.code}
                      onClick={() => setSelectedIntent(intent)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/30' 
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className={`p-2.5 rounded-xl ${
                          isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          <IconComp size={18} />
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-300">
                          {intent.freqStart?.toFixed(1)} - {intent.freqEnd?.toFixed(1)} MHz
                        </span>
                      </div>
                      <div>
                        <h5 className="font-semibold text-sm text-zinc-100 mb-0.5">{intent.title}</h5>
                        <p className="text-xs text-zinc-400 line-clamp-2">{intent.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button 
                type="button"
                onClick={() => handleStartScan(selectedIntent)}
                disabled={!selectedIntent || loadingConfig}
                className="py-3 px-4 rounded-2xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                <Signal size={16} />
                <span>Dò sóng tìm người ({selectedIntent ? `${selectedIntent.freqStart?.toFixed(1)} - ${selectedIntent.freqEnd?.toFixed(1)} MHz` : '...'})</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  setScreen('broadcast');
                }}
                disabled={!selectedIntent || loadingConfig}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                <Mic size={16} />
                <span>Thu âm 5s & Tự phát sóng</span>
              </button>
            </div>

            {/* KÊNH NHẠC NỀN HOẠT ĐỘNG */}
            {audioChannels.length > 0 && (
              <div className="pt-3 border-t border-zinc-800/80">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mb-2">
                  <Disc3 size={14} className="text-emerald-400 animate-spin" />
                  <span>Kênh radio nền đang hoạt động trong sảnh:</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                  {audioChannels.map(ch => (
                    <span 
                      key={ch.id} 
                      className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 flex-shrink-0 flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {ch.name} <span className="text-zinc-500">({ch.genreTag})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* MÀN 2: CHẾ ĐỘ THU ÂM & PHÁT SÓNG LÊN DẢI TẦN */}
        {/* ============================================================== */}
        {screen === 'broadcast' && (
          <div className="p-6 overflow-y-auto space-y-5">
            {!isBroadcasting ? (
              <>
                <div className="text-center max-w-md mx-auto space-y-1">
                  <h4 className="font-semibold text-base text-zinc-100">
                    Thu âm 5 giây giọng nói của bạn
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Hãy chào hỏi, ngân nga một câu hát hoặc chia sẻ tâm trạng để làm tín hiệu phát thanh độc bản.
                  </p>
                </div>

                {/* VÒNG TRÒN GHI ÂM TƯƠNG TÁC */}
                <div className="flex flex-col items-center justify-center py-6 gap-4">
                  <div className="relative flex items-center justify-center">
                    {/* Vòng tròn đếm ngược */}
                    <svg className="w-32 h-32 -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="#27272a"
                        strokeWidth="5"
                        fill="transparent"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="#10b981"
                        strokeWidth="5"
                        fill="transparent"
                        strokeDasharray={364.4}
                        strokeDashoffset={364.4 - (364.4 * recordProgress) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-100"
                      />
                    </svg>

                    <button 
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`absolute w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-lg active:scale-95 ${
                        isRecording 
                          ? 'bg-rose-500 text-white animate-pulse' 
                          : 'bg-zinc-800 hover:bg-zinc-750 text-emerald-400 border border-zinc-700'
                      }`}
                    >
                      {isRecording ? <MicOff size={26} /> : <Mic size={26} />}
                      <span className="text-[10px] font-mono font-semibold mt-1">
                        {isRecording ? 'Đang thu' : (recordedBlob ? 'Thu lại' : 'Bấm thu')}
                      </span>
                    </button>
                  </div>

                  <span className="text-xs font-mono text-zinc-400">
                    {isRecording ? `00:0${Math.floor((5000 * recordProgress / 100) / 1000)} / 00:05` : (recordedBlob ? '✓ Đã thu xong 5 giây' : 'Thời lượng tối đa 5 giây')}
                  </span>
                </div>

                {/* NÚT NGHE LẠI AUDIO ĐÃ THU */}
                {audioPreviewUrl && (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 max-w-md mx-auto">
                    <div className="flex items-center gap-3">
                      <button 
                        type="button"
                        onClick={togglePlayPreview}
                        className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 transition-colors"
                      >
                        {isPlayingPreview ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <div>
                        <span className="text-xs font-semibold text-zinc-200">Bản thu mẫu của bạn</span>
                        <p className="text-[11px] text-zinc-500 font-mono">Định dạng Audio/Opus</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                      <Check size={13} /> Sẵn sàng
                    </span>
                  </div>
                )}

                {/* FORM BỔ SUNG */}
                <div className="space-y-3 max-w-md mx-auto pt-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Lời chào / Lời nhắn trạm phát
                    </label>
                    <input 
                      type="text" 
                      placeholder="VD: Đang nghe Lo-Fi, ghé qua đàm đạo nhé!"
                      value={bioInput}
                      onChange={(e) => setBioInput(e.target.value)}
                      maxLength={120}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60 placeholder:text-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Gu âm nhạc / Vibe hôm nay
                    </label>
                    <input 
                      type="text" 
                      placeholder="VD: Lo-Fi, Acoustic, Indie, Jazz..."
                      value={musicTasteInput}
                      onChange={(e) => setMusicTasteInput(e.target.value)}
                      maxLength={60}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60 placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                {/* NÚT PHÁT SÓNG */}
                <div className="max-w-md mx-auto pt-3">
                  <button 
                    type="button"
                    onClick={handlePublishBroadcast}
                    disabled={!recordedBlob || isSubmittingBroadcast}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                  >
                    <Radio size={16} />
                    <span>{isSubmittingBroadcast ? 'Đang cấp tần số...' : 'Phát sóng lên dải tần'}</span>
                  </button>
                </div>
              </>
            ) : (
              /* TRẠM ĐANG PHÁT SÓNG TRỰC TIẾP */
              <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center max-w-md mx-auto">
                <div className="relative flex items-center justify-center">
                  <div className="w-28 h-28 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-ping"></div>
                  <div className="absolute w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex flex-col items-center justify-center text-emerald-400 shadow-xl">
                    <Radio size={28} />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    ĐANG PHÁT SÓNG TRỰC TIẾP
                  </span>
                  <h4 className="text-2xl font-bold font-mono tracking-tight text-white">
                    {broadcastInfo?.frequency?.toFixed(1) || '94.5'} MHz
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-sm">
                    Tín hiệu của bạn đang được phát rộng rãi trên dải tần {selectedIntent?.title}. Khi có người dò đúng tần số này, hệ thống sẽ tự động ghép nối cuộc gọi 1-1 ngay tức thì!
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-left w-full space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Trạm phát:</span>
                    <strong className="text-zinc-200">{currentUserName || currentUserAccount}</strong>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Mục tiêu:</span>
                    <span className="text-emerald-400 font-medium">{selectedIntent?.title}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Thời gian duy trì TTL:</span>
                    <span className="font-mono text-zinc-300">15 phút</span>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={handleStopBroadcast}
                  className="py-2.5 px-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-xs transition-colors border border-zinc-700/60"
                >
                  Tắt trạm phát sóng
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* MÀN 3: MÁY THU SÓNG FM TRỰC QUAN (TUNER SCANNER) */}
        {/* ============================================================== */}
        {screen === 'scan' && (
          <div className="p-6 overflow-y-auto space-y-6">
            
            {/* MÀN HÌNH TẦN SỐ ĐIỆN TỬ */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 shadow-inner flex flex-col items-center justify-center relative overflow-hidden">
              <div className="flex items-center justify-between w-full mb-3 text-xs text-zinc-500 font-mono">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${activeStation ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'}`}></span>
                  {activeStation ? 'TÍN HIỆU RÕ RÀNG' : 'TIẾNG ỒN DẢI TẦN TRỐNG (STATIC NOISE)'}
                </span>
                <span>{selectedIntent?.title}</span>
              </div>

              {/* TẦN SỐ HIỂN THỊ CHÍNH */}
              <div className="flex items-baseline gap-2 my-2">
                <span className="text-5xl font-mono font-bold tracking-wider text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  {currentFrequency.toFixed(1)}
                </span>
                <span className="text-lg font-mono text-zinc-400 font-semibold">MHz</span>
              </div>

              {/* THÔNG TIN TRẠM ĐANG BẮT ĐƯỢC */}
              {activeStation ? (
                <div className="flex items-center gap-3 mt-3 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 animate-fade-in">
                  <UserAvatar avatar={activeStation.avatar} name={activeStation.displayName || activeStation.username} size={28} />
                  <div className="text-left">
                    <span className="text-xs font-semibold text-white block">
                      {activeStation.displayName || activeStation.username}
                    </span>
                    <span className="text-[11px] text-zinc-300 line-clamp-1">
                      "{activeStation.bio || 'Chào bạn!'}"
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 mt-2 font-mono">
                  Kéo thước, lăn chuột hoặc dùng phím ← → để dò đài
                </p>
              )}
            </div>

            {/* THƯỚC ĐO TẦN SỐ FM CHUYÊN NGHIỆP */}
            <div 
              className="relative py-8 px-4 bg-zinc-950 rounded-2xl border border-zinc-800 select-none overflow-hidden cursor-ew-resize"
              onWheel={handleWheelFrequency}
            >
              {/* ĐIỂM SÁNG EMERALD ĐÁNH DẤU TRẠM CÓ NGƯỜI PHÁT */}
              {stations.map(st => {
                const leftPercent = Math.max(0, Math.min(100, ((st.frequency - minFreq) / (maxFreq - minFreq)) * 100));
                return (
                  <div 
                    key={st.userId}
                    style={{ left: `${leftPercent}%` }}
                    className="absolute top-2 -translate-x-1/2 flex flex-col items-center cursor-pointer group"
                    onClick={() => setCurrentFrequency(st.frequency)}
                    title={`Trạm ${st.displayName || st.username} (${st.frequency.toFixed(1)} MHz)`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 group-hover:scale-125 transition-transform animate-pulse"></span>
                    <span className="text-[9px] font-mono text-emerald-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {st.frequency.toFixed(1)}
                    </span>
                  </div>
                );
              })}

              {/* VẠCH CHIA THƯỚC FM */}
              <div className="relative h-12 flex items-end justify-between border-b border-zinc-800 px-2">
                {Array.from({ length: totalTicks + 1 }).map((_, idx) => {
                  const tickFreq = minFreq + idx * 0.1;
                  const isMajor = idx % 10 === 0;
                  const isMedium = idx % 5 === 0 && !isMajor;

                  return (
                    <div 
                      key={idx} 
                      className="flex flex-col items-center flex-1 justify-end"
                      onClick={() => setCurrentFrequency(Number(tickFreq.toFixed(1)))}
                    >
                      {isMajor && (
                        <span className="text-[10px] font-mono text-zinc-500 mb-1">
                          {tickFreq.toFixed(0)}
                        </span>
                      )}
                      <span className={`w-px ${
                        isMajor 
                          ? 'h-6 bg-zinc-400' 
                          : (isMedium ? 'h-3.5 bg-zinc-600' : 'h-2 bg-zinc-800')
                      }`} />
                    </div>
                  );
                })}
              </div>

              {/* KIM CHỈ TẦN SỐ (NEEDLE INDICATOR) MÀU TRẮNG / EMERALD */}
              <div 
                style={{ 
                  left: `${Math.max(0, Math.min(100, ((currentFrequency - minFreq) / (maxFreq - minFreq)) * 100))}%` 
                }}
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] pointer-events-none transition-all duration-75 flex flex-col items-center justify-between"
              >
                <div className="w-2 h-2 rounded-full bg-rose-500 -mt-1 shadow-sm"></div>
                <div className="w-2 h-2 rounded-full bg-rose-500 -mb-1 shadow-sm"></div>
              </div>

              {/* RANGE SLIDER ẨN ĐỂ HỖ TRỢ KÉO THẢ BẰNG TAY HOẶC TOUCH TRÊN ĐIỆN THOẠI */}
              <input 
                type="range"
                min={minFreq}
                max={maxFreq}
                step={0.1}
                value={currentFrequency}
                onChange={(e) => setCurrentFrequency(parseFloat(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
                aria-label="Điều chỉnh tần số FM"
              />
            </div>

            {/* THẺ BẮT SÓNG & NÚT KHÓA TẦN SỐ CALL 1-1 */}
            {activeStation ? (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-emerald-500/40 shadow-lg space-y-3 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar 
                      avatar={activeStation.avatar} 
                      name={activeStation.displayName || activeStation.username} 
                      size={44} 
                    />
                    <div>
                      <h5 className="font-semibold text-sm text-white flex items-center gap-2">
                        {activeStation.displayName || activeStation.username}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          {activeStation.frequency.toFixed(1)} MHz
                        </span>
                      </h5>
                      <p className="text-xs text-zinc-400 mt-0.5">{activeStation.bio}</p>
                    </div>
                  </div>
                </div>

                {activeStation.musicTaste && (
                  <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 pt-1 border-t border-zinc-800">
                    <Disc3 size={13} className="text-emerald-400" />
                    <span>Gu âm nhạc: <strong className="text-zinc-200">{activeStation.musicTaste}</strong></span>
                  </div>
                )}

                <div className="pt-2 flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => handleLockStation(activeStation)}
                    disabled={isLocking}
                    className="flex-1 h-11 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50"
                  >
                    <PhoneCall size={16} />
                    <span>{isLocking ? 'Đang kết nối đàm thoại...' : 'Khóa tần số & Call 1-1 (Enter)'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 text-center space-y-2">
                <p className="text-xs text-zinc-400">
                  {stations.length === 0 
                    ? 'Chưa có trạm phát nào trên dải tần này.' 
                    : `Đã tìm thấy ${stations.length} trạm phát trên dải tần. Hãy xoay kim vào các điểm sáng xanh để nghe thử!`}
                </p>
                <button 
                  type="button"
                  onClick={() => handleStartScan(selectedIntent)}
                  disabled={loadingScan}
                  className="py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono inline-flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={12} className={loadingScan ? 'animate-spin' : ''} />
                  <span>Quét dải tần mới</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* FOOTER BẢO MẬT & BẢN QUYỀN */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} className="text-emerald-400" /> Web Audio & Real-time WebRTC Protected
          </span>
          <span>Dải tần: 88.0 - 108.0 MHz</span>
        </div>

      </div>
    </div>
  );
};

export default ResonanceMatchModal;
