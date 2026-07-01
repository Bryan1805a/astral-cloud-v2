export default function DocsIndexPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Introduction</h1>
      <p className="mt-4 text-lg leading-relaxed text-gray-400">
        Astral Cloud is a production-grade cloud hosting platform that lets you
        deploy containerized servers in seconds. Whether you&apos;re running a
        personal blog, a SaaS app, or game servers — we make infrastructure simple.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="group rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-gray-700 transition-colors"
          >
            <div className="mb-2 inline-flex rounded-lg bg-gray-800 p-2 text-blue-400">
              {link.icon}
            </div>
            <h3 className="font-semibold text-gray-200 group-hover:text-white transition-colors">
              {link.title}
            </h3>
            <p className="mt-1 text-sm text-gray-400">{link.desc}</p>
          </a>
        ))}
      </div>

      <hr className="my-12 border-gray-800" />

      <h2 className="text-2xl font-bold tracking-tight">How It Works</h2>
      <div className="mt-6 space-y-6">
        {howItWorks.map((step, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-bold text-blue-400">
              {i + 1}
            </div>
            <div>
              <h3 className="font-semibold text-gray-200">{step.title}</h3>
              <p className="mt-1 text-sm text-gray-400">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <hr className="my-12 border-gray-800" />

      <h2 className="text-2xl font-bold tracking-tight">Core Concepts</h2>
      <div className="mt-6 space-y-4">
        {concepts.map((c) => (
          <div key={c.title} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h3 className="font-semibold text-gray-200">{c.title}</h3>
            <p className="mt-1 text-sm text-gray-400">{c.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}

const quickLinks = [
  {
    title: "Create Your First Server",
    desc: "Sign up, choose a plan, and deploy your first container in under 60 seconds.",
    href: "/docs/getting-started",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Manage Servers",
    desc: "Start, stop, restart, and delete servers. Configure firewalls, DNS, and backups.",
    href: "/docs/servers",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    title: "API Reference",
    desc: "Learn the REST API for programmatic server management, CLI, and Terraform.",
    href: "/docs/api",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    title: "Dashboard",
    desc: "Go straight to the dashboard to manage your servers, billing, and tickets.",
    href: "/dashboard",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
];

const howItWorks = [
  { title: "Sign up for an account", desc: "Register with your email and a strong password. Optionally enable two-factor authentication for extra security." },
  { title: "Top up your wallet", desc: "Add funds via Stripe (credit/debit card). Your wallet balance covers all server and resource charges." },
  { title: "Choose a plan and image", desc: "Pick a server plan (Starter, Pro, Business, Enterprise) or customize CPU/RAM/disk. Select an OS image like Ubuntu 24.04." },
  { title: "Deploy your server", desc: "Hit Create and your server provisions in under 60 seconds. You get a public IP, root password, and SSH access." },
  { title: "Manage and scale", desc: "Start, stop, resize, or delete servers from the dashboard. Add firewalls, DNS records, automated backups, and more." },
];

const concepts = [
  { title: "Server Instances", desc: "A server is a Docker container — not a full VM. This means provisioning takes seconds instead of minutes. You get a public IP, root SSH access, and resource limits defined by your chosen plan." },
  { title: "Wallet & Billing", desc: "Astral Cloud uses a pre-paid wallet system. You add funds to your wallet, and charges are deducted automatically — hourly for hourly billing, or monthly for subscription plans. Invoices are generated for every transaction." },
  { title: "Regions & Nodes", desc: "Regions are geographic data centers (e.g. US East, EU West). Each region contains multiple physical nodes (Docker hosts). When you create a server, the system picks a node with available capacity in your chosen region." },
  { title: "API-First Design", desc: "Every feature is built API-first. The web dashboard, CLI tool, and Terraform provider all use the same REST API. You can manage everything programmatically with API keys." },
];
