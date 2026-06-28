export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
        Astral Cloud
      </h1>
      <p className="mt-4 text-lg text-gray-400 max-w-md text-center">
        Production-grade cloud hosting. Open-source. Self-hostable.
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/login"
          className="rounded-lg bg-white px-6 py-3 font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
        >
          Sign In
        </a>
        <a
          href="/register"
          className="rounded-lg border border-gray-700 px-6 py-3 font-semibold text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Sign Up
        </a>
      </div>
    </main>
  );
}
