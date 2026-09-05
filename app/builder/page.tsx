"use client";

/* The finalized AI app builder — one merged system:
   chat + architecture tree + live site preview, powered by real AI models
   (Anthropic / OpenAI / Google, BYOK). Supabase handles auth and projects. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { stripApiKeys } from "@/lib/workspace";
import { BUILDER_CSS, BUILDER_HTML } from "./ui";
import { initBuilder, type ProjectRow } from "./engine";

/* getSession() can legitimately return null for a beat right after a
   redirect, while the client is still reading the persisted session out of
   storage (and while an email link's tokens are still being parsed out of
   the URL). Bouncing to /login on that first null is what produces the
   "it logs me in and throws me straight back out" loop, so wait for the
   auth client to actually settle before giving up. */
async function resolveSession(timeoutMs = 2500): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  return new Promise<Session | null>((resolve) => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        clearTimeout(timer);
        sub.subscription.unsubscribe();
        resolve(session);
      }
    });
    const timer = setTimeout(() => {
      sub.subscription.unsubscribe();
      resolve(null);
    }, timeoutMs);
  });
}

export default function BuilderPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const bootedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const session = await resolveSession();
      if (cancelled) return;

      if (!session) {
        router.replace("/login");
        return;
      }
      const uid = session.user.id;

      /* Load saved builder projects (most recent first). */
      const projects: ProjectRow[] = [];
      try {
        const { data: rows } = await supabase
          .from("workspaces")
          .select("id, name, nodes")
          .eq("user_id", uid)
          .order("updated_at", { ascending: false })
          .limit(10);
        (rows || []).forEach((ws) => {
          const n = ws.nodes as
            | { builder?: boolean; tree?: unknown; conns?: unknown[] }
            | null;
          projects.push({
            id: ws.id,
            name: ws.name || "Untitled",
            data:
              n && n.builder && n.tree
                ? { tree: n.tree, conns: (n.conns as never[]) || [] }
                : null,
          });
        });
      } catch {
        /* start fresh */
      }
      if (cancelled) return;

      setReady(true);

      /* Mount the engine on the next tick, once the markup is in the DOM. */
      requestAnimationFrame(() => {
        if (cancelled || bootedRef.current || !rootRef.current) return;
        bootedRef.current = true;
        initBuilder(rootRef.current, {
          projects,
          save: async ({ tree, conns, name }, projectId) => {
            const payload = {
              user_id: uid,
              name,
              nodes: {
                builder: true,
                tree: stripApiKeys(tree),
                conns: stripApiKeys(conns),
                name,
              },
              edges: [],
            };
            if (projectId) {
              const { error } = await supabase
                .from("workspaces")
                .update(payload)
                .eq("id", projectId);
              if (error) return { error: friendly(error.message) };
              return { id: projectId };
            }
            const { data: created, error } = await supabase
              .from("workspaces")
              .insert(payload)
              .select("id")
              .single();
            if (error) return { error: friendly(error.message) };
            return { id: (created as { id: string }).id };
          },
          signOut: async () => {
            await supabase.auth.signOut();
            window.location.assign("/login");
          },
        });
      });
    }

    boot().catch((e) =>
      setLoadError(e instanceof Error ? e.message : "Failed to load")
    );

    /* If the session goes away in another tab, don't leave a dead workspace
       sitting open here. */
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") window.location.assign("/login");
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
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

function friendly(msg: string): string {
  return msg.toLowerCase().includes("policy")
    ? "trial ended — read-only. Upgrade to keep saving."
    : msg;
}
