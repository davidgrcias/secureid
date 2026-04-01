import { apiClient } from "@/lib/api";

export type VerificationType = "ktp_photo" | "selfie" | "liveness";
export type VerificationStatus = "pending" | "processing" | "verified" | "failed";

export type VerificationRecord = {
  id: string;
  userId: string;
  type: VerificationType;
  filePath: string | null;
  status: VerificationStatus;
  resultData: Record<string, unknown>;
  failureReason: string | null;
  createdAt: string;
};

export type VerificationOverview = {
  latestByType: Partial<Record<VerificationType, VerificationRecord>>;
  records: VerificationRecord[];
  kycStatus: "unverified" | "pending" | "verified" | "rejected";
};

export async function getVerificationOverview(): Promise<VerificationOverview> {
  const response = await apiClient.get<{ data: VerificationOverview }>("/api/verifications");
  return response.data.data;
}

export async function uploadVerificationFile(input: {
  type: "ktp_photo" | "selfie";
  file: File;
  side?: "front" | "back";
}): Promise<VerificationRecord> {
  const formData = new FormData();
  formData.append("type", input.type);
  formData.append("file", input.file);

  if (input.side) {
    formData.append("side", input.side);
  }

  const response = await apiClient.post<{ data: VerificationRecord }>("/api/verifications/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return response.data.data;
}

export async function submitLivenessVerification(input: {
  passed: boolean;
  steps: string[];
  score?: number;
}): Promise<VerificationRecord> {
  const response = await apiClient.post<{ data: VerificationRecord }>("/api/verifications/liveness", input);
  return response.data.data;
}
