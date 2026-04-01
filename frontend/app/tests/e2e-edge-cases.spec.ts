import { expect, request, test, type APIRequestContext } from "@playwright/test";

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
0000000248 00000 n 
0000000352 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
422
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

async function uploadDocumentId(api: APIRequestContext, accessToken: string, suffix: string): Promise<string> {
  const uploadResponse = await api.post(`${API_BASE_URL}/api/documents/upload`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    multipart: {
      title: `Edge Doc ${suffix}`,
      description: "Edge case validation",
      file: {
        name: `edge-${suffix}.pdf`,
        mimeType: "application/pdf",
        buffer: makePdfBuffer(`Edge ${suffix}`)
      }
    }
  });

  expect(uploadResponse.status()).toBe(201);
  const uploadPayload = (await uploadResponse.json()) as {
    data: {
      id: string;
    };
  };

  return uploadPayload.data.id;
}

async function createEnvelopeWithSigner(api: APIRequestContext, accessToken: string, input: {
  documentId: string;
  suffix: string;
  signerEmail: string;
  signerName: string;
}): Promise<{
  envelopeId: string;
  recipientId: string;
  publicToken: string;
}> {
  const createEnvelopeResponse = await api.post(`${API_BASE_URL}/api/envelopes`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    data: {
      documentId: input.documentId,
      title: `Edge Envelope ${input.suffix}`,
      message: "Edge checks",
      sequentialSigning: true,
      recipients: [
        {
          email: input.signerEmail,
          name: input.signerName,
          role: "signer",
          signingOrder: 1
        }
      ]
    }
  });

  expect(createEnvelopeResponse.status()).toBe(201);

  const payload = (await createEnvelopeResponse.json()) as {
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

  const envelopeId = payload.data.envelope.id;
  const recipientId = payload.data.recipients[0]?.id;
  const publicToken = payload.data.recipients[0]?.accessToken;

  expect(typeof envelopeId).toBe("string");
  expect(typeof recipientId).toBe("string");
  expect(typeof publicToken).toBe("string");

  return {
    envelopeId,
    recipientId: recipientId as string,
    publicToken: publicToken as string
  };
}

