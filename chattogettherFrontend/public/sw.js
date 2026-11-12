// Clean Service Worker: Xóa bỏ toàn bộ cache cũ và hủy đăng ký để tránh xung đột mã nguồn Vite trên Vercel
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.claim();
    })
  );
});
