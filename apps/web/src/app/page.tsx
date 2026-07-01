import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="text-lg font-bold tracking-tight">Astral Cloud</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-20 sm:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900 px-4 py-1.5 text-sm text-gray-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Now in public beta
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Deploy servers
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                in seconds
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-400 sm:text-xl">
              Production-grade cloud hosting for developers. Containerized servers,
              block storage, private networking, and a clean API — all open-source
              and self-hostable.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-gray-900 hover:bg-gray-200 transition-colors sm:w-auto"
              >
                Start Building Free
                <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-gray-700 px-8 py-4 text-base font-semibold text-gray-300 hover:bg-gray-800 transition-colors sm:w-auto"
              >
                View Demo
              </Link>
            </div>
          </div>
        </div>

        {/* Gradient blobs */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-500/20 via-transparent to-emerald-500/20 blur-3xl" />
      </section>

      {/* Features */}
      <section className="border-t border-gray-800 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to ship
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              From instant server provisioning to automated backups — we handle
              the infrastructure so you can focus on building.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-800 bg-gray-900 p-6 hover:border-gray-700 transition-colors"
              >
                <div className="mb-4 inline-flex rounded-lg bg-gray-800 p-3 text-blue-400">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-gray-800 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              Pay only for what you use. No hidden fees, no surprises.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p, i) => (
              <div
                key={p.name}
                className={`relative rounded-2xl border p-6 ${
                  i === 1
                    ? "border-blue-500/50 bg-gradient-to-b from-blue-500/10 to-transparent ring-1 ring-blue-500/20"
                    : "border-gray-800 bg-gray-900"
                }`}
              >
                {i === 1 && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-0.5 text-xs font-semibold text-white">
                    Popular
                  </span>
                )}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">${p.price}</span>
                  <span className="text-sm text-gray-400">/mo</span>
                </div>
                <p className="mt-2 text-sm text-gray-400">{p.desc}</p>
                <ul className="mt-6 space-y-2">
                  {p.specs.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm text-gray-300">
                      <svg className="h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {s}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                    i === 1
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "border border-gray-700 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-gray-800 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-white">{s.value}</div>
                <div className="mt-1 text-sm text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-800 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 px-8 py-16 text-center sm:px-16">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-500/15 to-emerald-500/15 blur-2xl" />
            <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to deploy?
            </h2>
            <p className="relative mt-4 text-lg text-gray-400">
              Get a server running in under 60 seconds. No credit card required.
            </p>
            <div className="relative mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-gray-900 hover:bg-gray-200 transition-colors sm:w-auto"
              >
                Create Free Account
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-gray-700 px-8 py-4 text-base font-semibold text-gray-300 hover:bg-gray-800 transition-colors sm:w-auto"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-lg font-bold tracking-tight">Astral Cloud</span>
              <p className="mt-2 text-sm text-gray-400">
                Open-source cloud hosting platform.
              </p>
            </div>
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h4 className="text-sm font-semibold text-gray-300">{group.title}</h4>
                <ul className="mt-3 space-y-2">
                  {group.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 border-t border-gray-800 pt-6 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Astral Cloud. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    title: "Instant Provisioning",
    desc: "Containerized servers deploy in under 60 seconds. No VM overhead, no waiting for hardware allocation.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: "Block Storage",
    desc: "Attach up to 16 TB of persistent SSD storage per volume. Resize upward anytime without downtime.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
      </svg>
    ),
  },
  {
    title: "Private Networking",
    desc: "Connect servers within a region over isolated VLANs. Zero-trust networking with configurable firewalls.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
      </svg>
    ),
  },
  {
    title: "Firewall Rules",
    desc: "Per-server inbound firewall with protocol, port, and CIDR controls. Default deny-all keeps you safe.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "REST API & CLI",
    desc: "Programmatic access via API keys. CLI tool and Terraform provider for infrastructure-as-code workflows.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    title: "Automated Backups",
    desc: "Schedule daily, weekly, and monthly backups. Restore to any point in time with one click.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
    ),
  },
];

const plans = [
  {
    name: "Starter",
    price: 5,
    desc: "For side projects and static sites.",
    specs: ["1 vCPU", "1 GB RAM", "25 GB SSD", "1 TB transfer"],
  },
  {
    name: "Pro",
    price: 15,
    desc: "For SaaS apps and production workloads.",
    specs: ["2 vCPU", "4 GB RAM", "80 GB SSD", "3 TB transfer", "Automated backups"],
  },
  {
    name: "Business",
    price: 40,
    desc: "For high-traffic apps and APIs.",
    specs: ["4 vCPU", "8 GB RAM", "160 GB SSD", "5 TB transfer", "Private networking", "Priority support"],
  },
  {
    name: "Enterprise",
    price: 120,
    desc: "Custom solutions for large teams.",
    specs: ["8 vCPU", "16 GB RAM", "320 GB SSD", "10 TB transfer", "All features included"],
  },
];

const stats = [
  { value: "60s", label: "Time to first server" },
  { value: "99.5%", label: "API uptime SLA" },
  { value: "8", label: "Global regions" },
  { value: "15K+", label: "Containers deployed" },
];

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Pricing", href: "#" },
      { label: "Features", href: "#" },
      { label: "Changelog", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "API Reference", href: "/docs/api" },
      { label: "CLI", href: "#" },
      { label: "Terraform", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];
