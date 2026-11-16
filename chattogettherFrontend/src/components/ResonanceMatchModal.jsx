import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Radio, Mic, MicOff, Volume2, VolumeX, Play, Pause, RefreshCw,
  PhoneCall, ArrowLeft, X, Signal, ChevronLeft, ChevronRight, Square,
  Compass, MessageSquareShare, Users, Sparkles, Check, Disc3
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import toast from 'react-hot-toast';
import { createStompClient } from '../utils/stompClient';
import UserAvatar from './UserAvatar';

export const ResonanceMatchModal = ({
  isOpen,
  onClose,
  currentUserId,
  currentUserAccount,
  currentUserName,
  navigate
}) => {
  // Chế độ hiển thị: 'tune' (Dò sóng) | 'broadcast' (Phát sóng cá nhân)
  const [activeTab, setActiveTab] = useState('tune');

  // Dữ liệu từ Server
  const [stations, setStations] = useState([]);
  const [intents, setIntents] = useState([]);
  const [musicTracks, setMusicTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userPersonalFrequency, setUserPersonalFrequency] = useState(96.4);
  const [totalOnlineCount, setTotalOnlineCount] = useState(0);
  const [activeIntents, setActiveIntents] = useState([]);
  const seenStationIdsRef = useRef(new Set());

  // =========================================================================
  // TAB 1: DÒ SÓNG (TUNER STATES)
  // =========================================================================
  const [frequency, setFrequency] = useState(96.4);
  const [selectedIntentFilter, setSelectedIntentFilter] = useState('ALL');
  const [isMuted, setIsMuted] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [stationSubIndex, setStationSubIndex] = useState(0);

  // Thuật toán Quét Thông Minh (Smart Jump Auto-Scan)
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState(null);
  const autoScanTimerRef = useRef(null);

  // =========================================================================
  // TAB 2: PHÁT SÓNG CÁ NHÂN (BROADCAST STATES)
  // =========================================================================
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastInfo, setBroadcastInfo] = useState(null);
  const [broadcastIntentCode, setBroadcastIntentCode] = useState('');
  const [broadcastFreqTarget, setBroadcastFreqTarget] = useState(96.4);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);

  // Ghép sóng Realtime (Proximity Auto-Match)
  const [matchedSignal, setMatchedSignal] = useState(null);
  const [isPlayingMatchedAudio, setIsPlayingMatchedAudio] = useState(false);
  const matchedAudioRef = useRef(null);

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

  // Fetch guard ref
  const hasFetchedRef = useRef(false);
  const stompClientRef = useRef(null);

  // Thước chia vạch
  const rulerRef = useRef(null);
  const chipScrollRef = useRef(null);
  const isDraggingRulerRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartFreqRef = useRef(96.4);

  // Băng tần hiện tại đang chọn (Strict Range Clamping)
  const currentBand = useMemo(() => {
    if (selectedIntentFilter === 'ALL') {
      return { min: 88.0, max: 108.0, title: 'Toàn dải FM' };
    }
    const found = intents.find(it => it.code === selectedIntentFilter);
    return {
      min: found?.freqStart != null ? Number(found.freqStart.toFixed(1)) : 88.0,
      max: found?.freqEnd != null ? Number(found.freqEnd.toFixed(1)) : 108.0,
      title: found?.title || 'Băng tần'
    };
  }, [selectedIntentFilter, intents]);

  // Lọc danh sách trạm theo băng tần được chọn
  const filteredStations = useMemo(() => {
    if (selectedIntentFilter === 'ALL') return stations;
    return stations.filter(s => {
      if (s.intentCode === selectedIntentFilter) return true;
      const freq = Number(s.frequency);
      return freq >= currentBand.min && freq <= currentBand.max;
    });
  }, [stations, selectedIntentFilter, currentBand]);

  // Cold-start Discovery: Gợi ý băng tần khác có người phát nếu băng tần hiện tại vắng
  const suggestedIntent = useMemo(() => {
    if (filteredStations.length > 0) return null;
    return activeIntents.find(ai => ai.count > 0 && ai.code !== selectedIntentFilter) || null;
  }, [filteredStations, activeIntents, selectedIntentFilter]);

  // Danh sách các trạm trùng tần số hiện tại (Multi-User Stacking trong khoảng ±0.08 MHz)
  const stationsAtFreq = useMemo(() => {
    return filteredStations.filter(s => {
      if (!s || s.frequency == null) return false;
      const diff = Math.abs(Number(s.frequency) - frequency);
      return diff <= 0.08;
    });
  }, [filteredStations, frequency]);

  // Danh sách các trạm khác đang phát trong băng tần này (loại trừ chính mình)
  const activeBandStations = useMemo(() => {
    return filteredStations.filter(s => String(s.userId) !== String(currentUserId));
  }, [filteredStations, currentUserId]);

  // Trạm hiện tại đang được lắng nghe
  const currentStation = useMemo(() => {
    if (stationsAtFreq.length === 0) return null;
    const safeIdx = Math.abs(stationSubIndex) % stationsAtFreq.length;
    return stationsAtFreq[safeIdx] || stationsAtFreq[0];
  }, [stationsAtFreq, stationSubIndex]);

  // Reset stationSubIndex khi tần số thay đổi
  useEffect(() => {
    setStationSubIndex(0);
  }, [frequency]);

  // Helper: Sinh tần số ngẫu nhiên 1 chữ số thập phân trong dải của intent
  const getRandomFreqForIntent = useCallback((intentObj) => {
    if (!intentObj) return 96.4;
    const min = intentObj.freqStart != null ? intentObj.freqStart : 88.0;
    const max = intentObj.freqEnd != null ? intentObj.freqEnd : 108.0;
    const rand = min + Math.random() * (max - min);
    return Number((Math.round(rand * 10) / 10).toFixed(1));
  }, []);

  // Backend Collision-Free Slot Allocation
  const handleRequestCollisionFreeSlot = useCallback(async (intentCode) => {
    const code = intentCode || broadcastIntentCode || 'DEEP_TALK';
    try {
      const res = await axiosClient.get(`/match/allocate-frequency?intentCode=${encodeURIComponent(code)}`);
      if (res.data?.data) {
        const allocated = Number(Number(res.data.data).toFixed(1));
        setBroadcastFreqTarget(allocated);
        setUserPersonalFrequency(allocated);
        return allocated;
      }
    } catch (err) {
      console.warn("Backend allocation fallback:", err);
    }
    const it = intents.find(i => i.code === code) || intents[0];
    const fallback = getRandomFreqForIntent(it);
    setBroadcastFreqTarget(fallback);
    return fallback;
  }, [broadcastIntentCode, intents, getRandomFreqForIntent]);

  // Khi chọn intent trong tab phát sóng: tự động đồng bộ tần số tránh va chạm
  const handleSelectBroadcastIntent = (code) => {
    setBroadcastIntentCode(code);
    const targetIntent = intents.find(it => it.code === code);
    if (!targetIntent) return;

    const min = targetIntent.freqStart != null ? targetIntent.freqStart : 88.0;
    const max = targetIntent.freqEnd != null ? targetIntent.freqEnd : 108.0;

    // Nếu userPersonalFrequency nằm trong khoảng thì dùng luôn, ngược lại cấp slot không trùng lặp
    if (userPersonalFrequency >= min && userPersonalFrequency <= max) {
      setBroadcastFreqTarget(Number(userPersonalFrequency.toFixed(1)));
    } else {
      handleRequestCollisionFreeSlot(code);
    }
  };

  // 1. Tải dữ liệu từ Server song song 1 lần duy nhất khi mở modal
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [stationsRes, configRes, meRes] = await Promise.allSettled([
        axiosClient.get('/match/stations'),
        axiosClient.get('/public/lobby-config'),
        axiosClient.get('/users/profile')
      ]);

      // Nạp trạm sóng online & dữ liệu discovery
      if (stationsRes.status === 'fulfilled' && stationsRes.value?.data) {
        const raw = stationsRes.value.data;
        const list = raw.data?.stations || (Array.isArray(raw.data) ? raw.data : (Array.isArray(raw) ? raw : []));
        setStations(list);
        setTotalOnlineCount(raw.data?.totalOnlineCount ?? list.length);
        setActiveIntents(raw.data?.activeIntents || []);
      }

      // Nạp danh mục Băng tần từ Admin
      let loadedIntents = [];
      if (configRes.status === 'fulfilled' && configRes.value?.data?.data) {
        const cfg = configRes.value.data.data;
        loadedIntents = cfg.intents || [];
        setIntents(loadedIntents);
        setMusicTracks(cfg.tracks || cfg.musicTracks || []);
      }

      // Nạp thông tin tần số cá nhân
      if (meRes.status === 'fulfilled' && meRes.value?.data?.data) {
        const me = meRes.value.data.data;
        if (me.personalFrequency) {
          const pf = Number(Number(me.personalFrequency).toFixed(1));
          setUserPersonalFrequency(pf);
          setFrequency(pf);
          setBroadcastFreqTarget(pf);
        }
        if (me.matchIntentCode) {
          setBroadcastIntentCode(me.matchIntentCode);
        } else if (loadedIntents.length > 0) {
          setBroadcastIntentCode(loadedIntents[0].code);
          setBroadcastFreqTarget(getRandomFreqForIntent(loadedIntents[0]));
        }
      } else if (loadedIntents.length > 0) {
        setBroadcastIntentCode(loadedIntents[0].code);
        setBroadcastFreqTarget(getRandomFreqForIntent(loadedIntents[0]));
      }
    } catch (err) {
      console.warn("Lỗi tải cấu hình Radio FM:", err);
    } finally {
      setIsLoading(false);
    }
  }, [getRandomFreqForIntent]);

  // 2. Kết nối STOMP WebSocket nhận sự kiện Batching (/topic/fm-stations) & Ghép Sóng Tức Thì (/user/queue/fm-match)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    try {
      const client = createStompClient();
      stompClientRef.current = client;

      client.connect({}, () => {
        if (!isMounted) return;

        client.subscribe('/topic/fm-stations', (frame) => {
          try {
            const data = JSON.parse(frame.body);
            if (data.type === 'STATION_BATCH' && Array.isArray(data.events)) {
              setStations(prev => {
                let updated = [...prev];
                data.events.forEach(ev => {
                  if (ev.action === 'ONLINE' && ev.station) {
                    if (String(ev.station.userId) !== String(currentUserId)) {
                      updated = updated.filter(s => s.userId !== ev.station.userId);
                      updated.unshift(ev.station);
                    }
                  } else if (ev.action === 'OFFLINE' && ev.userId) {
                    updated = updated.filter(s => s.userId !== ev.userId);
                  }
                });
                return updated;
              });
            }
          } catch (e) { }
        });

        // Xử lý sự kiện Ghép Sóng Tức Thì (Proximity Auto-Match)
        const onFmMatch = (frame) => {
          try {
            const matchData = JSON.parse(frame.body);
            if (matchData && (matchData.type === 'FM_MATCH' || matchData.userId)) {
              setMatchedSignal(matchData);
              playTuneMatchSound();
              toast.success(`Đã bắt được sóng của ${matchData.displayName || matchData.username} tại ${Number(matchData.frequency).toFixed(1)} MHz!`);
            }
          } catch (e) { }
        };

        client.subscribe('/user/queue/fm-match', onFmMatch);
        if (currentUserId) {
          client.subscribe(`/topic/fm-match/${currentUserId}`, onFmMatch);
        }
      }, () => { });
    } catch (err) { }

    return () => {
      isMounted = false;
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.disconnect();
        stompClientRef.current = null;
      }
    };
  }, [isOpen, currentUserId]);

  // Modal Lifecycle & Phím tắt
  useEffect(() => {
    if (isOpen) {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchData();
        initWebAudioNoise();
      }
    } else {
      hasFetchedRef.current = false;
      stopAutoScan();
      stopWebAudioNoise();
      if (stationAudioRef.current) stationAudioRef.current.pause();
    }
  }, [isOpen, fetchData]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleModalClose();
      } else if (activeTab === 'tune') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          stopAutoScan();
          setFrequency(prev => Math.max(currentBand.min, Number((prev - 0.1).toFixed(1))));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          stopAutoScan();
          setFrequency(prev => Math.min(currentBand.max, Number((prev + 0.1).toFixed(1))));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, currentBand]);

  // 3. Web Audio API giả lập tiếng rè radio bán dẫn
  const initWebAudioNoise = () => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      if (noiseSourceRef.current) {
        try { noiseSourceRef.current.stop(); } catch (e) { }
      }

      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.12;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, ctx.currentTime);
      filter.Q.setValueAtTime(1.2, ctx.currentTime);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(isMuted ? 0 : 0.016, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      whiteNoise.start();
      noiseSourceRef.current = whiteNoise;
      noiseGainRef.current = gainNode;
      isAudioReadyRef.current = true;
    } catch (err) { }
  };

  const stopWebAudioNoise = () => {
    if (noiseSourceRef.current) {
      try { noiseSourceRef.current.stop(); } catch (e) { }
      noiseSourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.suspend(); } catch (e) { }
    }
    isAudioReadyRef.current = false;
  };

  // Hiệu ứng âm thanh Chime khi bắt trúng tần số sóng (Tune Match Sound)
  const playTuneMatchSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioContextRef.current || new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      // Note 1 (523.25 Hz - C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2 (659.25 Hz - E5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      gain2.gain.setValueAtTime(0.08, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.55);
    } catch (e) { }
  };

  // Tự động ngắt tiếng rè khi bắt được trạm và phát audio 5s
  useEffect(() => {
    if (!isOpen || activeTab !== 'tune') {
      if (stationAudioRef.current) stationAudioRef.current.pause();
      return;
    }

    if (currentStation) {
      if (noiseGainRef.current && audioContextRef.current) {
        noiseGainRef.current.gain.setTargetAtTime(0, audioContextRef.current.currentTime, 0.04);
      }

      if (stationAudioRef.current && currentStation.audioUrl) {
        const fullUrl = currentStation.audioUrl.startsWith('http')
          ? currentStation.audioUrl
          : `${BACKEND_URL || ''}${currentStation.audioUrl}`;

        if (stationAudioRef.current.src !== fullUrl) {
          stationAudioRef.current.src = fullUrl;
          stationAudioRef.current.volume = isMuted ? 0 : 1;
          stationAudioRef.current.play().catch(() => { });
        }
      }
    } else {
      if (noiseGainRef.current && audioContextRef.current) {
        const targetVol = isMuted ? 0 : 0.016;
        noiseGainRef.current.gain.setTargetAtTime(targetVol, audioContextRef.current.currentTime, 0.06);
      }

      if (stationAudioRef.current) {
        stationAudioRef.current.pause();
      }
    }
  }, [frequency, currentStation, isOpen, isMuted, activeTab]);

  useEffect(() => {
    if (noiseGainRef.current && audioContextRef.current) {
      const vol = isMuted ? 0 : (currentStation ? 0 : 0.016);
      noiseGainRef.current.gain.setValueAtTime(vol, audioContextRef.current.currentTime);
    }
    if (stationAudioRef.current) {
      stationAudioRef.current.volume = isMuted ? 0 : 1;
    }
  }, [isMuted, currentStation]);

  // 4. Thuật toán Quét Thông Minh & Hàng đợi Trạm đã nghe (Smart Hop Scan & Seen-Queue)
  const stopAutoScan = useCallback(() => {
    if (autoScanTimerRef.current) {
      clearInterval(autoScanTimerRef.current);
      clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    setIsAutoScanning(false);
  }, []);

  const executeSmartHop = useCallback((targetStation) => {
    stopAutoScan();
    if (!targetStation || targetStation.frequency == null) return;

    const targetFreq = Number(Number(targetStation.frequency).toFixed(1));
    setIsAutoScanning(true);
    setScanNotice(null);

    const startF = frequency;
    const steps = 12;
    let cur = 0;

    autoScanTimerRef.current = setInterval(() => {
      cur++;
      const p = cur / steps;
      const intermediate = Number((startF + (targetFreq - startF) * p).toFixed(1));
      setFrequency(intermediate);

      if (cur >= steps) {
        if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
        setFrequency(targetFreq);
        setIsAutoScanning(false);
        const sid = targetStation.id || targetStation.userId;
        if (sid) seenStationIdsRef.current.add(String(sid));
      }
    }, 40);
  }, [frequency, stopAutoScan]);

  const startAutoScan = () => {
    if (isAutoScanning) {
      stopAutoScan();
      return;
    }

    if (filteredStations.length === 0) {
      setScanNotice("Chưa có ai phát sóng ở băng tần này");
      return;
    }

    // Lọc các trạm chưa nghe trong dải và khác tần số hiện tại
    let candidates = filteredStations.filter(s => {
      const sid = String(s.id || s.userId);
      const isDifferent = Math.abs(Number(s.frequency) - frequency) > 0.08;
      return !seenStationIdsRef.current.has(sid) && isDifferent;
    });

    if (candidates.length === 0) {
      seenStationIdsRef.current.clear();
      candidates = filteredStations.filter(s => Math.abs(Number(s.frequency) - frequency) > 0.08);
    }

    if (candidates.length === 0) {
      const target = filteredStations[0];
      const sid = String(target.id || target.userId);
      seenStationIdsRef.current.add(sid);
      toast("Đã bắt trúng trạm đang phát sóng!");
      return;
    }

    const nextStation = candidates[Math.floor(Math.random() * candidates.length)];
    executeSmartHop(nextStation);
  };

  const handleScanNext = () => {
    stopAutoScan();
    setScanNotice(null);
    if (filteredStations.length === 0) return;

    let candidates = filteredStations.filter(s => {
      const sid = String(s.id || s.userId);
      const isDifferent = Math.abs(Number(s.frequency) - frequency) > 0.08;
      return !seenStationIdsRef.current.has(sid) && isDifferent;
    });

    if (candidates.length === 0) {
      seenStationIdsRef.current.clear();
      candidates = filteredStations.filter(s => Math.abs(Number(s.frequency) - frequency) > 0.08);
    }

    if (candidates.length === 0) {
      candidates = filteredStations;
    }

    const nextStation = candidates[Math.floor(Math.random() * candidates.length)];
    executeSmartHop(nextStation);
  };

  useEffect(() => {
    return () => {
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    };
  }, []);

  // 5. Thao tác trên thước chia vạch (Mouse Drag & Touch Swipe)
  const handleRulerMouseDown = (e) => {
    stopAutoScan();
    setScanNotice(null);
    isDraggingRulerRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartFreqRef.current = frequency;
  };

  const handleRulerMouseMove = (e) => {
    if (!isDraggingRulerRef.current) return;
    const deltaX = dragStartXRef.current - e.clientX;
    const deltaFreq = (deltaX / 14) * 0.1;
    const nextFreq = Math.min(currentBand.max, Math.max(currentBand.min, Number((dragStartFreqRef.current + deltaFreq).toFixed(1))));
    setFrequency(nextFreq);
  };

  const handleRulerMouseUp = () => {
    isDraggingRulerRef.current = false;
  };

  const handleRulerTouchStart = (e) => {
    stopAutoScan();
    setScanNotice(null);
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
    const nextFreq = Math.min(currentBand.max, Math.max(currentBand.min, Number((dragStartFreqRef.current + deltaFreq).toFixed(1))));
    setFrequency(nextFreq);
  };

  const handleRulerTouchEnd = () => {
    isDraggingRulerRef.current = false;
  };

  const handleRulerWheel = (e) => {
    e.preventDefault();
    stopAutoScan();
    setScanNotice(null);
    const delta = e.deltaY < 0 ? -0.1 : 0.1;
    setFrequency(prev => Math.min(currentBand.max, Math.max(currentBand.min, Number((prev + delta).toFixed(1)))));
  };

  // 6. Kết nối cuộc gọi 1-1 & Nhắn tin
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
        toast.success(`Đã khóa sóng ${station.frequency} MHz! Đang chuyển vào phòng thoại 1-1...`);
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

  const handleDirectChat = (station) => {
    if (!station?.userId) return;
    handleModalClose();
    navigate(`/messages/${station.userId}`);
  };

  // 7. Ghi âm 5s & Phát sóng cá nhân (Tab 2)
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
      formData.append('frequency', broadcastFreqTarget);

      const res = await axiosClient.post('/match/broadcast', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.data) {
        const b = res.data.data;
        setBroadcastInfo(b);
        setIsBroadcasting(true);
        setUserPersonalFrequency(b.frequency);
        toast.success(`Đã phát sóng giọng nói lên tần số ${Number(b.frequency).toFixed(1)} MHz! Đang chuyển sang Dò sóng...`);
        fetchData();
        // Tự động chuyển mượt mà về Tab Dò Sóng để bắt đầu ghép đôi
        setActiveTab('tune');
        setFrequency(Number(Number(b.frequency).toFixed(1)));
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
    } catch (e) { }
    setIsBroadcasting(false);
    setBroadcastInfo(null);
    fetchData();
  };

  const handleModalClose = () => {
    stopAutoScan();
    stopWebAudioNoise();
    if (stationAudioRef.current) stationAudioRef.current.pause();
    onClose();
  };

  if (!isOpen) return null;

  // Tính toán vị trí dịch chuyển của dải vạch thước (Ruler Strip)
  // Dải tần 88.0 đến 108.0 MHz (tổng 201 vạch, mỗi vạch 14px)
  const totalOffsetPx = (frequency - 88.0) * 140;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans select-none"
      onClick={handleModalClose}
    >
      <audio ref={stationAudioRef} loop className="hidden" />
      <audio ref={previewAudioRef} onEnded={() => setIsPlayingPreview(false)} className="hidden" />

      <div
        className="w-[92vw] max-w-md md:max-w-xl h-[600px] sm:h-[640px] max-h-[88dvh] bg-zinc-950 border border-zinc-800 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================== */}
        {/* 1. HEADER MODAL: TIÊU ĐỀ GỌN 1 HÀNG & NÚT ÂM THANH / ĐÓNG */}
        {/* ============================================================== */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200">
              <Radio size={16} />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm sm:text-base text-white tracking-tight whitespace-nowrap">Trạm Sóng FM</h3>
              <span className="text-[11px] font-mono whitespace-nowrap px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                {totalOnlineCount ?? stations.length} online
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeTab === 'tune' && (
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title={isMuted ? "Bật tiếng rè radio" : "Tắt tiếng rè radio"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
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

        {/* ============================================================== */}
        {/* 2. CHUYỂN ĐỔI 2 CHẾ ĐỘ: DÒ SÓNG (TÌM NGƯỜI) vs PHÁT SÓNG CỦA TÔI */}
        {/* ============================================================== */}
        <div className="grid grid-cols-2 border-b border-zinc-800 bg-zinc-950/60 p-1.5 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('tune')}
            className={`py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'tune'
              ? 'bg-white text-zinc-950 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
          >
            <Compass size={14} />
            <span>Dò Sóng (Tìm người)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopAutoScan();
              setActiveTab('broadcast');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'broadcast'
              ? 'bg-white text-zinc-950 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
          >
            <Mic size={14} />
            <span>Phát Sóng Của Tôi (5s)</span>
            {isBroadcasting && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
        </div>

        {/* ============================================================== */}
        {/* 3. NỘI DUNG CHÍNH THEO TAB */}
        {/* ============================================================== */}
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">

          {/* ============================================================ */}
          {/* TAB 1: DÒ SÓNG (TUNER & SCAN) */}
          {/* ============================================================ */}
          {activeTab === 'tune' && (
            <div className="space-y-5 animate-fade-in">

              {/* THẺ BẮT ĐƯỢC TÍN HIỆU GHÉP ĐÔI (REALTIME FM-MATCH) */}
              {matchedSignal && (
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/95 border border-emerald-500/40 space-y-3.5 shadow-xl animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <UserAvatar
                          avatar={matchedSignal.avatarUrl}
                          name={matchedSignal.displayName || matchedSignal.username}
                          size={48}
                          className="w-12 h-12 rounded-xl border border-emerald-500/50"
                        />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-zinc-950 flex items-center justify-center">
                          <Signal size={9} className="text-zinc-950" />
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider font-sans">
                            Đã bắt được tín hiệu!
                          </span>
                          <span className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
                            {Number(matchedSignal.frequency).toFixed(1)} MHz
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm text-white truncate mt-0.5 font-sans">
                          {matchedSignal.displayName || matchedSignal.username}
                        </h4>
                        <span className="text-xs text-zinc-400 block truncate font-sans">
                          @{matchedSignal.username} • {matchedSignal.bandName || 'FM Radio'} • Cách {matchedSignal.distanceMhz ?? 0} MHz
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMatchedSignal(null)}
                      className="w-7 h-7 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
                      title="Đóng thông báo"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Audio lời chào 5s của đối phương nếu có */}
                  {matchedSignal.audioUrl && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs font-sans text-zinc-300">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <span>Lời chào 5s của trạm</span>
                      </div>

                      <audio
                        ref={matchedAudioRef}
                        src={matchedSignal.audioUrl.startsWith('http') ? matchedSignal.audioUrl : `${BACKEND_URL || ''}${matchedSignal.audioUrl}`}
                        onEnded={() => setIsPlayingMatchedAudio(false)}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (!matchedAudioRef.current) return;
                          if (isPlayingMatchedAudio) {
                            matchedAudioRef.current.pause();
                            setIsPlayingMatchedAudio(false);
                          } else {
                            matchedAudioRef.current.play().then(() => setIsPlayingMatchedAudio(true)).catch(() => {});
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-sans flex items-center gap-1.5 transition-colors"
                      >
                        {isPlayingMatchedAudio ? <Pause size={12} /> : <Play size={12} />}
                        <span>{isPlayingMatchedAudio ? "Tạm dừng" : "Nghe lời chào"}</span>
                      </button>
                    </div>
                  )}

                  {/* Nút hành động */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleDirectChat(matchedSignal)}
                      className="flex-1 h-9 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95 font-sans"
                    >
                      <MessageSquareShare size={14} />
                      <span>Nhắn tin ngay</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleConnectCall(matchedSignal)}
                      disabled={isLocking}
                      className="flex-1 h-9 px-3.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 font-sans"
                    >
                      <PhoneCall size={14} />
                      <span>{isLocking ? "Đang kết nối..." : "Gọi thoại 1-1"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Dải chip chọn Băng tần từ Admin với 2 nút điều hướng tròn < > */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (chipScrollRef.current) chipScrollRef.current.scrollBy({ left: -140, behavior: 'smooth' });
                  }}
                  className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center shrink-0 active:scale-95 transition-all"
                  title="Cuộn sang trái"
                >
                  <ChevronLeft size={14} />
                </button>

                <div
                  ref={chipScrollRef}
                  onWheel={(e) => {
                    if (e.deltaY && chipScrollRef.current) {
                      chipScrollRef.current.scrollLeft += e.deltaY;
                    }
                  }}
                  className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-1 flex-1 scroll-smooth"
                >
                  <button
                    type="button"
                    onClick={() => {
                      stopAutoScan();
                      setScanNotice(null);
                      setSelectedIntentFilter('ALL');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all border shrink-0 ${selectedIntentFilter === 'ALL'
                      ? 'bg-white text-zinc-950 font-semibold border-white'
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
                          stopAutoScan();
                          setScanNotice(null);
                          setSelectedIntentFilter(it.code);
                          const min = it.freqStart != null ? Number(it.freqStart.toFixed(1)) : 88.0;
                          const max = it.freqEnd != null ? Number(it.freqEnd.toFixed(1)) : 108.0;
                          setFrequency(prev => Math.min(max, Math.max(min, prev)));
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all border shrink-0 ${isSelected
                          ? 'bg-white text-zinc-950 font-semibold border-white'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                          }`}
                      >
                        {it.title} ({it.freqStart?.toFixed(0)}-{it.freqEnd?.toFixed(0)} MHz)
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (chipScrollRef.current) chipScrollRef.current.scrollBy({ left: 140, behavior: 'smooth' });
                  }}
                  className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center shrink-0 active:scale-95 transition-all"
                  title="Cuộn sang phải"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Mặt đồng hồ Tuner & Thước chia vạch */}
              <div className="p-5 sm:p-6 rounded-3xl bg-zinc-950 border border-zinc-800 text-center relative shadow-inner space-y-3">

                {/* Tín hiệu bắt sóng */}
                <div className="flex items-center justify-center min-h-[24px]">
                  {isAutoScanning ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 text-zinc-200 border border-zinc-700 text-xs font-mono shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-zinc-200 animate-ping" />
                      <span>Đang quét tự động trong dải {currentBand.title}...</span>
                    </span>
                  ) : currentStation ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 text-zinc-200 border border-zinc-700 text-xs font-mono shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Bắt được sóng: <strong>{currentStation.displayName || currentStation.username}</strong></span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/60 text-zinc-500 border border-zinc-800 text-xs font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                      <span>Tần số tĩnh</span>
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

                {/* THƯỚC CHIA VẠCH ĐỒNG BỘ TUYỆT ĐỐI */}
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
                  {/* KIM CHỈ ĐỎ NẰM CHÍNH GIỮA */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-rose-500 -translate-x-1/2 z-20 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.9)]">
                    <div className="w-2 h-2 bg-rose-500 rotate-45 -translate-x-[3px] -translate-y-1 mx-auto" />
                  </div>

                  {/* Dải vạch thước: cố định width 2814px (201 vạch * 14px) đồng bộ 100% với kim đỏ */}
                  <div
                    className="absolute top-0 bottom-0 flex items-end pb-2.5 transition-transform duration-75 will-change-transform"
                    style={{
                      left: '50%',
                      width: `${201 * 14}px`,
                      transform: `translateX(-${totalOffsetPx + 7}px)`
                    }}
                  >
                    {Array.from({ length: 201 }).map((_, idx) => {
                      const tickFreq = Number((88.0 + idx * 0.1).toFixed(1));
                      const isMajor = idx % 10 === 0;
                      const isHalf = idx % 5 === 0 && !isMajor;

                      // Có trạm online tại vạch này không
                      const hasStationHere = filteredStations.some(s => Math.abs(Number(s.frequency) - tickFreq) < 0.05);

                      return (
                        <div
                          key={idx}
                          className="flex flex-col items-center justify-end relative shrink-0"
                          style={{ width: '14px' }}
                        >
                          {hasStationHere && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
                          )}

                          <div
                            className={`rounded-full transition-colors ${isMajor
                              ? 'w-[2px] h-7 bg-zinc-300'
                              : isHalf
                                ? 'w-[1.5px] h-4 bg-zinc-500'
                                : 'w-[1px] h-2 bg-zinc-700'
                              }`}
                          />

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

                {/* THANH ĐIỀU KHIỂN: +/- 0.1 MHz & NÚT QUÉT TỰ ĐỘNG */}
                <div className="pt-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        stopAutoScan();
                        setScanNotice(null);
                        setFrequency(prev => Math.max(currentBand.min, Number((prev - 0.1).toFixed(1))));
                      }}
                      className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors active:scale-95 flex items-center gap-1 shrink-0"
                      title="Giảm 0.1 MHz"
                    >
                      <ChevronLeft size={14} /> -0.1
                    </button>

                    <input
                      type="range"
                      min={currentBand.min}
                      max={currentBand.max}
                      step="0.1"
                      value={frequency}
                      onChange={(e) => {
                        stopAutoScan();
                        setScanNotice(null);
                        setFrequency(Number(e.target.value));
                      }}
                      className="flex-1 accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        stopAutoScan();
                        setScanNotice(null);
                        setFrequency(prev => Math.min(currentBand.max, Number((prev + 0.1).toFixed(1))));
                      }}
                      className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors active:scale-95 flex items-center gap-1 shrink-0"
                      title="Tăng 0.1 MHz"
                    >
                      +0.1 <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* Nút Quét Tự Động full-width riêng 1 hàng - Không bao giờ bị co text */}
                  <button
                    type="button"
                    onClick={startAutoScan}
                    className={`w-full h-10 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.99] whitespace-nowrap ${isAutoScanning
                      ? 'bg-zinc-800 border-zinc-600 text-white animate-pulse'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800'
                      }`}
                  >
                    <Compass size={14} className={isAutoScanning ? "animate-spin" : ""} />
                    <span>{isAutoScanning ? "Dừng quét" : "Quét tự động"}</span>
                  </button>
                </div>

              </div>

              {/* DANH SÁCH TÍN HIỆU ĐANG PHÁT CÙNG BĂNG TẦN */}
              {activeBandStations.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-sans px-1">
                    <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                      <Radio size={13} className="text-emerald-400" />
                      Tín hiệu đang phát cùng băng tần ({activeBandStations.length})
                    </span>
                    <span className="text-[11px] text-zinc-500">Chạm để bắt sóng</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeBandStations.map(s => {
                      const diff = Math.abs(Number(s.frequency) - frequency).toFixed(1);
                      const isCurrent = Math.abs(Number(s.frequency) - frequency) <= 0.05;
                      return (
                        <div
                          key={s.userId}
                          onClick={() => {
                            stopAutoScan();
                            setFrequency(Number(Number(s.frequency).toFixed(1)));
                          }}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                            isCurrent
                              ? 'bg-zinc-800 border-white/60 shadow-sm'
                              : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar
                              avatar={s.avatarUrl}
                              name={s.displayName || s.username}
                              size={28}
                              className="w-7 h-7 rounded-lg border border-zinc-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate font-sans">
                                {s.displayName || s.username}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-sans truncate">
                                @{s.username} • Cách {diff} MHz
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-mono tabular-nums px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800 shrink-0">
                            {Number(s.frequency).toFixed(1)} MHz
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* THẺ TRẠM SÓNG BẮT ĐƯỢC */}
              {currentStation ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3.5 shadow-lg animate-fade-in">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <UserAvatar
                          avatar={currentStation.avatarUrl}
                          name={currentStation.displayName || currentStation.username}
                          size={48}
                          className="w-12 h-12 rounded-xl border border-zinc-700"
                        />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-zinc-950 flex items-center justify-center">
                          <Signal size={9} className="text-zinc-950" />
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-white truncate font-sans">
                            {currentStation.displayName || currentStation.username}
                          </h4>
                          <span className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
                            {Number(currentStation.frequency).toFixed(1)} MHz
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 block truncate mt-0.5 font-sans">
                          @{currentStation.username || 'user'} • {currentStation.intentTitle || 'Tâm sự'}
                        </span>
                      </div>
                    </div>

                    {/* Nút hành động */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDirectChat(currentStation)}
                        className="h-9 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors active:scale-95 font-sans"
                        title="Nhắn tin riêng"
                      >
                        <MessageSquareShare size={14} />
                        <span className="hidden sm:inline">Nhắn tin</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleConnectCall(currentStation)}
                        disabled={isLocking}
                        className="h-9 px-3.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 font-sans"
                        title="Gọi thoại 1-1"
                      >
                        <PhoneCall size={14} />
                        <span>{isLocking ? "Đang kết nối..." : "Kết nối Call 1-1"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Đa người dùng cùng tần số */}
                  {stationsAtFreq.length > 1 && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-sans">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Users size={14} className="text-amber-400 shrink-0" />
                        <span>Tín hiệu <strong>{(stationSubIndex % stationsAtFreq.length) + 1}/{stationsAtFreq.length}</strong> tại {frequency.toFixed(1)} MHz</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setStationSubIndex(prev => prev + 1)}
                        className="h-7 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-sans flex items-center gap-1 transition-colors"
                      >
                        <span>Chuyển tín hiệu kế tiếp</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  )}

                  {currentStation.bio && (
                    <p className="text-xs text-zinc-400 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80 leading-relaxed font-sans">
                      "{currentStation.bio}"
                    </p>
                  )}

                  {/* Audio 5s đang phát & Nút Quét Tiếp */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-sans text-zinc-300">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Đang phát lời chào 5s của trạm...</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleScanNext}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-sans flex items-center gap-1 transition-colors"
                      title="Quét trạm tiếp theo"
                    >
                      <Compass size={12} />
                      <span>Quét tiếp</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-center space-y-2.5 animate-fade-in">
                  <p className="text-xs text-zinc-400">
                    {scanNotice || (filteredStations.length === 0 ? "Chưa có ai phát sóng ở băng tần này" : `Không có tín hiệu người phát tại tần số ${frequency.toFixed(1)} MHz.`)}
                  </p>
                  {suggestedIntent && filteredStations.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIntentFilter(suggestedIntent.code);
                        const it = intents.find(i => i.code === suggestedIntent.code);
                        if (it?.freqStart != null) setFrequency(Number(it.freqStart.toFixed(1)));
                      }}
                      className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors inline-flex items-center gap-1.5 active:scale-95"
                    >
                      <Radio size={13} className="text-emerald-400" />
                      <span>Chuyển sang {suggestedIntent.title} ({suggestedIntent.count} trạm online)</span>
                    </button>
                  )}
                </div>
              )}

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: PHÁT SÓNG CỦA TÔI (THU ÂM 5S & LÊN SÓNG) */}
          {/* ============================================================ */}
          {activeTab === 'broadcast' && (
            <div className="space-y-4 animate-fade-in">

              {/* Trạng thái phát sóng hiện tại nếu đang mở */}
              {isBroadcasting && (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Signal size={16} className="animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-emerald-300">Trạm phát của bạn đang hoạt động</h4>
                      <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
                        Tần số: <strong>{broadcastInfo?.frequency || userPersonalFrequency} MHz</strong> • {broadcastInfo?.intentTitle || 'Phát sóng'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStopBroadcast}
                    className="h-8 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-rose-400 border border-zinc-800 text-xs font-medium transition-colors shrink-0"
                  >
                    Dừng phát
                  </button>
                </div>
              )}

              {/* Chọn Băng Tần Muốn Phát Sóng */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">
                  1. Chọn Băng Tần Phát Sóng
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {intents.map(it => {
                    const isSelected = broadcastIntentCode === it.code;
                    return (
                      <div
                        key={it.code}
                        onClick={() => handleSelectBroadcastIntent(it.code)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all ${isSelected
                          ? 'border-white bg-zinc-800/90 text-white shadow-sm ring-1 ring-white'
                          : 'bg-zinc-950/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <h5 className="font-semibold text-xs text-white">{it.title}</h5>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${isSelected ? 'bg-white text-zinc-950 font-bold border-white' : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                            }`}>
                            {it.freqStart?.toFixed(0)}-{it.freqEnd?.toFixed(0)} MHz
                          </span>
                        </div>
                        {it.subtitle && (
                          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">{it.subtitle}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tần số được cấp tự động (Khóa chặt trong khoảng, có nút +/- 0.1 và đổi số ngẫu nhiên) */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-zinc-400 font-sans block">2. Tần số phát sóng được cấp:</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-3xl font-extrabold font-mono text-white tabular-nums tracking-tight">
                      {broadcastFreqTarget.toFixed(1)}
                    </span>
                    <span className="text-sm font-mono text-zinc-500 font-medium">MHz</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const it = intents.find(i => i.code === broadcastIntentCode);
                      const min = it?.freqStart != null ? Number(it.freqStart.toFixed(1)) : 88.0;
                      setBroadcastFreqTarget(prev => Math.max(min, Number((prev - 0.1).toFixed(1))));
                    }}
                    className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors active:scale-95"
                    title="Giảm 0.1 MHz"
                  >
                    -0.1
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const it = intents.find(i => i.code === broadcastIntentCode);
                      const max = it?.freqEnd != null ? Number(it.freqEnd.toFixed(1)) : 108.0;
                      setBroadcastFreqTarget(prev => Math.min(max, Number((prev + 0.1).toFixed(1))));
                    }}
                    className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors active:scale-95"
                    title="Tăng 0.1 MHz"
                  >
                    +0.1
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRequestCollisionFreeSlot(broadcastIntentCode)}
                    className="h-8 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono flex items-center gap-1.5 transition-colors active:scale-95 shrink-0"
                    title="Cấp một tần số trống chưa ai chiếm trong dải"
                  >
                    <RefreshCw size={13} />
                    <span>Đổi tần số khác</span>
                  </button>
                </div>
              </div>

              {/* KHUNG GHI ÂM 5S GIỌNG NÓI */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <label className="text-xs font-medium text-zinc-300 block">
                  3. Ghi Âm Lời Chào 5 Giây
                </label>

                {isRecording ? (
                  <div className="space-y-2 text-center py-2">
                    <div className="flex items-center justify-center gap-2 text-rose-400 text-xs font-mono">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Đang ghi âm tín hiệu giọng nói... {((5000 * (100 - recordProgress)) / 100000).toFixed(1)}s</span>
                    </div>

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
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center gap-3">
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
                        className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition-colors shadow-sm"
                      >
                        {isPlayingPreview ? <Pause size={15} /> : <Play size={15} />}
                      </button>
                      <div>
                        <span className="text-xs font-medium text-zinc-200 block">Đoạn ghi âm 5s sẵn sàng</span>
                        <span className="text-[10px] text-zinc-500 font-sans">Bấm Play để nghe thử trước khi lên sóng</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={startRecording5s}
                      className="text-xs font-sans text-zinc-400 hover:text-white underline px-2 whitespace-nowrap shrink-0"
                    >
                      Thu lại
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2.5">
                    <button
                      type="button"
                      onClick={startRecording5s}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold flex items-center gap-2 mx-auto active:scale-95 shadow-md"
                    >
                      <Mic size={15} />
                      <span>Bấm để bắt đầu thu âm 5s</span>
                    </button>
                  </div>
                )}
              </div>

              {/* NÚT KÍCH HOẠT PHÁT SÓNG (Chỉ sáng trắng khi đã thu âm 5s) */}
              <div className="pt-3 pb-6 shrink-0">
                <button
                  type="button"
                  onClick={handlePublishBroadcast}
                  disabled={!recordedBlob || isSubmittingBroadcast}
                  className={`w-full py-3.5 px-4 rounded-2xl font-semibold text-xs sm:text-sm transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2 ${recordedBlob && !isSubmittingBroadcast
                    ? 'bg-white hover:bg-zinc-200 text-zinc-950 shadow-white/10'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                    }`}
                >
                  <Radio size={16} />
                  <span>
                    {isSubmittingBroadcast
                      ? "Đang tải dữ liệu phát sóng..."
                      : (recordedBlob
                        ? `Lên sóng tại ${broadcastFreqTarget.toFixed(1)} MHz`
                        : "Vui lòng thu âm 5s ở bước 3 để lên sóng")}
                  </span>
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default ResonanceMatchModal;
