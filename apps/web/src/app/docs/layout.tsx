"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const DOCS_NAV = [
  {
    section: "Getting Started",
    items: [
      { label: "Introduction", href: "/docs" },
      { label: "Create Your First Server", href: "/docs/getting-started" },
    ],
  },
  {
    section: "Servers",
    items: [
      { label: "Server Lifecycle", href: "/docs/servers" },
    ],
  },
  {
    section: "API",
    items: [
      { label: "API Overview", href: "/docs/api" },
    ],
  },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-gray-800 bg-gray-900">
        <div className="flex h-14 items-center border-b border-gray-800 px-4">
          <Link href="/docs" className="text-lg font-bold tracking-tight">
            Astral Docs
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {DOCS_NAV.map((group) => (
            <div key={group.section}>
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {group.section}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/docs"
                      ? pathname === "/docs"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-gray-800 text-white font-medium"
                          : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-800 px-4 py-3">
          <Link
            href="/dashboard"
            className="block rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 transition-colors"
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="ml-56 flex-1">
        <div className="mx-auto max-w-3xl px-8 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
