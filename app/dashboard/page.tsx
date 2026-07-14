"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "@/lib/supabase";
import {
  Workflow,
  KeyRound,
  ShieldCheck,
  Save,
  LogOut,
  Loader2,
  Lock,
  Plus,
  Eye,
  EyeOff,
  Play,
  FileText,
  Sparkles,
  Terminal,
} from "lucide-react";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;
const TOKEN_RE = /\b(sk|pk|key|tok)[-_][A-Za-z0-9-_]{8,}\b/g;

function maskText(input: string): string {
  return input
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(TOKEN_RE, "[TOKEN]")
    .replace(PHONE_RE, "[PHONE]");
}

type RunStatus = "idle" | "running" | "done" | "error";

type NodeData = {
  provider?: string;
  apiKey?: string;
  text?: string;
  instruction?: string;
  model?: string;
  result?: string;
  status?: RunStatus;
  errorMsg?: string;
  onChange?: (id: string, patch: Record<string, unknown>) => void;
};

type FlowNode = Node<NodeData>;

function statusRing(status?: RunStatus): string {
  switch (status) {
    case "running":
      return "border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.35)] animate-pulse";
    case "done":
      return "border-emerald-500/70 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]";
    case "error":
      return "border-red-500/70 shadow-[0_0_0_3px_rgba(239,68,68,0.25)]";
    default:
      return "";
  }
}

