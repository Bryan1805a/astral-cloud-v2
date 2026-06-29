"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface User {
  id: string; username: string; email: string; role: string; status: string;
  balance: string; taxExempt: boolean; emailVerifiedAt: string | null;
  lastLoginAt: string | null; createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUsers = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.getPaginated<User>(`/admin/users?page=${p}&limit=20`);
      setUsers(res.data);
      setTotal(res.meta.total);
    } catch {
      setError("Failed to load users");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(page); }, [page]);

  async function updateUser(id: string, data: Record<string, unknown>) {
    try {
      await api.put(`/admin/users/${id}`, data);
      await fetchUsers(page);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed");
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="text-sm text-gray-400">{total} users</p>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      {loading ? <p className="mt-6 text-gray-400">Loading...</p> : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="pb-2 font-medium">Username</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Balance</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-800/50">
                  <td className="py-2 text-gray-200">{u.username}</td>
                  <td className="py-2 text-gray-400">{u.email}</td>
                  <td className="py-2">
                    <select value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-xs text-gray-200">
                      <option value="CUSTOMER">CUSTOMER</option>
                      <option value="STAFF">STAFF</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="py-2">
                    <select value={u.status} onChange={(e) => updateUser(u.id, { status: e.target.value })}
                      className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-xs text-gray-200">
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="LOCKED">LOCKED</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </td>
                  <td className="py-2 text-gray-300">${u.balance}</td>
                  <td className="py-2">
                    <button onClick={() => updateUser(u.id, { taxExempt: !u.taxExempt })}
                      className={`rounded border px-2 py-0.5 text-[10px] ${u.taxExempt ? "border-amber-700 text-amber-400" : "border-gray-700 text-gray-400"}`}>
                      {u.taxExempt ? "Tax Exempt" : "Taxable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
