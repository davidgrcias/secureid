# SecureID — Laporan Audit Kesiapan Produksi

> Audit menyeluruh semua lapisan: Database, Backend (11 service, 11 route, 5 middleware), Frontend (halaman, lib, stores).  
> Tanggal audit: 2026-04-01

---

## Ringkasan Eksekutif

| Layer | Status | Gap Kritikal |
|---|---|---|
| Database Schema | ✅ Solid | Tidak ada |
| Backend Auth | ✅ Solid | Tidak ada |
| Backend Envelope | ⚠️ 4 bug nyata | Lihat Seksi 2 |
| Backend Sign | ⚠️ 3 bug nyata | Lihat Seksi 3 |
| Backend Verification | 🔴 KRITIS | KYC auto-verified tanpa AI |
| Backend Email | ⚠️ Plain HTML, XSS-prone | Lihat Seksi 5 |
| Backend Security | ⚠️ 2 masalah | Rate limiter terlalu longgar |
| Frontend Send Flow | ⚠️ Field builder tidak draggable | UX kritis |
| Frontend Sign Page | ⚠️ Signature value tidak aman | Lihat Seksi 8 |
| Frontend API Client | ⚠️ Masalah refresh race condition | Lihat Seksi 9 |

**Kesimpulan: Belum siap produksi.** Ada **12 bug/risiko nyata** yang perlu diperbaiki sebelum go-live.

---

## Seksi 1 — Database Schema

### ✅ Yang Sudah Benar
- Semua FK dengan `ON DELETE CASCADE` / `ON DELETE SET NULL` sudah tepat.
- `access_token UNIQUE` mencegah duplikat token signing — bagus.
- Index di semua FK kolom sudah komprehensif.
- UUID sebagai PK dengan `gen_random_uuid()` — benar.
- TIMESTAMPTZ (bukan TIMESTAMP) — benar.

### 🔴 GAP-1: Tidak Ada Index di `access_token`
**File:** `backend/src/migrations/002_initial_schema.sql`  
**Masalah:** Kolom `envelope_recipients.access_token` punya `UNIQUE` constraint (otomatis membuat index), tapi tidak ada index eksplisit di `sessions.refresh_token`. Setiap token refresh akan full table scan jika session banyak.

```sql
-- TAMBAHKAN:
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions (refresh_token);
```

### ⚠️ GAP-2: Tidak Ada `updated_at` di Tabel Envelopes
Tabel `envelopes` tidak punya kolom `updated_at`. Saat status berubah (`draft → sent → in_progress → completed`), tidak ada timestamp perubahan terakhir yang bisa diaudit selain dari `audit_logs`. Untuk production, ini menyulitkan debugging.

```sql
-- TAMBAHKAN ke migration:
ALTER TABLE envelopes ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
```

---

## Seksi 2 — Backend Envelope Service

**File:** `backend/src/services/envelope.service.ts`

### 🔴 GAP-3: `sendEnvelope` Tidak Cek Status Draft
```typescript
// Line 636-643 — envelope bisa dikirim ulang meski sudah 'completed' atau 'voided'!
export async function sendEnvelope(senderId: string, envelopeId: string) {
  // LANGSUNG UPDATE status = 'sent' tanpa cek apakah statusnya masih 'draft'
  const result = await query(`UPDATE envelopes SET status = 'sent' ...`)
}
```
**Risiko:** User bisa memanggil API `POST /envelopes/:id/send` berkali-kali. Ini akan reset status envelope yang sudah `completed` kembali ke `sent` dan mengirim email ke semua signer lagi.

**Fix:**
```typescript
// Tambah validasi sebelum UPDATE:
if (ownershipEnvelope.status !== 'draft') {
  throw new ApiError(400, `Envelope sudah dalam status '${ownershipEnvelope.status}', tidak dapat dikirim ulang.`);
}
```

