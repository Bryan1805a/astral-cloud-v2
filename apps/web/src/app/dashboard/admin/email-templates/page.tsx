"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface EmailTemplate {
  id: string; code: string; name: string; subject: string;
  htmlBody: string; textBody: string | null;
  variables: string[] | null; isActive: boolean;
  updatedAt: string;
}

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editHtmlBody, setEditHtmlBody] = useState("");
  const [editVariables, setEditVariables] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try { setTemplates(await api.get<EmailTemplate[]>("/admin/email-templates")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function startEdit(tpl: EmailTemplate) {
    setEditingId(tpl.id);
    setEditSubject(tpl.subject);
    setEditHtmlBody(tpl.htmlBody);
    setEditVariables((tpl.variables || []).join(", "));
  }

  function cancelEdit() { setEditingId(null); }

  async function handleSave(id: string) {
    setSaving(true); setError("");
    const vars = editVariables ? editVariables.split(",").map((v) => v.trim()).filter(Boolean) : [];
    try {
      await api.put(`/admin/email-templates/${id}`, {
        subject: editSubject, htmlBody: editHtmlBody,
        variables: vars.length > 0 ? vars : undefined,
      });
      cancelEdit(); setSuccess("Template updated.");
      fetchTemplates();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed");
    } finally { setSaving(false); }
  }

  async function toggleActive(tpl: EmailTemplate) {
    try { await api.put(`/admin/email-templates/${tpl.id}`, { isActive: !tpl.isActive }); fetchTemplates(); }
    catch { /* noop */ }
  }

  function previewHtml(html: string, subject: string) {
    const w = window.open("", "_blank", "width=600,height=400");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${subject}</title></head><body style="font-family:Arial,sans-serif;background:#111;color:#e5e5e5;padding:24px"><div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:32px;border:1px solid #333">${html}</div></body></html>`);
    w.document.close();
  }

  if (loading) return <div><h1 className="text-2xl font-bold">Email Templates</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <p className="text-sm text-gray-400">Manage transactional email content</p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">{success}<button onClick={() => setSuccess("")} className="ml-2 underline hover:text-emerald-300">Dismiss</button></div>}

      <div className="mt-6 space-y-4">
        {templates.map((tpl) => (
          <div key={tpl.id} className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-200">{tpl.name}</h3>
                  <code className="text-xs text-gray-600">{tpl.code}</code>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${tpl.isActive ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
                    {tpl.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">Subject: {tpl.subject}</p>
                {tpl.variables && tpl.variables.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(tpl.variables as string[]).map((v) => (
                      <code key={v} className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-amber-400">{`{{${v}}}`}</code>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => previewHtml(tpl.htmlBody, tpl.subject)}
                  className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800">Preview</button>
                <button onClick={() => toggleActive(tpl)}
                  className={`rounded border px-2 py-1 text-xs ${tpl.isActive ? "border-amber-700 text-amber-400 hover:bg-amber-950/30" : "border-emerald-700 text-emerald-400 hover:bg-emerald-950/30"}`}>
                  {tpl.isActive ? "Disable" : "Enable"}
                </button>
                {editingId !== tpl.id ? (
                  <button onClick={() => startEdit(tpl)}
                    className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800">Edit</button>
                ) : (
                  <>
                    <button onClick={() => handleSave(tpl.id)} disabled={saving}
                      className="rounded bg-white px-2 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">Save</button>
                    <button onClick={cancelEdit}
                      className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800">Cancel</button>
                  </>
                )}
              </div>
            </div>

            {editingId === tpl.id && (
              <div className="mt-4 space-y-3 border-t border-gray-800 pt-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Subject</label>
                  <input type="text" value={editSubject} onChange={(e) => setEditSubject(e.target.value)}
                    className="block w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">HTML Body</label>
                  <textarea rows={6} value={editHtmlBody} onChange={(e) => setEditHtmlBody(e.target.value)}
                    className="block w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 font-mono resize-y" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Variables <span className="text-gray-600">(comma-separated)</span></label>
                  <input type="text" value={editVariables} onChange={(e) => setEditVariables(e.target.value)}
                    className="block w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
