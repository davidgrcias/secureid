# SecureID Frontend

Frontend aplikasi SecureID dibangun dengan Next.js App Router.

## Prasyarat

- Node.js 20+
- Backend SecureID aktif di port 3001

## Setup Aman

1. Install dependency dengan mode aman:

	npm install --ignore-scripts

2. Siapkan environment file:

	Copy `frontend/app/.env.local.example` menjadi `frontend/app/.env.local`.

3. Pastikan isi minimal:

	NEXT_PUBLIC_API_URL=http://localhost:3001

## Jalankan Aplikasi

- Development:

  npm run dev

- Production build test:

  npm run build
  npm start

## URL Lokal

- Frontend: http://localhost:3000
- Backend API default: http://localhost:3001

## Health Checklist Frontend

- `npm run lint` lulus
- `npm run build` lulus
- Halaman utama bisa dibuka di browser
- Login/Register terhubung ke backend tanpa CORS error
