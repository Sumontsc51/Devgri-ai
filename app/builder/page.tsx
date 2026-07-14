"use client";

/* The finalized AI app builder — one merged system:
   chat + architecture tree + preview, powered by real Claude (BYOK).
   Supabase handles auth and project persistence. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BUILDER_CSS, BUILDER_HTML } from "./ui";
import { initBuilder, type SavedProject } from "./engine";

export default function BuilderPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const bootedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      if (cancelled) return;
      const uid = data.session.user.id;

      /* Load the most recent saved builder project (if any). */
      let initial: SavedProject = null;
      let workspaceId: string | null = null;
      try {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("id, nodes")
          .eq("user_id", uid)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ws) {
          workspaceId = ws.id;
          const n = ws.nodes as { builder?: boolean; tree?: unknown; conns?: unknown[] } | null;
          if (n && n.builder && n.tree) {
            initial = { tree: n.tree, conns: (n.conns as never[]) || [] };
          }
        }
      } catch {
        /* no saved project — start fresh */
      }
      if (cancelled) return;

      setReady(true);

      /* Mount the engine on the next tick, once the markup is in the DOM. */
      requestAnimationFrame(() => {
        if (cancelled || bootedRef.current || !rootRef.current) return;
        bootedRef.current = true;
        initBuilder(rootRef.current, {
          initial,
          save: async ({ tree, conns, name }) => {
            const payload = {
              user_id: uid,
              name,
              nodes: { builder: true, tree, conns, name },
              edges: [],
            };
            const result = workspaceId
              ? await supabase.from("workspaces").update(payload).eq("id", workspaceId)
              : await supabase.from("workspaces").insert(payload).select("id").single();
            if (result.error) {
              return result.error.message.toLowerCase().includes("policy")
                ? "trial ended — read-only. Upgrade to keep saving."
                : result.error.message;
            }
            if (!workspaceId && "data" in result && result.data) {
              workspaceId = (result.data as { id: string }).id;
            }
            return null;
          },
          signOut: async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          },
        });
      });
    }

    boot().catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <p className="text-sm text-red-300">{loadError}</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      </main>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BUILDER_CSS }} />
      <div
        id="builder-root"
        ref={rootRef}
        dangerouslySetInnerHTML={{ __html: BUILDER_HTML }}
      />
    </>
  );
}
