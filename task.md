# 📋 SecureID — Task List
> Progress tracking for SecureID implementation.

> [!CAUTION]
> **🚨 PENTING: AXIOS SUPPLY CHAIN ATTACK (31 MARET 2026) 🚨**
> - `axios@1.14.1` dan `axios@0.30.4` mengandung **Remote Access Trojan (RAT)**.
> - **DILARANG KERAS** menjalankan `npm install axios` tanpa pin versi. Harus selalu menggunakan `"axios": "1.14.0"`.
> - **SELALU** jalankan `npm install --ignore-scripts` sebagai langkah pencegahan.

## 🏁 Phase 0: Foundation & Scaffolding
- [x] Initialize Backend (Express + TypeScript)
- [x] Configure Environment Variables & Basic Middleware
- [x] Database Connection (Supabase/PostgreSQL)
- [x] Audit komprehensif (Backend, Frontend, DB)
    - [x] Identifikasi gap fungsional & risiko siber
    - [x] Laporan audit final (`audit_report.md`)
- [x] Finalize implementation plan & task list
- [x] Commit & Push all changes to main
- [x] Redis Connection (Upstash/In-memory)
- [x] Database Migrations (Initial Schema)
- [x] Initialize Frontend (Next.js 15.2.4)
- [x] Tailwind CSS v4 Configuration (Migrate Design Tokens)
- [x] Base Layout Components (TopNav, SideNav, Footer)
- [x] Global Layout Shell (Dashboard Shell)

---

## 🔒 Phase 1: Auth & User Management
- [x] Backend: Auth Routes & JWT Logic
- [x] Frontend: Login & Registration Pages
- [x] e-KYC Verification Flow (KTP + Selfie)
- [x] Liveness Check Simulation

---

## 📄 Phase 2: Document Workflow (CORE)
- [x] Document Upload API & Storage
- [x] Envelope Management
- [x] Field Builder (Annotation Studio)
- [x] Review Before Send Logic

---

## ✒️ Phase 3: Signing Engine (CORE)
- [x] Public Signing Link Service
- [x] PDF Signing Logic (pdf-lib & Crypto)
- [x] Signature Creation Modal (Draw/Type/Upload)
- [x] Sequential Signing Orchestration

---

## 🔔 Phase 4: Notifications & UI Polish
- [x] Email Notifications (Nodemailer)
- [x] Real-time Notifications (Socket.io)
- [x] Success/Error Empty States

---

## 🏢 Phase 5: Enterprise & Production Ready
- [x] Team Management & RBAC
- [x] Dark Mode Compliance
- [x] Landing & Pricing Pages
- [x] SEO & Performance Optimization
