import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
  function (error) {
    if (!error.response) {
       console.error("Network Error: Vui lòng kiểm tra Server Backend có đang chạy tại http://localhost:8080 không? Hoặc lỗi CORS.");
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
