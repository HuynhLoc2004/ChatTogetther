# Chat Togetther

Chat Togetther la ung dung chat realtime gom frontend React va backend Spring Boot. Nguoi dung co the dang ky, dang nhap, tao phong chat, tham gia phong, gui tin nhan realtime va quan ly thanh vien trong phong.

## Chuc nang chinh

- Dang ky va dang nhap tai khoan.
- Xac thuc bang JWT access token va refresh token qua cookie.
- Tu dong refresh access token khi token het han.
- Tao phong chat voi ten phong, nickname va mat khau tuy chon.
- Xem danh sach phong dang hoat dong.
- Tham gia phong chat bang nickname va mat khau phong neu co.
- Chat realtime bang WebSocket, SockJS va STOMP.
- Xem lich su tin nhan cua phong.
- Hien thi danh sach thanh vien dang trong phong.
- Chu phong co the kick thanh vien, trao quyen chu phong va giai tan phong.
- Nguoi dung co the roi phong; chu phong can trao quyen hoac giai tan phong neu phong con thanh vien.

## Cong nghe su dung

### Frontend

- React 19
- Vite
- React Router DOM
- Axios
- SockJS Client
- STOMPJS
- Framer Motion
- React Hot Toast
- Lucide React
- Tailwind CSS

### Backend

- Java 21
- Spring Boot 3.4.2
- Spring Web
- Spring Security
- OAuth2 Resource Server
- Spring WebSocket
- Spring Data JPA
- PostgreSQL
- JWT
- Lombok

## Cau truc thu muc

```text
ChatTogetther/
├── chattogettherFrontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── axiosClient.js
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Home.jsx
│   │   │   └── ChatRoom.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── vite.config.js
│   └── package.json
│
└── chattogettherBackend/
    └── Backend/
        ├── src/main/java/chatToggetther/
        │   ├── configuration/
        │   ├── controller/
        │   ├── service/
        │   ├── repository/
        │   ├── modelEntity/
        │   ├── DTO/
        │   └── DataRequest/
        ├── src/main/resources/
        │   ├── application.properties
        │   └── application.yml
        └── pom.xml
```

## Yeu cau cai dat

- Node.js
- npm
- Java 21
- Maven hoac Maven Wrapper co san trong project
- PostgreSQL

## Cau hinh backend

Backend doc cau hinh trong:

- `chattogettherBackend/Backend/src/main/resources/application.properties`
- `chattogettherBackend/Backend/src/main/resources/application.yml`

Can kiem tra cac gia tri sau truoc khi chay:

```properties
spring.datasource.url=jdbc:postgresql://...
spring.datasource.username=...
spring.datasource.password=...
spring.jpa.hibernate.ddl-auto=update
```

JWT duoc cau hinh trong `application.yml`:

```yml
jwt:
  secret_key: your-secret-key
  exp_access: 5
  exp_refresh: 10080
```

## Cach chay project

### 1. Chay backend

Mo terminal tai thu muc backend:

```bash
cd chattogettherBackend/Backend
```

Chay bang Maven Wrapper:

```bash
./mvnw spring-boot:run
```

Tren Windows co the dung:

```bash
mvnw.cmd spring-boot:run
```

Backend mac dinh chay tai:

```text
http://localhost:8080
```

### 2. Chay frontend

Mo terminal tai thu muc frontend:

```bash
cd chattogettherFrontend
```

Cai dependencies:

```bash
npm install
```

Chay dev server:

```bash
npm run dev
```

Frontend mac dinh chay tai:

```text
http://localhost:5173
```

## Proxy frontend

Frontend da cau hinh proxy trong `vite.config.js`:

```js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      secure: false,
    },
    '/ws-gs-guide': {
      target: 'http://localhost:8080',
      ws: true,
      changeOrigin: true,
    }
  }
}
```

Vi vay frontend co the goi API bang `/api` va ket noi WebSocket bang `/ws-gs-guide` khi backend dang chay o port `8080`.

## API chinh

### Authentication

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| POST | `/api/auth/login` | Dang nhap |
| GET | `/api/auth/refresh_token` | Lam moi access token bang refresh token trong cookie |

### User

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| POST | `/api/users/create` | Tao tai khoan moi |
| GET | `/api/users/active-room` | Lay phong ma user dang tham gia |

### Room

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| GET | `/api/rooms/info-rooms` | Lay danh sach phong dang hoat dong |
| POST | `/api/rooms/create` | Tao phong moi |
| POST | `/api/rooms/join-room?room_id={id}` | Tham gia phong |
| POST | `/api/rooms/leave-room?room_id={id}` | Roi phong |
| POST | `/api/rooms/remove-user?user_id={id}&room_id={id}` | Kick thanh vien |
| POST | `/api/rooms/delegate-admin?room_id={id}&new_admin_id={id}` | Trao quyen chu phong |
| POST | `/api/rooms/disband-room?room_id={id}` | Giai tan phong |

### Message

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| GET | `/api/message/history?room_id={id}` | Lay lich su tin nhan |
| POST | `/api/message/send?user_room={id}` | Gui tin nhan |

## WebSocket

Backend mo endpoint:

```text
/ws-gs-guide
```

Client subscribe cac topic:

```text
/topic/rooms
/topic/room/{roomId}
```

- `/topic/rooms`: cap nhat danh sach phong khi co thay doi.
- `/topic/room/{roomId}`: nhan tin nhan realtime, tin nhan he thong, su kien kick, giai tan phong va cap nhat thanh vien.

## Luong su dung

1. Nguoi dung dang ky tai `/register`.
2. Dang nhap tai `/login`.
3. Sau khi dang nhap, access token duoc luu trong `localStorage`.
4. Trang Home hien thi danh sach phong dang hoat dong.
5. Nguoi dung tao phong moi hoac tham gia phong co san.
6. Trong phong chat, tin nhan duoc gui qua API va nhan realtime qua WebSocket.
7. Chu phong co them quyen quan ly thanh vien va giai tan phong.

## Scripts frontend

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Test backend

Tai thu muc backend:

```bash
cd chattogettherBackend/Backend
./mvnw test
```

Tren Windows:

```bash
mvnw.cmd test
```

## Luu y

- Backend can chay truoc khi frontend goi API hoac ket noi WebSocket.
- CORS hien cho phep `http://localhost:5173` va `http://127.0.0.1:5173`.
- Neu doi port frontend hoac backend, can cap nhat lai `vite.config.js`, `SecurityConfig.java` va `WebSocketConfig.java`.
- Khong nen commit thong tin database password hoac JWT secret that len repository public.
