"use client";

import { useEffect, useState } from "react";

interface Prefs {
  emailServerCreated: boolean; emailServerDeleted: boolean;
  emailPaymentFailure: boolean; emailTicketUpdates: boolean;
  emailMarketing: boolean; pushServerCreated: boolean;
  pushTicketUpdates: boolean;
}

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPrefs = async () => {
    const token = localStorage.getItem("access_token");
    const res = await fetch("/api/notifications/preferences", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.data) setPrefs(json.data);
    setLoading(false);
  };

  useEffect(() => { fetchPrefs(); }, []);

  async function toggle(key: keyof Prefs) {
    if (!prefs) return;
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSaving(true);
    try {
      const token = localStorage.getItem("access_token");
      await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: !prefs[key] }),
      });
    } catch { /* noop */ }
    finally { setSaving(false); }
  }

  if (loading) return <div><h1 className="text-2xl font-bold">Notification Preferences</h1><p className="mt-4 text-gray-400">Loading...</p></div>;
  if (!prefs) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold">Notification Preferences</h1>
      <p className="mt-1 text-sm text-gray-400">Choose which notifications you receive by email</p>

      <div className="mt-6 space-y-3">
        <Section label="Email Notifications">
          <Toggle label="Server created" desc="Receive an email when a new server is provisioned" checked={prefs.emailServerCreated} onChange={() => toggle("emailServerCreated")} disabled={saving} />
          <Toggle label="Server deleted" desc="Receive an email when a server is deleted" checked={prefs.emailServerDeleted} onChange={() => toggle("emailServerDeleted")} disabled={saving} />
          <Toggle label="Payment failure" desc="Receive an email when a payment fails" checked={prefs.emailPaymentFailure} onChange={() => toggle("emailPaymentFailure")} disabled={saving} />
          <Toggle label="Ticket updates" desc="Receive an email when a ticket is updated" checked={prefs.emailTicketUpdates} onChange={() => toggle("emailTicketUpdates")} disabled={saving} />
          <Toggle label="Marketing" desc="Product updates, promotions, and newsletters" checked={prefs.emailMarketing} onChange={() => toggle("emailMarketing")} disabled={saving} />
        </Section>
        <Section label="Push Notifications">
          <Toggle label="Server events" desc="In-app notifications for server create/start/stop/etc" checked={prefs.pushServerCreated} onChange={() => toggle("pushServerCreated")} disabled={saving} />
          <Toggle label="Ticket updates" desc="In-app notifications for ticket changes" checked={prefs.pushTicketUpdates} onChange={() => toggle("pushTicketUpdates")} disabled={saving} />
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-300">{label}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange, disabled }: { label: string; desc: string; checked: boolean; onChange: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <button onClick={onChange} disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-white" : "bg-gray-700"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-gray-900 transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
