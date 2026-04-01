# SecureID Monorepo

Panduan ini untuk menjalankan stack SecureID secara lokal dengan mode yang mendekati production.

## Arsitektur

- Backend: Express + TypeScript (port 3001)
- Frontend: Next.js App Router (port 3000)
- Database: PostgreSQL (database secureid)
- Cache: fallback memory (Upstash optional)

## Kredensial Lokal Aktif

Konfigurasi runtime backend sudah tersedia di file `backend/.env`.

Ringkasan nilai penting:

- NODE_ENV=development
- PORT=3001
- CORS_ORIGIN=http://localhost:3000
- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/secureid
- DATABASE_SSL_MODE=auto
- JWT_ACCESS_EXPIRES_IN=15m
- JWT_REFRESH_EXPIRES_IN=7d
- PASSWORD_RESET_TTL_SECONDS=900
- UPLOAD_DIR=uploads

Konfigurasi runtime frontend:

- File: `frontend/app/.env.local`
- Nilai: NEXT_PUBLIC_API_URL=http://localhost:3001

## Setup Sekali Saja

### 1) Backend

- Masuk folder backend
- Install dependency aman:

  npm install --ignore-scripts

- Jalankan migration:

  npm run migrate

### 2) Frontend

- Masuk folder frontend/app
- Install dependency aman:

  npm install --ignore-scripts

- Pastikan file env ada:

  frontend/app/.env.local

## Menjalankan Aplikasi

Terminal 1 (backend):

- cd backend
- npm start

Terminal 2 (frontend):

- cd frontend/app
- npm run dev

## Endpoint Lokal

- Frontend: http://localhost:3000
- Backend root: http://localhost:3001
- Backend health: http://localhost:3001/api/health

## Validasi Siap Pakai

Checklist minimal sebelum dipakai testing manual:

- Backend `npm run typecheck` lulus
- Backend `npm run build` lulus
- Backend `npm run migrate` lulus
- Frontend `npm run lint` lulus
- Frontend `npm run build` lulus
- Smoke flow auth -> upload dokumen -> create envelope -> send -> public sign -> completed lulus

## Catatan Production Sungguhan

Untuk deployment ke server production:

- Ganti CORS_ORIGIN ke domain frontend production
- Ganti DATABASE_URL ke managed PostgreSQL production
- Aktifkan SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM sesuai mail provider
- Isi UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN bila ingin cache/queue redis
- Rotate JWT secrets secara periodik
