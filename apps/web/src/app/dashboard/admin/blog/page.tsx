"use client";

import Link from "next/link";

export default function BlogAdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Blog</h1>
      <p className="text-sm text-gray-400">Manage blog content and categories</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/dashboard/admin/blog/posts"
          className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 hover:border-gray-700 transition-colors">
          <h2 className="text-lg font-semibold text-gray-200">Posts</h2>
          <p className="mt-2 text-sm text-gray-400">Create, edit, and publish blog posts with Markdown.</p>
        </Link>
        <Link href="/dashboard/admin/blog/categories"
          className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 hover:border-gray-700 transition-colors">
          <h2 className="text-lg font-semibold text-gray-200">Categories</h2>
          <p className="mt-2 text-sm text-gray-400">Manage blog categories like Tutorials, News, and Changelog.</p>
        </Link>
      </div>
    </div>
  );
}