function InputNode({ id, data }: NodeProps<NodeData>) {
  return (
    <div
      className={`w-64 rounded-xl border border-sky-500/40 bg-panel p-3 shadow-lg shadow-black/40 ${statusRing(
        data.status
      )}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4 text-sky-400" />
        <span className="text-xs font-semibold text-white">Input</span>
      </div>
      <textarea
        value={data.text ?? ""}
        onChange={(e) => data.onChange?.(id, { text: e.target.value })}
        rows={4}
        placeholder="Raw text to feed into the workflow…"
        className="nodrag w-full resize-none rounded-md border border-line bg-ink px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-sky-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-ink !bg-sky-400"
      />
    </div>
  );
}

function ApiKeyNode({ id, data }: NodeProps<NodeData>) {
  const [show, setShow] = useState(false);
  return (
    <div
      className={`w-64 rounded-xl border border-indigo-500/40 bg-panel p-3 shadow-lg shadow-black/40 ${statusRing(
        data.status
      )}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-indigo-400" />
        <span className="text-xs font-semibold text-white">API Key (BYOK)</span>
      </div>
      <select
        value={data.provider ?? "anthropic"}
        onChange={(e) => data.onChange?.(id, { provider: e.target.value })}
        className="nodrag mb-2 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-indigo-500"
      >
        <option value="anthropic">Anthropic (Claude)</option>
      </select>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={data.apiKey ?? ""}
          onChange={(e) => data.onChange?.(id, { apiKey: e.target.value })}
          placeholder="sk-ant-…"
          className="nodrag w-full rounded-md border border-line bg-ink px-2 py-1.5 pr-8 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="nodrag absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          aria-label={show ? "Hide key" : "Show key"}
        >
          {show ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-gray-500">
        Session only. Stripped before every save — never stored on our servers.
      </p>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-ink !bg-indigo-400"
      />
    </div>
  );
}

function MaskingNode({ id, data }: NodeProps<NodeData>) {
  const preview = maskText(data.text ?? "");
  return (
    <div
      className={`w-72 rounded-xl border border-emerald-500/40 bg-panel p-3 shadow-lg shadow-black/40 ${statusRing(
        data.status
      )}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-ink !bg-emerald-400"
      />
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-400" />
        <span className="text-xs font-semibold text-white">
          PII Data Masking
        </span>
      </div>
      <p className="mb-2 text-[10px] leading-snug text-gray-500">
        Masks emails, phone numbers, and secret tokens from upstream input.
        Type below to test it standalone.
      </p>
      <textarea
        value={data.text ?? ""}
        onChange={(e) => data.onChange?.(id, { text: e.target.value })}
        rows={2}
        placeholder="Fallback text (used only if nothing is connected)…"
        className="nodrag w-full resize-none rounded-md border border-line bg-ink px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500"
      />
      <div className="mt-2 rounded-md border border-line bg-ink p-2">
        <p className="mb-1 text-[10px] font-medium text-gray-500">
          {data.result !== undefined
            ? "Last run output:"
            : "Standalone preview:"}
        </p>
        <p className="break-words font-mono text-[11px] leading-snug text-emerald-300">
          {data.result !== undefined ? data.result || "—" : preview || "—"}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-ink !bg-emerald-400"
      />
    </div>
  );
}

function AiNode({ id, data }: NodeProps<NodeData>) {
  return (
    <div
      className={`w-72 rounded-xl border border-violet-500/40 bg-panel p-3 shadow-lg shadow-black/40 ${statusRing(
        data.status
      )}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-ink !bg-violet-400"
      />
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <span className="text-xs font-semibold text-white">AI (Claude)</span>
      </div>
      <select
        value={data.model ?? "claude-haiku-4-5-20251001"}
        onChange={(e) => data.onChange?.(id, { model: e.target.value })}
        className="nodrag mb-2 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-violet-500"
      >
        <option value="claude-haiku-4-5-20251001">
          Claude Haiku 4.5 (fast)
        </option>
        <option value="claude-sonnet-5">Claude Sonnet 5 (balanced)</option>
        <option value="claude-opus-4-8">Claude Opus 4.8 (strongest)</option>
      </select>
      <textarea
        value={data.instruction ?? ""}
        onChange={(e) => data.onChange?.(id, { instruction: e.target.value })}
        rows={2}
        placeholder="Instruction, e.g. “Summarize this in 3 bullet points”"
        className="nodrag w-full resize-none rounded-md border border-line bg-ink px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-violet-500"
      />
      {data.status === "error" && (
        <p className="mt-2 break-words rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[10px] text-red-300">
          {data.errorMsg}
        </p>
      )}
      {data.status === "done" && data.result !== undefined && (
        <p className="mt-2 max-h-24 overflow-y-auto break-words rounded-md border border-line bg-ink p-2 font-mono text-[10px] leading-snug text-violet-200">
          {data.result.slice(0, 400)}
          {data.result.length > 400 ? "…" : ""}
        </p>
      )}
      <p className="mt-2 text-[10px] leading-snug text-gray-500">
        Connect an API Key node. The call runs in your browser — key and data
        go directly to Anthropic, never through Devgri.
      </p>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-ink !bg-violet-400"
      />
    </div>
  );
}

function OutputNode({ data }: NodeProps<NodeData>) {
  return (
    <div
      className={`w-80 rounded-xl border border-amber-500/40 bg-panel p-3 shadow-lg shadow-black/40 ${statusRing(
        data.status
      )}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-ink !bg-amber-400"
      />
      <div className="mb-2 flex items-center gap-2">
        <Terminal className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-semibold text-white">Output</span>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-line bg-ink p-2.5">
        <p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-amber-100">
          {data.result || "Run the workflow to see the result here."}
        </p>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  input: InputNode,
  apiKey: ApiKeyNode,
  masking: MaskingNode,
  ai: AiNode,
  output: OutputNode,
};

const DEFAULT_NODES: FlowNode[] = [
  {
    id: "n1",
    type: "input",
    position: { x: 40, y: 60 },
    data: {
      text: "Customer wrote: please contact me at jane.doe@acme.com or +1 415 555 0132. My key is sk-a8f3k2m9x1p7q4. She wants a refund for order #4412.",
    },
  },
  {
    id: "n2",
    type: "apiKey",
    position: { x: 40, y: 340 },
    data: { provider: "anthropic", apiKey: "" },
  },
  {
    id: "n3",
    type: "masking",
    position: { x: 380, y: 60 },
    data: { text: "" },
  },
  {
    id: "n4",
    type: "ai",
    position: { x: 740, y: 150 },
    data: {
      model: "claude-haiku-4-5-20251001",
      instruction: "Summarize the customer request in one sentence.",
    },
  },
  {
    id: "n5",
    type: "output",
    position: { x: 1100, y: 170 },
    data: {},
  },
];

const DEFAULT_EDGES: Edge[] = [
  { id: "e1-3", source: "n1", target: "n3", animated: true },
  { id: "e3-4", source: "n3", target: "n4", animated: true },
  { id: "e2-4", source: "n2", target: "n4", animated: true },
  { id: "e4-5", source: "n4", target: "n5", animated: true },
];

function topologicalOrder(nodes: FlowNode[], edges: Edge[]): string[] | null {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  nodes.forEach((n) => {
    indegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });
  edges.forEach((e) => {
    if (!indegree.has(e.source) || !indegree.has(e.target)) return;
    adjacency.get(e.source)!.push(e.target);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  });
  const queue = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  return order.length === nodes.length ? order : null;
}

async function callClaude(
  apiKey: string,
  model: string,
  instruction: string,
  inputText: string
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: instruction
            ? `${instruction}\n\n---\n\n${inputText}`
            : inputText,
        },
      ],
    }),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      detail = err?.error?.message ?? detail;
    } catch {
      /* keep HTTP status */
    }
    throw new Error(detail);
  }

  const json = await response.json();
  const block = Array.isArray(json.content)
    ? json.content.find((c: { type: string }) => c.type === "text")
    : null;
  return block?.text ?? "";
}

export default function DashboardPage() {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(true);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const workspaceId = useRef<string | null>(null);
  const idCounter = useRef(100);
  const nodesRef = useRef<FlowNode[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  nodesRef.current = nodes as FlowNode[];
  edgesRef.current = edges;

  const updateNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
        )
      );
    },
    [setNodes]
  );

  const withHandlers = useCallback(
    (list: FlowNode[]): FlowNode[] =>
      list.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: "idle" as RunStatus,
          onChange: updateNodeData,
        },
      })),
    [updateNodeData]
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const uid = sessionData.session.user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_premium, created_at")
        .eq("id", uid)
        .single();

      if (profile && !cancelled) {
        const ageMs = Date.now() - new Date(profile.created_at).getTime();
        setIsPremium(profile.is_premium);
        setDaysLeft(Math.max(0, 3 - Math.floor(ageMs / 86400000)));
        setCanWrite(profile.is_premium || ageMs < 3 * 86400000);
      }

      const { data: ws } = await supabase
        .from("workspaces")
        .select("id, nodes, edges")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (ws) {
        workspaceId.current = ws.id;
        const loaded = (ws.nodes as FlowNode[]) ?? [];
        setNodes(withHandlers(loaded.length ? loaded : DEFAULT_NODES));
        setEdges(
          ((ws.edges as Edge[]) ?? []).length
            ? (ws.edges as Edge[])
            : DEFAULT_EDGES
        );
      } else {
        const { data: created } = await supabase
          .from("workspaces")
          .insert({
            user_id: uid,
            name: "My workspace",
            nodes: DEFAULT_NODES,
            edges: DEFAULT_EDGES,
          })
          .select("id")
          .single();
        if (created) workspaceId.current = created.id;
        setNodes(withHandlers(DEFAULT_NODES));
        setEdges(DEFAULT_EDGES);
      }
      setBooting(false);
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [router, setNodes, setEdges, withHandlers]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  function addNode(type: keyof typeof nodeTypes) {
    idCounter.current += 1;
    const id = `n${idCounter.current}`;
    const base: Record<string, NodeData> = {
      input: { text: "" },
      apiKey: { provider: "anthropic", apiKey: "" },
      masking: { text: "" },
      ai: { model: "claude-haiku-4-5-20251001", instruction: "" },
      output: {},
    };
    const newNode: FlowNode = {
      id,
      type: type as string,
      position: { x: 120 + Math.random() * 400, y: 60 + Math.random() * 320 },
      data: { ...base[type], status: "idle", onChange: updateNodeData },
    };
    setNodes((nds) => [...nds, newNode]);
  }

  async function runWorkflow() {
    if (running) return;
    const flowNodes = nodesRef.current;
    const flowEdges = edgesRef.current;

    const order = topologicalOrder(flowNodes, flowEdges);
    if (!order) {
      setStatusMsg("Cannot run: the workflow contains a cycle.");
      return;
    }

    setRunning(true);
    setStatusMsg("Running workflow…");
    order.forEach((id) =>
      updateNodeData(id, { status: "idle", errorMsg: undefined })
    );

    const byId = new Map(flowNodes.map((n) => [n.id, n]));
    const parentsOf = (id: string): FlowNode[] =>
      flowEdges
        .filter((e) => e.target === id)
        .map((e) => byId.get(e.source))
        .filter((n): n is FlowNode => Boolean(n));

    const outputs = new Map<string, string>();
    const keys = new Map<string, string>();
    let failed = false;

    for (const id of order) {
      if (failed) break;
      const node = byId.get(id);
      if (!node) continue;

      updateNodeData(id, { status: "running" });
      await new Promise((r) => setTimeout(r, 250));

      const textParents = parentsOf(id).filter((p) => p.type !== "apiKey");
      const upstreamText = textParents
        .map((p) => outputs.get(p.id) ?? "")
        .filter(Boolean)
        .join("\n\n");

      try {
        switch (node.type) {
          case "input": {
            outputs.set(id, node.data.text ?? "");
            updateNodeData(id, { status: "done" });
            break;
          }
          case "apiKey": {
            keys.set(id, node.data.apiKey ?? "");
            outputs.set(id, "");
            updateNodeData(id, { status: "done" });
            break;
          }
          case "masking": {
            const source = upstreamText || node.data.text || "";
            const masked = maskText(source);
            outputs.set(id, masked);
            updateNodeData(id, { status: "done", result: masked });
            break;
          }
          case "ai": {
            const keyParent = parentsOf(id).find((p) => p.type === "apiKey");
            const anyKeyNode = flowNodes.find((n) => n.type === "apiKey");
            const apiKey =
              (keyParent && keys.get(keyParent.id)) ||
              keyParent?.data.apiKey ||
              anyKeyNode?.data.apiKey ||
              "";
            if (!apiKey) {
              throw new Error(
                "No API key. Add an API Key node, paste your Anthropic key, and connect it to this AI node."
              );
            }
            if (!upstreamText && !node.data.instruction) {
              throw new Error(
                "Nothing to send. Connect an Input or Masking node, or set an instruction."
              );
            }
            const answer = await callClaude(
              apiKey,
              node.data.model ?? "claude-haiku-4-5-20251001",
              node.data.instruction ?? "",
              upstreamText || "(no input)"
            );
            outputs.set(id, answer);
            updateNodeData(id, { status: "done", result: answer });
            break;
          }
          case "output": {
            const final = upstreamText;
            outputs.set(id, final);
            updateNodeData(id, { status: "done", result: final });
            break;
          }
          default: {
            outputs.set(id, upstreamText);
            updateNodeData(id, { status: "done" });
          }
        }
      } catch (err) {
        failed = true;
        const message =
          err instanceof Error ? err.message : "Unknown execution error";
        updateNodeData(id, { status: "error", errorMsg: message });
        setStatusMsg(`Run failed at "${node.type}" node: ${message}`);
      }
    }

    if (!failed) setStatusMsg("Run complete ✓");
    setRunning(false);
    setTimeout(() => setStatusMsg(null), 4000);
  }

  async function saveWorkspace() {
    if (!workspaceId.current || !canWrite) return;
    setSaving(true);

    const cleaned = nodesRef.current.map((n) => {
      const { onChange, apiKey, status, errorMsg, ...rest } =
        n.data as NodeData;
      const cleanData: Record<string, unknown> = { ...rest };
      if (n.type === "apiKey") cleanData.apiKey = "";
      return { ...n, data: cleanData };
    });

    const { error } = await supabase
      .from("workspaces")
      .update({ nodes: cleaned, edges: edgesRef.current })
      .eq("id", workspaceId.current);

    setSaving(false);
    if (error) {
      setStatusMsg(
        error.message.toLowerCase().includes("policy")
          ? "Trial ended — workspace is read-only. Upgrade to keep editing."
          : `Save failed: ${error.message}`
      );
    } else {
      setStatusMsg("Workspace saved");
      setTimeout(() => setStatusMsg(null), 2500);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-ink">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
            <Workflow className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Devgri AI</span>
        </div>

        <div className="mx-2 h-5 w-px bg-line" />

        {(
          [
            ["input", "Input"],
            ["masking", "Masking"],
            ["ai", "AI"],
            ["output", "Output"],
            ["apiKey", "API Key"],
          ] as [keyof typeof nodeTypes, string][]
        ).map(([type, label]) => (
          <button
            key={type}
            onClick={() => addNode(type)}
            className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-gray-300 transition hover:border-indigo-500/50 hover:text-white"
          >
            <Plus className="h-3 w-3" /> {label}
          </button>
        ))}

        <div className="flex-1" />

        {statusMsg && (
          <span className="max-w-xs truncate text-xs text-gray-400">
            {statusMsg}
          </span>
        )}

        {!isPremium && daysLeft !== null && (
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${
              canWrite
                ? "bg-indigo-500/15 text-indigo-300"
                : "bg-amber-500/15 text-amber-300"
            }`}
          >
            {canWrite
              ? `Trial: ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
              : "Trial ended — read-only"}
          </span>
        )}

        <button
          onClick={runWorkflow}
          disabled={running}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {running ? "Running…" : "Run"}
        </button>

        <button
          onClick={saveWorkspace}
          disabled={saving || !canWrite}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : canWrite ? (
            <Save className="h-3.5 w-3.5" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          {saving ? "Saving…" : "Save"}
        </button>

        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-500 transition hover:text-gray-300"
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </header>

      {!canWrite && (
        <div className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          <Lock className="h-3.5 w-3.5" />
          Your 3-day trial has ended. The canvas is read-only (you can still
          Run) — upgrade to Premium to keep editing.
        </div>
      )}

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          nodesDraggable={canWrite}
          nodesConnectable={canWrite}
          elementsSelectable
          fitView
          proOptions={{ hideAttribution: false }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1}
            color="#23232f"
          />
          <Controls
            position="bottom-left"
            className="!border-line !bg-panel [&>button]:!border-line [&>button]:!bg-panel [&>button]:!text-gray-400"
          />
          <MiniMap
            pannable
            zoomable
            className="!border !border-line !bg-panel"
            nodeColor="#4f46b8"
            maskColor="rgba(10,10,15,0.7)"
          />
        </ReactFlow>
      </div>
    </main>
  );
}
