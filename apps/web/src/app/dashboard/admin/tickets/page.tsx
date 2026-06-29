"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Ticket {
  id: string; subject: string; status: string; priority: string; category: string;
  customer: { id: string; username: string; email: string };
  assignedTo: { id: string; username: string } | null; messageCount: number;
  createdAt: string; updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "border-emerald-700 text-emerald-400 bg-emerald-950/30",
  IN_PROGRESS: "border-blue-700 text-blue-400 bg-blue-950/30",
  WAITING_ON_CUSTOMER: "border-amber-700 text-amber-400 bg-amber-950/30",
  RESOLVED: "border-gray-600 text-gray-400 bg-gray-950/30",
  CLOSED: "border-gray-700 text-gray-500 bg-gray-900/30",
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchTickets = async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/tickets?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      const json = await res.json();
      setTickets(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch { /* noop */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTickets(page); }, [page, statusFilter]);

  async function updateTicket(id: string, data: Record<string, unknown>) {
    try { await api.put(`/admin/tickets/${id}`, data); await fetchTickets(page); }
    catch { /* noop */ }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h1 className="text-2xl font-bold">Support Tickets</h1>
      <p className="text-sm text-gray-400">{total} tickets</p>

      <div className="mt-4 flex gap-2">
        {["", "OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${statusFilter === s ? "border-white bg-white text-gray-900" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? <p className="mt-6 text-gray-400">Loading...</p> : tickets.length === 0 ? <p className="mt-6 text-gray-500">No tickets.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="pb-2 font-medium">Subject</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Priority</th>
                <th className="pb-2 font-medium">Assigned</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-gray-800/50">
                  <td className="py-2 text-gray-200 max-w-[200px] truncate">
                    <Link href={`/dashboard/admin/tickets/${t.id}`} className="hover:text-white hover:underline">{t.subject}</Link>
                  </td>
                  <td className="py-2 text-gray-400">{t.customer.username}</td>
                  <td className="py-2">
                    <select value={t.status} onChange={(e) => updateTicket(t.id, { status: e.target.value })}
                      className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-xs text-gray-200">
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="WAITING_ON_CUSTOMER">WAITING</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </td>
                  <td className="py-2">
                    <select value={t.priority} onChange={(e) => updateTicket(t.id, { priority: e.target.value })}
                      className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-xs text-gray-200">
                      <option value="LOW">LOW</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </td>
                  <td className="py-2 text-gray-400">{t.assignedTo?.username || "—"}</td>
                  <td className="py-2">
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] || ""}`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
