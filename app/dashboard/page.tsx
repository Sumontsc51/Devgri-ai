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

/* ------------------------------------------------------------------ */
/* Masking helpers (client-side only — data never leaves the browser)  */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;
const TOKEN_RE = /\b(sk|pk|key|tok)[-_][A-Za-z0-9-_]{8,}\b/g;

function maskText(input: string): string {
  return input
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(TOKEN_RE, "[TOKEN]")
    .replace(PHONE_RE, "[PHONE]");
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Shared node chrome                                                  */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Custom nodes                                                        */
/* ------------------------------------------------------------------ */

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
        <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fast)</option>
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

/* ------------------------------------------------------------------ */
/* Default workflow                                                    */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Execution engine                                                    */
/* ------------------------------------------------------------------ */

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
  return order.length === nodes.length ? order : null; // null → cycle
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

/* ------------------------------------------------------------------ */
/* Dashboard page                                                      */
/* -----------------------------