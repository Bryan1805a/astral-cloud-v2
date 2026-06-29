"use client";

import { useEffect, useState } from "react";

interface AuditLog {
  id: string; userId: string | null; action: string;
  targetType: string; targetId: string; result: string;
  metadata: Record<string, unknown> | null; ipAddress: string; createdAt: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLogs = async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-logs?page=${p}&limit=50`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      }).then(r => r.json());
      setLogs(res.data);
      setTotal(res.meta.total);
    } catch { setError("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(page); }, [page]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <p className="text-sm text-gray-400">{total} entries</p>
      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      {loading ? <p className="mt-6 text-gray-400">Loading...</p> : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Action</th>
                <th className="pb-2 font-medium">Target</th>
                <th className="pb-2 font-medium">Result</th>
                <th className="pb-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-gray-800/50">
                  <td className="py-2 text-gray-400 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <span className="font-mono text-xs text-gray-300">{l.action}</span>
                  </td>
                  <td className="py-2 text-gray-500">{l.targetType}#{l.targetId.slice(0, 8)}</td>
                  <td className="py-2">
                    <span className={l.result === "SUCCESS" ? "text-emerald-400" : "text-red-400"}>{l.result}</span>
                  </td>
                  <td className="py-2 text-gray-500">{l.ipAddress}</td>
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
