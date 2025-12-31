# HelloDoc Backend - Microservices API

<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen" />
  <img src="https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white" />
</p>
<p align="center">
  Backend API cho hệ thống y tế toàn diện hỗ trợ người khuyết tật
</p>

---

## 📖 Giới thiệu

HelloDoc Backend là hệ thống API microservices được xây dựng bằng NestJS, cung cấp các dịch vụ:

- **Community Forum API**: Quản lý bài viết, bình luận, tương tác cộng đồng
- **AI/ML Services**: Tích hợp Gemini API, NLP, vector search
- **Đặt lịch thông minh**: Hệ thống quản lý lịch khám hiệu quả
- **Real-time Services:**: WebSocket cho cập nhật trực tuyến
- **...**

**Nhóm thực hiện:**
- Mai Nguyễn Đăng Khoa (2251120423)
- Vũ Nguyễn Phương (2251120437)  
- Lê Nguyễn Minh Phúc (2251120040)

---

## 🏗️ Kiến trúc hệ thống

```
backend/
├── apps/                         # Microservices Architecture
│   ├── admin/                    # Admin Management System
│   │   └── src/
│   │       ├── controller/       # Admin API controllers
│   │       ├── core/             # Domain models & entities
│   │       ├── service/          # Business logic services
│   │       └── use-case/         # Application use cases
│   │
│   ├── api-gateway/              # API Gateway & Routing
│   │   └── src/
│   │       ├── controller/
│   │       ├── core/
│   │       └── middleware/       # Gateway middleware
│   │
│   ├── appointment/              # Booking System Service
│   │   └── src/
│   │       ├── controller/       # Appointment endpoints
│   │       ├── core/             # Booking domain logic
│   │       ├── service/          # Appointment services
│   │       └── use-case/         # Booking use cases
│   │
│   ├── auth/                     # Authentication Service
│   │   └── src/
│   │       ├── controller/       # Auth endpoints
│   │       ├── core/             # JWT, tokens, strategies
│   │       ├── service/          # Auth business logic
│   │       └── use-case/         # Login, register flows
│   │
│   ├── cloudinary/               # Media Storage Service
│   │   └── src/
│   │       ├── controller/       # Upload endpoints
│   │       ├── service/          # Cloudinary integration
│   │       └── use-case/         # Media upload flows
│   │
│   ├── config/                   # Configuration Service
│   │   └── src/
│   │       └── environments/     # Environment configs
│   │
│   ├── doctor/                   # Doctor Management Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── core/
│   │       ├── service/
│   │       └── use-case/
│   │
│   ├── embedding/                # Vector Embeddings Service
│   │   └── src/
│   │       ├── controller/       # Embedding API
│   │       ├── service/          # Sentence transformers
│   │       └── use-case/         # Text vectorization
│   │
│   ├── image-caption/            # AI Image Analysis Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── service/          # Gemini Vision API
│   │       └── use-case/         # Image captioning
│   │
│   ├── medicalservice/           # Medical Services Management
│   │   └── src/
│   │       ├── controller/
│   │       ├── core/
│   │       └── service/
│   │
│   ├── neo4j/                    # Graph Database Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── service/          # Neo4j driver integration
│   │       └── use-case/         # Word suggestion, relations
│   │
│   ├── news/                     # Medical News Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── core/
│   │       └── service/
│   │
│   ├── news-comment/             # News Comment Service
│   │   └── src/
│   │       ├── controller/
│   │       └── service/
│   │
│   ├── news-favorite/            # News Bookmark Service
│   │   └── src/
│   │       ├── controller/
│   │       └── service/
│   │
│   ├── nlp-integration/          # NLP Processing Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── service/          # Underthesea integration
│   │       └── use-case/         # Word segmentation, POS tagging
│   │
│   ├── notification/             # Push Notification Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── service/          # Firebase Cloud Messaging
│   │       └── use-case/
│   │
│   ├── phowhisper/               # Speech Recognition Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── service/          # PhoWhisper ASR
│   │       └── use-case/         # Vietnamese speech-to-text
│   │
│   ├── post-comment/             # Forum Comment Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── core/
│   │       └── service/
│   │
│   ├── post-favorite/            # Post Bookmark Service
│   │   └── src/
│   │       ├── controller/
│   │       └── service/
│   │
│   ├── posts/                    # Forum Posts Service
│   │   └── src/
│   │       ├── controller/       # Post CRUD endpoints
│   │       ├── core/             # Post entities
│   │       ├── service/          # Post business logic
│   │       └── use-case/         # Create, update, delete posts
│   │
│   ├── projects/                 # Projects Management (Admin)
│   │   └── src/
│   │       ├── controller/
│   │       └── service/
│   │
│   ├── qdrant/                   # Vector Search Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── service/          # Qdrant client integration
│   │       └── use-case/         # Semantic search, recommendations
│   │
│   ├── report/                   # Content Moderation Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── core/
│   │       └── service/
│   │
│   ├── review/                   # Doctor Review Service
│   │   └── src/
│   │       ├── controller/
│   │       └── service/
│   │
│   ├── sign-language/            # Sign Language Processing Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── service/          # MediaPipe integration
│   │       └── use-case/         # Speech-to-sign conversion
│   │
│   ├── specialty/                # Medical Specialty Service
│   │   └── src/
│   │       ├── controller/
│   │       ├── core/
│   │       └── service/
│   │
│   ├── underthesea/              # Vietnamese NLP Service
│   │   └── src/
│   │       ├── controller/
│   │       └── service/          # Underthesea library wrapper
│   │
│   └── users/                    # User Management Service
│       └── src/
│           ├── controller/       # User API endpoints
│           ├── core/             # User entities
│           ├── service/          # User business logic
│           └── use-case/         # Profile management flows
│
├── libs/                         # Shared Libraries
│   ├── common/                   # Common utilities
│       ├── guards/
│       └── contracts/
│   
│
├── docker-compose.yml            # Container orchestration
└── nest-cli.json                 # NestJS monorepo config
```

