"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Backup {
  id: string; label: string; type: string; status: string;
  sizeMB: number; expiresAt: string | null;
  createdAt: string;
}

interface BackupScheduleData {
  id: string; enabled: boolean;
  intervalHours: number; retainDaily: number; retainWeekly: number; retainMonthly: number;
  nextRunAt: string;
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

const STATUS_COLORS: Record<string, string> = {
  CREATING: "border-amber-700 text-amber-400 bg-amber-950/30",
  AVAILABLE: "border-emerald-700 text-emerald-400 bg-emerald-950/30",
  FAILED: "border-red-700 text-red-400 bg-red-950/30",
  EXPIRED: "border-gray-700 text-gray-500 bg-gray-900/30",
};

export default function BackupsTab({ serverId }: { serverId: string }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [total, setTotal] = useState(0);
  const [schedule, setSchedule] = useState<BackupScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState(24);
  const [retainDaily, setRetainDaily] = useState(7);
  const [retainWeekly, setRetainWeekly] = useState(4);
  const [retainMonthly, setRetainMonthly] = useState(3);

  const totalSize = backups.reduce((sum, b) => sum + b.sizeMB, 0);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch(`/api/servers/${serverId}/backups`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      const json = await res.json();
      setBackups(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch { /* noop */ }
  }, [serverId]);

  const fetchSchedule = useCallback(async () => {
    try {
      const data = await api.get<BackupScheduleData>(`/servers/${serverId}/backups/schedule`);
      setSchedule(data);
      setScheduleEnabled(data.enabled);
      setIntervalHours(data.intervalHours);
      setRetainDaily(data.retainDaily);
      setRetainWeekly(data.retainWeekly);
      setRetainMonthly(data.retainMonthly);
    } catch { /* noop */ }
  }, [serverId]);

  useEffect(() => {
    Promise.all([fetchBackups(), fetchSchedule()]).finally(() => setLoading(false));
  }, [fetchBackups, fetchSchedule]);

  async function handleCreateBackup() {
    setCreating(true);
    setError("");
    try {
      await api.post(`/servers/${serverId}/backups`);
      await fetchBackups();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteBackup(backupId: string) {
    setError("");
    try {
      await api.del(`/servers/${serverId}/backups/${backupId}`);
      await fetchBackups();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to delete backup");
    }
  }

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    setError("");
    try {
      await api.put(`/servers/${serverId}/backups/schedule`, {
        enabled: scheduleEnabled,
        intervalHours,
        retainDaily,
        retainWeekly,
        retainMonthly,
      });
      await fetchSchedule();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to save schedule");
    } finally {
      setSavingSchedule(false);
    }
  }

  if (loading) return <p className="text-gray-400">Loading backups...</p>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-300">Automated Backup Schedule</h3>
            <p className="mt-1 text-xs text-gray-500">
              {schedule?.nextRunAt && scheduleEnabled
                ? `Next scheduled run: ${new Date(schedule.nextRunAt).toLocaleString()}`
                : "Schedule is disabled"}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800" />
            <span className="text-sm text-gray-300">Enable automated backups</span>
          </label>

          {scheduleEnabled && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs text-gray-400">Interval (hours)</label>
                <input type="number" value={intervalHours} onChange={(e) => setIntervalHours(parseInt(e.target.value) || 24)}
                  min={6} className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100" />
              </div>
              <div>
                <label className="block text-xs text-gray-400">Keep Daily</label>
                <input type="number" value={retainDaily} onChange={(e) => setRetainDaily(parseInt(e.target.value) || 7)}
                  min={1} className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100" />
              </div>
              <div>
                <label className="block text-xs text-gray-400">Keep Weekly</label>
                <input type="number" value={retainWeekly} onChange={(e) => setRetainWeekly(parseInt(e.target.value) || 4)}
                  min={1} className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100" />
              </div>
              <div>
                <label className="block text-xs text-gray-400">Keep Monthly</label>
                <input type="number" value={retainMonthly} onChange={(e) => setRetainMonthly(parseInt(e.target.value) || 3)}
                  min={1} className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100" />
              </div>
            </div>
          )}

          <button onClick={handleSaveSchedule} disabled={savingSchedule}
            className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {savingSchedule ? "Saving..." : "Save Schedule"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-300">Backups</h3>
            <p className="mt-1 text-xs text-gray-500">
              {total} backup{total !== 1 ? "s" : ""} · {formatSize(totalSize)} total
            </p>
          </div>
          <button onClick={handleCreateBackup} disabled={creating}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50">
            {creating ? "Creating..." : "Create Backup"}
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No backups yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="pb-2 font-medium">Label</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Size</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-300">{b.label}</td>
                    <td className="py-2 text-gray-500">{b.type}</td>
                    <td className="py-2">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] || ""}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400">{formatSize(b.sizeMB)}</td>
                    <td className="py-2 text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 text-right">
                      {(b.status === "AVAILABLE" || b.status === "FAILED" || b.status === "EXPIRED") && (
                        <button onClick={() => handleDeleteBackup(b.id)}
                          className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
