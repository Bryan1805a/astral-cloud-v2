"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Payment {
  id: string; amount: string; currency: string; status: string; type: string; createdAt: string;
}

interface Invoice {
  id: string; invoiceNumber: string; subtotal: string; taxAmount: string;
  discountAmount: string; total: string; currency: string; status: string;
  pdfUrl: string | null; createdAt: string;
}

interface PaymentMethod {
  id: string; brand: string; last4: string; expMonth: number; expYear: number;
  isDefault: boolean; createdAt: string;
}

const LIMIT = 15;

export default function BillingPage() {
  const [balance, setBalance] = useState<string>("0.00");
  const [topUpAmount, setTopUpAmount] = useState(10);
  const [voucherCode, setVoucherCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [activeTab, setActiveTab] = useState<"topup" | "methods" | "history" | "invoices">("topup");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentTotalPages, setPaymentTotalPages] = useState(1);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceTotalPages, setInvoiceTotalPages] = useState(1);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const data = await api.get<{ balance: string }>("/auth/me");
      if (data.balance) setBalance(data.balance);
    } catch { /* noop */ }
  }, []);

  const fetchPayments = useCallback(async (page: number) => {
    try {
      const res = await api.getPaginated<Payment>(`/billing/history?page=${page}&limit=${LIMIT}`);
      setPayments(res.data || []);
      setPaymentTotal(res.meta?.total || 0);
      setPaymentTotalPages(res.meta?.totalPages || 1);
    } catch { /* noop */ }
  }, []);

  const fetchInvoices = useCallback(async (page: number) => {
    try {
      const res = await api.getPaginated<Invoice>(`/billing/invoices?page=${page}&limit=${LIMIT}`);
      setInvoices(res.data || []);
      setInvoiceTotal(res.meta?.total || 0);
      setInvoiceTotalPages(res.meta?.totalPages || 1);
    } catch { /* noop */ }
  }, []);

  const fetchPaymentMethods = useCallback(async () => {
    setMethodsLoading(true);
    try {
      const data = await api.get<PaymentMethod[]>("/wallet/payment-methods");
      setPaymentMethods(data);
    } catch { /* noop */ }
    finally { setMethodsLoading(false); }
  }, []);

  useEffect(() => {
    Promise.all([fetchBalance(), fetchPayments(1), fetchInvoices(1)]).finally(() => setLoadingMeta(false));
  }, [fetchBalance, fetchPayments, fetchInvoices]);

  useEffect(() => { fetchPayments(paymentPage); }, [paymentPage, fetchPayments]);
  useEffect(() => { fetchInvoices(invoicePage); }, [invoicePage, fetchInvoices]);
  useEffect(() => {
    if (activeTab === "methods") fetchPaymentMethods();
  }, [activeTab, fetchPaymentMethods]);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setSubmitting(true);
    try {
      const result = await api.post<{
        paymentId: string; originalAmount: number; discountAmount: number;
        finalAmount: number; voucherCode: string | null; status: string;
      }>("/wallet/top-up", { amount: topUpAmount, voucherCode: voucherCode || undefined });

      setSuccess(`Added $${topUpAmount}. New balance: $${(parseFloat(balance) + topUpAmount).toFixed(2)}`);
      if (result.discountAmount > 0) {
        setSuccess((s) => `${s} (Saved $${result.discountAmount} with voucher!)`);
      }
      setVoucherCode("");
      await Promise.all([fetchBalance(), fetchPayments(1), fetchInvoices(1)]);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Top-up failed");
    } finally { setSubmitting(false); }
  }

  async function handleDeleteMethod(id: string) {
    setError("");
    try {
      await api.del(`/wallet/payment-methods/${id}`);
      await fetchPaymentMethods();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to delete payment method");
    }
  }

  async function handleSetDefault(id: string) {
    setError("");
    try {
      await api.put(`/wallet/payment-methods/${id}`, { isDefault: true });
      await fetchPaymentMethods();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to set default");
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

  const tabs: { key: "topup" | "methods" | "history" | "invoices"; label: string }[] = [
    { key: "topup", label: "Top Up" },
    { key: "methods", label: "Payment Methods" },
    { key: "history", label: "Payment History" },
    { key: "invoices", label: "Invoices" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="mt-1 text-sm">
            Balance: <span className="font-semibold text-white">${balance}</span>
          </p>
        </div>
      </div>

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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400">Total Payments</p>
          <p className="mt-1 text-xl font-semibold text-white">{paymentTotal}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400">Invoices</p>
          <p className="mt-1 text-xl font-semibold text-white">{invoiceTotal}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400">Saved Cards</p>
          <p className="mt-1 text-xl font-semibold text-white">{paymentMethods.length}</p>
        </div>
      </div>

      <div className="mt-6 border-b border-gray-800">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key ? "border-b-2 border-white text-white" : "text-gray-400 hover:text-gray-300"
              }`}>
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
                    <button key={amt} type="button" onClick={() => setTopUpAmount(amt)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        topUpAmount === amt ? "border-white bg-gray-800 text-white" : "border-gray-700 text-gray-400 hover:border-gray-600"
                      }`}>${amt}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">Custom Amount</label>
                <input type="number" min={1} value={topUpAmount}
                  onChange={(e) => setTopUpAmount(parseInt(e.target.value) || 1)}
                  className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 focus:border-white focus:outline-none focus:ring-1 focus:ring-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Voucher Code <span className="text-gray-500">(optional)</span>
                </label>
                <input type="text" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                  placeholder="SAVE20" />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full rounded-lg bg-white px-4 py-2.5 font-semibold text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-50">
                {submitting ? "Processing..." : `Add $${topUpAmount} to Wallet`}
              </button>
            </form>
          </div>
        )}

        {activeTab === "methods" && (
          <div>
            {methodsLoading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : paymentMethods.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No saved payment methods.</p>
                <p className="mt-1 text-xs text-gray-600">Payment methods are saved when you complete a top-up.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-14 items-center justify-center rounded border border-gray-700 bg-gray-800 text-xs font-mono text-gray-400">
                        {pm.brand.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-gray-200">
                          {pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)} ending in {pm.last4}
                          {pm.isDefault && <span className="ml-2 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">Default</span>}
                        </p>
                        <p className="text-xs text-gray-500">Expires {pm.expMonth}/{pm.expYear}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!pm.isDefault && (
                        <button onClick={() => handleSetDefault(pm.id)}
                          className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800">
                          Set Default
                        </button>
                      )}
                      <button onClick={() => handleDeleteMethod(pm.id)}
                        className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500">No payment history.</p>
            ) : (
              <>
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
                {paymentTotalPages > 1 && (
                  <Pagination page={paymentPage} totalPages={paymentTotalPages} onPageChange={setPaymentPage} />
                )}
              </>
            )}
          </>
        )}

        {activeTab === "invoices" && (
          <>
            {invoices.length === 0 ? (
              <p className="text-sm text-gray-500">No invoices yet.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-left text-gray-400">
                        <th className="pb-2 font-medium">Invoice #</th>
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Subtotal</th>
                        <th className="pb-2 font-medium">Tax</th>
                        <th className="pb-2 font-medium">Discount</th>
                        <th className="pb-2 font-medium">Total</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-gray-800/50">
                          <td className="py-2 font-mono text-xs text-gray-300">{inv.invoiceNumber}</td>
                          <td className="py-2 text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                          <td className="py-2 text-gray-400">${inv.subtotal}</td>
                          <td className="py-2 text-gray-400">${inv.taxAmount}</td>
                          <td className="py-2 text-gray-400">${inv.discountAmount}</td>
                          <td className="py-2 font-medium text-gray-300">${inv.total}</td>
                          <td className="py-2">
                            <span className={inv.status === "PAID" ? "text-emerald-400" : "text-amber-400"}>{inv.status}</span>
                          </td>
                          <td className="py-2 text-right">
                            {inv.pdfUrl ? (
                              <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 underline">PDF</a>
                            ) : (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {invoiceTotalPages > 1 && (
                  <Pagination page={invoicePage} totalPages={invoiceTotalPages} onPageChange={setInvoicePage} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
        className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30 hover:bg-gray-800">Prev</button>
      <span>Page {page} of {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
        className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30 hover:bg-gray-800">Next</button>
    </div>
  );
}
