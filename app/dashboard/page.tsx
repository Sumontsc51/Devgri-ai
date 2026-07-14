"use client";

/* The workspace moved: the finalized AI app builder (chat + architecture
   tree + preview, real Claude) lives at /builder. This route is kept as a
   redirect so old links, bookmarks, and the login flow keep working. */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/builder");
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
    </main>
  );
}
