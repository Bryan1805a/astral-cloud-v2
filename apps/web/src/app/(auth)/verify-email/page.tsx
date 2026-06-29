"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.data) { setStatus("success"); setMessage(json.data.message); }
        else { setStatus("error"); setMessage(json.error?.message || "Verification failed."); }
      })
      .catch(() => { setStatus("error"); setMessage("Network error."); });
  }, [searchParams]);

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <h1 className="text-2xl font-bold">Email Verification</h1>
      {status === "loading" && <p className="text-gray-400">Verifying your email...</p>}
      {status === "success" && (
        <>
          <p className="text-emerald-400">{message}</p>
          <button onClick={() => router.push("/login")}
            className="rounded-lg bg-white px-6 py-2.5 font-semibold text-gray-900 hover:bg-gray-200">Sign In</button>
        </>
      )}
      {status === "error" && <p className="text-red-400">{message}</p>}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<p className="text-gray-400">Verifying...</p>}>
        <VerifyForm />
      </Suspense>
    </main>
  );
}