### 🔴 GAP-4: `voidEnvelope` Tidak Cek Status — Bisa Void Envelope yang Sudah Completed
```typescript
// Line 764-795 — tidak ada pengecekan status!
export async function voidEnvelope(senderId: string, envelopeId: string) {
  // Langsung UPDATE status = 'voided' tanpa filter
}
```
**Risiko:** Envelope yang sudah `completed` (dokumen sudah ditandatangani sah) bisa di-void oleh sender, merusak integritas legal.

**Fix:** Tambah validasi:
```typescript
if (['completed', 'voided'].includes(ownershipEnvelope.status)) {
  throw new ApiError(400, 'Envelope tidak dapat dibatalkan pada status ini.');
}
```

### ⚠️ GAP-5: Audit Log Action `'viewed'` Salah Label
```typescript
// Line 548 — saat update draft, log action-nya 'viewed' padahal harusnya 'updated'
await createAuditLog(envelopeId, senderId, "viewed", { updated: true });

// Line 619-622 — saat replace fields, juga 'viewed'
INSERT INTO audit_logs ... VALUES ($1, $2, 'viewed', $3)
```
**Masalah:** Schema DB hanya allow: `('created', 'sent', 'opened', 'viewed', 'signed', 'declined', 'voided', 'downloaded', 'reminded')`. Tidak ada `'updated'`, jadi ini sebenarnya intentional tapi menyesatkan karena artinya berbeda. Perlu ditambah enum `'updated'` ke schema dan pakai label yang benar.

### ⚠️ GAP-6: `replaceEnvelopeFields` Tidak Cek Status Envelope
**File:** `envelope.service.ts` Line 553  
Siapapun bisa replace fields di envelope yang sudah `sent` atau bahkan `completed`. Ini harus dibatasi hanya untuk envelope dengan status `draft`.

```typescript
// TEMUKAN: ensureEnvelopeOwnership → tambah status check
if (!['draft'].includes(envelope.status)) {
  throw new ApiError(400, 'Field hanya dapat diubah saat envelope masih dalam status draft.');
}
```

---

## Seksi 3 — Backend Sign Service

**File:** `backend/src/services/sign.service.ts`

### 🔴 GAP-7: Signed PDF Overwrite Dokumen Original — Data Loss Risk
```typescript
// Line 497-506 — Setiap signer baru menimpa file_path dokumen!
await client.query(
  `UPDATE documents SET file_path = $2, file_hash_sha256 = $3 ...`,
  [session.document_id, signedRelativePath, documentHashAfter]
);
```
**Masalah Serius:** Ketika Signer #1 menandatangani, dokumen original di-overwrite dengan signed version milik Signer #1. Ketika Signer #2 menandatangani, ia membaca file dari Signer #1 (sudah dimodifikasi). **Hash SHA256 di `signing_actions` tidak lagi merepresentasikan hash dokumen original** — audit trail kriptografis rusak.

**Fix yang benar:** Simpan signed file ke path baru per-signer, dan gunakan dokumen original (yang tidak pernah berubah) sebagai `document_hash_before` untuk semua signer.

```typescript
// Strategi: Jangan overwrite documents.file_path
// Simpan signed output ke tabel terpisah atau kolom berbeda
// Hash before = hash dokumen original (tidak berubah)
// Hash after = hash hasil signing signer ini
```

