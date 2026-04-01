# 📋 SecureID — Task List
> Progress tracking for SecureID implementation.

> [!CAUTION]
> **🚨 PENTING: AXIOS SUPPLY CHAIN ATTACK (31 MARET 2026) 🚨**
> - `axios@1.14.1` dan `axios@0.30.4` mengandung **Remote Access Trojan (RAT)**.
> - **DILARANG KERAS** menjalankan `npm install axios` tanpa pin versi. Harus selalu menggunakan `"axios": "1.14.0"`.
> - **SELALU** jalankan `npm install --ignore-scripts` sebagai langkah pencegahan.

## 🏁 Phase 0: Foundation & Scaffolding (WIP)
- [x] Initialize Backend (Express + TypeScript)
- [x] Configure Environment Variables & Basic Middleware
- [x] Database Connection (Supabase/PostgreSQL)
- [x] Redis Connection (Upstash/In-memory)
- [x] Database Migrations (Initial Schema)
- [x] Initialize Frontend (Next.js 15.2.4)
- [x] Tailwind CSS v4 Configuration (Migrate Design Tokens)
- [x] Base Layout Components (TopNav, SideNav, Footer)
- [x] Global Layout Shell (Dashboard Shell)

---

## 🔒 Phase 1: Auth & User Management
- [ ] [ ] Backend: Auth Routes & JWT Logic
- [ ] [ ] Frontend: Login & Registration Pages
- [ ] [ ] e-KYC Verification Flow (KTP + Selfie)
- [ ] [ ] Liveness Check Simulation

---

## 📄 Phase 2: Document Workflow (CORE)
- [ ] [ ] Document Upload API & Storage
- [ ] [ ] Envelope Management
- [ ] [ ] Field Builder (Annotation Studio)
- [ ] [ ] Review Before Send Logic

---

## ✒️ Phase 3: Signing Engine (CORE)
- [ ] [ ] Public Signing Link Service
- [ ] [ ] PDF Signing Logic (pdf-lib & Crypto)
- [ ] [ ] Signature Creation Modal (Draw/Type/Upload)
- [ ] [ ] Sequential Signing Orchestration

---

## 🔔 Phase 4: Notifications & UI Polish
- [ ] [ ] Email Notifications (Nodemailer)
- [ ] [ ] Real-time Notifications (Socket.io)
- [ ] [ ] Success/Error Empty States

---

## 🏢 Phase 5: Enterprise & Production Ready
- [ ] [ ] Team Management & RBAC
- [ ] [ ] Dark Mode Compliance
- [ ] [ ] Landing & Pricing Pages
- [ ] [ ] SEO & Performance Optimization