async function fetchDocumentStatus(api: APIRequestContext, accessToken: string, documentId: string): Promise<string> {
  const response = await api.get(`${API_BASE_URL}/api/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  expect(response.status()).toBe(200);

  const payload = (await response.json()) as {
    data: {
      status: string;
    };
  };

  return payload.data.status;
}

test.describe.serial("API edge-case protections", () => {
  let api: APIRequestContext;
  let accessToken: string;
  let ownerEmail: string;
  let ownerPassword: string;

  test.beforeAll(async () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    ownerEmail = `edge.owner.${suffix}@example.com`;
    ownerPassword = `Edge!${suffix}`;

    api = await request.newContext();

    await registerUser(api, {
      fullName: "Edge Owner",
      email: ownerEmail,
      phone: `0888${suffix.slice(-8)}`,
      password: ownerPassword
    });

    accessToken = await loginAccessToken(api, ownerEmail, ownerPassword);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("rejects sending envelope with no fields and keeps document status uploaded", async () => {
    const suffix = `${Date.now()}-nofields`;
    const documentId = await uploadDocumentId(api, accessToken, suffix);
    const envelope = await createEnvelopeWithSigner(api, accessToken, {
      documentId,
      suffix,
      signerEmail: `edge.signer.${suffix}@example.com`,
      signerName: "Edge Signer"
    });

    const sendResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelope.envelopeId}/send`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    expect(sendResponse.status()).toBe(400);
    const sendPayload = (await sendResponse.json()) as { message?: string };
    expect(sendPayload.message ?? "").toContain("Tambahkan minimal satu field");

    const documentStatus = await fetchDocumentStatus(api, accessToken, documentId);
    expect(documentStatus).toBe("uploaded");
  });

  test("rejects sending envelope when fields contain no signature or initial", async () => {
    const suffix = `${Date.now()}-nosignature`;
    const documentId = await uploadDocumentId(api, accessToken, suffix);
    const envelope = await createEnvelopeWithSigner(api, accessToken, {
      documentId,
      suffix,
      signerEmail: `edge.signer.${suffix}@example.com`,
      signerName: "Edge Signer"
    });

    const saveFieldsResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelope.envelopeId}/fields`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      data: {
        fields: [
          {
            recipientId: envelope.recipientId,
            fieldType: "text",
            pageNumber: 1,
            positionX: 20,
            positionY: 20,
            width: 40,
            height: 10,
            required: true
          }
        ]
      }
    });

    expect(saveFieldsResponse.status()).toBe(200);

    const sendResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelope.envelopeId}/send`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    expect(sendResponse.status()).toBe(400);
    const sendPayload = (await sendResponse.json()) as { message?: string };
    expect(sendPayload.message ?? "").toContain("signature atau initial");
  });

  test("rejects signing completion when required field is missing in payload", async () => {
    const suffix = `${Date.now()}-missingrequired`;
    const documentId = await uploadDocumentId(api, accessToken, suffix);
    const envelope = await createEnvelopeWithSigner(api, accessToken, {
      documentId,
      suffix,
      signerEmail: `edge.signer.${suffix}@example.com`,
      signerName: "Edge Signer"
    });

    const saveFieldsResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelope.envelopeId}/fields`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      data: {
        fields: [
          {
            recipientId: envelope.recipientId,
            fieldType: "signature",
            pageNumber: 1,
            positionX: 18,
            positionY: 28,
            width: 35,
            height: 12,
            required: true
          },
          {
            recipientId: envelope.recipientId,
            fieldType: "text",
            pageNumber: 1,
            positionX: 18,
            positionY: 45,
            width: 35,
            height: 12,
            required: true
          }
        ]
      }
    });

    expect(saveFieldsResponse.status()).toBe(200);

    const sendResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelope.envelopeId}/send`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    expect(sendResponse.status()).toBe(200);

    const sessionResponse = await api.get(`${API_BASE_URL}/api/sign/${envelope.publicToken}`);
    expect(sessionResponse.status()).toBe(200);

    const sessionPayload = (await sessionResponse.json()) as {
      data: {
        fields: Array<{
          id: string;
          fieldType: string;
        }>;
      };
    };

    const signatureField = sessionPayload.data.fields.find((field) => field.fieldType === "signature");
    expect(signatureField).toBeDefined();

    const completeResponse = await api.post(`${API_BASE_URL}/api/sign/${envelope.publicToken}/complete`, {
      data: {
        fields: [
          {
            fieldId: signatureField?.id,
            value: "Edge Signature"
          }
        ],
        signature: {
          type: "type",
          value: "Edge Signature"
        }
      }
    });

    expect(completeResponse.status()).toBe(400);
    const completePayload = (await completeResponse.json()) as { message?: string };
    expect(completePayload.message ?? "").toContain("wajib diisi");
  });

  test("rejects signing completion when payload contains duplicate field IDs", async () => {
    const suffix = `${Date.now()}-duplicatefield`;
    const documentId = await uploadDocumentId(api, accessToken, suffix);
    const envelope = await createEnvelopeWithSigner(api, accessToken, {
      documentId,
      suffix,
      signerEmail: `edge.signer.${suffix}@example.com`,
      signerName: "Edge Signer"
    });

    const saveFieldsResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelope.envelopeId}/fields`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      data: {
        fields: [
          {
            recipientId: envelope.recipientId,
            fieldType: "signature",
            pageNumber: 1,
            positionX: 18,
            positionY: 28,
            width: 35,
            height: 12,
            required: true
          }
        ]
      }
    });

    expect(saveFieldsResponse.status()).toBe(200);

    const sendResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelope.envelopeId}/send`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    expect(sendResponse.status()).toBe(200);

    const sessionResponse = await api.get(`${API_BASE_URL}/api/sign/${envelope.publicToken}`);
    expect(sessionResponse.status()).toBe(200);

    const sessionPayload = (await sessionResponse.json()) as {
      data: {
        fields: Array<{
          id: string;
          fieldType: string;
        }>;
      };
    };

    const signatureField = sessionPayload.data.fields.find((field) => field.fieldType === "signature");
    expect(signatureField).toBeDefined();

    const completeResponse = await api.post(`${API_BASE_URL}/api/sign/${envelope.publicToken}/complete`, {
      data: {
        fields: [
          {
            fieldId: signatureField?.id,
            value: "Edge Signature A"
          },
          {
            fieldId: signatureField?.id,
            value: "Edge Signature B"
          }
        ],
        signature: {
          type: "type",
          value: "Edge Signature"
        }
      }
    });

    expect(completeResponse.status()).toBe(400);
    const completePayload = (await completeResponse.json()) as { message?: string };
    expect(completePayload.message ?? "").toContain("lebih dari satu kali");
  });

  test("keeps document status synchronized when envelope is sent then voided", async () => {
    const suffix = `${Date.now()}-statussync`;
    const documentId = await uploadDocumentId(api, accessToken, suffix);
    const envelope = await createEnvelopeWithSigner(api, accessToken, {
      documentId,
      suffix,
      signerEmail: `edge.signer.${suffix}@example.com`,
      signerName: "Edge Signer"
    });

    const saveFieldsResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelope.envelopeId}/fields`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      data: {
        fields: [
          {
            recipientId: envelope.recipientId,
            fieldType: "signature",
            pageNumber: 1,
            positionX: 18,
            positionY: 28,
            width: 35,
            height: 12,
            required: true
          }
        ]
      }
    });

    expect(saveFieldsResponse.status()).toBe(200);

    const sendResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelope.envelopeId}/send`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    expect(sendResponse.status()).toBe(200);

    const sentDocumentStatus = await fetchDocumentStatus(api, accessToken, documentId);
    expect(sentDocumentStatus).toBe("processing");

    const voidResponse = await api.post(`${API_BASE_URL}/api/envelopes/${envelope.envelopeId}/void`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    expect(voidResponse.status()).toBe(200);

    const voidedDocumentStatus = await fetchDocumentStatus(api, accessToken, documentId);
    expect(voidedDocumentStatus).toBe("uploaded");
  });
});