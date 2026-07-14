"use client";

/* /builder and the AI-workflow canvas are one merged system — the full
   workspace (chat + canvas + architecture tree) lives at /dashboard.
   This route is kept as an alias so existing links keep working. */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function BuilderAlias() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
    </main>
  );
}
