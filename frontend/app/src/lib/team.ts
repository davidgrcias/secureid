import { apiClient } from "./api";

export type TeamMember = {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string;
  email: string;
  fullName: string;
};

type ApiResponse<T> = {
  message?: string;
  data: T;
};

export async function listTeamMembers(): Promise<TeamMember[]> {
  const response = await apiClient.get<ApiResponse<TeamMember[]>>("/api/team");
  return response.data.data;
}

export async function inviteTeamMember(input: { email: string; role: "admin" | "signer" | "viewer" }): Promise<TeamMember> {
  const response = await apiClient.post<ApiResponse<TeamMember>>("/api/team/invite", input);
  return response.data.data;
}

export async function updateTeamMemberRole(
  memberId: string,
  role: "owner" | "admin" | "signer" | "viewer"
): Promise<TeamMember> {
  const response = await apiClient.patch<ApiResponse<TeamMember>>(`/api/team/members/${memberId}/role`, {
    role
  });

  return response.data.data;
}
