import { apiClient } from "./api";

export type WorkflowDocument = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  originalFilename: string;
  filePath: string;
  createdAt: string;
};

export type EnvelopeRecipientInput = {
  email: string;
  name: string;
  role?: "signer" | "viewer" | "approver";
  signingOrder?: number;
};

export type EnvelopeFieldInput = {
  recipientId?: string;
  fieldType: "signature" | "initial" | "date" | "text" | "checkbox";
  pageNumber: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  required?: boolean;
  value?: string;
};

type ApiResponse<T> = {
  message?: string;
  data: T;
};

export async function uploadDocument(input: {
  file: File;
  title: string;
  description?: string;
}): Promise<WorkflowDocument> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("title", input.title);
  if (input.description) {
    formData.append("description", input.description);
  }

  const response = await apiClient.post<ApiResponse<WorkflowDocument>>("/api/documents/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return response.data.data;
}

export async function listDocuments(): Promise<WorkflowDocument[]> {
  const response = await apiClient.get<ApiResponse<{ items: WorkflowDocument[]; total: number }>>("/api/documents", {
    params: {
      page: 1,
      limit: 50
    }
  });

  return response.data.data.items;
}

export async function createEnvelope(input: {
  documentId: string;
  title: string;
  message?: string;
  sequentialSigning?: boolean;
  autoReminder?: boolean;
  recipients: EnvelopeRecipientInput[];
}): Promise<{
  envelope: {
    id: string;
    status: string;
    title: string;
  };
  recipients: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
  }>;
}> {
  const response = await apiClient.post<
    ApiResponse<{
      envelope: { id: string; status: string; title: string };
      recipients: Array<{ id: string; email: string; name: string; role: string }>;
    }>
  >("/api/envelopes", input);

  return response.data.data;
}

export async function saveEnvelopeFields(envelopeId: string, fields: EnvelopeFieldInput[]): Promise<void> {
  await apiClient.post(`/api/envelopes/${envelopeId}/fields`, {
    fields
  });
}

export async function sendEnvelope(envelopeId: string): Promise<void> {
  await apiClient.post(`/api/envelopes/${envelopeId}/send`);
}
