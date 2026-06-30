"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface ReferralData {
  referralCode: string;
  referralLink: string;
  stats: {
    totalReferrals: number;
    creditedReferrals: number;
    pendingReferrals: number;
    totalEarnings: number;
    availableBalance: number;
    totalPaidOut: number;
  };
  referrals: {
    id: string; referee: string; status: string;
    referrerCredit: string; refereeCredit: string;
    createdAt: string;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "border-amber-700 text-amber-400 bg-amber-950/30",
  CREDITED: "border-emerald-700 text-emerald-400 bg-emerald-950/30",
  PAID_OUT: "border-blue-700 text-blue-400 bg-blue-950/30",
};

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    try { setData(await api.get<ReferralData>("/referrals")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function copyCode() {
    if (!data) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div><h1 className="text-2xl font-bold">Referrals</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Referrals</h1>
      <p className="text-sm text-gray-400">Invite friends and earn credits</p>

      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h3 className="text-sm font-semibold text-gray-300">Your Referral Code</h3>
        <p className="mt-2 text-xs text-gray-400">Share this link with friends. When they sign up and make their first payment, you both earn credits.</p>
        <div className="mt-3 flex items-center gap-3">
          <code className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-mono text-gray-200 truncate">
            {data?.referralCode}
          </code>
          <button onClick={copyCode}
            className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors shrink-0">
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>

      {data && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-400">Total Invited</p>
            <p className="mt-1 text-xl font-semibold text-white">{data.stats.totalReferrals}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-400">Credited</p>
            <p className="mt-1 text-xl font-semibold text-emerald-400">{data.stats.creditedReferrals}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-400">Available Balance</p>
            <p className="mt-1 text-xl font-semibold text-amber-400">${data.stats.availableBalance.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-400">Total Paid Out</p>
            <p className="mt-1 text-xl font-semibold text-blue-400">${data.stats.totalPaidOut.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-300">Referred Users</h3>
        {data?.referrals.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No referrals yet. Share your code to get started!</p>
        ) : (
          <div className="mt-4 space-y-2">
            {data?.referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-200">{r.referee}</span>
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>
                    {r.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {Number(r.referrerCredit) > 0 && <span className="mr-3 text-emerald-400">+${r.referrerCredit}</span>}
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
