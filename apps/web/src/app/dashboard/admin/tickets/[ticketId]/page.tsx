"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface Message {
  id: string; body: string; isInternal: boolean;
  author: { id: string; username: string; role: string };
  createdAt: string;
}

interface Ticket {
  id: string; subject: string; status: string; priority: string; category: string;
  customer: { id: string; username: string; email: string };
  assignedTo: { id: string; username: string } | null;
  messages: Message[]; createdAt: string; updatedAt: string;
}

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const STATUS_COLORS: Record<string, string> = {
  OPEN: "text-emerald-400", IN_PROGRESS: "text-blue-400",
  WAITING_ON_CUSTOMER: "text-amber-400", RESOLVED: "text-gray-400", CLOSED: "text-gray-500",
};

export default function AdminTicketDetailPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchTicket = useCallback(async () => {
    setLoading(true);
    try { setTicket(await api.get<Ticket>(`/admin/tickets/${ticketId}`)); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed to load ticket"); }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true); setError("");
    try {
      await api.post(`/admin/tickets/${ticketId}/messages`, { body: reply, isInternal });
      setReply(""); setIsInternal(false);
      await fetchTicket();
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed to send"); }
    finally { setSending(false); }
  }

  async function handleStatusChange(status: string) {
    try { await api.put(`/admin/tickets/${ticketId}`, { status }); await fetchTicket(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed to update"); }
  }

  async function handlePriorityChange(priority: string) {
    try { await api.put(`/admin/tickets/${ticketId}`, { priority }); await fetchTicket(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed to update"); }
  }

  async function handleAssignSelf() {
    try { await api.put(`/admin/tickets/${ticketId}`, { assignedUserId: "self" }); await fetchTicket(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed to assign"); }
  }

  if (loading) {
    return (
      <div>
        <Link href="/dashboard/admin/tickets" className="text-sm text-gray-400 hover:text-gray-300">&larr; Tickets</Link>
        <p className="mt-4 text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div>
        <Link href="/dashboard/admin/tickets" className="text-sm text-gray-400 hover:text-gray-300">&larr; Tickets</Link>
        <p className="mt-4 text-red-400">{error || "Ticket not found"}</p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard/admin/tickets" className="text-sm text-gray-400 hover:text-gray-300">&larr; Tickets</Link>

      <div className="mt-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{ticket.subject}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className={STATUS_COLORS[ticket.status] || ""}>{ticket.status}</span>
              <span className="text-gray-400">{ticket.priority}</span>
              <span className="text-gray-500">{ticket.category}</span>
            </div>
            <div className="mt-1 text-sm text-gray-500">
              Customer: {ticket.customer.username} ({ticket.customer.email})
              {ticket.assignedTo && <span className="ml-3">Assigned: {ticket.assignedTo.username}</span>}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Status:</label>
            <select value={ticket.status} onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Priority:</label>
            <select value={ticket.priority} onChange={(e) => handlePriorityChange(e.target.value)}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <button onClick={handleAssignSelf}
            className="rounded border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800">
            {ticket.assignedTo ? "Reassign to Me" : "Assign to Me"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-400">{error}</div>
      )}

      <div className="mt-6 space-y-4">
        {ticket.messages.map((msg) => (
          <div key={msg.id} className={`rounded-lg border p-4 ${msg.isInternal ? "border-amber-800 bg-amber-950/20" : "border-gray-800 bg-gray-900/50"}`}>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${msg.author.role === "ADMIN" || msg.author.role === "STAFF" ? "text-blue-400" : "text-gray-300"}`}>
                  {msg.author.username}
                </span>
                <span className="text-gray-600">{msg.author.role}</span>
                {msg.isInternal && <span className="rounded border border-amber-700 px-1.5 py-0.5 text-[10px] text-amber-400">Internal</span>}
              </div>
              <span>{new Date(msg.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{msg.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "CLOSED" && (
        <div className="mt-6 space-y-4">
          <form onSubmit={handleReply}>
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800" />
                Internal note (not visible to customer)
              </label>
            </div>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)}
              className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none resize-y"
              rows={4} placeholder={isInternal ? "Add an internal note..." : "Type your reply..."} />
            <button type="submit" disabled={sending || !reply.trim()}
              className={`mt-3 rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50 ${isInternal ? "border border-amber-700 bg-amber-950/30 text-amber-400 hover:bg-amber-950/50" : "bg-white text-gray-900 hover:bg-gray-200"}`}>
              {sending ? "Sending..." : isInternal ? "Add Internal Note" : "Send Reply"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
