"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Setting {
  id: string; key: string; value: string; type: string;
  label: string; description: string | null; isImmutable: boolean;
  updatedAt: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try { setSettings(await api.get<Setting[]>("/admin/settings")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  function startEdit(setting: Setting) {
    setEditingKey(setting.key);
    setEditValue(setting.value);
  }

  async function handleSave(key: string) {
    setSaving(true); setError("");
    try {
      await api.put(`/admin/settings/${key}`, { value: editValue });
      setEditingKey(null); setSuccess("Setting updated.");
      fetchSettings();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed");
    } finally { setSaving(false); }
  }

  function renderInput(setting: Setting) {
    const isEditing = editingKey === setting.key;
    const inputClass = "rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 focus:border-white focus:outline-none";

    if (isEditing) {
      if (setting.type === "BOOLEAN") {
        return (
          <select value={editValue} onChange={(e) => setEditValue(e.target.value)} className={inputClass}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        );
      }
      if (setting.type === "NUMBER") {
        return <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} className={`${inputClass} w-24`} />;
      }
      return <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} className={`${inputClass} w-64`} />;
    }

    const displayValue = setting.type === "BOOLEAN"
      ? <span className={setting.value === "true" ? "text-emerald-400" : "text-red-400"}>{setting.value}</span>
      : <code className="text-gray-200">{setting.value}</code>;

    return displayValue;
  }

  if (loading) return <div><h1 className="text-2xl font-bold">System Settings</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Settings</h1>
          <p className="text-sm text-gray-400">Platform-wide configuration</p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">{success}<button onClick={() => setSuccess("")} className="ml-2 underline hover:text-emerald-300">Dismiss</button></div>}

      <div className="mt-6 space-y-2">
        {settings.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-200">{s.label}</span>
                <code className="text-xs text-gray-600">{s.key}</code>
                <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">{s.type}</span>
                {s.isImmutable && <span className="rounded bg-amber-950/50 px-1.5 py-0.5 text-[10px] text-amber-400 border border-amber-800">Immutable</span>}
              </div>
              {s.description && <p className="mt-0.5 text-xs text-gray-500">{s.description}</p>}
            </div>
            <div className="flex items-center gap-3 ml-4">
              {renderInput(s)}
              {editingKey === s.key ? (
                <>
                  <button onClick={() => handleSave(s.key)} disabled={saving}
                    className="rounded bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">Save</button>
                  <button onClick={() => setEditingKey(null)}
                    className="rounded border border-gray-600 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800">Cancel</button>
                </>
              ) : (
                !s.isImmutable && (
                  <button onClick={() => startEdit(s)}
                    className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800">Edit</button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
