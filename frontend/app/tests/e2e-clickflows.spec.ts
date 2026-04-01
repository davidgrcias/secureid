import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

const WEB_BASE_URL = "http://localhost:3000";
const API_BASE_URL = "http://localhost:3001";

function makePdfBuffer(content: string): Buffer {
  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 54 >>
stream
BT /F1 12 Tf 30 120 Td (${content}) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000062 00000 n 
0000000121 00000 n 
0000000247 00000 n 
0000000351 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
421
%%EOF`);
}

async function registerUser(api: APIRequestContext, input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<void> {
  const response = await api.post(`${API_BASE_URL}/api/auth/register`, {
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      password: input.password
    }
  });

  expect(response.status()).toBe(201);
}

async function loginAccessToken(api: APIRequestContext, identifier: string, password: string): Promise<string> {
  const response = await api.post(`${API_BASE_URL}/api/auth/login`, {
    data: {
      identifier,
      password
    }
  });

  expect(response.status()).toBe(200);
  const payload = (await response.json()) as {
    data: {
      tokens: {
        accessToken: string;
      };
    };
  };

  return payload.data.tokens.accessToken;
}

async function createPublicSigningToken(api: APIRequestContext, accessToken: string, recipientEmail: string, suffix: string): Promise<string> {
  const uploadResponse = await api.post(`${API_BASE_URL}/api/documents/upload`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    multipart: {
      title: `E2E Sign ${suffix}`,
      description: "E2E public signing flow",
      file: {
        name: `sign-${suffix}.pdf`,
        mimeType: "application/pdf",
        buffer: makePdfBuffer(`Sign Flow ${suffix}`)
      }
    }
  });

  expect(uploadResponse.status()).toBe(201);
  const uploadPayload = (await uploadResponse.json()) as {
    data: {
      id: string;
    };
  };

  const createEnvelopeResponse = await api.post(`${API_BASE_URL}/api/envelopes`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    data: {
      documentId: uploadPayload.data.id,
      title: `Sign Envelope ${suffix}`,
      message: "Please sign",
      sequentialSigning: true,
      recipients: [
        {
          email: recipientEmail,
          name: "External Signer",
          role: "signer",
          signingOrder: 1
        }
      ]
    }
  });

  expect(createEnvelopeResponse.status()).toBe(201);
  const envelopePayload = (await createEnvelopeResponse.json()) as {
    data: {
      envelope: {
        id: string;
      };
      recipients: Array<{
        id: string;
        accessToken: string;
      }>;
    };
  };

  const envelopeId = envelopePayload.data.envelope.id;
  const recipientId = envelopePayload.data.recipients[0]?.id;
  const publicToken = envelopePayload.data.recipients[0]?.accessToken;

  expect(typeof envelopeId).toBe("string");
  expect(typeof recipientId).toBe("string");
  expect(typeof publicToken).toBe("string");

  const fieldsResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelopeId}/fields`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    data: {
      fields: [
        {
          recipientId,
          fieldType: "signature",
          pageNumber: 1,
          positionX: 18,
          positionY: 30,
          width: 35,
          height: 12,
          required: true
        }
      ]
    }
  });

  expect(fieldsResponse.status()).toBe(200);

  const sendResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelopeId}/send`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  expect(sendResponse.status()).toBe(200);

  return publicToken as string;
}

async function loginFromUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${WEB_BASE_URL}/login`);
  await page.getByPlaceholder("contoh@email.com").fill(email);
  await page.getByPlaceholder("Minimal 8 karakter").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("all major click actions work across public, dashboard, verify, and signing flows", async ({ page }) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const ownerEmail = `owner.${suffix}@example.com`;
  const inviteEmail = `invite.${suffix}@example.com`;
  const externalSignerEmail = `external.${suffix}@example.com`;
  const ownerPassword = `Owner!${suffix}`;

  const api = await request.newContext();
  await registerUser(api, {
    fullName: "Invite User",
    email: inviteEmail,
    phone: `0814${suffix.slice(-8)}`,
    password: `Invite!${suffix}`
  });

  await page.goto(`${WEB_BASE_URL}/`);
  await page.getByRole("link", { name: "Lihat Paket" }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await page.goto(`${WEB_BASE_URL}/`);
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByRole("link", { name: "Masuk Dashboard" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(`${WEB_BASE_URL}/register`);
  await page.getByPlaceholder("Contoh: Budi Santoso").fill("Owner QA");
  await page.getByPlaceholder("budi@kantor.com").fill(ownerEmail);
  await page.getByPlaceholder("08xxxxxxxxxx").fill(`0815${suffix.slice(-8)}`);
  await page.getByPlaceholder("Minimal 8 karakter").fill(ownerPassword);
  await page.getByPlaceholder("Ulangi kata sandi").fill(ownerPassword);
  await page.getByRole("button", { name: "Daftar & Lanjut Verifikasi" }).click();
  await expect(page).toHaveURL(/\/dashboard\/verify$/);

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await loginFromUi(page, ownerEmail, ownerPassword);

  await page.getByRole("link", { name: "Mulai Tanda Tangan" }).click();
  await expect(page).toHaveURL(/\/dashboard\/send$/);

  await page.getByPlaceholder("Perjanjian Kerjasama Vendor Q4").fill(`QA Workflow ${suffix}`);
  await page.getByPlaceholder("Tambahkan catatan singkat untuk para penandatangan.").fill("Automated click-flow test");
  await page.getByPlaceholder("Nama lengkap").first().fill("Owner QA");
  await page.getByPlaceholder("Email").first().fill(ownerEmail);

  const uploadInput = page.locator('input[type="file"][accept*=".pdf"]');
  await uploadInput.setInputFiles({
    name: `workflow-${suffix}.pdf`,
    mimeType: "application/pdf",
    buffer: makePdfBuffer(`Workflow ${suffix}`)
  });

  await page.getByRole("button", { name: "Lanjut ke Builder Field" }).click();
  await expect(page.getByText("Annotation Studio")).toBeVisible();
  await page.getByRole("button", { name: "Tanda Tangan" }).click();
  await page.getByRole("button", { name: "Review Sebelum Kirim" }).click();
  await expect(page.getByRole("heading", { name: "Review Sebelum Kirim" })).toBeVisible();
  await page.getByRole("button", { name: "Kirim untuk Ditandatangani" }).click();
  await expect(page.getByText("Dokumen berhasil dikirim ke seluruh penerima.")).toBeVisible();

  await page.getByRole("link", { name: "Dokumen Saya" }).click();
  await expect(page).toHaveURL(/\/dashboard\/documents$/);
  await page.getByRole("link", { name: "Kirim Dokumen Baru" }).click();
  await expect(page).toHaveURL(/\/dashboard\/send$/);

  await page.getByRole("link", { name: "Team Management" }).click();
  await expect(page).toHaveURL(/\/dashboard\/team$/);
  await page.getByPlaceholder("email@company.com").fill(inviteEmail);
  await page.locator("article").filter({ hasText: "Undang Anggota Baru" }).locator("select").selectOption("viewer");
  await page.getByRole("button", { name: "Undang" }).click();
  await expect(page.getByText("Anggota tim berhasil ditambahkan.")).toBeVisible();

  const invitedRoleSelect = page.locator(`tr:has-text("${inviteEmail}") select`).first();
  await invitedRoleSelect.selectOption("signer");
  await expect(page.getByText("Role anggota berhasil diperbarui.")).toBeVisible();

  await page.getByRole("link", { name: "Profil" }).click();
  await expect(page).toHaveURL(/\/dashboard\/settings$/);
  await page.getByRole("button", { name: "Dark Mode" }).click();
  await page.getByRole("button", { name: "Light Mode" }).click();
  await page.getByPlaceholder("Nomor telepon").fill(`0899${suffix.slice(-8)}`);
  await page.getByRole("button", { name: "Simpan Perubahan" }).click();
  await expect(page.getByText(/Profil berhasil diperbarui/i)).toBeVisible();

  await page.getByRole("link", { name: "Verifikasi Identitas" }).click();
  await expect(page).toHaveURL(/\/dashboard\/verify$/);

  const imagePayload = {
    name: `face-${suffix}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9W4lQAAAAASUVORK5CYII=",
      "base64"
    )
  };

  const imageInputs = page.locator('input[type="file"][accept="image/*"]');
  await imageInputs.nth(0).setInputFiles(imagePayload);
  await imageInputs.nth(1).setInputFiles({ ...imagePayload, name: `ktp-back-${suffix}.png` });
  await imageInputs.nth(2).setInputFiles({ ...imagePayload, name: `selfie-${suffix}.png` });
  await expect(page.getByText("File verifikasi berhasil disimpan.")).toBeVisible({ timeout: 30000 });

  await page.getByRole("button", { name: "Buka Kamera Selfie" }).click();
  const selfieModal = page.locator("div").filter({ hasText: "Ambil Selfie Sekarang" }).first();
  await expect(selfieModal).toBeVisible();
  await selfieModal.getByRole("button", { name: "Batal" }).click();
  await expect(page.locator("div").filter({ hasText: "Ambil Selfie Sekarang" })).toHaveCount(0);

  await page.getByRole("button", { name: "Mulai Liveness Check" }).click();
  const livenessModal = page.locator("div").filter({ hasText: "Liveness Face Check" }).first();
  await expect(livenessModal).toBeVisible();
  await page.getByRole("button", { name: "Tutup liveness" }).click();
  await expect(page.locator("div").filter({ hasText: "Liveness Face Check" })).toHaveCount(0);

  await page.getByRole("button", { name: "Notifikasi" }).click();
  await expect(page.getByText("Notifikasi")).toBeVisible();
  await page.getByRole("button", { name: "Tandai semua dibaca" }).click();
  await page.getByRole("button", { name: "Notifikasi" }).click();

  const ownerAccessToken = await loginAccessToken(api, ownerEmail, ownerPassword);
  const publicSignToken = await createPublicSigningToken(api, ownerAccessToken, externalSignerEmail, suffix);

  await page.goto(`${WEB_BASE_URL}/sign/${publicSignToken}`);
  await expect(page.getByRole("heading", { name: "Tanda Tangan Dokumen" })).toBeVisible();
  await page.getByRole("button", { name: "Buat Signature" }).first().click();

  const signatureModal = page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: "Buat Signature" }) })
    .first();
  await expect(signatureModal).toBeVisible();
  await signatureModal.getByRole("button", { name: "Type", exact: true }).click();
  await signatureModal.getByPlaceholder("Ketik nama untuk signature").fill("QA Signature");
  await signatureModal.getByRole("button", { name: "Gunakan Signature" }).click();

  await page.getByRole("button", { name: "Selesaikan Tanda Tangan" }).click();
  await expect(page.getByText(/Dokumen berhasil ditandatangani/i)).toBeVisible({ timeout: 30000 });

  await api.dispose();
});
