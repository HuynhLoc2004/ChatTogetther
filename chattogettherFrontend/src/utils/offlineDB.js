// Quản lý lưu trữ CSDL Ngoại Tuyến (Offline-First) bằng IndexedDB
const DB_NAME = 'ChatTogetherOfflineDB';
const DB_VERSION = 1;

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('room_messages')) {
        db.createObjectStore('room_messages', { keyPath: 'roomId' });
      }
      if (!db.objectStoreNames.contains('rooms_cache')) {
        db.createObjectStore('rooms_cache', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn("Không thể mở IndexedDB, chuyển về bộ nhớ tạm:", request.error);
      resolve(null);
    };
  });
};

/**
 * Lưu lịch sử tin nhắn của phòng vào bộ nhớ máy (IndexedDB)
 */
export const saveMessagesOffline = async (roomId, messages) => {
  if (!roomId || !messages) return;
  try {
    const db = await openDB();
    if (!db) {
      localStorage.setItem(`offline_msgs_${roomId}`, JSON.stringify(messages.slice(-50)));
      return;
    }

    const tx = db.transaction('room_messages', 'readwrite');
    const store = tx.objectStore('room_messages');
    store.put({
      roomId: roomId.toString(),
      messages: messages,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error("Lỗi khi lưu tin nhắn offline:", err);
  }
};

/**
 * Lấy danh sách tin nhắn đã lưu trước đó khi không có mạng
 */
export const getMessagesOffline = async (roomId) => {
  if (!roomId) return [];
  try {
    const db = await openDB();
    if (!db) {
      const local = localStorage.getItem(`offline_msgs_${roomId}`);
      return local ? JSON.parse(local) : [];
    }

    return new Promise((resolve) => {
      const tx = db.transaction('room_messages', 'readonly');
      const store = tx.objectStore('room_messages');
      const request = store.get(roomId.toString());

      request.onsuccess = () => {
        if (request.result && Array.result !== null) {
          resolve(request.result.messages || []);
        } else {
          // Thử fallback từ localStorage
          try {
            const local = localStorage.getItem(`offline_msgs_${roomId}`);
            const parsed = local ? JSON.parse(local) : [];
            resolve(Array.isArray(parsed) ? parsed : []);
          } catch {
            resolve([]);
          }
        }
      };

      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error("Lỗi khi đọc tin nhắn offline:", err);
    return [];
  }
};

/**
 * Lưu danh sách phòng vào bộ nhớ máy
 */
export const saveRoomsOffline = async (rooms) => {
  if (!Array.isArray(rooms)) return;
  try {
    const db = await openDB();
    if (!db) {
      localStorage.setItem('offline_rooms', JSON.stringify(rooms));
      return;
    }

    const tx = db.transaction('rooms_cache', 'readwrite');
    const store = tx.objectStore('rooms_cache');
    rooms.forEach(room => {
      if (room.id) store.put(room);
    });
  } catch (err) {
    console.error("Lỗi lưu rooms offline:", err);
  }
};

/**
 * Lấy danh sách phòng khi không có internet
 */
export const getRoomsOffline = async () => {
  try {
    const db = await openDB();
    if (!db) {
      try {
        const local = localStorage.getItem('offline_rooms');
        const parsed = local ? JSON.parse(local) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return new Promise((resolve) => {
      const tx = db.transaction('rooms_cache', 'readonly');
      const store = tx.objectStore('rooms_cache');
      const request = store.getAll();

      request.onsuccess = () => {
        if (request.result && request.result.length > 0) {
          resolve(request.result);
        } else {
          try {
            const local = localStorage.getItem('offline_rooms');
            const parsed = local ? JSON.parse(local) : [];
            resolve(Array.isArray(parsed) ? parsed : []);
          } catch {
            resolve([]);
          }
        }
      };

      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error("Lỗi đọc rooms offline:", err);
    return [];
  }
};

