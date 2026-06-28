"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          confirmPassword,
          referralCode: referralCode || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.error?.details) {
          const fields: Record<string, string> = {};
          json.error.details.forEach((d: { field: string; message: string }) => {
            fields[d.field] = d.message;
          });
          setFieldErrors(fields);
        }
        setError(json.error?.message || "Registration failed");
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="mt-1 text-sm text-gray-400">Start hosting in seconds</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              minLength={3}
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
              placeholder="jane_doe"
            />
            {fieldErrors.username && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
              placeholder="you@example.com"
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
              placeholder="Min 8 chars, upper + lower + digit"
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
              placeholder="Repeat your password"
            />
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <div>
            <label htmlFor="referralCode" className="block text-sm font-medium text-gray-300">
              Referral Code <span className="text-gray-500">(optional)</span>
            </label>
            <input
              id="referralCode"
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
              placeholder="ABCD1234"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-white px-4 py-2.5 font-semibold text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-gray-200 hover:text-white underline">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
