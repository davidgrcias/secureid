"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, UserPlus2 } from "lucide-react";
import { inviteTeamMember, listTeamMembers, updateTeamMemberRole, type TeamMember } from "@/lib/team";

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "signer" | "viewer">("signer");
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadMembers(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const items = await listTeamMembers();
      setMembers(items);
    } catch {
      setErrorMessage("Gagal memuat anggota tim. Pastikan akun Anda memiliki akses organisasi.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  async function handleInvite(): Promise<void> {
    if (!email.trim()) {
      setErrorMessage("Email anggota wajib diisi.");
      return;
    }

    try {
      setIsInviting(true);
      setErrorMessage(null);
      setMessage(null);

      const member = await inviteTeamMember({
        email: email.trim(),
        role
      });

      setMembers((current) => {
        const withoutMember = current.filter((item) => item.id !== member.id);
        return [...withoutMember, member].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
      });

      setEmail("");
      setMessage("Anggota tim berhasil ditambahkan.");
    } catch {
      setErrorMessage("Gagal mengundang anggota tim. Pastikan email sudah terdaftar.");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, nextRole: "owner" | "admin" | "signer" | "viewer"): Promise<void> {
    try {
      const member = await updateTeamMemberRole(memberId, nextRole);
      setMembers((current) => current.map((item) => (item.id === member.id ? member : item)));
      setMessage("Role anggota berhasil diperbarui.");
    } catch {
      setErrorMessage("Gagal memperbarui role anggota.");
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-3xl bg-surface-container-lowest p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Enterprise Team Management</p>
        <h1 className="mt-3 text-3xl font-black text-on-surface">Kelola Tim & Akses</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Atur anggota organisasi, role RBAC, dan distribusi akses dokumen dalam satu panel kerja.
        </p>
      </header>

      {message ? <p className="rounded-2xl bg-secondary/10 px-4 py-3 text-sm text-secondary">{message}</p> : null}
      {errorMessage ? <p className="rounded-2xl bg-error-container px-4 py-3 text-sm text-error">{errorMessage}</p> : null}

      <article className="rounded-3xl bg-surface-container-lowest p-5 sm:p-6">
        <h2 className="text-lg font-bold text-on-surface">Undang Anggota Baru</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@company.com"
            className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none"
          />

          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "admin" | "signer" | "viewer")}
            className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none"
          >
            <option value="admin">Admin</option>
            <option value="signer">Signer</option>
            <option value="viewer">Viewer</option>
          </select>

          <button
            type="button"
            onClick={handleInvite}
            disabled={isInviting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserPlus2 className="h-4 w-4" />
            {isInviting ? "Mengundang..." : "Undang"}
          </button>
        </div>
      </article>

      <article className="rounded-3xl bg-surface-container-lowest p-5 sm:p-6">
        <h2 className="text-lg font-bold text-on-surface">Anggota Tim</h2>

        {isLoading ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Memuat anggota tim...
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-outline-variant/20">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-surface-container-low text-xs uppercase tracking-[0.08em] text-outline">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-t border-outline-variant/10">
                    <td className="px-4 py-4 font-semibold text-on-surface">{member.fullName}</td>
                    <td className="px-4 py-4 text-on-surface-variant">{member.email}</td>
                    <td className="px-4 py-4">
                      <select
                        value={member.role}
                        onChange={(event) =>
                          void handleRoleChange(
                            member.id,
                            event.target.value as "owner" | "admin" | "signer" | "viewer"
                          )
                        }
                        className="rounded-lg bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface outline-none"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="signer">Signer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
