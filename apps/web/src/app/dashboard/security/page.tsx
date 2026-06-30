"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface NotificationPrefs {
  id: string;
  emailServerCreated: boolean;
  emailServerDeleted: boolean;
  emailPaymentFailure: boolean;
  emailTicketUpdates: boolean;
  emailMarketing: boolean;
  pushServerCreated: boolean;
  pushTicketUpdates: boolean;
}

const PREF_LABELS: Record<string, string> = {
  emailServerCreated: "Email — Server created",
  emailServerDeleted: "Email — Server deleted",
  emailPaymentFailure: "Email — Payment failure",
  emailTicketUpdates: "Email — Ticket updates",
  emailMarketing: "Email — Marketing",
  pushServerCreated: "In-app — Server created",
  pushTicketUpdates: "In-app — Ticket updates",
};

export default function SecurityPage() {
  const [user, setUser] = useState<{ username: string; email: string; role: string; twoFactorEnabled: boolean } | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const [qrCodeUri, setQrCodeUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step2fa, setStep2fa] = useState<"idle" | "confirm">("idle");
  const [totpCode, setTotpCode] = useState("");
  const [submitting2fa, setSubmitting2fa] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    Promise.all([
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      api.get<NotificationPrefs>("/notifications/preferences").catch(() => null),
    ]).then(([profile, prefsData]) => {
      if (profile.data) {
        setUser({ username: profile.data.username, email: profile.data.email, role: profile.data.role, twoFactorEnabled: profile.data.twoFactorEnabled || false });
        setUsername(profile.data.username);
        setEmail(profile.data.email);
      }
      if (prefsData) setPrefs(prefsData);
    }).finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setSavingProfile(true);
    try {
      const result = await api.put<{ username: string; email: string }>("/auth/profile", { username, email });
      setUser((u) => u ? { ...u, username: result.username, email: result.email } : u);
      setSuccess("Profile updated.");
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
    finally { setSavingProfile(false); }
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setChangingPw(true);
    try {
      await api.post("/auth/change-password", { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(""); setNewPw(""); setSuccess("Password changed.");
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
    finally { setChangingPw(false); }
  }

  async function togglePref(key: string, value: boolean) {
    if (!prefs) return;
    setError("");
    try {
      const updated = await api.put<NotificationPrefs>("/notifications/preferences", { [key]: !value });
      setPrefs(updated);
    } catch { /* noop */ }
  }

  async function handleSetup2fa() {
    setError(""); setSuccess("");
    try {
      const result = await api.get<{ secret: string; qrCodeUri: string; backupCodes: string[] }>("/auth/2fa/enable");
      setQrCodeUri(result.qrCodeUri);
      setBackupCodes(result.backupCodes);
      setStep2fa("confirm");
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  async function handleConfirm2fa() {
    setError(""); setSubmitting2fa(true);
    try {
      await api.post("/auth/2fa/enable", { totpCode });
      setUser((u) => u ? { ...u, twoFactorEnabled: true } : u);
      setStep2fa("idle"); setTotpCode(""); setBackupCodes([]);
      setSuccess("Two-factor authentication enabled!");
    } catch (err: unknown) { setError((err as { message?: string }).message || "Invalid code"); }
    finally { setSubmitting2fa(false); }
  }

  async function handleDisable2fa() {
    setError(""); setSuccess("");
    const code = window.prompt("Enter your current TOTP code:");
    if (!code) return;
    try {
      await api.post("/auth/2fa/disable", { totpCode: code });
      setUser((u) => u ? { ...u, twoFactorEnabled: false } : u);
      setSuccess("2FA disabled.");
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  if (loading) return <div><h1 className="text-2xl font-bold">Security & Profile</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  const inputClass = "block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1";

  return (
    <div>
      <h1 className="text-2xl font-bold">Security & Profile</h1>
      <p className="text-sm text-gray-400">Manage your account settings</p>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">{success}<button onClick={() => setSuccess("")} className="ml-2 underline hover:text-emerald-300">Dismiss</button></div>}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-sm font-semibold text-gray-200">Profile</h3>
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-3">
            <div>
              <label className={labelClass}>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" disabled={savingProfile}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">Save</button>
          </form>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-sm font-semibold text-gray-200">Change Password</h3>
          <form onSubmit={handleChangePw} className="mt-4 space-y-3">
            <div>
              <label className={labelClass}>Current Password</label>
              <input type="password" required value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>New Password</label>
              <input type="password" required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" disabled={changingPw}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">Change Password</button>
          </form>
        </div>
      </div>

      {prefs && (
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-sm font-semibold text-gray-200">Notification Preferences</h3>
          <div className="mt-3 space-y-2">
            {Object.entries(PREF_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded border border-gray-800 bg-gray-900/30 px-3 py-2 cursor-pointer hover:bg-gray-800/30">
                <span className="text-sm text-gray-300">{label}</span>
                <input type="checkbox" checked={!!(prefs as unknown as Record<string, boolean>)[key]}
                  onChange={() => togglePref(key, !!(prefs as unknown as Record<string, boolean>)[key])}
                  className="rounded border-gray-600 bg-gray-800" />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Two-Factor Authentication</h3>
            <p className="text-xs text-gray-400 mt-1">
              {user?.twoFactorEnabled ? "Your account is protected with TOTP-based 2FA." : "Add an extra layer of security to your account."}
            </p>
          </div>
          {user?.twoFactorEnabled ? (
            step2fa === "idle" && (
              <button onClick={handleDisable2fa} disabled={user.role === "ADMIN"}
                className="rounded-lg border border-red-700 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950 disabled:opacity-30"
                title={user?.role === "ADMIN" ? "ADMIN accounts cannot disable 2FA" : undefined}>Disable 2FA</button>
            )
          ) : (
            step2fa === "idle" && (
              <button onClick={handleSetup2fa} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">Enable 2FA</button>
            )
          )}
        </div>

        {step2fa === "confirm" && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              {qrCodeUri && (
                <div className="rounded-lg bg-white p-2">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrCodeUri)}`}
                    alt="2FA QR Code" className="h-40 w-40" />
                </div>
              )}
              <div className="text-sm text-gray-400">
                <p>1. Scan the QR code with your authenticator app</p>
                <p>2. Enter the 6-digit code below to confirm</p>
              </div>
            </div>
            {backupCodes.length > 0 && (
              <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4">
                <p className="text-sm font-medium text-amber-400">Backup Codes — save these somewhere safe!</p>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {backupCodes.map((c, i) => <code key={i} className="font-mono text-sm text-amber-300">{c}</code>)}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <input type="text" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="000000"
                className="w-24 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-center font-mono text-lg text-gray-100 tracking-widest focus:border-white focus:outline-none" />
              <button onClick={handleConfirm2fa} disabled={submitting2fa || totpCode.length !== 6}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">Confirm</button>
              <button onClick={() => { setStep2fa("idle"); setTotpCode(""); setBackupCodes([]); }}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
