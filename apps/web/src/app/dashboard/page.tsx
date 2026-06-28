"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  balance: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }

        const json = await res.json();
        setUser(json.data);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  async function handleLogout() {
    const token = localStorage.getItem("access_token");
    if (token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    localStorage.removeItem("access_token");
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold">Welcome, {user?.username}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-400">Email</dt>
              <dd className="text-gray-200">{user?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Role</dt>
              <dd className="text-gray-200">{user?.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Balance</dt>
              <dd className="text-gray-200">${user?.balance}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold">Servers</h2>
          <p className="mt-2 text-sm text-gray-400">
            You don&apos;t have any servers yet. Create your first one!
          </p>
        </div>
      </div>
    </main>
  );
}