### Stack công nghệ

| Thành phần | Công nghệ | Mục đích |
|------------|-----------|----------|
| **Backend API** | NestJS (Node.js), TypeScript | REST API, Microservices |
| **Web Admin** | Nuxt.js, Vue 3, Tailwind CSS | Dashboard quản trị |
| **Mobile App** | Kotlin, Jetpack Compose, ExoPlayer | Ứng dụng Android |
| **Database** | MongoDB, Qdrant, Neo4j, Redis, RoomDB | Polyglot Persistence |
| **AI/ML** | Gemini API, Hugging Face, MediaPipe | NLP, Computer Vision, ASR |
| **Auth** | Firebase Auth, JWT | Xác thực & phân quyền |
| **Storage** | Cloudinary | Quản lý media |
| **Real-time** | WebSocket | Cập nhật trạng thái trực tuyến |

---

## 🗄️ Cơ sở dữ liệu

### MongoDB - Cơ sở dữ liệu chính
- Lưu trữ: Users, Posts, Comments, Appointments,...
- Schema linh hoạt, hỗ trợ mở rộng

### Qdrant - Vector Database  
- Lưu trữ embeddings 384 chiều
- Tìm kiếm ngữ nghĩa với HNSW algorithm
- Cosine similarity cho content recommendation

### Neo4j - Graph Database
- Mô hình hóa quan hệ y khoa (triệu chứng → bệnh → điều trị)
- Gợi ý từ đồng nghĩa với Cypher query
- Hỗ trợ word suggestion

### Redis - Cache & Real-time
- Session management
- Cache kết quả tìm kiếm
- Rate limiting

### RoomDB - Local Storage (Android)
- Offline data access
- Sync với server khi online

---

## 🤖 Mô hình AI/ML

### 1. Natural Language Processing
- **Underthesea**: Word segmentation, POS tagging cho tiếng Việt
- **Sentence Transformers** (MiniLM-L6-V2): Text embeddings
- **BAAI/bge-m3**: Multilingual embeddings

### 2. Speech Recognition
- **PhoWhisper**: ASR cho tiếng Việt
- Nhận dạng giọng nói với độ chính xác cao
- Xử lý nhiễu nền

### 3. Computer Vision
- **MediaPipe**: Pose estimation, hand tracking
- Trích xuất landmarks 3D (21 điểm bàn tay, 33 điểm cơ thể)
- Real-time processing

### 4. Generative AI
- **Gemini API**: Chatbot, image analysis
- Multimodal understanding
- Content generation

---

## 🚀 Cài đặt & Triển khai

### Yêu cầu hệ thống

- **Node.js** 18+ (cho Backend & Web Admin)
- **JDK 21** (bundled với Android Studio)
- **Android Studio** 
- **MongoDB** 8.0+
- **Redis** 7.0+

### 1. Clone repository

```bash
git clone https://github.com/vuphuong1794/HelloDoc_BE_Microservices

```

### 2. Cài đặt Backend (NestJS)

```bash
npm install

# Chạy development server
npm run start:all
```

Backend API sẽ chạy tại `http://localhost:4000`


## 🧪 Kiểm thử & Đánh giá

### Kết quả đạt được

| Chỉ tiêu | Kết quả | Đánh giá |
|----------|---------|----------|
| Mức độ hoàn thiện | Đầy đủ chức năng chính | ✅ Đạt |
| Tốc độ phản hồi | < 3 giây | ✅ Đạt |
| Độ chính xác | 65-70% (gợi ý từ), 85-90% (vector search) | ⚠️ Đạt (cần cải thiện) |
| Tính bảo mật | Mã hóa AES, JWT | ✅ Tốt |
| Tính nhân văn | Thu hẹp khoảng cách số | ⭐ Xuất sắc |

---

### Kế hoạch tương lai 🚀
- [ ] Sử dụng RabbitMQ
- [ ] Tích hợp CI/CD
- [ ] Sử dụng load balancing
- [ ] Cải tiến logic

---

## 📧 Liên hệ

**Nhóm thực hiện:**
- Mai Nguyễn Đăng Khoa - maikhoa2015@gmail.com
- Vũ Nguyễn Phương - pvunguyen84@gmail.com
- Lê Nguyễn Minh Phúc - lenguyenminhphuc0706@gmail.com

---

<p align="center">
  <i>Được phát triển với ❤️ bởi nhóm HelloDoc</i>
</p>

<p align="center">
  <i>"Thu hẹp khoảng cách số, nâng cao chất lượng cuộc sống"</i>
</p>
