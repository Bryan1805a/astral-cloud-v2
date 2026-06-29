"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Payment {
  id: string;
  amount: string;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  total: string;
  currency: string;
  status: string;
  pdfUrl: string | null;
  createdAt: string;
}

export default function BillingPage() {
  const [balance, setBalance] = useState<string>("0.00");
  const [topUpAmount, setTopUpAmount] = useState(10);
  const [voucherCode, setVoucherCode] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"topup" | "history" | "invoices">("topup");

  const fetchBalance = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data?.balance) setBalance(json.data.balance);
    } catch { /* noop */ }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/billing/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) setPayments(json.data);
    } catch { /* noop */ }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/billing/invoices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) setInvoices(json.data);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    async function load() {
      await Promise.all([fetchBalance(), fetchPayments(), fetchInvoices()]);
      setLoadingMeta(false);
    }
    load();
  }, [fetchBalance, fetchPayments, fetchInvoices]);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const result = await api.post<{
        paymentId: string;
        originalAmount: number;
        discountAmount: number;
        finalAmount: number;
        voucherCode: string | null;
        status: string;
      }>("/wallet/top-up", {
        amount: topUpAmount,
        voucherCode: voucherCode || undefined,
      });
      setSuccess(`Added $${topUpAmount}. New balance: $${(parseFloat(balance) + topUpAmount).toFixed(2)}`);
      if (result.discountAmount > 0) {
        setSuccess((s) => `${s} (Saved $${result.discountAmount} with voucher!)`);
      }
      setVoucherCode("");
      await Promise.all([fetchBalance(), fetchPayments(), fetchInvoices()]);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Top-up failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingMeta) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="mt-4 text-gray-400">Loading...</p>
      </div>
    );
  }

  const tabs: { key: "topup" | "history" | "invoices"; label: string }[] = [
    { key: "topup", label: "Top Up" },
    { key: "history", label: "Payment History" },
    { key: "invoices", label: "Invoices" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="mt-1 text-sm text-gray-400">
        Balance: <span className="font-semibold text-white">${balance}</span>
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">
          {success}
          <button onClick={() => setSuccess("")} className="ml-2 underline hover:text-emerald-300">Dismiss</button>
        </div>
      )}

      <div className="mt-6 border-b border-gray-800">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-white text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === "topup" && (
          <div className="mx-auto max-w-md">
            <form onSubmit={handleTopUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Amount (USD)</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[5, 10, 25, 50, 100, 200].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        topUpAmount === amt
                          ? "border-white bg-gray-800 text-white"
                          : "border-gray-700 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Custom Amount
                </label>
                <input
                  type="number"
                  min={1}
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(parseInt(e.target.value) || 1)}
                  className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Voucher Code <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                  placeholder="SAVE20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-white px-4 py-2.5 font-semibold text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {submitting ? "Processing..." : `Add $${topUpAmount} to Wallet`}
              </button>
            </form>
          </div>
        )}

        {activeTab === "history" && (
          <>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500">No payment history.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-left text-gray-400">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-gray-800/50">
                        <td className="py-2 text-gray-400">{new Date(p.createdAt).toLocaleString()}</td>
                        <td className="py-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                            p.type === "TOP_UP" ? "border-emerald-700 text-emerald-400 bg-emerald-950/30" : "border-blue-700 text-blue-400 bg-blue-950/30"
                          }`}>
                            {p.type === "TOP_UP" ? "Top-Up" : p.type}
                          </span>
                        </td>
                        <td className="py-2 text-gray-300">${p.amount}</td>
                        <td className="py-2">
                          <span className={p.status === "COMPLETED" ? "text-emerald-400" : p.status === "FAILED" ? "text-red-400" : "text-amber-400"}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "invoices" && (
          <>
            {invoices.length === 0 ? (
              <p className="text-sm text-gray-500">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-left text-gray-400">
                      <th className="pb-2 font-medium">Invoice #</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Subtotal</th>
                      <th className="pb-2 font-medium">Discount</th>
                      <th className="pb-2 font-medium">Total</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-800/50">
                        <td className="py-2 font-mono text-xs text-gray-300">{inv.invoiceNumber}</td>
                        <td className="py-2 text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                        <td className="py-2 text-gray-400">${inv.subtotal}</td>
                        <td className="py-2 text-gray-400">${inv.discountAmount}</td>
                        <td className="py-2 font-medium text-gray-300">${inv.total}</td>
                        <td className="py-2">
                          <span className={inv.status === "PAID" ? "text-emerald-400" : "text-amber-400"}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
