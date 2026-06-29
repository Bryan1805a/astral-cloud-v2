"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Ticket {
  id: string; subject: string; status: string; priority: string; category: string;
  assignedTo: string | null; messageCount: number;
  createdAt: string; updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "border-emerald-700 text-emerald-400 bg-emerald-950/30",
  IN_PROGRESS: "border-blue-700 text-blue-400 bg-blue-950/30",
  WAITING_ON_CUSTOMER: "border-amber-700 text-amber-400 bg-amber-950/30",
  RESOLVED: "border-gray-600 text-gray-400 bg-gray-950/30",
  CLOSED: "border-gray-700 text-gray-500 bg-gray-900/30",
};

const PRIORITY_COLORS: Record<string, string> = { URGENT: "text-red-400", HIGH: "text-amber-400", NORMAL: "text-gray-400", LOW: "text-gray-500" };

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchTickets = async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/tickets?${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    });
    const json = await res.json();
    if (json.data) setTickets(json.data);
    if (json.meta) setTotal(json.meta.total);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(page); }, [page, statusFilter]);

  if (loading) return <div><h1 className="text-2xl font-bold">Support Tickets</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Support Tickets</h1><p className="text-sm text-gray-400">{total} tickets</p></div>
        <Link href="/dashboard/tickets/create" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">New Ticket</Link>
      </div>

      <div className="mt-4 flex gap-2">
        {["", "OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${statusFilter === s ? "border-white bg-white text-gray-900" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {tickets.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-gray-500">No tickets yet.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {tickets.map((t) => (
            <Link key={t.id} href={`/dashboard/tickets/${t.id}`}
              className="block rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-200">{t.subject}</span>
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] || ""}`}>{t.status}</span>
                  <span className={`text-xs font-medium ${PRIORITY_COLORS[t.priority] || ""}`}>{t.priority}</span>
                </div>
                <span className="text-xs text-gray-500">{t.category} · {t.messageCount} msgs</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {new Date(t.createdAt).toLocaleDateString()}
                {t.assignedTo && <span className="ml-3">Assigned to: {t.assignedTo}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Prev</button>
          <span>Page {page} of {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage((p) => Math.min(Math.ceil(total / 20), p + 1))} disabled={page >= Math.ceil(total / 20)}
            className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}
