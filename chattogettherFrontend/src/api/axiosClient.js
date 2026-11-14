import axios from 'axios';

// Nhận diện linh hoạt cả VITE_API_URL và VITE_API_BASE_URL (bóc tách /api nếu người dùng lỡ viết vào cuối)
const rawEndpoint = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
export const BACKEND_URL = rawEndpoint.replace(/\/api$/, '');

const axiosClient = axios.create({
  baseURL: BACKEND_URL ? `${BACKEND_URL}/api` : '/api',
  timeout: 60000, // 60s để chờ Render thức giấc nếu máy chủ đang ở chế độ ngủ (Free tier)
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Biến để tránh gọi refresh token nhiều lần cùng lúc
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add a request interceptor
axiosClient.interceptors.request.use(
  function (config) {
    const token = localStorage.getItem('accesstoken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  function (error) {
    return Promise.reject(error);
  }
);

// Add a response interceptor
axiosClient.interceptors.response.use(
  function (response) {
    return response;
  },
  async function (error) {
    const originalRequest = error.config;

    // Nếu lỗi 401 và không phải là request refresh token
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh_token') &&
      !originalRequest.url.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshEndpoint = BACKEND_URL ? `${BACKEND_URL}/api/auth/refresh_token` : '/api/auth/refresh_token';
        const storedRefreshToken = localStorage.getItem('refreshToken');
        
        const response = await axios.get(refreshEndpoint, {
          withCredentials: true,
          headers: {
            Authorization: undefined,
            'x-refresh-token': storedRefreshToken || undefined,
          },
        });
        
        const newAccessToken = response.data.data;
        localStorage.setItem('accesstoken', newAccessToken);

        // Đảm bảo user_id luôn tồn tại
        try {
          const payloadBase64 = newAccessToken.split('.')[1];
          const decoded = JSON.parse(atob(payloadBase64));
          if (decoded && decoded.user_id) {
            localStorage.setItem('user_id', decoded.user_id.toString());
          }
        } catch (_) {}
        
        // Giải quyết các request đang chờ
        processQueue(null, newAccessToken);
        isRefreshing = false;
        
        // Cập nhật token mới cho request hiện tại
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        console.error("Refresh token failed:", refreshError);
        localStorage.removeItem('accesstoken');
        // window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    if (!error.response) {
      // Trường hợp Render Free tier đang ngủ (cold start) hoặc mạng chập chờn
      if (!originalRequest._networkRetry && (originalRequest.method === 'get' || originalRequest.url.includes('/auth/login'))) {
        originalRequest._networkRetry = true;
        console.warn("Máy chủ Backend đang khởi động lại hoặc mạng chậm. Đang tự động kết nối lại...");
        await new Promise(res => setTimeout(res, 2000));
        return axiosClient(originalRequest);
      }
      console.warn("Lỗi kết nối máy chủ:", error.message || "Network Error");
    } else if (error.response.status === 429) {
      console.warn("Rate Limit (429):", error.response.data?.message || "Thao tác quá nhanh, vui lòng thử lại sau giây lát.");
    } else {
      console.warn("API Error:", error.response.status, error.response.data?.message || error.response.statusText);
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