### ⚠️ GAP-8: Tidak Ada Signature File Cleanup
**File:** `sign.service.ts` Line 464-491  
Setiap kali signer menandatangani, file PDF baru dibuat di disk. Tidak ada mekanisme untuk membersihkan intermediate signed files (antara signer #1, #2, dst.). Untuk produksi dengan traffic tinggi, disk akan penuh.

### ⚠️ GAP-9: Viewer/Approver Bisa Akses Signing Page
**File:** `sign.service.ts` Line 150-158  
Fungsi `ensureEnvelopeIsSignable` hanya cek status envelope, **tidak cek role recipient**. Artinya, jika `viewer` punya access_token (yang mereka miliki), mereka bisa call endpoint `POST /sign/:token/complete` dan "menandatangani" dokumen.

**Fix:**
```typescript
function ensureEnvelopeIsSignable(row: DbSigningSessionRow): void {
  // ... cek status existing ...
  
  // TAMBAHKAN:
  if (row.recipient_role !== 'signer') {
    throw new ApiError(403, 'Hanya signer yang dapat menyelesaikan proses penandatanganan.');
  }
}
```

---

## Seksi 4 — Backend Verification Service (KRITIS)

**File:** `backend/src/services/verification.service.ts`

### 🔴 GAP-10: KYC Auto-Verified Tanpa AI — Security Bypass Parah
```typescript
// Line 137-149 — uploadVerificationFile langsung set status = 'verified'!
export async function uploadVerificationFile(input) {
  const record = await createVerificationRecord({
    ...
    status: "verified",  // <-- LANGSUNG VERIFIED! Tanpa OCR, tanpa liveness, tanpa validasi apapun
    resultData: { source: "file_upload" }
  });
}
```
**Ini sangat berbahaya untuk platform legal e-signature.**  
User cukup upload foto apapun (bahkan foto kucing) dan langsung mendapat `kyc_status = 'verified'`. Semua enforcement hukum e-signature di Indonesia (Permenkominfo No. 11 Tahun 2022) mensyaratkan verifikasi identitas yang nyata.

**Fix Minimum:**
```typescript
// Upload file → status 'pending', bukan 'verified'
// Perlu admin review atau integrasi vendor KYC (Verihubs, Privy, dll.)
status: "pending",  // Bukan 'verified'
```

---

## Seksi 5 — Backend Email Service

**File:** `backend/src/services/email.service.ts`

### ⚠️ GAP-11: Template Email Rentan XSS via Interpolasi Langsung
```html
<!-- Line 44-48 — Tidak ada HTML escaping! -->
<p>Halo ${input.recipientName},</p>
<strong>${input.envelopeTitle}</strong>
```
Jika `recipientName` atau `envelopeTitle` mengandung `<script>alert(1)</script>`, ini akan dikirim langsung ke email penerima. Untuk klien email yang render HTML, ini adalah XSS.

**Fix:** Escape karakter HTML sebelum interpolasi:
```typescript
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

### ⚠️ GAP-12: Tidak Ada Email Password Reset
`requestPasswordReset` di `auth.service.ts` TIDAK mengirim email — hanya menyimpan token di cache dan mengembalikan token di response (di non-production). Di production, user **tidak akan pernah menerima email reset password**.

---

## Seksi 6 — Backend Security

### ⚠️ GAP-13: Rate Limit Terlalu Longgar untuk Auth Endpoints
**File:** `backend/src/middleware/rateLimiter.middleware.ts`  
Rate limiter `apiRateLimiter` diaplikasikan secara global: 200 requests per 15 menit. Ini **terlalu longgar** untuk endpoint sensitif seperti `/api/auth/login`.

Seorang attacker bisa mencoba 200 password berbeda dalam 15 menit per-IP untuk brute force attack.

**Fix:** Tambah rate limiter khusus untuk auth:
```typescript
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Hanya 10 login attempt per 15 menit
  message: 'Terlalu banyak percobaan login. Coba lagi nanti.'
});
```
Dan aplikasikan di `auth.routes.ts`:
```typescript
router.post("/login", authRateLimiter, async (req, res, next) => { ... });
router.post("/forgot-password", authRateLimiter, ...);
```

### ⚠️ GAP-14: Upload File Disajikan Tanpa Auth (`/uploads`)
**File:** `backend/src/index.ts` Line 45
```typescript
app.use("/uploads", express.static(env.UPLOAD_DIR));
```
Siapapun yang tahu path file bisa mengakses dokumen legal yang diupload tanpa autentikasi apapun. Untuk platform e-signature dengan dokumen sensitif (KTP, kontrak, dll.), ini adalah vulnerability serius.

**Fix:** Buat route authenticated untuk serve file:
```typescript
app.get("/api/files/:filepath(*)", authMiddleware, async (req, res) => {
  // Verifikasi user punya akses ke file ini, baru serve
});
```

---

## Seksi 7 — Backend RBAC Middleware

**File:** `backend/src/middleware/rbac.middleware.ts`

### ⚠️ GAP-15: Auto-Create Org dengan Plan 'enterprise' untuk Semua User
```typescript
// Line 60-64 — Setiap user personal yang pertama kali akses RBAC langsung dapat org enterprise!
await client.query(
  `INSERT INTO organizations (id, name, plan) VALUES ($1, $2, 'enterprise')`,
  [orgId, `Org ${user.full_name}`]
);
```
Ini sama dengan memberi semua user plan enterprise gratis. Selain itu, behavior ini berjalan **silently** setiap kali user mengakses endpoint yang pakai `requireOrgRoles`. Logic bisnis ini perlu di-review ulang — seharusnya personal user tidak otomatis dapat enterprise org.

---

## Seksi 8 — Frontend: Public Sign Page

**File:** `frontend/app/src/app/sign/[token]/page.tsx`

### ⚠️ GAP-16: Nilai Signature Dikirim Sebagai Teks Label, Bukan Data Aktual
```typescript
// Line 242 — Saat signature dibuat, valuenya hanya label string:
const label = payload.type === "type" ? payload.value : `Signed (${payload.type})`;
updateFieldValue(targetSignatureFieldId, label);
```
Ketika user "menandatangani" dengan metode `draw` (gambar), nilai yang dikirim ke backend adalah string literal `"Signed (draw)"` — bukan gambar SVG/PNG signature aktual. Ini berarti **tidak ada data signature nyata yang disimpan di database** untuk draw/upload type.

**Fix:** Kirim `signaturePayload.value` (yang berisi SVG data atau base64 image) sebagai value field, bukan label.

### ⚠️ GAP-17: Tidak Ada PDF Viewer untuk Dokumen yang Ditandatangani
User di halaman signing tidak bisa melihat dokumen yang mereka tandatangani. UX ini tidak acceptale untuk production — signer harus bisa membaca dokumen sebelum menandatangani (ini juga persyaratan hukum).

---

## Seksi 9 — Frontend: API Client

**File:** `frontend/app/src/lib/api.ts`

### ⚠️ GAP-18: Race Condition saat Multiple Request Gagal 401 Bersamaan
```typescript
// Jika 3 request gagal 401 secara bersamaan, semua akan mencoba refresh token
// Ini akan menghasilkan 3 refresh calls, yang pertama berhasil, 2 sisanya gagal
// karena token rotation sudah terjadi
```
**Fix:** Implementasi "refresh mutex":
```typescript
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];
```

---

## Seksi 10 — Frontend: Send Flow

**File:** `frontend/app/src/app/(dashboard)/dashboard/send/page.tsx`

### ⚠️ GAP-19: Field Builder Tidak Draggable — UX Tidak Bisa Dipakai
```typescript
// Line 374-388 — Field ditempatkan dengan posisi hardcoded berdasarkan index
positionX: 10 + ((index * 11) % 70),
positionY: 12 + ((index * 13) % 70),
```
User tidak bisa drag-and-drop field ke posisi yang mereka inginkan. Semua field ditempatkan secara otomatis di posisi yang mungkin overlap atau tidak sesuai dokumen. Untuk platform e-signature yang kompetitif, ini adalah **blocker utama**.

### ⚠️ GAP-20: Error di `handleProceedToBuilder` Tidak Menghapus File yang Terupload
```typescript
// Line 130-156 — Jika createEnvelope gagal, dokumen sudah terupload ke server
// tapi tidak ada cleanup. File menjadi orphan di disk.
} catch {
  setErrorMessage("Gagal membuat draft pengiriman dokumen.");
  // File yang sudah diupload tidak dihapus!
}
```

---

## Ringkasan Gap & Prioritas

| # | Gap | Severity | File | Status |
|---|---|---|---|---|
| GAP-1 | Index sessions.refresh_token | 🟡 Medium | migration SQL | Perlu fix |
| GAP-2 | Tidak ada updated_at di envelopes | 🟡 Medium | migration SQL | Perlu fix |
| GAP-3 | sendEnvelope tanpa cek status draft | 🔴 Critical | envelope.service.ts:636 | Perlu fix |
| GAP-4 | voidEnvelope void completed envelope | 🔴 Critical | envelope.service.ts:764 | Perlu fix |
| GAP-5 | Audit log label salah ('viewed') | 🟡 Medium | envelope.service.ts:548,619 | Perlu fix |
| GAP-6 | replaceFields tidak cek status | 🟡 Medium | envelope.service.ts:553 | Perlu fix |
| GAP-7 | Signed PDF overwrite original | 🔴 Critical | sign.service.ts:497 | Perlu fix |
| GAP-8 | Tidak ada file cleanup | 🟡 Medium | sign.service.ts:464 | Perlu fix |
| GAP-9 | Viewer bisa complete signing | 🔴 Critical | sign.service.ts:150 | Perlu fix |
| GAP-10 | KYC auto-verified tanpa validasi | 🔴 KRITIS | verification.service.ts:141 | Perlu fix |
| GAP-11 | Email template XSS | 🟡 Medium | email.service.ts:44 | Perlu fix |
| GAP-12 | Password reset tidak kirim email | 🔴 Critical | auth.service.ts:387 | Perlu fix |
| GAP-13 | Rate limit login terlalu longgar | 🟡 Medium | rateLimiter.middleware.ts | Perlu fix |
| GAP-14 | /uploads publik tanpa auth | 🔴 Critical | index.ts:45 | Perlu fix |
| GAP-15 | Auto-create enterprise org | 🟡 Medium | rbac.middleware.ts:61 | Perlu review |
| GAP-16 | Signature value tidak tersimpan | 🔴 Critical | sign/[token]/page.tsx:242 | Perlu fix |
| GAP-17 | Tidak ada PDF viewer di sign page | 🟡 Medium | sign/[token]/page.tsx | Perlu fix |
| GAP-18 | Race condition token refresh | 🟡 Medium | api.ts | Perlu fix |
| GAP-19 | Field builder tidak draggable | 🟡 Medium | send/page.tsx:374 | Perlu fix |
| GAP-20 | Orphan file saat envelope create gagal | 🟡 Medium | send/page.tsx:152 | Perlu fix |

---

## Prioritas Fix untuk Go-Live

### Phase 1 (Blocker — Harus fix sebelum production):
1. **GAP-10** — KYC auto-verified: ubah ke `pending`, tambah admin review
2. **GAP-7** — Signed PDF overwrite original: refactor storage strategy
3. **GAP-9** — Viewer bisa complete signing: tambah role check
4. **GAP-3** — sendEnvelope tanpa status check: tambah guard
5. **GAP-4** — voidEnvelope tanpa status check: tambah guard
6. **GAP-14** — /uploads publik: implement authenticated file serving
7. **GAP-16** — Signature value tidak tersimpan: fix data serialization
8. **GAP-12** — Password reset tidak kirim email: implementasi SMTP flow

### Phase 2 (Important — Fix sebelum soft launch):
9. **GAP-13** — Rate limit auth endpoints
10. **GAP-6** — Protect field editor dari envelope non-draft
11. **GAP-19** — Field builder draggable
12. **GAP-18** — Refresh token race condition

### Phase 3 (Enhancement):
13. **GAP-1, GAP-2** — DB indexes & schema improvements
14. **GAP-5** — Audit log labels
15. **GAP-11** — HTML escaping di email
16. **GAP-17** — PDF viewer
17. **GAP-20** — Orphan file cleanup
