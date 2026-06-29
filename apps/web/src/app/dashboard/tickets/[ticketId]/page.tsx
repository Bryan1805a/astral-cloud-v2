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
  assignedTo: { id: string; username: string } | null;
  messages: Message[]; createdAt: string; updatedAt: string;
}

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const fetchTicket = useCallback(async () => {
    try { setTicket(await api.get<Ticket>(`/tickets/${ticketId}`)); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed to load"); }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true); setError("");
    try { await api.post(`/tickets/${ticketId}/messages`, { body: reply }); setReply(""); await fetchTicket(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed to send"); }
    finally { setSending(false); }
  }

  async function handleClose() {
    try { await api.post(`/tickets/${ticketId}/close`); await fetchTicket(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  async function handleReopen() {
    try { await api.post(`/tickets/${ticketId}/reopen`); await fetchTicket(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  if (loading) return <div><Link href="/dashboard/tickets" className="text-sm text-gray-400 hover:text-gray-300">&larr; Tickets</Link><p className="mt-4 text-gray-400">Loading...</p></div>;
  if (!ticket) return <div><Link href="/dashboard/tickets" className="text-sm text-gray-400 hover:text-gray-300">&larr; Tickets</Link><p className="mt-4 text-red-400">{error || "Not found"}</p></div>;

  const statusColor: Record<string, string> = {
    OPEN: "text-emerald-400", IN_PROGRESS: "text-blue-400", WAITING_ON_CUSTOMER: "text-amber-400", RESOLVED: "text-gray-400", CLOSED: "text-gray-500",
  };

  return (
    <div>
      <Link href="/dashboard/tickets" className="text-sm text-gray-400 hover:text-gray-300">&larr; Tickets</Link>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className={statusColor[ticket.status]}>{ticket.status}</span>
            <span className="text-gray-400">{ticket.priority}</span>
            <span className="text-gray-500">{ticket.category}</span>
            {ticket.assignedTo && <span className="text-gray-400">Assigned: {ticket.assignedTo.username}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {ticket.status === "RESOLVED" && <button onClick={handleClose} className="rounded border border-gray-600 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800">Close</button>}
          {ticket.status === "CLOSED" && <button onClick={handleReopen} className="rounded border border-gray-600 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800">Reopen</button>}
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-400">{error}</div>}

      <div className="mt-6 space-y-4">
        {ticket.messages.map((msg) => (
          <div key={msg.id} className={`rounded-lg border p-4 ${msg.isInternal ? "border-amber-800 bg-amber-950/20" : "border-gray-800 bg-gray-900/50"}`}>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span className="font-medium text-gray-300">{msg.author.username}</span>
              <span>{new Date(msg.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{msg.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "CLOSED" && (
        <form onSubmit={handleReply} className="mt-6">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)}
            className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none resize-y"
            rows={3} placeholder="Type your reply..." />
          <button type="submit" disabled={sending || !reply.trim()}
            className="mt-3 rounded-lg bg-white px-5 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {sending ? "Sending..." : "Send Reply"}
          </button>
        </form>
      )}
    </div>
  );
}
