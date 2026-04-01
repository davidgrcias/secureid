import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const publicSigningClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

export type SigningSession = {
  envelope: {
    id: string;
    title: string;
    message: string | null;
    status: string;
    sequentialSigning: boolean;
    expiresAt: string | null;
  };
  document: {
    id: string;
    title: string;
    originalFilename: string;
  };
  recipient: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    signingOrder: number;
  };
  fields: Array<{
    id: string;
    recipientId: string | null;
    fieldType: "signature" | "initial" | "date" | "text" | "checkbox";
    pageNumber: number;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    required: boolean;
    value: string | null;
  }>;
};

type ApiResponse<T> = {
  message?: string;
  data: T;
};

export async function getSigningSession(token: string): Promise<SigningSession> {
  const response = await publicSigningClient.get<ApiResponse<SigningSession>>(`/api/sign/${token}`);
  return response.data.data;
}

export async function getSigningDocumentBlob(token: string): Promise<Blob> {
  const response = await publicSigningClient.get<Blob>(`/api/sign/${token}/document`, {
    responseType: "blob"
  });

  return response.data;
}

export async function completeSigning(
  token: string,
  payload: {
    fields: Array<{ fieldId: string; value?: string }>;
    signature?: {
      type: "draw" | "type" | "upload";
      value: string;
      fontFamily?: string;
    };
  }
): Promise<{ envelopeId: string; envelopeStatus: string; completed: boolean }> {
  const response = await publicSigningClient.post<
    ApiResponse<{ envelopeId: string; envelopeStatus: string; completed: boolean }>
  >(`/api/sign/${token}/complete`, payload);

  return response.data.data;
}
