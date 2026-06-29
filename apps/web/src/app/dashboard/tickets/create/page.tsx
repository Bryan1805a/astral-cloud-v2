"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "ABUSE"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export default function CreateTicketPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>("GENERAL");
  const [priority, setPriority] = useState<string>("NORMAL");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSubmitting(true);
    try {
      await api.post("/tickets", { subject, category, priority, message });
      router.push("/dashboard/tickets");
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to create ticket");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">New Support Ticket</h1>
      <p className="mt-1 text-sm text-gray-400">Describe your issue and we'll help you out</p>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">Subject</label>
          <input type="text" required maxLength={255} value={subject} onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
            placeholder="Brief description of your issue" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 focus:border-white focus:outline-none">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 focus:border-white focus:outline-none">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Message</label>
          <textarea required rows={6} value={message} onChange={(e) => setMessage(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white resize-y"
            placeholder="Describe your issue in detail..." />
        </div>

        <div className="flex gap-4">
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
          <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit Ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
