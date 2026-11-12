import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, LogOut, Plus, MessageSquare, Shield, User, X, Lock, Hash, 
  CheckCircle, ArrowRight, WifiOff, Heart, MessageCircle, Share2, 
  Search, Sparkles, Send, Copy, Compass, Radio, ChevronRight, CornerDownRight
} from 'lucide-react';
import axiosClient, { BACKEND_URL } from '../api/axiosClient';
import { saveRoomsOffline, getRoomsOffline } from '../utils/offlineDB';
import UserProfileModal from './UserProfileModal';
import FriendsModal from './FriendsModal';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';

const Home = () => {
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem('user_id');

  // Navigation tab chính: 'feed' (Bảng tin) | 'rooms' (Phòng trò chuyện)
  const [activeTab, setActiveTab] = useState('feed');

  // State Dữ liệu Phòng Chat
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [newRoomData, setNewRoomData] = useState({ name: '', password: '', nickname: '' });
  const [joinData, setJoinData] = useState({ nickname: '', password: '' });

  // State Dữ liệu Mạng Xã Hội (Feed & Posts)
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);

  // Bình luận
  const [expandedComments, setExpandedComments] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});

  // Modals & Menu
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [sharePost, setSharePost] = useState(null);

  const newPostInputRef = useRef(null);

  // ====================== PHÒNG TRÒ CHUYỆN ======================
  const isUserInRoom = (room) => {
    if (!currentUserId || !room?.userRoomDTOList) return false;
    return room.userRoomDTOList.some(ur => ur.userDTO?.id?.toString() === currentUserId.toString());
  };

  const checkActiveRoom = async () => {
    if (sessionStorage.getItem('hasCheckedActiveRoom')) return false;
    try {
      const response = await axiosClient.get('/users/active-room');
      if (response.data && response.data.data) {
        sessionStorage.setItem('hasCheckedActiveRoom', 'true');
        navigate(`/room/${response.data.data}`);
        return true;
      }
    } catch (err) {
      console.error("Lỗi khi kiểm tra phòng hoạt động:", err);
    }
    sessionStorage.setItem('hasCheckedActiveRoom', 'true');
    return false;
  };

  const fetchRooms = async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingRooms(true);
      const response = await axiosClient.get('/rooms/info-rooms'); 
      if (response.data && response.data.data) {
        setRooms(response.data.data);
        saveRoomsOffline(response.data.data);
      }
    } catch (err) {
      console.error("Lỗi khi lấy danh sách phòng:", err);
      const cached = await getRoomsOffline();
      if (cached && cached.length > 0) setRooms(cached);
    } finally {
      if (!isSilent) setLoadingRooms(false);
    }
  };

  // ====================== BẢNG TIN / POSTS ======================
  const fetchPosts = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingPosts(true);
      const response = await axiosClient.get('/posts');
      if (response.data?.data) {
        setPosts(response.data.data);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách bài viết:", err);
    } finally {
      if (!isSilent) setLoadingPosts(false);
    }
  }, []);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    const content = newPostContent.trim();
    if (!content) return;

    if (!navigator.onLine) {
      toast.error("Cần kết nối mạng để đăng bài viết!");
      return;
    }

    try {
      setIsPosting(true);
      const res = await axiosClient.post('/posts', { content });
      if (res.data?.data) {
        setPosts(prev => [res.data.data, ...prev]);
        setNewPostContent('');
        toast.success("Đăng bài viết thành công!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể đăng bài viết!");
    } finally {
      setIsPosting(false);
    }
  };

  const handleToggleLike = async (postId) => {
    try {
      const res = await axiosClient.post(`/posts/${postId}/like`);
      if (res.data?.data) {
        const updated = res.data.data;
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          likesCount: updated.likesCount,
          isLikedByMe: updated.isLikedByMe
        } : p));
      }
    } catch (err) {
      toast.error("Không thể thao tác thả tim!");
    }
  };

  const handleToggleComments = async (postId) => {
    const isCurrentlyOpen = expandedComments[postId];
    setExpandedComments(prev => ({ ...prev, [postId]: !isCurrentlyOpen }));

    if (!isCurrentlyOpen && !commentsMap[postId]) {
      try {
        const res = await axiosClient.get(`/posts/${postId}/comments`);
        if (res.data?.data) {
          setCommentsMap(prev => ({ ...prev, [postId]: res.data.data }));
        }
      } catch (err) {
        console.error("Lỗi tải bình luận:", err);
      }
    }
  };

  const handleAddComment = async (e, postId) => {
    e.preventDefault();
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    try {
      setSubmittingComment(prev => ({ ...prev, [postId]: true }));
      const res = await axiosClient.post(`/posts/${postId}/comments`, { content: text });
      if (res.data?.data) {
        const newCmt = res.data.data;
        setCommentsMap(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), newCmt]
        }));
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          commentsCount: (p.commentsCount || 0) + 1
        } : p));
        toast.success("Đã gửi bình luận!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể gửi bình luận!");
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const kw = searchKeyword.trim();
    if (!kw) {
      fetchPosts();
      return;
    }

    try {
      setSearching(true);
      const res = await axiosClient.get('/posts/search', {
        params: { keyword: kw }
      });
      if (res.data?.data) {
        setPosts(res.data.data);
      }
    } catch (err) {
      toast.error("Lỗi khi tìm kiếm bài viết!");
    } finally {
      setSearching(false);
    }
  };

  // Chia sẻ bài viết
  const handleCopyPostLink = (post) => {
    const url = `${window.location.origin}/#post-${post.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Đã sao chép liên kết bài viết!");
    setSharePost(null);
  };

  const handleShareFacebook = (post) => {
    const url = encodeURIComponent(`${window.location.origin}/#post-${post.id}`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=500');
    setSharePost(null);
  };

  const handleShareTwitter = (post) => {
    const text = encodeURIComponent(`"${post.content?.slice(0, 100)}..." trên Chat Together`);
    const url = encodeURIComponent(`${window.location.origin}/#post-${post.id}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=600,height=500');
    setSharePost(null);
  };

  // ====================== EFFECTS ======================
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchRooms(true);
      fetchPosts(true);
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast("Đang ngoại tuyến. Bạn có thể xem các nội dung đã lưu.", { icon: '📶' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchPosts]);

  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      const cached = await getRoomsOffline();
      if (cached && cached.length > 0 && isMounted) {
        setRooms(cached);
        setLoadingRooms(false);
      }
      fetchRooms();
      fetchPosts();
      checkActiveRoom();
    };

    init();

    // WebSocket lắng nghe cập nhật phòng và bài đăng mới (được bọc an toàn)
    let stompClient = null;
    try {
      const socketUrl = BACKEND_URL ? `${BACKEND_URL}/ws-gs-guide` : '/ws-gs-guide';
      const socket = new SockJS(socketUrl);
      stompClient = Stomp.over(socket);
      stompClient.debug = null;

      stompClient.connect({}, () => {
        if (!isMounted) return;
        stompClient.subscribe('/topic/rooms', () => fetchRooms(true));
        stompClient.subscribe('/topic/posts', () => fetchPosts(true));
      }, (err) => {
        console.warn("WebSocket reconnection/notice:", err);
      });
    } catch (wsErr) {
      console.warn("Không thể khởi tạo WebSocket trong Home:", wsErr);
    }

    return () => {
      isMounted = false;
      try {
        if (stompClient && stompClient.connected) {
          stompClient.disconnect(() => {});
        }
      } catch (_) {}
    };
  }, [fetchPosts]);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast.success("Đã đăng xuất tài khoản!");
    navigate('/login');
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomData.name.trim()) {
      toast.error("Vui lòng nhập tên phòng chat!");
      return;
    }

    try {
      const response = await axiosClient.post('/rooms/create-room', {
        roomName: newRoomData.name.trim(),
        password: newRoomData.password || null
      });

      if (response.data && response.data.data) {
        const resData = response.data.data;
        if (resData.accessToken) {
          localStorage.setItem('accesstoken', resData.accessToken);
        }
        toast.success("Tạo phòng thành công!");
        setIsCreateModalOpen(false);
        setNewRoomData({ name: '', password: '', nickname: '' });
        navigate(`/room/${resData.roomId}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Tạo phòng thất bại!");
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return;

    if (selectedRoom.hasPassword && !joinData.password) {
      toast.error("Vui lòng nhập mật khẩu phòng!");
      return;
    }

    try {
      const response = await axiosClient.post('/rooms/join-room', {
        password: joinData.password || null
      }, {
        params: { idRoom: selectedRoom.id }
      });

      if (response.data && response.data.data) {
        toast.success("Tham gia phòng thành công!");
        setSelectedRoom(null);
        setJoinData({ nickname: '', password: '' });
        navigate(`/room/${selectedRoom.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Mật khẩu phòng không chính xác!");
    }
  };

  return (
    <div className="social-app-wrapper">
      {/* CỘT 1: THANH ĐIỀU HƯỚNG TRÁI (NAVIGATION RAIL) */}
      <aside className="nav-sidebar">
        <div className="nav-brand" onClick={() => setActiveTab('feed')}>
          <div className="brand-logo-glow">
            <MessageSquare size={22} color="white" />
          </div>
          <span className="brand-name">Chat Together</span>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            <Compass size={20} />
            <span>Bảng tin</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            <Radio size={20} />
            <span>Phòng chat ({rooms.length})</span>
          </button>

          <button 
            className="nav-item"
            onClick={() => setIsFriendsOpen(true)}
          >
            <Users size={20} />
            <span>Bạn bè</span>
          </button>

          <button 
            className="nav-item"
            onClick={() => setSelectedProfileUserId(currentUserId)}
          >
            <User size={20} />
            <span>Hồ sơ của tôi</span>
          </button>
        </nav>

        {/* Nút hành động chính */}
        <div className="nav-action-box">
          <button 
            className="btn-create-post-nav"
            onClick={() => {
              setActiveTab('feed');
              setTimeout(() => newPostInputRef.current?.focus(), 100);
            }}
          >
            <Sparkles size={18} />
            <span>Đăng bài mới</span>
          </button>

          <button 
            className="btn-create-room-nav"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={18} />
            <span>Tạo phòng</span>
          </button>
        </div>

        <div className="nav-footer">
          <button onClick={handleLogout} className="btn-logout-nav" title="Đăng xuất">
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* CỘT 2: LUỒNG CHÍNH (MAIN STREAM FEED / ROOMS) */}
      <main className="main-stream">
        {isOffline && (
          <div className="offline-stream-banner">
            <WifiOff size={16} />
            <span>Bạn đang ngoại tuyến. Đang hiển thị dữ liệu đã lưu trong máy.</span>
          </div>
        )}

        {/* Header Tabs Trên Mobile & Desktop */}
        <header className="stream-header">
          <div className="stream-tabs">
            <button 
              className={`stream-tab ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              Dành cho bạn
            </button>
            <button 
              className={`stream-tab ${activeTab === 'rooms' ? 'active' : ''}`}
              onClick={() => setActiveTab('rooms')}
            >
              Phòng trò chuyện & Gọi thoại
            </button>
          </div>
        </header>

        {/* NỘI DUNG 1: BẢNG TIN MẠNG XÃ HỘI (FEED) */}
        {activeTab === 'feed' && (
          <div className="feed-container">
            {/* Hộp Đăng Bài Viết Nhanh */}
            <div className="post-creator-card">
              <div className="creator-avatar">
                {localStorage.getItem('nickname')?.charAt(0).toUpperCase() || "T"}
              </div>
              <form onSubmit={handleCreatePost} className="creator-form">
                <textarea 
                  ref={newPostInputRef}
                  rows="3"
                  placeholder="Hôm nay bạn có câu chuyện hay suy nghĩ gì muốn chia sẻ cùng mọi người?..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                />
                <div className="creator-footer">
                  <span className="creator-hint">Bấm đăng để chia sẻ lên bảng tin cộng đồng</span>
                  <button 
                    type="submit" 
                    disabled={!newPostContent.trim() || isPosting}
                    className="btn-publish-post"
                  >
                    <Send size={15} />
                    <span>{isPosting ? 'Đang đăng...' : 'Đăng bài'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Danh Sách Bài Viết (Feed Stream) */}
            <div className="posts-stream">
              {loadingPosts ? (
                <div className="stream-loading">
                  <div className="stream-spinner"></div>
                  <p>Đang chuẩn bị bảng tin...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="stream-empty">
                  <MessageCircle size={44} className="empty-icon" />
                  <h3>Chưa có bài viết nào</h3>
                  <p>Hãy là người đầu tiên chia sẻ cảm nghĩ của bạn lên bảng tin!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <article key={post.id} className="post-card" id={`post-${post.id}`}>
                    <div className="post-header">
                      <div 
                        className="post-author-avatar"
                        onClick={() => setSelectedProfileUserId(post.authorId)}
                        title={`Xem hồ sơ của ${post.authorNickname}`}
                      >
                        {post.authorNickname?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div className="post-author-meta">
                        <div className="author-name-row">
                          <h4 
                            onClick={() => setSelectedProfileUserId(post.authorId)}
                            title={`Xem hồ sơ của ${post.authorNickname}`}
                          >
                            {post.authorNickname}
                          </h4>
                          <span className="author-account">@{post.authorAccount}</span>
                        </div>
                        <div className="post-sub-meta">
                          <span className="post-time">{post.formattedTime}</span>
                          {post.authorLocation && (
                            <span className="post-location">📍 {post.authorLocation}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="post-content">
                      <p>{post.content}</p>
                    </div>

                    {/* Thanh Tương Tác: Thả tim, Bình luận, Chia sẻ */}
                    <div className="post-actions-bar">
                      <button 
                        onClick={() => handleToggleLike(post.id)}
                        className={`action-pill ${post.isLikedByMe ? 'liked' : ''}`}
                        title={post.isLikedByMe ? "Bỏ thích" : "Thả tim"}
                      >
                        <Heart size={18} fill={post.isLikedByMe ? "#ef4444" : "none"} color={post.isLikedByMe ? "#ef4444" : "currentColor"} />
                        <span>{post.likesCount || 0}</span>
                      </button>

                      <button 
                        onClick={() => handleToggleComments(post.id)}
                        className="action-pill"
                        title="Bình luận"
                      >
                        <MessageCircle size={18} />
                        <span>{post.commentsCount || 0}</span>
                      </button>

                      <button 
                        onClick={() => setSharePost(post)}
                        className="action-pill action-share"
                        title="Chia sẻ bài viết"
                      >
                        <Share2 size={18} />
                        <span>Chia sẻ</span>
                      </button>
                    </div>

                    {/* Hộp Bình Luận (Mở rộng khi click) */}
                    {expandedComments[post.id] && (
                      <div className="comments-section">
                        <div className="comments-list">
                          {commentsMap[post.id]?.length === 0 ? (
                            <p className="no-comments-msg">Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</p>
                          ) : (
                            commentsMap[post.id]?.map((cmt) => (
                              <div key={cmt.id} className="comment-bubble">
                                <div 
                                  className="cmt-avatar"
                                  onClick={() => setSelectedProfileUserId(cmt.authorId)}
                                >
                                  {cmt.authorNickname?.charAt(0).toUpperCase() || "U"}
                                </div>
                                <div className="cmt-body">
                                  <div className="cmt-header">
                                    <span 
                                      className="cmt-author"
                                      onClick={() => setSelectedProfileUserId(cmt.authorId)}
                                    >
                                      {cmt.authorNickname}
                                    </span>
                                    <span className="cmt-time">{cmt.formattedTime}</span>
                                  </div>
                                  <p className="cmt-text">{cmt.content}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Ô nhập bình luận */}
                        <form onSubmit={(e) => handleAddComment(e, post.id)} className="comment-form">
                          <input 
                            type="text" 
                            placeholder="Viết câu trả lời của bạn..."
                            value={commentInputs[post.id] || ''}
                            onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                          />
                          <button 
                            type="submit" 
                            disabled={!commentInputs[post.id]?.trim() || submittingComment[post.id]}
                            className="btn-send-cmt"
                          >
                            <CornerDownRight size={16} />
                          </button>
                        </form>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {/* NỘI DUNG 2: DANH SÁCH PHÒNG CHAT & VOICE CALL (ROOMS) */}
        {activeTab === 'rooms' && (
          <div className="rooms-container">
            <div className="rooms-banner">
              <div>
                <h2>Phòng Trò Chuyện & Gọi Thoại Trực Tiếp</h2>
                <p>Tham gia phòng để trao đổi tin nhắn và đàm thoại WebRTC thời gian thực cùng bạn bè.</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(true)} className="btn-create-room-header">
                <Plus size={16} /> Tạo phòng mới
              </button>
            </div>

            <div className="rooms-grid">
              {rooms.map((room) => {
                const alreadyIn = isUserInRoom(room);
                return (
                  <div key={room.id} className={`room-card-modern ${alreadyIn ? 'is-my-room' : ''}`}>
                    <div className="card-top">
                      <h3>{room.nameroom}</h3>
                      <span className="online-pill">
                        <span className="pulse-green"></span>
                        {room.soluong || room.userRoomDTOList?.length || 0} online
                      </span>
                    </div>

                    <div className="card-badges">
                      {room.hasPassword && (
                        <span className="badge badge-locked">
                          <Lock size={12} /> Khóa
                        </span>
                      )}
                      {alreadyIn && (
                        <span className="badge badge-joined">
                          <CheckCircle size={12} /> Phòng của bạn
                        </span>
                      )}
                    </div>

                    <div className="members-chips">
                      {room.userRoomDTOList?.slice(0, 4).map((ur, idx) => (
                        <span key={idx} className="chip">
                          {ur.userDTO?.nickname || "User"}
                        </span>
                      ))}
                      {(room.userRoomDTOList?.length || 0) > 4 && (
                        <span className="chip chip-more">+{room.userRoomDTOList.length - 4}</span>
                      )}
                    </div>

                    <div className="card-action">
                      {alreadyIn ? (
                        <button onClick={() => navigate(`/room/${room.id}`)} className="btn-enter-room btn-reenter">
                          Vào lại phòng <ArrowRight size={16} />
                        </button>
                      ) : (
                        <button onClick={() => setSelectedRoom(room)} className="btn-enter-room">
                          Tham gia ngay <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* CỘT 3: TIỆN ÍCH PHẢI (WIDGETS & DISCOVERY) */}
      <aside className="widgets-sidebar">
        {/* Hộp Tìm Kiếm Bài Viết */}
        <div className="search-widget">
          <form onSubmit={handleSearch} className="search-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Tìm kiếm bài viết..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            {searchKeyword && (
              <button type="button" onClick={() => { setSearchKeyword(''); fetchPosts(); }} className="btn-clear-search">
                <X size={14} />
              </button>
            )}
          </form>
        </div>

        {/* Tiện Ích Phòng Sôi Nổi */}
        <div className="widget-card">
          <div className="widget-header">
            <Radio size={18} className="widget-icon" />
            <h4>Phòng Chat Sôi Nổi</h4>
          </div>
          <div className="widget-rooms-list">
            {rooms.slice(0, 3).map((r) => (
              <div key={r.id} className="widget-room-item" onClick={() => navigate(`/room/${r.id}`)}>
                <div className="w-room-info">
                  <span className="w-name">#{r.nameroom}</span>
                  <span className="w-online">{r.soluong || r.userRoomDTOList?.length || 0} người</span>
                </div>
                <ChevronRight size={16} className="w-arrow" />
              </div>
            ))}
          </div>
        </div>

        {/* Thông Tin Bản Quyền & Giới Thiệu */}
        <div className="widget-footer-info">
          <p>© 2026 Chat Together Platform. Mạng xã hội & liên lạc thời gian thực.</p>
        </div>
      </aside>

      {/* THANH ĐIỀU HƯỚNG DƯỚI ĐÁY DÀNH CHO MOBILE (BOTTOM NAVIGATION BAR) */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`b-nav-item ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <Compass size={22} />
          <span>Bảng tin</span>
        </button>

        <button 
          className={`b-nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
          onClick={() => setActiveTab('rooms')}
        >
          <Radio size={22} />
          <span>Phòng chat</span>
        </button>

        <button 
          className="b-nav-item b-nav-create"
          onClick={() => {
            setActiveTab('feed');
            setTimeout(() => newPostInputRef.current?.focus(), 150);
          }}
        >
          <Plus size={24} />
        </button>

        <button 
          className="b-nav-item"
          onClick={() => setIsFriendsOpen(true)}
        >
          <Users size={22} />
          <span>Bạn bè</span>
        </button>

        <button 
          className="b-nav-item"
          onClick={() => setSelectedProfileUserId(currentUserId)}
        >
          <User size={22} />
          <span>Hồ sơ</span>
        </button>
      </nav>

      {/* MODAL CHIA SẺ BÀI VIẾT */}
      {sharePost && (
        <div className="modal-backdrop-blur" onClick={() => setSharePost(null)}>
          <div className="share-card" onClick={(e) => e.stopPropagation()}>
            <div className="share-header">
              <h3>Chia sẻ bài viết</h3>
              <button onClick={() => setSharePost(null)} className="btn-close-share"><X size={18} /></button>
            </div>
            <p className="share-preview">"{sharePost.content?.slice(0, 80)}..."</p>
            <div className="share-options">
              <button onClick={() => handleCopyPostLink(sharePost)} className="share-opt-btn btn-copy">
                <Copy size={18} /> Sao chép liên kết
              </button>
              <button onClick={() => handleShareFacebook(sharePost)} className="share-opt-btn btn-fb">
                Chia sẻ lên Facebook
              </button>
              <button onClick={() => handleShareTwitter(sharePost)} className="share-opt-btn btn-tw">
                Chia sẻ lên X (Twitter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HỒ SƠ NGƯỜI DÙNG */}
      {selectedProfileUserId && (
        <UserProfileModal 
          userId={selectedProfileUserId}
          currentUserId={currentUserId}
          onClose={() => setSelectedProfileUserId(null)}
        />
      )}

      {/* MODAL BẠN BÈ */}
      {isFriendsOpen && (
        <FriendsModal 
          onClose={() => setIsFriendsOpen(false)}
          onSelectUser={(uid) => {
            setIsFriendsOpen(false);
            setSelectedProfileUserId(uid);
          }}
        />
      )}

      {/* MODAL TẠO PHÒNG CHAT */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="modal-backdrop-blur" onClick={() => setIsCreateModalOpen(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Tạo Phòng Chat Mới</h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="btn-close-modal"><X size={18} /></button>
              </div>
              <form onSubmit={handleCreateRoom} className="modal-form">
                <div className="form-item">
                  <label>Tên phòng chat</label>
                  <input 
                    type="text" 
                    placeholder="VD: Không gian trò chuyện cuối tuần"
                    value={newRoomData.name}
                    onChange={(e) => setNewRoomData({ ...newRoomData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-item">
                  <label>Mật khẩu (Không bắt buộc)</label>
                  <input 
                    type="password" 
                    placeholder="Để trống nếu là phòng công khai"
                    value={newRoomData.password}
                    onChange={(e) => setNewRoomData({ ...newRoomData, password: e.target.value })}
                  />
                </div>
                <div className="modal-actions-row">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-cancel">Hủy</button>
                  <button type="submit" className="btn-confirm">Tạo ngay</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL THAM GIA PHÒNG CÓ MẬT KHẨU */}
      <AnimatePresence>
        {selectedRoom && (
          <div className="modal-backdrop-blur" onClick={() => setSelectedRoom(null)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Tham gia #{selectedRoom.nameroom}</h3>
                <button onClick={() => setSelectedRoom(null)} className="btn-close-modal"><X size={18} /></button>
              </div>
              <form onSubmit={handleJoinRoom} className="modal-form">
                {selectedRoom.hasPassword ? (
                  <div className="form-item">
                    <label>Mật khẩu phòng (Bắt buộc)</label>
                    <input 
                      type="password" 
                      placeholder="Nhập mật khẩu phòng..."
                      value={joinData.password}
                      onChange={(e) => setJoinData({ ...joinData, password: e.target.value })}
                      required
                    />
                  </div>
                ) : (
                  <p className="public-notice">Phòng này công khai, bạn có thể tham gia trò chuyện ngay!</p>
                )}
                <div className="modal-actions-row">
                  <button type="button" onClick={() => setSelectedRoom(null)} className="btn-cancel">Hủy</button>
                  <button type="submit" className="btn-confirm">Vào phòng</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --social-bg: #090d16;
          --sidebar-bg: #060911;
          --card-bg: #0f172a;
          --card-border: rgba(255, 255, 255, 0.08);
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --brand: #6366f1;
          --brand-hover: #4f46e5;
        }

        .social-app-wrapper {
          display: flex;
          min-height: 100vh;
          background: var(--social-bg);
          color: var(--text-main);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }

        /* CỘT 1: NAV RAIL */
        .nav-sidebar {
          width: 260px;
          height: 100vh;
          position: sticky;
          top: 0;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--card-border);
          display: flex;
          flex-direction: column;
          padding: 20px 16px;
          box-sizing: border-box;
          flex-shrink: 0;
        }
        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          margin-bottom: 28px;
        }
        .brand-logo-glow {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
        }
        .brand-name {
          font-size: 17px;
          font-weight: 700;
          background: linear-gradient(to right, #f8fafc, #c7d2fe);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 14.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #f8fafc;
        }
        .nav-item.active {
          background: rgba(99, 102, 241, 0.12);
          color: #818cf8;
        }
        .nav-action-box {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }
        .btn-create-post-nav, .btn-create-room-nav {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-create-post-nav {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          border: none;
          color: white;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
        }
        .btn-create-post-nav:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(79, 70, 229, 0.45); }
        .btn-create-room-nav {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--card-border);
          color: #cbd5e1;
        }
        .btn-create-room-nav:hover { background: rgba(255, 255, 255, 0.1); color: white; }
        .nav-footer { border-top: 1px solid var(--card-border); padding-top: 12px; }
        .btn-logout-nav {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: none;
          border: none;
          color: #ef4444;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
        }
        .btn-logout-nav:hover { background: rgba(239, 68, 68, 0.1); }

        /* CỘT 2: MAIN STREAM */
        .main-stream {
          flex: 1;
          max-width: 680px;
          border-right: 1px solid var(--card-border);
          min-height: 100vh;
          padding-bottom: 80px;
        }
        .offline-stream-banner {
          background: rgba(245, 158, 11, 0.15);
          border-bottom: 1px solid rgba(245, 158, 11, 0.3);
          color: #fbbf24;
          padding: 8px 16px;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .stream-header {
          position: sticky;
          top: 0;
          background: rgba(9, 13, 22, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--card-border);
          z-index: 30;
        }
        .stream-tabs {
          display: flex;
        }
        .stream-tab {
          flex: 1;
          background: none;
          border: none;
          color: var(--text-muted);
          padding: 16px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }
        .stream-tab:hover { color: #f8fafc; }
        .stream-tab.active {
          color: #f8fafc;
          border-bottom-color: var(--brand);
        }

        /* Post Creator Card */
        .post-creator-card {
          padding: 16px 20px;
          border-bottom: 1px solid var(--card-border);
          display: flex;
          gap: 14px;
          background: rgba(255, 255, 255, 0.015);
        }
        .creator-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          font-weight: 700;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .creator-form {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .creator-form textarea {
          width: 100%;
          background: none;
          border: none;
          color: #f8fafc;
          font-size: 15px;
          outline: none;
          resize: none;
          font-family: inherit;
          line-height: 1.5;
        }
        .creator-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .creator-hint { font-size: 12px; color: #64748b; }
        .btn-publish-post {
          background: var(--brand);
          color: white;
          border: none;
          padding: 8px 18px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s;
        }
        .btn-publish-post:hover:not(:disabled) { background: var(--brand-hover); }
        .btn-publish-post:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Posts Stream */
        .posts-stream { display: flex; flex-direction: column; }
        .post-card {
          padding: 18px 20px;
          border-bottom: 1px solid var(--card-border);
          transition: background 0.15s;
        }
        .post-card:hover { background: rgba(255, 255, 255, 0.02); }
        .post-header {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }
        .post-author-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .post-author-meta { flex: 1; overflow: hidden; }
        .author-name-row { display: flex; align-items: center; gap: 8px; }
        .author-name-row h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
          cursor: pointer;
        }
        .author-name-row h4:hover { text-decoration: underline; color: #818cf8; }
        .author-account { font-size: 12px; color: var(--text-muted); }
        .post-sub-meta { display: flex; gap: 10px; margin-top: 2px; }
        .post-time { font-size: 11.5px; color: #64748b; }
        .post-location { font-size: 11.5px; color: #818cf8; }
        .post-content p {
          margin: 0 0 14px 0;
          font-size: 15px;
          line-height: 1.6;
          color: #e2e8f0;
          word-break: break-word;
        }
        .post-actions-bar {
          display: flex;
          gap: 16px;
        }
        .action-pill {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 16px;
          transition: all 0.15s;
        }
        .action-pill:hover { background: rgba(255, 255, 255, 0.05); color: #f8fafc; }
        .action-pill.liked { color: #ef4444; }

        /* Comments Section */
        .comments-section {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .comments-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
        }
        .comment-bubble {
          display: flex;
          gap: 10px;
        }
        .cmt-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #334155;
          color: white;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .cmt-body {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 8px 12px;
          flex: 1;
        }
        .cmt-header { display: flex; justify-content: space-between; margin-bottom: 3px; }
        .cmt-author { font-size: 12.5px; font-weight: 600; color: #818cf8; cursor: pointer; }
        .cmt-time { font-size: 10.5px; color: #64748b; }
        .cmt-text { margin: 0; font-size: 13.5px; color: #cbd5e1; line-height: 1.4; }
        .no-comments-msg { font-size: 12.5px; color: #64748b; font-style: italic; margin: 4px 0; }
        .comment-form {
          display: flex;
          gap: 8px;
        }
        .comment-form input {
          flex: 1;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid var(--card-border);
          border-radius: 18px;
          padding: 8px 14px;
          color: #f8fafc;
          font-size: 13.5px;
          outline: none;
        }
        .comment-form input:focus { border-color: var(--brand); }
        .btn-send-cmt {
          background: var(--brand);
          color: white;
          border: none;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        /* Rooms Section */
        .rooms-container { padding: 20px; }
        .rooms-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 16px;
        }
        .rooms-banner h2 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #f8fafc; }
        .rooms-banner p { margin: 0; font-size: 13.5px; color: var(--text-muted); }
        .btn-create-room-header {
          background: var(--brand);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
        .rooms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .room-card-modern {
          background: #0f172a;
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 16px;
          transition: transform 0.2s, border-color 0.2s;
        }
        .room-card-modern:hover {
          transform: translateY(-3px);
          border-color: rgba(99, 102, 241, 0.4);
        }
        .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .card-top h3 { margin: 0; font-size: 16px; font-weight: 700; color: #f8fafc; }
        .online-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #34d399;
          background: rgba(16, 185, 129, 0.1);
          padding: 2px 8px;
          border-radius: 10px;
        }
        .pulse-green { width: 6px; height: 6px; background: #10b981; border-radius: 50%; }
        .card-badges { display: flex; gap: 6px; margin-bottom: 12px; }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 6px;
        }
        .badge-locked { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .badge-joined { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .members-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; min-height: 24px; }
        .chip {
          background: rgba(255, 255, 255, 0.05);
          color: #cbd5e1;
          font-size: 11.5px;
          padding: 2px 8px;
          border-radius: 12px;
        }
        .btn-enter-room {
          width: 100%;
          background: #4f46e5;
          color: white;
          border: none;
          padding: 9px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-reenter { background: #10b981; }

        /* CỘT 3: WIDGETS SIDEBAR */
        .widgets-sidebar {
          width: 320px;
          height: 100vh;
          position: sticky;
          top: 0;
          padding: 20px 20px 20px 16px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 20px;
          flex-shrink: 0;
        }
        .search-widget { width: 100%; }
        .search-box {
          background: #0f172a;
          border: 1px solid var(--card-border);
          border-radius: 20px;
          padding: 8px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .search-icon { color: #64748b; }
        .search-box input {
          flex: 1;
          background: none;
          border: none;
          color: #f8fafc;
          font-size: 13.5px;
          outline: none;
        }
        .btn-clear-search { background: none; border: none; color: #94a3b8; cursor: pointer; }
        .widget-card {
          background: #0f172a;
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 16px;
        }
        .widget-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .widget-icon { color: var(--brand); }
        .widget-header h4 { margin: 0; font-size: 15px; font-weight: 700; color: #f8fafc; }
        .widget-rooms-list { display: flex; flex-direction: column; gap: 8px; }
        .widget-room-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .widget-room-item:hover { background: rgba(99, 102, 241, 0.1); }
        .w-room-info { display: flex; flex-direction: column; gap: 2px; }
        .w-name { font-size: 13px; font-weight: 600; color: #f8fafc; }
        .w-online { font-size: 11px; color: #34d399; }
        .w-arrow { color: #64748b; }
        .widget-footer-info p { font-size: 11.5px; color: #64748b; line-height: 1.5; margin: 0; }

        /* MOBILE BOTTOM NAV */
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: rgba(6, 9, 17, 0.95);
          backdrop-filter: blur(12px);
          border-top: 1px solid var(--card-border);
          z-index: 100;
          align-items: center;
          justify-content: space-around;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .b-nav-item {
          background: none;
          border: none;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
          padding: 6px;
        }
        .b-nav-item.active { color: var(--brand); }
        .b-nav-create {
          background: var(--brand);
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          justify-content: center;
          margin-top: -16px;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.5);
        }

        /* MODALS */
        .modal-backdrop-blur {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .modal-box, .share-card {
          background: #0f172a;
          border: 1px solid var(--card-border);
          border-radius: 18px;
          width: 100%;
          max-width: 400px;
          padding: 20px;
          box-shadow: 0 25px 50px rgba(0,0,0,0.6);
        }
        .modal-header, .share-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .modal-header h3, .share-header h3 { margin: 0; font-size: 17px; font-weight: 700; color: #f8fafc; }
        .btn-close-modal, .btn-close-share { background: none; border: none; color: #94a3b8; cursor: pointer; }
        .form-item { margin-bottom: 14px; }
        .form-item label { display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
        .form-item input {
          width: 100%;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid var(--card-border);
          border-radius: 10px;
          padding: 9px 12px;
          color: #f8fafc;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }
        .form-item input:focus { border-color: var(--brand); }
        .modal-actions-row { display: flex; gap: 10px; margin-top: 18px; }
        .btn-cancel { flex: 1; background: #334155; color: #cbd5e1; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .btn-confirm { flex: 1; background: var(--brand); color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .public-notice { font-size: 13.5px; color: #34d399; margin: 10px 0 16px; }
        .share-preview { font-size: 13px; color: var(--text-muted); font-style: italic; margin-bottom: 16px; }
        .share-options { display: flex; flex-direction: column; gap: 8px; }
        .share-opt-btn {
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          border: none;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-copy { background: #334155; color: white; }
        .btn-fb { background: #1877f2; color: white; }
        .btn-tw { background: #000000; border: 1px solid #334155; color: white; }

        .stream-loading, .stream-empty {
          text-align: center;
          padding: 50px 20px;
          color: var(--text-muted);
        }
        .stream-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255,255,255,0.1);
          border-bottom-color: var(--brand);
          border-radius: 50%;
          margin: 0 auto 12px;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .empty-icon { color: #334155; margin-bottom: 8px; }

        /* RESPONSIVE TRÊN MOBILE & TABLET */
        @media (max-width: 1024px) {
          .widgets-sidebar { display: none; }
          .main-stream { max-width: 100%; }
        }

        @media (max-width: 768px) {
          .nav-sidebar { display: none; }
          .mobile-bottom-nav { display: flex; }
          .main-stream { padding-bottom: 80px; }
          .post-creator-card { padding: 14px 16px; }
          .post-card { padding: 14px 16px; }
          .rooms-container { padding: 14px; }
        }
      `}} />
    </div>
  );
};

export default Home;
