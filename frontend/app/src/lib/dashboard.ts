import { apiClient } from "@/lib/api";

export type DashboardSummary = {
  user: {
    fullName: string;
    role: string;
    plan: string;
  };
  stats: {
    totalDocuments: number;
    totalEnvelopes: number;
    pendingSignatureRequests: number;
    myPendingActions: number;
    weeklyDocumentChangePercent: number;
  };
  recentActivities: Array<{
    envelopeId: string;
    documentTitle: string;
    signerName: string | null;
    status: string;
    createdAt: string;
  }>;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiClient.get<{ data: DashboardSummary }>("/api/dashboard/summary");
  return response.data.data;
}
