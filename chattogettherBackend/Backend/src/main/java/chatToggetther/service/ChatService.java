package chatToggetther.service;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.Customize.SecurityUtils;
import chatToggetther.DTO.SendMessageDTO;
import chatToggetther.DataRequest.MessageRequest;
import chatToggetther.ENUMS.ErrorCode;
import chatToggetther.modelEntity.FriendshipEntity;
import chatToggetther.modelEntity.HiddenChatEntity;
import chatToggetther.modelEntity.MessageEntity;
import chatToggetther.modelEntity.RoomEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.modelEntity.UserRoomEntity;
import chatToggetther.repository.FriendshipRepository;
import chatToggetther.repository.HiddenChatRepository;
import chatToggetther.repository.MessageRepository;
import chatToggetther.repository.RoomRepository;
import chatToggetther.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Map;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ChatService {
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final FriendshipRepository friendshipRepository;
    private final HiddenChatRepository hiddenChatRepository;
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final ObjectMapper objectMapper;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);

    public ChatService(RoomRepository roomRepository, UserRepository userRepository, MessageRepository messageRepository, FriendshipRepository friendshipRepository, HiddenChatRepository hiddenChatRepository, SimpMessagingTemplate simpMessagingTemplate, ObjectMapper objectMapper) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.friendshipRepository = friendshipRepository;
        this.hiddenChatRepository = hiddenChatRepository;
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ResponseData<Boolean> sendMessage(JwtAuthenticationToken jwtAuthenticationToken , MessageRequest messageRequest , Long user_room){
            if (messageRequest.getMessage() == null || messageRequest.getMessage().trim().isEmpty()) {
                throw new AppException(400, "Tin nhắn không được để trống", 400);
            }

            Long userId = SecurityUtils.extractUserId(jwtAuthenticationToken);
            UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(()->{
                throw new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "không tồn tại user" , ErrorCode.USER_NOT_EXISTED.getStatusCode().value());
            });
            RoomEntity roomEntity = this.roomRepository.findById(user_room).orElseThrow(()->{
                throw new AppException(ErrorCode.ROOM_NOT_FOUND.getCode(),  "phòng không tồn tại" , ErrorCode.ROOM_NOT_FOUND.getStatusCode().value());
            });

            // Tự động đảm bảo quyền và trạng thái hoạt động trong phòng trước khi gửi
            boolean isDm = roomEntity.getPassword() != null && roomEntity.getPassword().startsWith("DM_");
            Long partnerId = null;
            if (isDm) {
                String[] parts = roomEntity.getPassword().split("_");
                if (parts.length >= 3) {
                    try {
                        Long u1 = Long.parseLong(parts[1]);
                        Long u2 = Long.parseLong(parts[2]);
                        if (!userId.equals(u1) && !userId.equals(u2)) {
                            throw new AppException(403, "Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện riêng tư này", 403);
                        }
                        partnerId = userId.equals(u1) ? u2 : u1;
                    } catch (NumberFormatException ignored) {}
                }
            } else {
                UserRoomEntity myUr = roomEntity.getUserRoomEntityList().stream()
                        .filter(ur -> ur.getUserEntity() != null && ur.getUserEntity().getId().equals(userId))
                        .findFirst()
                        .orElse(null);

                if (myUr != null && !Boolean.TRUE.equals(myUr.getActive())) {
                    myUr.setActive(true);
                    this.roomRepository.save(roomEntity);
                }
            }

            LocalDateTime now = LocalDateTime.now();

            // Nếu có chỉ định upToMessageId (ví dụ trả lời nhanh qua thanh thông báo): Chỉ đánh dấu đến đúng tin nhắn đó
            if (isDm && partnerId != null && messageRequest.getUpToMessageId() != null) {
                try {
                    Long upToId = messageRequest.getUpToMessageId();
                    this.messageRepository.markMessagesAsRead(user_room, partnerId, upToId, now);

                    Map<String, Object> readEvent = new HashMap<>();
                    readEvent.put("type", "MESSAGES_READ");
                    readEvent.put("roomId", user_room);
                    readEvent.put("readerId", userId);
                    readEvent.put("senderId", partnerId);
                    readEvent.put("upToMessageId", upToId);
                    readEvent.put("timeRead", now.toString());
                    readEvent.put("formattedTimeRead", now.format(DateTimeFormatter.ofPattern("HH:mm")));
                    this.simpMessagingTemplate.convertAndSend("/topic/messages/" + partnerId, readEvent);
                } catch (Exception ex) {
                    log.warn("Không thể tự động đánh dấu đã đọc khi gửi tin: {}", ex.getMessage());
                }
            }

            MessageEntity messageEntity = new MessageEntity();
            messageEntity.setMessage(messageRequest.getMessage().trim());
            messageEntity.setTimeSend(now);
            messageEntity.setTimeRetrieve(now);
            messageEntity.setIsRead(false);
            messageEntity.setUserEntity(userEntity);
            messageEntity.setRoomEntity(roomEntity);
            this.messageRepository.save(messageEntity);

            String senderNickname = (userEntity.getNickname() != null && !userEntity.getNickname().trim().isEmpty())
                    ? userEntity.getNickname() : userEntity.getAccount();
            String senderUsername = userEntity.getAccount();
            String senderAvatar = userEntity.getAvatar();

            SendMessageDTO sendMessageDTO = new SendMessageDTO();
            sendMessageDTO.setId(messageEntity.getId());
            sendMessageDTO.setMessage(messageEntity.getMessage());
            sendMessageDTO.setTimeSend(now);
            sendMessageDTO.setTime_retrieve(now);
            sendMessageDTO.setUserId(userId);
            sendMessageDTO.setSenderId(userId);
            sendMessageDTO.setNickname(senderNickname);
            sendMessageDTO.setSenderUsername(senderUsername);
            sendMessageDTO.setSenderAvatar(senderAvatar);
            sendMessageDTO.setAvatar(senderAvatar);
            sendMessageDTO.setFormattedTime(now.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")));
            sendMessageDTO.setClientTempId(messageRequest.getClientTempId());
            
            // Gửi duy nhất 1 thông điệp vào phòng để triệt tiêu trùng lặp tin nhắn
            this.simpMessagingTemplate.convertAndSend("/topic/room/" + user_room, sendMessageDTO);
            if (partnerId != null) {
                // Chỉ gửi tới partnerId để cập nhật badge/alert khi đối phương đang ở ngoài phòng
                this.simpMessagingTemplate.convertAndSend("/topic/messages/" + partnerId, sendMessageDTO);
            }

            // Bắn sự kiện thông báo realtime (Floating Alert & Âm thanh) cho tin nhắn 1-1
            if (isDm && partnerId != null) {
                // Kiểm tra xem người nhận có đang ẩn cuộc trò chuyện với người gửi hay không
                boolean isHiddenByRecipient = hiddenChatRepository.existsByUserIdAndPartnerId(partnerId, userId);
                if (!isHiddenByRecipient) {
                    String contentPreview = messageEntity.getMessage();
                    if (contentPreview != null && contentPreview.length() > 100) {
                        contentPreview = contentPreview.substring(0, 97) + "...";
                    }
                    Map<String, Object> dmAlertPayload = new HashMap<>();
                    dmAlertPayload.put("type", "MESSAGE");
                    dmAlertPayload.put("id", messageEntity.getId());
                    dmAlertPayload.put("messageId", messageEntity.getId());
                    dmAlertPayload.put("roomId", roomEntity.getId());
                    dmAlertPayload.put("roomName", senderNickname);
                    dmAlertPayload.put("isDirect", true);
                    dmAlertPayload.put("partnerId", userId);
                    dmAlertPayload.put("senderId", userId);
                    dmAlertPayload.put("senderUsername", senderUsername);
                    dmAlertPayload.put("senderDisplayName", senderNickname);
                    dmAlertPayload.put("senderAvatar", senderAvatar);
                    dmAlertPayload.put("contentPreview", contentPreview);
                    dmAlertPayload.put("message", contentPreview);
                    dmAlertPayload.put("createdAt", now.toString());

                    this.simpMessagingTemplate.convertAndSendToUser(partnerId.toString(), "/queue/room-alerts", dmAlertPayload);
                    this.simpMessagingTemplate.convertAndSend("/topic/room-alerts/" + partnerId, dmAlertPayload);
                }
            }

            // Bắn sự kiện tin nhắn nhóm qua kênh riêng (tuyệt đối không tạo bản ghi Notification ở Chuông Sảnh)
            if (!isDm && roomEntity.getUserRoomEntityList() != null) {
                String contentPreview = messageEntity.getMessage();
                if (contentPreview != null && contentPreview.length() > 100) {
                    contentPreview = contentPreview.substring(0, 97) + "...";
                }
                java.util.Map<String, Object> alertPayload = new java.util.HashMap<>();
                alertPayload.put("roomId", roomEntity.getId());
                alertPayload.put("roomName", roomEntity.getRoomName());
                alertPayload.put("senderId", userId);
                alertPayload.put("senderUsername", senderUsername);
                alertPayload.put("senderDisplayName", senderNickname);
                alertPayload.put("senderAvatar", senderAvatar);
                alertPayload.put("contentPreview", contentPreview);
                alertPayload.put("createdAt", now.toString());

                for (UserRoomEntity ur : roomEntity.getUserRoomEntityList()) {
                    if (ur.getUserEntity() != null && Boolean.TRUE.equals(ur.getActive())) {
                        Long memberId = ur.getUserEntity().getId();
                        if (!memberId.equals(userId) && !Boolean.TRUE.equals(ur.getMuted())) {
                            this.simpMessagingTemplate.convertAndSendToUser(memberId.toString(), "/queue/room-alerts", alertPayload);
                            this.simpMessagingTemplate.convertAndSend("/topic/room-alerts/" + memberId, alertPayload);
                        }
                    }
                }
            }
            
            return new ResponseData<>(ErrorCode.SUCCESS.getCode() , "gửi tin nhắn thành công" , true);
    }

    @Transactional
    public ResponseData<List<SendMessageDTO>> getMessageHistory(JwtAuthenticationToken jwtAuthenticationToken, Long roomId, Long beforeId, Integer size) {
        if (roomId == null) {
            throw new AppException(400, "room_id không được để trống", 400);
        }

        Long userId = SecurityUtils.extractUserId(jwtAuthenticationToken);
        RoomEntity roomEntity = this.roomRepository.findById(roomId).orElseThrow(() -> {
            throw new AppException(ErrorCode.ROOM_NOT_FOUND.getCode(), "Phòng không tồn tại", ErrorCode.ROOM_NOT_FOUND.getStatusCode().value());
        });

        int pageSize = (size != null && size > 0 && size <= 100) ? size : 30;
        List<MessageEntity> messages = this.messageRepository.findMessagesBeforeId(roomId, beforeId, PageRequest.of(0, pageSize));
        
        // Sắp xếp lại theo thứ tự thời gian tăng dần để client hiển thị từ trên xuống dưới
        Collections.reverse(messages);

        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("HH:mm");

        List<SendMessageDTO> history = messages.stream().map(m -> {
            SendMessageDTO dto = new SendMessageDTO();
            dto.setId(m.getId());
            dto.setMessage(m.getMessage());
            LocalDateTime displayTime = m.getTimeSend() != null ? m.getTimeSend() : m.getTimeRetrieve();
            if (displayTime == null) {
                displayTime = LocalDateTime.now();
            }
            dto.setTimeSend(displayTime); 
            dto.setFormattedTime(displayTime.format(formatter));
            dto.setIsRead(Boolean.TRUE.equals(m.getIsRead()));
            dto.setTimeRead(m.getTimeRead());
            if (m.getTimeRead() != null) {
                dto.setFormattedTimeRead(m.getTimeRead().format(formatter));
            }
            
            if (m.getUserEntity() != null) {
                UserEntity u = m.getUserEntity();
                dto.setUserId(u.getId());
                dto.setSenderId(u.getId());
                String nickname = (u.getNickname() != null && !u.getNickname().trim().isEmpty())
                        ? u.getNickname() : u.getAccount();
                dto.setNickname(nickname);
                dto.setSenderUsername(u.getAccount());
                dto.setSenderAvatar(u.getAvatar());
                dto.setAvatar(u.getAvatar());
            } else {
                dto.setUserId(0L);
                dto.setSenderId(0L);
                dto.setNickname("Hệ thống");
                dto.setSenderUsername("system");
                dto.setSenderAvatar(null);
                dto.setAvatar(null);
            }
            return dto;
        }).collect(Collectors.toList());
        return new ResponseData<>(200, "Lấy lịch sử tin nhắn thành công", history);
    }

    @Transactional
    public ResponseData<Map<String, Object>> getOrCreateDirectRoom(JwtAuthenticationToken token, Long targetUserId) {
        return getOrCreateDirectRoom(token, targetUserId != null ? targetUserId.toString() : null);
    }

    @Transactional
    public ResponseData<Map<String, Object>> getOrCreateDirectRoom(JwtAuthenticationToken token, String targetIdentifier) {
        UserEntity me = SecurityUtils.getAuthenticatedUser(token, userRepository);
        if (me == null) {
            throw new AppException(401, "Yêu cầu đăng nhập hoặc phiên làm việc đã hết hạn", 401);
        }
        Long myId = me.getId();

        if (targetIdentifier == null || targetIdentifier.trim().isEmpty()) {
            throw new AppException(400, "Thiếu thông tin người nhận", 400);
        }

        String targetStr = targetIdentifier.trim();
        UserEntity target = null;

        // 1. Thử tìm theo ID số
        try {
            Long targetIdNum = Long.parseLong(targetStr);
            target = userRepository.findById(targetIdNum).orElse(null);
        } catch (NumberFormatException ignored) {}

        // 2. Thử tìm theo account (username)
        if (target == null) {
            target = userRepository.findByAccount(targetStr).orElse(null);
        }

        // 3. Thử tìm theo nickname hoặc account không phân biệt hoa thường
        if (target == null) {
            List<UserEntity> allUsers = userRepository.findAll();
            target = allUsers.stream()
                    .filter(u -> targetStr.equalsIgnoreCase(u.getAccount()) || 
                                 targetStr.equalsIgnoreCase(u.getNickname()))
                    .findFirst()
                    .orElse(null);
        }

        if (target == null) {
            throw new AppException(404, "Không tìm thấy người dùng nhận", 404);
        }

        Long targetUserId = target.getId();
        if (myId.equals(targetUserId)) {
            throw new AppException(400, "Không thể tạo đoạn chat với chính mình", 400);
        }

        String directKey = "DM_" + Math.min(myId, targetUserId) + "_" + Math.max(myId, targetUserId);

        // 1. Tìm kiếm Idempotent phòng chat 1-1 bằng directKey
        RoomEntity dmRoom = roomRepository.findByPassword(directKey).orElse(null);
        if (dmRoom == null) {
            List<RoomEntity> existing = roomRepository.findAll();
            dmRoom = existing.stream()
                    .filter(r -> directKey.equals(r.getPassword()))
                    .findFirst()
                    .orElse(null);
        }

        if (dmRoom != null) {
            if (!Boolean.TRUE.equals(dmRoom.getActive())) {
                dmRoom.setActive(true);
                dmRoom = roomRepository.save(dmRoom);
            }
        } else {
            String myName = (me.getNickname() != null && !me.getNickname().trim().isEmpty()) ? me.getNickname() : me.getAccount();
            String targetName = (target.getNickname() != null && !target.getNickname().trim().isEmpty()) ? target.getNickname() : target.getAccount();

            dmRoom = new RoomEntity();
            dmRoom.setActive(true);
            dmRoom.setRoomName("Chat: " + myName + " & " + targetName + "_" + directKey);
            dmRoom.setDescription("Cuộc trò chuyện riêng tư 1-1");
            dmRoom.setPassword(directKey);
            dmRoom.setAvatar(target.getAvatar() != null ? target.getAvatar() : me.getAvatar());
            dmRoom.setLocalDateTime(LocalDateTime.now());
            dmRoom.setUserRoomEntityList(new ArrayList<>());

            try {
                // Tuyệt đối không tạo UserRoomEntity cho phòng DM để tránh xung đột với phòng công cộng
                dmRoom = roomRepository.saveAndFlush(dmRoom);
            } catch (Exception ex) {
                // Nếu bị duplicate do 2 bên cùng nhấn mở đồng thời
                dmRoom = roomRepository.findByPassword(directKey)
                        .orElseGet(() -> roomRepository.findAll().stream()
                                .filter(r -> directKey.equals(r.getPassword()))
                                .findFirst()
                                .orElse(null));
                if (dmRoom == null) {
                    throw new AppException(500, "Không thể khởi tạo cuộc trò chuyện: " + ex.getMessage(), 500);
                }
            }
        }

        Map<String, Object> targetData = new HashMap<>();
        targetData.put("id", target.getId());
        targetData.put("nickname", target.getNickname() != null ? target.getNickname() : target.getAccount());
        targetData.put("account", target.getAccount());
        targetData.put("avatar", target.getAvatar() != null ? target.getAvatar() : "");

        Map<String, Object> res = new HashMap<>();
        res.put("roomId", dmRoom.getId());
        res.put("roomName", dmRoom.getRoomName());
        res.put("targetUser", targetData);

        // Nạp sẵn 50 tin nhắn mới nhất để phía Frontend hiển thị tức thì chỉ trong 1 request duy nhất (Zero-lag khi reload)
        try {
            ResponseData<List<SendMessageDTO>> historyRes = getMessageHistory(token, dmRoom.getId(), null, 50);
            res.put("messages", historyRes.getData() != null ? historyRes.getData() : Collections.emptyList());
        } catch (Exception ignored) {
            res.put("messages", Collections.emptyList());
        }

        return new ResponseData<>(200, "Lấy phòng chat 1-1 thành công", res);
    }

    @Transactional
    public ResponseData<List<Map<String, Object>>> getRecentConversations(JwtAuthenticationToken token) {
        Long myId = SecurityUtils.extractUserId(token);
        if (myId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }
        UserEntity me = userRepository.findById(myId).orElseThrow(() ->
            new AppException(ErrorCode.USER_NOT_EXISTED.getCode(), "User không tồn tại", 404)
        );

        // 1. Thu thập tất cả bạn bè đã chấp nhận
        List<FriendshipEntity> friends = friendshipRepository.findAllAcceptedFriends(me);
        Map<Long, UserEntity> partnersMap = new LinkedHashMap<>();
        for (FriendshipEntity f : friends) {
            UserEntity partner = f.getUser().getId().equals(myId) ? f.getFriend() : f.getUser();
            if (partner != null && !partner.getId().equals(myId)) {
                partnersMap.put(partner.getId(), partner);
            }
        }

        // 2. Thu thập tất cả phòng DM 1-1 mà user này tham gia
        List<RoomEntity> allDmRooms = roomRepository.findAllDmRooms();
        Map<Long, RoomEntity> partnerToRoomMap = new HashMap<>();
        List<Long> dmRoomIds = new ArrayList<>();

        for (RoomEntity r : allDmRooms) {
            String pwd = r.getPassword();
            if (pwd != null && pwd.startsWith("DM_")) {
                String[] parts = pwd.split("_");
                if (parts.length >= 3) {
                    try {
                        Long u1 = Long.parseLong(parts[1]);
                        Long u2 = Long.parseLong(parts[2]);
                        if (myId.equals(u1) || myId.equals(u2)) {
                            Long partnerId = myId.equals(u1) ? u2 : u1;
                            if (!partnerToRoomMap.containsKey(partnerId)) {
                                partnerToRoomMap.put(partnerId, r);
                            }
                            dmRoomIds.add(r.getId());

                            // Nếu người này chưa có trong partnersMap (chưa kết bạn nhưng từng nhắn tin 1-1)
                            if (!partnersMap.containsKey(partnerId)) {
                                userRepository.findById(partnerId).ifPresent(p -> partnersMap.put(partnerId, p));
                            }
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        // 3. Batch query tin nhắn mới nhất cho TẤT CẢ các phòng DM cùng 1 truy vấn duy nhất
        Map<Long, MessageEntity> latestMsgByRoomId = new HashMap<>();
        if (!dmRoomIds.isEmpty()) {
            List<MessageEntity> latestMessages = messageRepository.findLatestMessagesForRooms(dmRoomIds);
            for (MessageEntity m : latestMessages) {
                if (m.getRoomEntity() != null) {
                    latestMsgByRoomId.put(m.getRoomEntity().getId(), m);
                }
            }
        }

        // 4. Tạo danh sách hội thoại tổng hợp
        List<Map<String, Object>> result = new ArrayList<>();
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");

        List<HiddenChatEntity> hiddenChats = hiddenChatRepository.findByUserId(myId);
        Set<Long> hiddenPartnerIds = hiddenChats.stream()
                .map(HiddenChatEntity::getPartnerId)
                .collect(Collectors.toSet());

        for (Map.Entry<Long, UserEntity> entry : partnersMap.entrySet()) {
            Long partnerId = entry.getKey();
            UserEntity partner = entry.getValue();
            RoomEntity room = partnerToRoomMap.get(partnerId);

            MessageEntity lastMsg = null;
            if (room != null) {
                lastMsg = latestMsgByRoomId.get(room.getId());
            }

            boolean isOnline = chatToggetther.controller.RoomPresenceController.isUserOnline(partnerId);

            Map<String, Object> conv = new HashMap<>();
            conv.put("id", partner.getId());
            conv.put("account", partner.getAccount());
            String nickname = (partner.getNickname() != null && !partner.getNickname().trim().isEmpty())
                    ? partner.getNickname() : partner.getAccount();
            conv.put("nickname", nickname);
            conv.put("avatar", partner.getAvatar() != null ? partner.getAvatar() : "");
            conv.put("isOnline", isOnline);
            conv.put("status", isOnline ? "ONLINE" : "OFFLINE");
            conv.put("directRoomId", room != null ? room.getId() : null);
            conv.put("isHidden", hiddenPartnerIds.contains(partnerId));

            long unreadCount = 0;
            if (room != null) {
                unreadCount = messageRepository.countUnreadMessages(room.getId(), partnerId);
            }
            conv.put("unreadCount", unreadCount);

            if (lastMsg != null) {
                conv.put("lastMessage", lastMsg.getMessage());
                conv.put("lastMessageTime", lastMsg.getTimeSend() != null ? lastMsg.getTimeSend().toString() : null);
                conv.put("lastMessageFormattedTime", lastMsg.getTimeSend() != null ? lastMsg.getTimeSend().format(timeFormatter) : "");
                conv.put("lastMessageSenderId", lastMsg.getUserEntity() != null ? lastMsg.getUserEntity().getId() : null);
            } else {
                conv.put("lastMessage", null);
                conv.put("lastMessageTime", null);
                conv.put("lastMessageFormattedTime", "");
                conv.put("lastMessageSenderId", null);
            }

            result.add(conv);
        }

        // 5. Sắp xếp: Ai có tin nhắn gần đây nhất lên đầu (chuẩn Messenger / Telegram), tuyệt đối an toàn NullPointerException
        result.sort((a, b) -> {
            String timeA = (String) a.get("lastMessageTime");
            String timeB = (String) b.get("lastMessageTime");
            if (timeA != null && timeB != null) {
                int cmp = timeB.compareTo(timeA); // DESC
                if (cmp != 0) return cmp;
            } else if (timeA != null) {
                return -1;
            } else if (timeB != null) {
                return 1;
            }
            String nameA = a.get("nickname") != null ? a.get("nickname").toString() : (a.get("account") != null ? a.get("account").toString() : "");
            String nameB = b.get("nickname") != null ? b.get("nickname").toString() : (b.get("account") != null ? b.get("account").toString() : "");
            return nameA.compareToIgnoreCase(nameB);
        });

        return new ResponseData<>(200, "Lấy danh sách cuộc trò chuyện thành công", result);
    }

    @Transactional
    public ResponseData<Boolean> markMessagesAsRead(JwtAuthenticationToken token, Long roomId, String targetUserId, Long upToMessageId) {
        Long myId = SecurityUtils.extractUserId(token);
        if (myId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }

        Long effectiveRoomId = roomId;
        Long partnerId = null;

        if (targetUserId != null && !targetUserId.trim().isEmpty()) {
            try {
                partnerId = Long.parseLong(targetUserId.trim());
            } catch (NumberFormatException ignored) {}
        }

        if (effectiveRoomId == null && partnerId != null) {
            try {
                ResponseData<Map<String, Object>> dmRes = getOrCreateDirectRoom(token, partnerId);
                if (dmRes.getData() != null && dmRes.getData().get("roomId") != null) {
                    effectiveRoomId = Long.valueOf(dmRes.getData().get("roomId").toString());
                }
            } catch (Exception ignored) {}
        }

        if (effectiveRoomId == null) {
            return new ResponseData<>(200, "Không tìm thấy phòng tương ứng", false);
        }

        if (partnerId == null) {
            RoomEntity room = roomRepository.findById(effectiveRoomId).orElse(null);
            if (room != null && room.getPassword() != null && room.getPassword().startsWith("DM_")) {
                String[] parts = room.getPassword().split("_");
                if (parts.length >= 3) {
                    try {
                        Long u1 = Long.parseLong(parts[1]);
                        Long u2 = Long.parseLong(parts[2]);
                        partnerId = myId.equals(u1) ? u2 : u1;
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        LocalDateTime now = LocalDateTime.now();
        if (partnerId != null) {
            messageRepository.markMessagesAsRead(effectiveRoomId, partnerId, upToMessageId, now);

            // Bắn tín hiệu socket realtime CHỈ cho người gửi biết tin nhắn của họ đã được đọc
            Map<String, Object> readEvent = new HashMap<>();
            readEvent.put("type", "MESSAGES_READ");
            readEvent.put("roomId", effectiveRoomId);
            readEvent.put("readerId", myId);
            readEvent.put("senderId", partnerId);
            readEvent.put("upToMessageId", upToMessageId);
            readEvent.put("timeRead", now.toString());
            readEvent.put("formattedTimeRead", now.format(DateTimeFormatter.ofPattern("HH:mm")));
            this.simpMessagingTemplate.convertAndSend("/topic/messages/" + partnerId, readEvent);
        }

        return new ResponseData<>(200, "Đánh dấu đã đọc thành công", true);
    }

    public ResponseData<Map<String, Object>> getHiddenChatStatus(JwtAuthenticationToken token) {
        Long myId = SecurityUtils.extractUserId(token);
        if (myId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }
        UserEntity user = userRepository.findById(myId)
                .orElseThrow(() -> new AppException(404, "Không tìm thấy người dùng", 404));

        List<HiddenChatEntity> hiddenChats = hiddenChatRepository.findByUserId(myId);
        List<Long> hiddenPartnerIds = hiddenChats.stream().map(HiddenChatEntity::getPartnerId).collect(Collectors.toList());

        Map<String, Object> res = new HashMap<>();
        res.put("hasPin", user.getHiddenChatPin() != null && !user.getHiddenChatPin().trim().isEmpty());
        res.put("hiddenCount", hiddenPartnerIds.size());
        res.put("hiddenPartnerIds", hiddenPartnerIds);
        return new ResponseData<>(200, "Lấy trạng thái cuộc trò chuyện ẩn thành công", res);
    }

    @Transactional
    public ResponseData<Boolean> setupHiddenChatPin(JwtAuthenticationToken token, String pin) {
        Long myId = SecurityUtils.extractUserId(token);
        if (myId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }
        if (pin == null || !pin.matches("^\\d{6}$")) {
            throw new AppException(400, "Mã PIN phải bao gồm đúng 6 chữ số (0-9)", 400);
        }
        UserEntity user = userRepository.findById(myId)
                .orElseThrow(() -> new AppException(404, "Không tìm thấy người dùng", 404));

        user.setHiddenChatPin(passwordEncoder.encode(pin));
        userRepository.save(user);

        return new ResponseData<>(200, "Cài đặt mã PIN 6 số bảo mật thành công", true);
    }

    public ResponseData<Map<String, Object>> verifyHiddenChatPin(JwtAuthenticationToken token, String pin) {
        Long myId = SecurityUtils.extractUserId(token);
        if (myId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }
        if (pin == null || !pin.matches("^\\d{6}$")) {
            throw new AppException(400, "Mã PIN phải bao gồm đúng 6 chữ số", 400);
        }
        UserEntity user = userRepository.findById(myId)
                .orElseThrow(() -> new AppException(404, "Không tìm thấy người dùng", 404));

        if (user.getHiddenChatPin() == null || user.getHiddenChatPin().trim().isEmpty()) {
            throw new AppException(400, "Bạn chưa thiết lập mã PIN cho đoạn chat ẩn", 400);
        }

        if (!passwordEncoder.matches(pin, user.getHiddenChatPin())) {
            throw new AppException(400, "Mã PIN không chính xác! Vui lòng thử lại.", 400);
        }

        List<HiddenChatEntity> hiddenChats = hiddenChatRepository.findByUserId(myId);
        List<Long> hiddenPartnerIds = hiddenChats.stream().map(HiddenChatEntity::getPartnerId).collect(Collectors.toList());

        Map<String, Object> res = new HashMap<>();
        res.put("verified", true);
        res.put("hiddenPartnerIds", hiddenPartnerIds);
        return new ResponseData<>(200, "Xác thực mã PIN thành công", res);
    }

    @Transactional
    public ResponseData<Boolean> hideChat(JwtAuthenticationToken token, Long partnerId, String pin) {
        Long myId = SecurityUtils.extractUserId(token);
        if (myId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }
        if (partnerId == null || partnerId.equals(myId)) {
            throw new AppException(400, "Đối tượng cuộc trò chuyện không hợp lệ", 400);
        }
        UserEntity user = userRepository.findById(myId)
                .orElseThrow(() -> new AppException(404, "Không tìm thấy người dùng", 404));

        // Nếu người dùng đã có PIN thì bắt buộc kiểm tra PIN
        if (user.getHiddenChatPin() != null && !user.getHiddenChatPin().trim().isEmpty()) {
            if (pin == null || !passwordEncoder.matches(pin, user.getHiddenChatPin())) {
                throw new AppException(400, "Mã PIN không chính xác!", 400);
            }
        } else {
            // Chưa có PIN thì yêu cầu setup PIN trước
            if (pin != null && pin.matches("^\\d{6}$")) {
                user.setHiddenChatPin(passwordEncoder.encode(pin));
                userRepository.save(user);
            } else {
                throw new AppException(400, "Vui lòng thiết lập mã PIN 6 số trước khi ẩn cuộc trò chuyện", 400);
            }
        }

        if (!hiddenChatRepository.existsByUserIdAndPartnerId(myId, partnerId)) {
            HiddenChatEntity hidden = HiddenChatEntity.builder()
                    .userId(myId)
                    .partnerId(partnerId)
                    .createdAt(LocalDateTime.now())
                    .build();
            hiddenChatRepository.save(hidden);
        }

        return new ResponseData<>(200, "Đã ẩn cuộc trò chuyện thành công", true);
    }

    @Transactional
    public ResponseData<Boolean> unhideChat(JwtAuthenticationToken token, Long partnerId, String pin) {
        Long myId = SecurityUtils.extractUserId(token);
        if (myId == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED.getCode(), "Yêu cầu đăng nhập", 401);
        }
        UserEntity user = userRepository.findById(myId)
                .orElseThrow(() -> new AppException(404, "Không tìm thấy người dùng", 404));

        if (user.getHiddenChatPin() != null && !user.getHiddenChatPin().trim().isEmpty()) {
            if (pin != null && !pin.trim().isEmpty() && !passwordEncoder.matches(pin, user.getHiddenChatPin())) {
                throw new AppException(400, "Mã PIN không chính xác!", 400);
            }
        }

        hiddenChatRepository.deleteByUserIdAndPartnerId(myId, partnerId);
        return new ResponseData<>(200, "Đã bỏ ẩn cuộc trò chuyện thành công", true);
    }

}
