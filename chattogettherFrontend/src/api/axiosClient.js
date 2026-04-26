import axios from 'axios';

const axiosClient = axios.create({
  baseURL: 'http://localhost:8080/api', // Trỏ thẳng đến API root của Backend
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

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

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const response = await axios.get('http://localhost:8080/api/auth/refresh_token', {
          withCredentials: true,
        });
        const newAccessToken = response.data.data;
        localStorage.setItem('accesstoken', newAccessToken);
        
        // Cập nhật token mới cho request hiện tại và các request sau
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        console.error("Refresh token failed:", refreshError);
        localStorage.removeItem('accesstoken');
        // window.location.href = '/login'; // Có thể redirect về login nếu muốn
        return Promise.reject(refreshError);
      }
    }

    if (!error.response) {
       console.error("Network Error: Vui lòng kiểm tra Server Backend (8080) có đang chạy không?");
    } else {
       console.error("API Error:", error.response.status, error.response.data);
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
