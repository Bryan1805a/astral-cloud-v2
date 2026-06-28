# Triết lý Môi trường Phát triển

Dự án này tuân theo quy trình phát triển Docker-first.

Máy chủ Windows phải được giữ sạch nhất có thể.

## Triết lý

Hệ điều hành máy chủ KHÔNG phải là môi trường phát triển.

Máy chủ chỉ chịu trách nhiệm:

- Docker Desktop
- Git
- VS Code
- WSL2
- Trình duyệt

Mọi thứ khác phải chạy bên trong Docker containers.

---

## Quy tắc Bắt buộc

KHÔNG hướng dẫn lập trình viên cài đặt runtime hoặc trình quản lý gói trên máy chủ.

Ví dụ:

❌ Node.js

❌ npm

❌ pnpm

❌ Python

❌ Redis

❌ PostgreSQL

❌ RabbitMQ

❌ Nginx

❌ PHP

Tất cả chúng phải chạy bên trong Docker containers.

---

## Quy trình Ưu tiên

VS Code

↓

Docker Compose

↓

Frontend Container

↓

Backend Container

↓

Redis Container

↓

PostgreSQL Container

↓

Worker Container

---

## Ngoại lệ

Cài đặt trên máy chủ chỉ được chấp nhận nếu thực sự cần thiết bởi Docker Desktop hoặc chính VS Code.

Ngoài ra, giả định mọi thứ đều được container hóa.

---

Bất cứ khi nào đề xuất các bước cài đặt, luôn ưu tiên các giải pháp dựa trên Docker thay vì cài đặt native trên máy chủ.

## Chính sách Khởi tạo Dự án

Dự án này là Docker-first ngay từ lệnh đầu tiên.

Dự án không bao giờ được tuân theo quy trình:

Máy chủ → Cài Node.js → Tạo Dự án → Docker hóa

Thay vào đó, quy trình là:

Máy chủ
→ Docker Compose
→ Development Container
→ Khởi tạo Dự án
→ Cài Đặt Phụ thuộc
→ Chạy Development Server

Khởi tạo dự án, cài đặt phụ thuộc, tạo mã, quản lý gói, database migration, Prisma generation, tạo Next.js, tạo NestJS, và mọi tác vụ phát triển phải thực thi bên trong Docker containers.

Ví dụ:

✅ docker compose run web pnpm create next-app

✅ docker compose run api pnpm install

✅ docker compose run api prisma migrate dev

❌ pnpm create next-app (máy chủ)

❌ npm install (máy chủ)

❌ npx prisma migrate (máy chủ)

❌ node scripts/... (máy chủ)

Nếu đề xuất lệnh, luôn cung cấp phiên bản Docker tương đương.
