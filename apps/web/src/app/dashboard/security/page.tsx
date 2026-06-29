"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function SecurityPage() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrCodeUri, setQrCodeUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<"idle" | "setup" | "confirm">("idle");
  const [totpCode, setTotpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  const fetchProfile = async () => {
    const token = localStorage.getItem("access_token");
    const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.data) {
      setTwoFactorEnabled(json.data.twoFactorEnabled || false);
      setUserRole(json.data.role);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, []);

  async function handleSetup() {
    setError(""); setSuccess("");
    try {
      const result = await api.get<{ secret: string; qrCodeUri: string; backupCodes: string[] }>("/auth/2fa/enable");
      setQrCodeUri(result.qrCodeUri);
      setBackupCodes(result.backupCodes);
      setStep("confirm");
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to setup 2FA");
    }
  }

  async function handleConfirm() {
    setError(""); setSubmitting(true);
    try {
      await api.post("/auth/2fa/enable", { totpCode });
      setTwoFactorEnabled(true);
      setStep("idle");
      setSuccess("Two-factor authentication enabled!");
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Invalid code");
    } finally { setSubmitting(false); }
  }

  async function handleDisable() {
    setError(""); setSuccess("");
    const code = window.prompt("Enter your current TOTP code to disable 2FA:");
    if (!code) return;
    setSubmitting(true);
    try {
      await api.post("/auth/2fa/disable", { totpCode: code });
      setTwoFactorEnabled(false);
      setSuccess("Two-factor authentication disabled.");
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to disable 2FA");
    } finally { setSubmitting(false); }
  }

  if (loading) return <div><h1 className="text-2xl font-bold">Security</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Security</h1>
      <p className="mt-1 text-sm text-gray-400">Manage authentication and security settings</p>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">{success}</div>}

      <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-200">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-400 mt-1">
              {twoFactorEnabled ? "Your account is protected with TOTP-based 2FA." : "Add an extra layer of security to your account."}
            </p>
          </div>
          {twoFactorEnabled ? (
            step === "idle" && (
              <button onClick={handleDisable} disabled={submitting || userRole === "ADMIN"}
                className="rounded-lg border border-red-700 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950 disabled:opacity-30"
                title={userRole === "ADMIN" ? "ADMIN accounts cannot disable 2FA" : undefined}>
                Disable 2FA
              </button>
            )
          ) : (
            step === "idle" && (
              <button onClick={handleSetup} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">
                Enable 2FA
              </button>
            )
          )}
        </div>

        {step === "confirm" && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              {qrCodeUri && (
                <div className="rounded-lg bg-white p-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrCodeUri)}`}
                    alt="2FA QR Code"
                    className="h-40 w-40"
                  />
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
                  {backupCodes.map((c, i) => (
                    <code key={i} className="font-mono text-sm text-amber-300">{c}</code>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <input type="text" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value)}
                placeholder="000000"
                className="w-24 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-center font-mono text-lg text-gray-100 tracking-widest focus:border-white focus:outline-none" />
              <button onClick={handleConfirm} disabled={submitting || totpCode.length !== 6}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
                {submitting ? "Verifying..." : "Confirm"}
              </button>
              <button onClick={() => { setStep("idle"); setTotpCode(""); setBackupCodes([]); }}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
