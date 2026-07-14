/* Finalized AI app builder — engine (ported from ai-app-builder.html).
   The simulated AI is replaced with real Claude calls (BYOK, browser-direct):
   - project generation → Claude designs the architecture JSON
   - chat edits → Claude returns structured ops applied to the tree
   Falls back to the original offline simulation when no API key is set. */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProjectRow = { id: string; name: string; data: { tree: any; conns: any[] } | null };

export type BuilderHandles = {
  projects: ProjectRow[];
  save: (data: { tree: any; conns: any[]; name: string }, projectId: string | null) => Promise<{ id?: string; error?: string }>;
  signOut: () => void;
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GOOGLE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

type Provider = "anthropic" | "openai" | "google";
type ModelDef = { provider: Provider; id: string; label: string; price: [number, number] };

/* Model registry — price is rough USD per million tokens [in, out], display only. */
const MODELS: Record<string, ModelDef> = {
  opus: { provider: "anthropic", id: "claude-opus-4-8", label: "Claude Opus 4.8", price: [15, 75] },
  sonnet: { provider: "anthropic", id: "claude-sonnet-5", label: "Claude Sonnet 5", price: [3, 15] },
  haiku: { provider: "anthropic", id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", price: [1, 5] },
  gpt4o: { provider: "openai", id: "gpt-4o", label: "GPT-4o", price: [2.5, 10] },
  gpt4omini: { provider: "openai", id: "gpt-4o-mini", label: "GPT-4o mini", price: [0.15, 0.6] },
  gemini25pro: { provider: "google", id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", price: [1.25, 10] },
  gemini20flash: { provider: "google", id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", price: [0.1, 0.4] },
};
const PROVIDER_LABEL: Record<Provider, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google" };
/* Auto-routing preference per task domain, best-first. */
const AUTOPREF: Record<string, string[]> = {
  back: ["opus", "gpt4o", "gemini25pro", "sonnet", "gemini20flash", "gpt4omini", "haiku"],
  front: ["sonnet", "gpt4o", "gemini25pro", "opus", "haiku", "gemini20flash", "gpt4omini"],
  media: ["haiku", "gemini20flash", "gpt4omini", "sonnet", "gpt4o", "gemini25pro", "opus"],
};

export function initBuilder(root: HTMLElement, handles: BuilderHandles): void {
  if (root.dataset.inited === "1") return; // React StrictMode double-mount guard
  root.dataset.inited = "1";

  /* ---------------- state ---------------- */
  const NW = 176, NH = 44, COLW = 232, VGAP = 14;
  let uid = 0, tree: any = null, conns: any[] = [], open = new Set<number>(), sel: number | null = null, curPage: number | null = null;
  let view = "tree", scale = 1, panX = 40, panY = 30, connectFrom: number | null = null, propsOpen = true, selConn: number | null = null, linking: any = null;
  let pvMode = "live", building = false, pendingBrand: any = null, lastFrameKey = "";
  const $ = (id: string) => root.querySelector<HTMLElement>("#" + id) as any;
  const esc = (s: any) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  const childOf: Record<string, string> = { project: "page", pages: "page", page: "section", sections: "section", section: "element", element: "element", menus: "menu item", "menu item": "sub-menu item", "sub-menu item": "sub-menu item", tools: "tool", tool: "option", option: "option", item: "item", datas: "table", table: "field", field: "field", logics: "action", action: "step", step: "step" };
  const iconOf: Record<string, string> = { project: "ti-layout-dashboard", pages: "ti-files", page: "ti-file", sections: "ti-layout-list", section: "ti-layout-rows", element: "ti-box", menus: "ti-menu-2", "menu item": "ti-menu-2", "sub-menu item": "ti-corner-down-right", tools: "ti-tools", tool: "ti-tool", option: "ti-adjustments", item: "ti-box", datas: "ti-database", table: "ti-table", field: "ti-tag", logics: "ti-settings-automation", action: "ti-bolt", step: "ti-arrow-right" };
  const COLORS: Record<string, string> = { blue: "#E6F1FB", green: "#EAF3DE", red: "#FCEBEB", purple: "#EEEDFE", pink: "#FBEAF0", teal: "#E1F5EE", amber: "#FAEEDA", orange: "#FAECE7", gray: "#F1EFE8", white: "#FFFFFF" };
  const COLORTX: Record<string, string> = { blue: "#0C447C", green: "#27500A", red: "#791F1F", purple: "#3C3489", pink: "#72243E", teal: "#085041", amber: "#633806", orange: "#712B13", gray: "#444441", white: "#1f1e1b" };

  const WHY: Record<string, string> = { front: "frontend", back: "backend and logic", media: "images and UI polish" };
  const settings: any = { keys: { anthropic: "", openai: "", google: "" }, mode: "auto", manual: { front: "sonnet", back: "opus", media: "haiku" } };

  function domainOf(n: any) { if (n.type === "section" && /hero|gallery|image|banner/i.test(n.label)) return "media"; return ["datas", "table", "field", "logics", "action", "step", "tools", "tool", "option", "project"].indexOf(n.type) > -1 ? "back" : "front"; }
  function hasAnyKey() { return !!(settings.keys.anthropic || settings.keys.openai || settings.keys.google); }
  function avail() { return Object.keys(MODELS).filter((k) => settings.keys[MODELS[k].provider]); }
  function pickFor(d: string): string | null {
    const av = avail(); if (!av.length) return null;
    if (settings.mode === "manual" && av.indexOf(settings.manual[d]) > -1) return settings.manual[d];
    for (const k of AUTOPREF[d] || []) if (av.indexOf(k) > -1) return k;
    return av[0];
  }
  function modelOf(n: any) { const p = pickFor(domainOf(n)); return p ? MODELS[p].label : "No model"; }
  function whyOf(n: any) { const av = avail(); if (av.length <= 1) return av.length ? "only available model" : "add an API key"; return (settings.mode === "manual" ? "hardcoded: " : "auto: ") + WHY[domainOf(n)]; }
  function routeSummary() {
    if (!hasAnyKey()) return "No API keys connected — running in <b>offline demo mode</b>. Add an Anthropic, OpenAI, or Google key in AI settings (gear icon) to design with real AI.";
    const provs = (["anthropic", "openai", "google"] as Provider[]).filter((p) => settings.keys[p]).map((p) => PROVIDER_LABEL[p]).join(", ");
    return "Model routing (" + (settings.mode === "manual" ? "your hardcoded mapping" : "auto — best available per task") + "):<br>• frontend → <b>" + MODELS[pickFor("front")!].label + "</b><br>• backend and logic → <b>" + MODELS[pickFor("back")!].label + "</b><br>• images and UI → <b>" + MODELS[pickFor("media")!].label + "</b><br>Keys connected: " + provs + ". All calls go browser-direct to the provider — never through Devgri. PII masking is on: emails, phone numbers and secret tokens are scrubbed client-side before any prompt leaves your browser.";
  }

  function node(label: string, type: string, need?: string, how?: string, children?: any[]): any { return { id: uid++, label, type, need: need || "", how: how || "", color: "", notes: [], children: children || [] }; }
  function find(n: any, id: number | null): any { if (!n || id == null) return null; if (n.id === id) return n; for (const c of n.children) { const r = find(c, id); if (r) return r; } return null; }
  function findParent(n: any, id: number): any { for (const c of n.children) { if (c.id === id) return n; const r = findParent(c, id); if (r) return r; } return null; }
  function count(n: any): number { return 1 + n.children.reduce((s: number, c: any) => s + count(c), 0); }
  function expandTo(id: number) { let p = findParent(tree, id); while (p) { open.add(p.id); p = p.id === tree.id ? null : findParent(tree, p.id); } }
  function pageOf(n: any) { let c = n; while (c && c.type !== "page") { c = c.id === tree.id ? null : findParent(tree, c.id); } return c; }
  function allNodes(n: any, a?: any[]): any[] { a = a || []; a.push(n); n.children.forEach((c: any) => allNodes(c, a!)); return a; }
  function byLabel(q: string) { q = q.toLowerCase(); return allNodes(tree).find((n) => n.label.toLowerCase() === q) || allNodes(tree).find((n) => n.label.toLowerCase().includes(q)); }
  function cluster(type: string) { return tree.children.find((c: any) => c.type === type); }
  function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------------- token usage tracking ---------------- */
  const usage = { calls: 0, inTok: 0, outTok: 0, cost: 0, maxCost: 0, perModel: {} as Record<string, { calls: number; inTok: number; outTok: number; cost: number }> };
  function fmtTok(n: number) { return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n); }
  function trackUsage(modelKey: string, inT: number, outT: number) {
    const def = MODELS[modelKey]; if (!def) return;
    const cost = (inT / 1e6) * def.price[0] + (outT / 1e6) * def.price[1];
    const po = MODELS.opus.price;
    usage.calls++; usage.inTok += inT; usage.outTok += outT; usage.cost += cost;
    usage.maxCost += (inT / 1e6) * po[0] + (outT / 1e6) * po[1];
    const m = (usage.perModel[modelKey] = usage.perModel[modelKey] || { calls: 0, inTok: 0, outTok: 0, cost: 0 });
    m.calls++; m.inTok += inT; m.outTok += outT; m.cost += cost;
    renderTok();
  }
  function renderTok() {
    const bar = $("tokbar"), line = $("tokline"), det = $("tokdetail");
    if (!bar || !usage.calls) return;
    bar.style.display = "block";
    const saved = usage.maxCost - usage.cost;
    line.innerHTML = "⛁ " + fmtTok(usage.inTok + usage.outTok) + " tok · ~$" + usage.cost.toFixed(usage.cost < 0.1 ? 3 : 2) + (saved > 0.004 ? ' · <span style="color:#1D9E75">saved $' + saved.toFixed(saved < 0.1 ? 3 : 2) + "</span>" : "");
    det.innerHTML = Object.keys(usage.perModel).map((k) => { const m = usage.perModel[k]; return "<b>" + esc(MODELS[k] ? MODELS[k].label : k) + "</b>: " + m.calls + " call" + (m.calls === 1 ? "" : "s") + " · " + fmtTok(m.inTok) + " in / " + fmtTok(m.outTok) + " out · ~$" + m.cost.toFixed(3); }).join("<br>") + '<br><span style="opacity:.7">Estimates · savings vs running everything on the priciest model</span>';
    bar.onclick = () => { det.style.display = det.style.display === "none" ? "block" : "none"; };
  }

  /* ---------------- unified multi-provider transport ---------------- */
  async function callModel(modelKey: string, system: string, userText: string): Promise<string> {
    const def = MODELS[modelKey];
    if (!def) throw new Error("Unknown model: " + modelKey);
    const key = settings.keys[def.provider];
    if (!key) throw new Error("No " + PROVIDER_LABEL[def.provider] + " API key — add one in AI settings");

    if (def.provider === "anthropic") {
      const response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: def.id, max_tokens: 8192, system, messages: [{ role: "user", content: userText }] }),
      });
      const json = await parseOrThrow(response);
      trackUsage(modelKey, json.usage?.input_tokens || 0, json.usage?.output_tokens || 0);
      const block = Array.isArray(json.content) ? json.content.find((c: any) => c.type === "text") : null;
      return block?.text ?? "";
    }
    if (def.provider === "openai") {
      const call = async (tokParam: Record<string, number>) => fetch(OPENAI_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + key },
        body: JSON.stringify({ model: def.id, ...tokParam, messages: [{ role: "system", content: system }, { role: "user", content: userText }] }),
      });
      let response = await call({ max_completion_tokens: 8192 });
      if (!response.ok) {
        /* older models reject max_completion_tokens; retry with the legacy param */
        let msg = ""; try { msg = JSON.stringify(await response.clone().json()); } catch { /* ignore */ }
        if (/max_completion_tokens|max_tokens/i.test(msg)) response = await call({ max_tokens: 8192 });
      }
      const json = await parseOrThrow(response);
      trackUsage(modelKey, json.usage?.prompt_tokens || 0, json.usage?.completion_tokens || 0);
      return json.choices?.[0]?.message?.content ?? "";
    }
    /* google — key goes in a header, never in the URL */
    const response = await fetch(GOOGLE_URL + def.id + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: userText }] }], generationConfig: { maxOutputTokens: 8192 } }),
    });
    const json = await parseOrThrow(response);
    trackUsage(modelKey, json.usageMetadata?.promptTokenCount || 0, json.usageMetadata?.candidatesTokenCount || 0);
    const parts = json.candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map((p: any) => p.text || "").join("") : "";
  }
  async function parseOrThrow(response: Response): Promise<any> {
    if (!response.ok) {
      let detail = "HTTP " + response.status;
      try { const err = await response.json(); detail = err?.error?.message ?? err?.error?.status ?? detail; } catch { /* keep */ }
      throw new Error(detail);
    }
    return response.json();
  }
  /* Retry-and-repair: one retry with the parse error fed back to the model.
     All outgoing text is PII-masked (emails, phones, secret tokens) client-side. */
  async function callAndParse<T>(modelKey: string, system: string, userText: string, parse: (raw: string) => T): Promise<T> {
    const masked = maskText(userText);
    try {
      return parse(await callModel(modelKey, system, masked));
    } catch (firstErr: any) {
      const note = "\n\nIMPORTANT: your previous reply was invalid (" + String(firstErr?.message || firstErr) + "). Respond again following the required output format EXACTLY.";
      return parse(await callModel(modelKey, system, masked + note));
    }
  }

  function extractJson(text: string): any {
    let c = text.trim();
    const fence = c.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) c = fence[1].trim();
    const s = c.indexOf("{"), e = c.lastIndexOf("}");
    if (s === -1 || e <= s) throw new Error("No JSON in model reply");
    return JSON.parse(c.slice(s, e + 1));
  }

  /* ---------------- offline generation (fallback, original sim) ---------------- */
  function deriveName(p: string) {
    const stop = new Set(["a", "an", "the", "for", "with", "and", "my", "i", "want", "to", "build", "create", "make", "need", "online", "app", "application", "please"]);
    const w = p.replace(/[^a-zA-Z ]/g, "").split(/\s+/).filter((x) => x && !stop.has(x.toLowerCase()));
    const pick = w.slice(0, 2).map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase());
    return pick.length ? pick.join(" ") : "My project";
  }
  function secNode(name: string) {
    const needs: Record<string, string> = { Hero: "A headline, sub-text and a call-to-action button.", Features: "3–4 feature cards with icons.", Footer: "Links, contact info, copyright.", "Product grid": "Product data: image, name, price.", Filters: "Category and price filter options.", "Cart items": "The list of items the user added.", "Checkout button": "A payment method connection.", "Post list": "Blog posts from the content source.", Categories: "A list of post categories.", "Gallery grid": "Images with captions.", "Case study": "A detailed project write-up.", "Stats cards": "Key numbers to display.", Charts: "A data source and chart types.", "Report table": "Rows of report data.", "Export bar": "Export format options.", Calendar: "Available dates.", "Time slots": "Bookable time ranges.", Story: "Text about the business.", Team: "Team member cards.", "Contact form": "Name, email, message fields.", Map: "A location address." };
    return node(name, "section", needs[name] || "Content for this block.", "Rendered as a block inside its page.");
  }
  function assembleProject(name: string, prompt: string, pages: Array<{ name: string; sections: Array<{ name: string; need?: string }> }>, tables: Array<{ name: string; fields: string }>, actions: Array<{ name: string; trigger?: string; steps?: Array<{ label: string; kind?: string }> }>, tools: string[], connections: Array<{ from: string; to: string; type?: string }>) {
    const pageNodes = pages.slice(0, 9).map((pg) => {
      const pn = node(pg.name, "page", "Route: /" + pg.name.toLowerCase().replace(/\s+/g, "-"), "A page of the app. Sections render inside it.");
      pn.children = (pg.sections || []).map((s) => { const sn = secNode(s.name); if (s.need) sn.need = s.need; return sn; });
      return pn;
    });
    const menuNodes = pageNodes.map((pn) => node(pn.label, "menu item", "A label and a target page.", "Clicking navigates to the connected page."));
    const tableNodes = tables.map((t) => node(t.name, "table", "Fields: " + t.fields + ".", "A database table. Sections read/write it via data connections."));
    const logicNodes = actions.map((a) => {
      const n0 = node(a.name, "action", "Trigger: " + (a.trigger || "Manual"), "Runs its steps in order when triggered. Select it and press Test run.");
      n0.trigger = a.trigger || "Manual"; n0.runs = [];
      (a.steps || []).forEach((sp) => {
        const k = sp.kind && ["ai", "table", "notify", "condition"].indexOf(sp.kind) > -1 ? sp.kind : "ai";
        const st = node(sp.label, "step", k === "ai" ? "A prompt; data flows in from the previous step." : k === "table" ? "Writes a row to its table." : k === "notify" ? "Sends an email or notification." : "Branches on a condition.", "Step kind: " + k + ".");
        st.kind = k; n0.children.push(st);
      });
      return n0;
    });
    const root = node(name, "project", 'The whole product. Built from: "' + prompt + '"', "Pages hold sections; the menu navigates; data and logic power behavior.");
    root.children = [
      Object.assign(node("Pages", "pages", "All pages of the app.", "Add a page, then add sections inside it."), { children: pageNodes }),
      Object.assign(node("Sections", "sections", "Reusable blocks.", "Create once, reuse on any page."), { children: [secNode("Footer")] }),
      Object.assign(node("Menu", "menus", "Navigation.", "Each item connects to a page."), { children: menuNodes }),
      Object.assign(node("Database", "datas", "The data model.", "Tables that sections read and write (teal dashed lines)."), { children: tableNodes }),
      Object.assign(node("Logic", "logics", "App behavior.", "Actions fired by connected elements (orange dashed lines)."), { children: logicNodes }),
      Object.assign(node("Tools", "tools", "Utility features.", "Each tool adds one behavior."), { children: tools.map((t) => node(t, "tool", "Configuration for " + t.toLowerCase() + ".", "Runs across the whole app.")) }),
    ];
    const cs: any[] = [];
    menuNodes.forEach((m, i) => cs.push({ from: m.id, to: pageNodes[i].id, type: "nav" }));
    const all = allNodes(root);
    const lbl = (q: string) => { q = q.toLowerCase(); return all.find((n) => n.label.toLowerCase() === q) || all.find((n) => n.label.toLowerCase().includes(q)); };
    (connections || []).forEach((c) => {
      const a = lbl(c.from), b = lbl(c.to);
      if (a && b && a.id !== b.id) cs.push({ from: a.id, to: b.id, type: ["nav", "data", "event"].indexOf(c.type || "") > -1 ? c.type : "data" });
    });
    return { root, cs, pageNodes };
  }
  function genProject(prompt: string) {
    const p = prompt.toLowerCase();
    const pages: Array<[string, string[]]> = [["Home", ["Hero", "Features", "Footer"]]];
    if (/shop|store|sell|commerce|order|product|bakery|menu of|buy/.test(p)) { pages.push(["Products", ["Product grid", "Filters"]]); pages.push(["Cart", ["Cart items", "Checkout button"]]); }
    if (/blog|news|article|post/.test(p)) pages.push(["Blog", ["Post list", "Categories"]]);
    if (/portfolio|gallery|showcase|photograph/.test(p)) pages.push(["Portfolio", ["Gallery grid", "Case study"]]);
    if (/dashboard|admin|manage|track|analytic/.test(p)) pages.push(["Dashboard", ["Stats cards", "Charts"]]);
    if (/report/.test(p)) pages.push(["Reports", ["Report table", "Export bar"]]);
    if (/book|appointment|schedule|reserv/.test(p)) pages.push(["Booking", ["Calendar", "Time slots"]]);
    pages.push(["About", ["Story", "Team"]]);
    pages.push(["Contact", ["Contact form", "Map"]]);
    const toolNames = ["Search"];
    if (/login|account|auth|user|sign/.test(p)) toolNames.push("Login / Auth");
    if (/pay|order|checkout|commerce|shop|store|bakery/.test(p)) toolNames.push("Payments");
    if (/export|report|pdf|csv/.test(p)) toolNames.push("Export");
    const tables: Array<[string, string]> = [];
    if (/shop|store|sell|commerce|order|product|bakery|buy/.test(p)) { tables.push(["Products", "name, price, image, category"]); tables.push(["Orders", "items, total, status, customer"]); }
    if (/blog|news|article|post/.test(p)) tables.push(["Posts", "title, body, author, date"]);
    if (/book|appointment|schedule|reserv/.test(p)) tables.push(["Bookings", "date, time, customer, status"]);
    if (/login|account|auth|user|sign/.test(p) || tables.length) tables.push(["Users", "name, email, password hash"]);
    tables.push(["Messages", "name, email, message"]);
    const acts: string[] = [];
    if (/shop|store|sell|commerce|order|product|bakery|buy/.test(p)) acts.push("Place order");
    if (/book|appointment|schedule|reserv/.test(p)) acts.push("Create booking");
    if (/login|account|auth|user|sign/.test(p)) acts.push("Sign in / sign up");
    acts.push("Send contact message");
    const STEPPLANS: Record<string, [string, Array<[string, string]>]> = { "Place order": ["Form submitted", [["AI: validate order", "ai"], ["Write to Orders", "table"], ["Email confirmation", "notify"]]], "Create booking": ["Form submitted", [["Check availability", "condition"], ["Write to Bookings", "table"], ["Email confirmation", "notify"]]], "Sign in / sign up": ["Form submitted", [["AI: validate credentials", "ai"], ["Create session", "table"]]], "Send contact message": ["Form submitted", [["AI: categorize message", "ai"], ["Write to Messages", "table"], ["Email notify owner", "notify"]]] };
    const dmap: Record<string, string> = { "Product grid": "Products", "Cart items": "Orders", "Post list": "Posts", Calendar: "Bookings", "Contact form": "Messages" };
    const emap: Record<string, string> = { "Checkout button": "Place order", "Contact form": "Send contact message" };
    const connections: Array<{ from: string; to: string; type: string }> = [];
    pages.forEach(([, secs]) => secs.forEach((s) => {
      if (dmap[s]) connections.push({ from: s, to: dmap[s], type: "data" });
      if (emap[s]) connections.push({ from: s, to: emap[s], type: "event" });
    }));
    return assembleProject(deriveName(prompt), prompt, pages.slice(0, 7).map(([name, secs]) => ({ name, sections: secs.map((s) => ({ name: s })) })), tables.map(([name, fields]) => ({ name, fields })), acts.map((a) => ({ name: a, trigger: STEPPLANS[a] ? STEPPLANS[a][0] : "Manual", steps: (STEPPLANS[a] ? STEPPLANS[a][1] : []).map(([label, kind]) => ({ label, kind })) })), toolNames, connections);
  }

  /* ---------------- real Claude generation ---------------- */
  const ARCH_SYSTEM = `You are the architect model of an AI app builder. The user describes an app; you design its architecture.
Respond with ONLY a single raw JSON object — no markdown, no fences:
{"name":"Short Project Name",
 "pages":[{"name":"Home","sections":[{"name":"Hero","need":"what this block needs, one sentence"}]}],
 "tables":[{"name":"Products","fields":"name, price, image"}],
 "actions":[{"name":"Place order","trigger":"Form submitted","steps":[{"label":"AI: validate order","kind":"ai"},{"label":"Write to Orders","kind":"table"},{"label":"Email confirmation","kind":"notify"}]}],
 "tools":["Search","Payments"],
 "connections":[{"from":"Product grid","to":"Products","type":"data"},{"from":"Checkout button","to":"Place order","type":"event"}],
 "brand":{"primary":"#4f46b8","font":"Inter","vibe":"clean, modern, confident"}}
Rules: 3-7 pages, each with 2-4 sections. 2-5 tables. 1-4 actions with 2-4 steps each (kinds: ai, table, notify, condition). 1-4 tools. Connections reference exact section/table/action names; types: data (section reads/writes table) or event (section triggers action). Keep names short. "brand" picks a primary hex color, one Google Font name, and a 3-word design vibe fitting the business.`;

  const PAGE_SYSTEM = `You are the frontend model of an AI app builder. Generate ONE complete, standalone, production-quality HTML page for the described page of a website.
Hard rules:
- Output ONLY raw HTML starting with <!DOCTYPE html>. No markdown, no fences, no commentary.
- If "designCss" is provided, include it VERBATIM as the first <style> in <head> and REUSE its classes (.nav, .btn, .card, .section, .container, .footer, grids) so every page of the site matches; add only page-specific styles in a second <style>. Otherwise all CSS in a single <style>. No external CSS or JS. A Google Fonts <link> is allowed.
- Fully responsive (mobile-first, flex/grid). Polished, modern, cohesive design driven by the given brand (primary color, font, vibe). Real visual depth: gradients, spacing rhythm, hover states.
- NO stock photos. Build imagery with CSS: gradients, shapes, patterns, emoji where tasteful.
- Write realistic, specific copy for this business — headlines, feature text, prices, names. Never lorem ipsum, never "placeholder".
- Include the site navigation bar listing EVERY page of the site. Each nav link must be exactly: <a href="#" data-page="PageName">PageName</a> (data-page = exact page name given). Mark the current page visually.
- Implement EXACTLY the listed sections, in order, honoring each section's "need", its listed child elements, and user notes. Do not invent extra sections; if a section lists elements (e.g. a form's fields), implement every one of them.
- Forms/buttons are visual only (no real submission).
- After </html>, append ONE HTML comment reporting the structure you actually built, exactly:
<!--STRUCTURE {"sections":[{"name":"Hero","need":"one-line summary of what it shows","elements":[{"name":"Headline"},{"name":"CTA button"}]}]}-->
The comment's section/element names must match what is really on the page — this syncs the visual architecture tree.
Keep total output under 700 lines.`;

  async function generateWithAI(prompt: string) {
    const mk = pickFor("back")!;
    const spec = await callAndParse(mk, ARCH_SYSTEM, prompt, (raw) => {
      const s = extractJson(raw);
      if (!s || !Array.isArray(s.pages) || !s.pages.length) throw new Error("missing pages array");
      return s;
    });
    if (spec.brand && typeof spec.brand === "object") pendingBrand = spec.brand;
    return assembleProject(String(spec.name || deriveName(prompt)), prompt, spec.pages.map((pg: any) => ({ name: String(pg.name || "Page"), sections: Array.isArray(pg.sections) ? pg.sections.map((s: any) => ({ name: String(s.name || "Section"), need: s.need ? String(s.need) : undefined })) : [] })), Array.isArray(spec.tables) ? spec.tables.map((t: any) => ({ name: String(t.name || "Table"), fields: String(t.fields || "") })) : [], Array.isArray(spec.actions) ? spec.actions.map((a: any) => ({ name: String(a.name || "Action"), trigger: a.trigger ? String(a.trigger) : "Manual", steps: Array.isArray(a.steps) ? a.steps.map((s: any) => ({ label: String(s.label || "Step"), kind: s.kind })) : [] })) : [], Array.isArray(spec.tools) ? spec.tools.map((t: any) => String(t)) : ["Search"], Array.isArray(spec.connections) ? spec.connections : []);
  }

  /* ---------------- real Claude edit ops ---------------- */
  const OPS_SYSTEM = `You are the architect model inside an AI app builder. You receive the project's element tree, its connections, the selected element, and a user instruction. Decide what to change and reply with ONLY raw JSON:
{"reply":"short conversational confirmation (plain text, may name what you changed)",
 "ops":[
  {"op":"add","parent":ID,"label":"...","type":"page|section|element|menu item|table|field|action|step|tool","need":"optional","how":"optional"},
  {"op":"rename","id":ID,"label":"..."},
  {"op":"delete","id":ID},
  {"op":"color","id":ID,"color":"blue|green|red|purple|pink|teal|amber|orange|gray|white"},
  {"op":"need","id":ID,"text":"..."},
  {"op":"how","id":ID,"text":"..."},
  {"op":"trigger","id":ID,"text":"..."},
  {"op":"note","id":ID,"text":"..."},
  {"op":"connect","from":ID,"to":ID,"type":"nav|data|event","label":"optional"},
  {"op":"disconnect","from":ID,"to":ID}
 ]}
Rules: IDs must come from the given tree. Use the selected element when the instruction says "it"/"this". Prefer small precise ops; use several ops for compound requests. If the request is a styling/content wish that maps to no structural op, use "note" on the target element and explain in reply. Empty ops array is allowed for pure questions — answer in reply.`;

  function treeContext() {
    const list = allNodes(tree).map((n) => { const p = findParent(tree, n.id); return { id: n.id, parent: p ? p.id : null, type: n.type, label: n.label }; });
    return JSON.stringify({ project: tree.label, nodes: list.slice(0, 400), connections: conns.map((c) => ({ from: c.from, to: c.to, type: c.type })) });
  }

  function applyOps(ops: any[]): number {
    let applied = 0;
    for (const o of ops || []) {
      try {
        if (o.op === "add") {
          const parent = find(tree, o.parent) || (sel != null ? find(tree, sel) : tree) || tree;
          const t = o.type && childOf[o.type] !== undefined ? o.type : childOf[parent.type] || "item";
          const k = node(cap(String(o.label || "New " + t)), t, o.need ? String(o.need) : "", o.how ? String(o.how) : "Added by Claude.");
          parent.children.push(k); open.add(parent.id); sel = k.id; expandTo(k.id);
          const pg = pageOf(k); if (pg) curPage = pg.id;
          touchPage(k);
          applied++;
        } else if (o.op === "rename") {
          const n = find(tree, o.id); if (n) { n.label = cap(String(o.label || n.label)); touchPage(n); applied++; }
        } else if (o.op === "delete") {
          const n = find(tree, o.id);
          if (n && n.id !== tree.id) {
            touchPage(n);
            const p = findParent(tree, n.id);
            p.children = p.children.filter((c: any) => c.id !== n.id);
            const dead = new Set(allNodes(n).map((x) => x.id));
            conns = conns.filter((c) => !dead.has(c.from) && !dead.has(c.to));
            if (sel != null && dead.has(sel)) sel = p.id;
            applied++;
          }
        } else if (o.op === "color") {
          const n = find(tree, o.id); if (n && COLORS[o.color]) { n.color = o.color; touchPage(n); applied++; }
        } else if (o.op === "need") {
          const n = find(tree, o.id); if (n) { n.need = String(o.text || ""); touchPage(n); applied++; }
        } else if (o.op === "how") {
          const n = find(tree, o.id); if (n) { n.how = String(o.text || ""); applied++; }
        } else if (o.op === "trigger") {
          const n = find(tree, o.id); if (n) { n.trigger = String(o.text || "Manual"); applied++; }
        } else if (o.op === "note") {
          const n = find(tree, o.id); if (n) { n.notes.push(String(o.text || "")); touchPage(n); applied++; }
        } else if (o.op === "connect") {
          const a = find(tree, o.from), b = find(tree, o.to);
          if (a && b && a.id !== b.id) { conns.push({ from: a.id, to: b.id, type: ["nav", "data", "event"].indexOf(o.type) > -1 ? o.type : "nav", label: o.label ? String(o.label) : "" }); applied++; }
        } else if (o.op === "disconnect") {
          const before = conns.length;
          conns = conns.filter((c) => !(c.from === o.from && c.to === o.to));
          if (conns.length < before) applied++;
        }
      } catch { /* skip bad op */ }
    }
    return applied;
  }

  /* ---------------- real site generation (live preview) ---------------- */
  function touchPage(n: any) {
    if (!n || !tree) return;
    const pg = pageOf(n);
    if (pg && pg.html) pg.stale = true;
  }
  function extractHtml(text: string): string {
    let c = text.trim();
    const fence = c.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (fence) c = fence[1].trim();
    const start = c.search(/<!DOCTYPE|<html/i);
    if (start === -1) throw new Error("Model returned no HTML");
    return c.slice(start);
  }
  const NAV_SCRIPT = '<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[data-page]"):null;if(a){e.preventDefault();parent.postMessage({devgriNav:a.getAttribute("data-page")},"*");}});</' + "script>";
  function injectNav(html: string): string {
    return html.indexOf("</body>") > -1 ? html.replace("</body>", NAV_SCRIPT + "</body>") : html + NAV_SCRIPT;
  }
  function pageContext(pg: any): string {
    const pagesC = cluster("pages");
    return JSON.stringify({
      site: tree.label,
      about: tree.need,
      brand: tree.brand || { primary: "#4f46b8", font: "Inter", vibe: "clean, modern, confident" },
      designCss: tree.designCss || undefined,
      pages: pagesC.children.map((p: any) => p.label),
      currentPage: pg.label,
      sections: pg.children.map((s: any) => ({
        name: s.label,
        need: s.need,
        notes: s.notes,
        color: s.color || undefined,
        elements: s.children.map((el: any) => ({ name: el.label, need: el.need || undefined, notes: el.notes && el.notes.length ? el.notes : undefined })),
      })),
    });
  }
  /* Sync the architecture tree to the structure Claude actually built,
     preserving node ids (and their connections) where labels match. */
  function reconcilePage(pg: any, secs: any[]) {
    if (!Array.isArray(secs) || !secs.length) return false;
    snap();
    const oldKids = pg.children;
    const usedS = new Set<number>();
    pg.children = secs.map((s: any) => {
      const nameS = String(s.name || "Section"), lowS = nameS.toLowerCase();
      let ex = oldKids.find((c: any) => !usedS.has(c.id) && c.label.toLowerCase() === lowS)
        || oldKids.find((c: any) => !usedS.has(c.id) && (c.label.toLowerCase().includes(lowS) || lowS.includes(c.label.toLowerCase())));
      if (!ex) ex = node(cap(nameS), "section", "", "Rendered as a block inside its page.");
      else ex.label = cap(nameS);
      usedS.add(ex.id);
      if (s.need) ex.need = String(s.need);
      if (Array.isArray(s.elements)) {
        const usedE = new Set<number>();
        const oldEls = ex.children;
        ex.children = s.elements.map((el: any) => {
          const nameE = String(el.name || "Element"), lowE = nameE.toLowerCase();
          let ee = oldEls.find((c: any) => !usedE.has(c.id) && c.label.toLowerCase() === lowE)
            || oldEls.find((c: any) => !usedE.has(c.id) && (c.label.toLowerCase().includes(lowE) || lowE.includes(c.label.toLowerCase())));
          if (!ee) ee = node(cap(nameE), "element", el.need ? String(el.need) : "", "Part of its section.");
          else ee.label = cap(nameE);
          usedE.add(ee.id);
          return ee;
        });
        oldEls.forEach((c: any) => {
          if (usedE.has(c.id)) return;
          const hasConn = conns.some((k) => k.from === c.id || k.to === c.id);
          if (c.children.length || c.notes.length || hasConn) ex.children.push(c);
        });
      }
      return ex;
    });
    /* Keep unreported old sections that carry user structure or connections —
       weaker models sometimes omit sections they did in fact render. */
    const connected = new Set<number>();
    conns.forEach((c) => { connected.add(c.from); connected.add(c.to); });
    oldKids.forEach((c: any) => {
      if (usedS.has(c.id)) return;
      const hasConn = allNodes(c).some((x: any) => connected.has(x.id));
      if (c.children.length || c.notes.length || hasConn) pg.children.push(c);
    });
    /* prune connections and selection that pointed at removed nodes */
    const alive = new Set(allNodes(tree).map((n: any) => n.id));
    conns = conns.filter((c) => alive.has(c.from) && alive.has(c.to));
    if (sel != null && !alive.has(sel)) sel = pg.id;
    if (curPage != null && !alive.has(curPage)) curPage = pg.id;
    return true;
  }
  const DESIGN_SYSTEM = `You are the design-system model of an AI app builder. Given a site brief, output ONLY raw CSS (no markdown, no fences, no HTML) defining a reusable design system all pages will share:
- :root variables built from the brand (primary color + shades, surfaces, text colors, radius, spacing)
- a minimal reset, base typography using the brand font (assume it is loaded)
- classes: .nav (sticky site header), .nav a, .nav a.active, .btn, .btn-primary, .card, .section (vertical rhythm), .container (max-width wrapper), .footer, .grid-2, .grid-3
- responsive rules for mobile
Under 220 lines.`;

  async function ensureDesignSystem() {
    if (tree.designCss) return;
    const mk = pickFor("front")!;
    const brief = JSON.stringify({ site: tree.label, about: tree.need, brand: tree.brand || {}, pages: cluster("pages").children.map((p: any) => p.label) });
    const css = await callAndParse(mk, DESIGN_SYSTEM, brief, (raw) => {
      let c = raw.trim();
      const fence = c.match(/```(?:css)?\s*([\s\S]*?)```/);
      if (fence) c = fence[1].trim();
      if (!/[{}]/.test(c) || /<html/i.test(c)) throw new Error("not CSS");
      return c;
    });
    tree.designCss = css;
    addMsg("ai", "Design system generated — every page will share the same nav, buttons, cards and rhythm.");
  }

  async function buildPage(pg: any, announce?: boolean) {
    if (!pg) return;
    if (!hasAnyKey()) { toast("Add an API key in AI settings to build the real site"); $("setmodal").style.display = "flex"; return; }
    if (building) { toast("Already building a page — one moment"); return; }
    building = true;
    updateBuildBtn(pg);
    const mk = pickFor("front")!;
    if (announce !== false) addMsg("ai", "Building <b>" + esc(pg.label) + "</b> for real with <b>" + esc(MODELS[mk].label) + "</b>…");
    typing(true);
    try {
      await ensureDesignSystem();
      const out = await callAndParse(mk, PAGE_SYSTEM, pageContext(pg), (raw) => {
        const html = extractHtml(raw);
        if (html.indexOf("</html>") === -1) throw new Error("HTML truncated — output a more compact page that fits");
        return { html, raw };
      });
      pg.html = injectNav(out.html);
      pg.stale = false;
      /* sync the tree to what the model actually built */
      let synced = false;
      const sm = out.raw.match(/<!--\s*STRUCTURE\s*({[\s\S]*?})\s*-->/);
      if (sm) { try { synced = reconcilePage(pg, JSON.parse(sm[1]).sections); } catch { /* keep tree as-is */ } }
      typing(false);
      addMsg("ai", "✓ <b>" + esc(pg.label) + "</b> built — real generated code, not a template." + (synced ? " The architecture tree is synced to the page." : "") + " Tell me what to change and press Rebuild.");
      pvMode = "live";
      renderAll();
      toast(pg.label + " built ✓");
      scheduleAutosave();
    } catch (err: any) {
      typing(false);
      addMsg("ai", '<span style="color:var(--text-danger)">Page build failed: ' + esc(err?.message || "unknown error") + "</span> — press Build to retry.");
    }
    building = false;
    updateBuildBtn(pg);
  }
  function updateBuildBtn(pg: any) {
    const b = $("pBuild"), t = $("pBuildTxt");
    if (!b || !t) return;
    if (building) { t.textContent = "Building…"; (b as HTMLButtonElement).disabled = true; return; }
    (b as HTMLButtonElement).disabled = false;
    if (!pg) { t.textContent = "Build page with Claude"; return; }
    t.textContent = !pg.html ? "Build “" + pg.label + "” with Claude" : pg.stale ? "Rebuild “" + pg.label + "” (changes pending)" : "Rebuild “" + pg.label + "”";
  }
  function renderLive() {
    const pg = curPage != null ? find(tree, curPage) : null;
    const live = $("siteLive"), blue = $("site"), tabs = $("livetabs");
    const showLive = pvMode === "live";
    blue.style.display = showLive ? "none" : "block";
    live.style.display = showLive ? "block" : "none";
    tabs.style.display = showLive ? "flex" : "none";
    updateBuildBtn(pg);
    if (!showLive) return;
    const pagesC = cluster("pages");
    tabs.innerHTML = pagesC.children.map((p: any) => '<button data-ltab="' + p.id + '" style="font-size:12px;border:1px solid var(--border);background:' + (p.id === curPage ? "var(--fill-accent)" : "var(--surface-2)") + ";color:" + (p.id === curPage ? "#fff" : "var(--text-secondary)") + ';border-radius:14px;padding:4px 11px;">' + esc(p.label) + (p.html ? "" : " ·") + "</button>").join("");
    tabs.querySelectorAll("[data-ltab]").forEach((b: any) => (b.onclick = () => { curPage = +b.dataset.ltab; const p2 = find(tree, curPage); renderPreview(); if (p2 && !p2.html) buildPage(p2); }));
    const frame = $("siteFrame") as HTMLIFrameElement;
    if (pg && pg.html) {
      const key = pg.id + ":" + pg.html.length;
      if (key !== lastFrameKey) { lastFrameKey = key; frame.srcdoc = pg.html; }
    } else {
      lastFrameKey = "";
      frame.srcdoc = '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#96948c;background:#fafaf8;"><div style="text-align:center;max-width:420px;padding:20px;"><div style="font-size:34px;">✦</div><p style="font-size:15px;color:#555;margin:8px 0 4px;font-weight:600;">' + esc(pg ? pg.label : "This page") + " isn’t built yet</p><p style=\"font-size:13px;line-height:1.6;\">Press <b>Build with Claude</b> above — Claude will write this page’s real HTML from your architecture.</p></div></body></html>";
    }
  }
  window.addEventListener("message", (e: MessageEvent) => {
    const p = e.data && (e.data as any).devgriNav;
    if (!p || !tree) return;
    const pagesC = cluster("pages");
    const pg = pagesC.children.find((x: any) => x.label.toLowerCase() === String(p).toLowerCase());
    if (pg) { curPage = pg.id; renderPreview(); if (!pg.html) buildPage(pg); }
  });

  /* ---------------- chat ---------------- */
  function addMsg(role: string, html: string) {
    const d = document.createElement("div");
    d.className = "msg " + role;
    d.innerHTML = html;
    $("msgs").appendChild(d);
    $("msgs").scrollTop = $("msgs").scrollHeight;
    return d;
  }
  let typingEl: HTMLElement | null = null;
  function typing(on: boolean) {
    if (on && !typingEl) { typingEl = addMsg("ai", '<span class="dots"><span></span><span></span><span></span></span>'); }
    else if (!on && typingEl) { typingEl.remove(); typingEl = null; }
  }
  function ai(html: string, delay?: number) {
    return new Promise<void>((res) => { typing(true); setTimeout(() => { typing(false); addMsg("ai", html); res(); }, delay || 700); });
  }

  /* ---------------- project lifecycle ---------------- */
  async function createProject(prompt: string) {
    $("start").style.display = "none";
    $("build").style.display = "flex";
    addMsg("user", esc(prompt));
    let g: any = null;
    if (hasAnyKey()) {
      await ai("Got it — asking <b>" + esc(MODELS[pickFor("back")!].label) + "</b> to design the <b>architecture</b>…", 600);
      typing(true);
      try {
        g = await generateWithAI(prompt);
        typing(false);
      } catch (err: any) {
        typing(false);
        addMsg("ai", '<span style="color:var(--text-danger)">AI call failed: ' + esc(err?.message || "unknown error") + "</span><br>Falling back to the offline template.");
        g = null;
      }
    } else {
      await ai("No API key set — designing with the <b>offline template</b>. Add an Anthropic, OpenAI, or Google key in AI settings (gear icon) for real AI designs.", 800);
    }
    if (!g) g = genProject(prompt);
    uid = 0; allNodes(g.root).forEach((n: any) => (uid = Math.max(uid, n.id + 1)));
    tree = g.root; conns = g.cs;
    if (pendingBrand) { tree.brand = pendingBrand; pendingBrand = null; }
    open = new Set([tree.id, cluster("pages").id]);
    sel = tree.id; curPage = g.pageNodes.length ? g.pageNodes[0].id : null;
    $("pnameTxt").textContent = tree.label;
    renderAll(); fit();
    const pgs = g.pageNodes.map((p: any) => p.label).join(", ");
    await ai("Architecture created:<br>• <b>" + g.pageNodes.length + " pages</b> — " + esc(pgs) + "<br>• menu wired to pages (purple dashed = navigation)<br>• <b>database</b>: " + esc(cluster("datas").children.map((t: any) => t.label).join(", ") || "—") + " (teal dashed = data)<br>• <b>logic</b>: " + esc(cluster("logics").children.map((t: any) => t.label).join(", ") || "—") + " (orange dashed = event)<br>• tools: " + esc(cluster("tools").children.map((t: any) => t.label).join(", ") || "—"), 1200);
    await ai(routeSummary(), 900);
    await ai("Now building the project preview…", 800);
    pvMode = "live";
    setView("preview");
    await ai("<b>Done!</b> Your project is ready. Try this:<br>• <b>Live site</b> shows the real generated website; <b>Blueprint</b> shows the architecture blocks<br>• click any block in the <b>Blueprint</b> — it gets selected in the <b>Tree</b> too<br>• with something selected, just tell me what to change: <i>“make it blue”, “add testimonials”, “rename to Our story”, “connect to Contact”</i> — then <b>Rebuild</b> the page<br>• select an action under <b>Logic</b> and press <b>Test run</b> to watch the automation execute<br>• press <b>Save</b> to keep this project on your account", 1100);
    if (hasAnyKey()) {
      const first = g.pageNodes.length ? g.pageNodes[0] : null;
      if (first) await buildPage(first);
    }
    scheduleAutosave();
  }
  function newProject() {
    clearTimeout(autosaveTimer);
    tree = null; conns = []; open = new Set(); sel = null; curPage = null; connectFrom = null; currentProjectId = null; lastFrameKey = "";
    $("msgs").innerHTML = ""; $("build").style.display = "none"; $("start").style.display = "flex";
    ($("p0") as HTMLTextAreaElement).value = ""; $("p0").focus();
    renderProjects();
  }
  function restoreProject(saved: { tree: any; conns: any[] }) {
    $("msgs").innerHTML = ""; lastFrameKey = "";
    tree = saved.tree; conns = saved.conns || [];
    allNodes(tree).forEach((n: any) => { n.notes = n.notes || []; n.children = n.children || []; uid = Math.max(uid, n.id + 1); });
    open = new Set([tree.id]); const pc = cluster("pages"); if (pc) open.add(pc.id);
    sel = tree.id; curPage = pc && pc.children.length ? pc.children[0].id : null;
    $("start").style.display = "none"; $("build").style.display = "flex";
    $("pnameTxt").textContent = tree.label;
    addMsg("ai", "Restored your saved project <b>" + esc(tree.label) + "</b>. " + routeSummary());
    renderAll(); fit(); setView("tree");
  }

  /* ---------------- prompt handling ---------------- */
  async function handlePromptLocal(text: string) {
    const n = sel != null ? find(tree, sel) : null;
    const t = text.toLowerCase();
    let m: RegExpMatchArray | null;
    snap();
    if ((m = t.match(/^(?:add|create)\s+(?:a\s+|an\s+)?(.+)$/))) {
      let label = m[1].trim(), target = n || tree;
      const cm = label.match(/^(page|section|menu item|menu|tool)s?\s*[:\-]?\s*(.*)$/);
      if (cm && cm[2]) {
        const map: Record<string, string> = { page: "pages", section: "sections", menu: "menus", "menu item": "menus", tool: "tools" };
        target = cluster(map[cm[1]]) || target; label = cm[2];
      }
      const ct = childOf[target.type] || "item";
      const k = node(cap(label), ct, "", "Added by prompt.");
      target.children.push(k); open.add(target.id); sel = k.id; expandTo(k.id);
      const pg = pageOf(k); if (pg) curPage = pg.id;
      touchPage(k);
      renderAll();
      await ai("Added <b>" + esc(cap(label)) + "</b> (" + ct + ") inside <b>" + esc(target.label) + "</b>. It’s selected — describe what it needs.", 800);
    } else if (/^(delete|remove)\b/.test(t) && n && n.id !== tree.id) {
      touchPage(n);
      const p = findParent(tree, n.id);
      p.children = p.children.filter((c: any) => c.id !== n.id);
      const dead = new Set(allNodes(n).map((x) => x.id));
      conns = conns.filter((c) => !dead.has(c.from) && !dead.has(c.to));
      sel = p.id; renderAll();
      await ai("Deleted <b>" + esc(n.label) + "</b>.", 600);
    } else if ((m = t.match(/rename(?:\s+.*)?\s+to\s+(.+)/)) && n) {
      const old = n.label; n.label = cap(m[1].trim()); touchPage(n); renderAll();
      await ai("Renamed <b>" + esc(old) + "</b> → <b>" + esc(n.label) + "</b>.", 600);
    } else if ((m = t.match(/connect(?:\s+(?:it|this))?(?:\s+to)?\s+(.+?)(?:\s+as\s+(nav|navigation|data|event))?$/)) && n) {
      const target = byLabel(m[1].trim());
      if (target && target.id !== n.id) {
        const ctp = m[2] ? (m[2] === "navigation" ? "nav" : m[2]) : "nav";
        conns.push({ from: n.id, to: target.id, type: ctp }); renderAll();
        await ai("Connected <b>" + esc(n.label) + "</b> → <b>" + esc(target.label) + "</b> as <b>" + ctp + "</b>.", 800);
      } else await ai("I couldn’t find an element called “" + esc(m[1].trim()) + "”. Try the exact name from the tree.", 700);
    } else if ((m = t.match(/\b(blue|green|red|purple|pink|teal|amber|orange|gray|white)\b/)) && n) {
      n.color = m[1]; touchPage(n); renderAll();
      await ai("Made <b>" + esc(n.label) + "</b> " + m[1] + ". Check the preview.", 700);
    } else if (n) {
      n.notes.push(text); touchPage(n); renderAll();
      await ai("Applied to <b>" + esc(n.label) + "</b>: “" + esc(text) + '”.<br><span style="color:var(--text-muted);font-size:12px;">(Offline mode: saved as a build note. Add your Anthropic key in AI settings for real changes.)</span>', 900);
    } else {
      await ai('Select an element first (in the tree or the preview), then tell me what to change. Or say <i>“add page Pricing”</i>.', 700);
    }
  }

  async function handlePrompt(text: string) {
    addMsg("user", esc(text));
    const t = text.toLowerCase();
    if (/^undo\b/.test(t)) { undo(); await ai("Undid the last change.", 500); return; }
    if (!hasAnyKey()) { await handlePromptLocal(text); return; }
    /* real AI ops */
    typing(true);
    try {
      const n = sel != null ? find(tree, sel) : null;
      const mk = pickFor(n ? domainOf(n) : "back")!;
      const userMsg = "PROJECT STATE:\n" + treeContext() + "\n\nSELECTED ELEMENT: " + (n ? n.id + " (" + n.type + " “" + n.label + "”)" : "none") + "\n\nUSER INSTRUCTION:\n" + text;
      const out = await callAndParse(mk, OPS_SYSTEM, userMsg, (raw) => {
        const o = extractJson(raw);
        if (typeof o.reply !== "string") throw new Error("missing reply field");
        return o;
      });
      typing(false);
      snap();
      const applied = applyOps(Array.isArray(out.ops) ? out.ops : []);
      if (applied) { renderAll(); scheduleAutosave(); }
      addMsg("ai", esc(String(out.reply || "Done.")) + (applied ? '<br><span style="color:var(--text-muted);font-size:12px;">' + applied + " change" + (applied === 1 ? "" : "s") + " applied by " + esc(MODELS[mk].label) + "</span>" : ""));
    } catch (err: any) {
      typing(false);
      addMsg("ai", '<span style="color:var(--text-danger)">AI call failed: ' + esc(err?.message || "unknown error") + "</span> — you can retry, or I can apply simple commands offline (add / rename / delete / connect / colors).");
    }
  }

  /* ---------------- selection ---------------- */
  function select(id: number | null) {
    selConn = null;
    if (connectFrom != null && id != null && id !== connectFrom) {
      const a = find(tree, connectFrom), b = find(tree, id);
      const ctp = $("connType") ? ($("connType") as HTMLSelectElement).value : "nav";
      snap();
      conns.push({ from: connectFrom, to: id, type: ctp });
      connectFrom = null; $("connectbar").style.display = "none";
      sel = id; renderAll();
      addMsg("ai", "Connected <b>" + esc(a.label) + "</b> → <b>" + esc(b.label) + "</b> (" + ctp + ").");
      return;
    }
    sel = id;
    if (id != null) { expandTo(id); const pg = pageOf(find(tree, id)); if (pg) curPage = pg.id; }
    renderAll();
  }

  /* ---------------- render ---------------- */
  function renderAll() { renderTree(); renderPreview(); renderProps(); renderChip(); }
  function renderChip() {
    const c = $("selchip"), n = sel != null ? find(tree, sel) : null;
    if (n && n.id !== tree.id) { c.style.display = "flex"; $("selchipTxt").textContent = n.label + " (" + n.type + ")"; }
    else c.style.display = "none";
  }
  function lay(n: any, d: number): number { n.x = d * COLW; const k = open.has(n.id) ? n.children : []; if (!k.length) { n.h = NH + VGAP; return n.h; } let h = 0; k.forEach((c: any) => (h += lay(c, d + 1))); n.h = Math.max(h, NH + VGAP); return n.h; }
  function place(n: any, t: number) { const k = open.has(n.id) ? n.children : []; if (!k.length) { n.y = t + (n.h - NH) / 2; return; } let y = t; k.forEach((c: any) => { place(c, y); y += c.h; }); n.y = (k[0].y + k[k.length - 1].y) / 2; }
  function vis(n: any, a: any[]): any[] { a.push(n); if (open.has(n.id)) n.children.forEach((c: any) => vis(c, a)); return a; }
  function kicon(n: any) { if (n.type === "step" && n.kind) return ({ ai: "ti-sparkles", table: "ti-database", notify: "ti-mail", condition: "ti-git-fork" } as any)[n.kind] || "ti-arrow-right"; return iconOf[n.type] || "ti-box"; }
  function renderTree() {
    if (!tree) return;
    lay(tree, 0); place(tree, 0);
    const ns = vis(tree, []);
    const idx: Record<number, any> = {}; ns.forEach((n) => (idx[n.id] = n));
    const mw = Math.max(...ns.map((n) => n.x)) + NW + 60, mh = Math.max(...ns.map((n) => n.y)) + NH + 60;
    let svg = '<svg style="position:absolute;top:0;left:0;overflow:visible" width="' + mw + '" height="' + mh + '" aria-hidden="true">';
    ns.forEach((n) => { if (!open.has(n.id)) return; n.children.forEach((k: any) => { const x1 = n.x + NW, y1 = n.y + NH / 2, x2 = k.x, y2 = k.y + NH / 2, m = (x1 + x2) / 2; svg += '<path d="M' + x1 + " " + y1 + " C" + m + " " + y1 + " " + m + " " + y2 + " " + x2 + " " + y2 + '" fill="none" stroke="var(--edge)" stroke-width="1.5"/>'; }); });
    conns.forEach((c, ci) => { const a = idx[c.from], b = idx[c.to]; if (!a || !b) return; const col = c.type === "data" ? "#1D9E75" : c.type === "event" ? "#D85A30" : "#7F77DD"; const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, m = (x1 + x2) / 2; const dd = "M" + x1 + " " + y1 + " C" + (m + 40) + " " + y1 + " " + (m - 40) + " " + y2 + " " + x2 + " " + y2; const sc = ci === selConn; svg += '<path d="' + dd + '" fill="none" stroke="' + col + '" stroke-width="' + (sc ? 3 : 1.5) + '"' + (sc ? "" : ' stroke-dasharray="5 4"') + ' opacity=".9"/>'; svg += '<path d="' + dd + '" fill="none" stroke="rgba(0,0,0,0)" stroke-width="14" style="pointer-events:stroke;cursor:pointer;" data-conn="' + ci + '"/>'; if (c.label) svg += '<text x="' + (x1 + x2) / 2 + '" y="' + ((y1 + y2) / 2 - 7) + '" text-anchor="middle" font-size="10" fill="' + col + '">' + esc(c.label) + "</text>"; });
    svg += "</svg>";
    let h = svg;
    ns.forEach((n) => {
      const kids = n.children.length, io = open.has(n.id), ct = childOf[n.type] || "item";
      h += '<div class="node' + (n.id === sel ? " sel" : "") + (n.id === connectFrom ? " connsrc" : "") + '" data-id="' + n.id + '" style="left:' + n.x + "px;top:" + n.y + 'px" role="button" tabindex="0">'
        + '<i class="ti ' + kicon(n) + '" style="font-size:15px;flex-shrink:0" aria-hidden="true"></i>'
        + '<span class="lb">' + esc(n.label) + "</span>"
        + (kids ? '<span class="badge" data-act="toggle" title="' + (io ? "Collapse" : "Expand") + '">' + (io ? "−" : "+" + kids) + "</span>" : "")
        + '<span class="port" data-port="' + n.id + '" title="Drag to connect to another element"></span>'
        + '<button class="nbtn addbtn" data-act="add" title="Add ' + esc(ct) + '">+</button>'
        + (n.id !== tree.id ? '<button class="nbtn delbtn" data-act="del" title="Delete">×</button>' : "")
        + "</div>";
    });
    $("world").style.width = mw + "px"; $("world").style.height = mh + "px";
    $("world").innerHTML = h;
    tf();
  }
  function tf() { $("world").style.transform = "translate(" + panX + "px," + panY + "px) scale(" + scale + ")"; }
  function renderPreview() {
    if (!tree) return;
    const pagesC = cluster("pages"), menusC = cluster("menus");
    const pages = pagesC ? pagesC.children : [];
    if (!pages.find((p: any) => p.id === curPage)) curPage = pages.length ? pages[0].id : null;
    let nav = '<span class="brand">' + esc(tree.label) + "</span>";
    (menusC ? menusC.children : []).forEach((mi: any) => {
      const c = conns.find((x) => x.from === mi.id);
      const tgt = c ? find(tree, c.to) : null;
      nav += '<a data-nav="' + mi.id + '" data-page="' + (tgt ? tgt.id : "") + '" class="' + (tgt && tgt.id === curPage ? "cur" : "") + '">' + esc(mi.label) + "</a>";
    });
    $("sitenav").innerHTML = nav;
    $("ptabs").innerHTML = '<span style="font-size:11px;color:#96948c;align-self:center;margin-right:4px;">Pages:</span>' + pages.map((p: any) => '<button data-tab="' + p.id + '" class="' + (p.id === curPage ? "cur" : "") + '">' + esc(p.label) + "</button>").join("");
    const pg = curPage != null ? find(tree, curPage) : null;
    let secs = "";
    if (pg) {
      if (!pg.children.length) secs = '<div class="hint" style="padding:30px;text-align:center;">This page has no sections yet. Select the page and say “add hero”.</div>';
      pg.children.forEach((s: any) => {
        const bg = s.color ? COLORS[s.color] : "", tx = s.color ? COLORTX[s.color] : "";
        const tall = /hero/i.test(s.label) ? "min-height:130px;" : /footer/i.test(s.label) ? "min-height:56px;" : "min-height:88px;";
        secs += '<div class="psec' + (s.id === sel ? " sel" : "") + '" data-sec="' + s.id + '" style="' + tall + (bg ? "background:" + bg + ";border-style:solid;border-color:transparent;" : "") + (tx ? "color:" + tx + ";" : "") + '">'
          + '<span class="tag">Selected</span>'
          + "<h3>" + esc(s.label) + "</h3>"
          + "<p>" + esc(s.need || "Click to select · describe it in chat") + "</p>"
          + (s.notes.length ? '<p style="margin-top:6px;font-size:11px;color:#4f46b8;">✎ ' + esc(s.notes[s.notes.length - 1]) + "</p>" : "")
          + '<div class="fake"><i></i><i style="flex:2"></i><i></i></div>'
          + "</div>";
      });
    } else secs = '<div class="hint" style="padding:30px;text-align:center;">No pages yet.</div>';
    $("psecs").innerHTML = secs;
    root.querySelectorAll("#sitenav a").forEach((a: any) => (a.onclick = () => {
      const pid = a.dataset.page;
      if (connectFrom != null) { select(+a.dataset.nav); return; }
      if (pid) { curPage = +pid; select(+pid); } else select(+a.dataset.nav);
    }));
    root.querySelectorAll("#ptabs button").forEach((b: any) => (b.onclick = () => { curPage = +b.dataset.tab; select(+b.dataset.tab); }));
    root.querySelectorAll(".psec").forEach((el: any) => (el.onclick = () => select(+el.dataset.sec)));
    renderLive();
  }
  function renderConnProps(p: HTMLElement) {
    const c = conns[selConn!], a = find(tree, c.from), b = find(tree, c.to);
    if (!a || !b) { selConn = null; p.innerHTML = ""; return; }
    p.innerHTML = '<div class="sec"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><i class="ti ti-plug-connected" style="font-size:20px;color:var(--conn)" aria-hidden="true"></i><span class="chip">connection</span></div>'
      + '<div class="connrow" style="cursor:default;"><span class="go" data-ga="' + a.id + '">' + esc(a.label) + '</span><i class="ti ti-arrow-right" style="font-size:12px;color:var(--text-muted)" aria-hidden="true"></i><span class="go" data-ga="' + b.id + '">' + esc(b.label) + "</span></div>"
      + '<label class="flabel">Type</label><select id="cT" style="width:100%;font-size:13px;padding:7px;border-radius:8px;border:1px solid var(--border);background:var(--surface-1);color:var(--text-primary);"><option value="nav"' + (c.type === "nav" ? " selected" : "") + '>navigation — click goes there</option><option value="data"' + (c.type === "data" ? " selected" : "") + '>data — reads / writes</option><option value="event"' + (c.type === "event" ? " selected" : "") + '>event — triggers action</option></select>'
      + '<label class="flabel">Label (shown on the line)</label><input type="text" id="cL" value="' + esc(c.label || "") + '" style="width:100%;" placeholder="e.g. submits to">'
      + '<label class="flabel">What this connection does</label><textarea id="cD" rows="3" style="width:100%;" placeholder="Describe the behavior…">' + esc(c.desc || "") + "</textarea></div>"
      + '<div class="sec"><button id="cDel" style="width:100%;justify-content:center;color:var(--text-danger);border:1px solid var(--border-danger);"><i class="ti ti-trash" aria-hidden="true"></i> Delete connection</button></div>'
      + '<div class="sec hint" style="border-bottom:none;">Tip: drag from a node’s purple dot onto another node to create a connection. Click any dashed line to edit it.</div>';
    ($("cT") as HTMLSelectElement).onchange = (e: any) => { snap(); c.type = e.target.value; renderAll(); };
    ($("cL") as HTMLInputElement).oninput = (e: any) => { c.label = e.target.value; };
    ($("cL") as HTMLInputElement).onchange = () => renderTree();
    ($("cD") as HTMLTextAreaElement).oninput = (e: any) => { c.desc = e.target.value; };
    $("cDel").onclick = () => { snap(); conns.splice(selConn!, 1); selConn = null; renderAll(); toast("Connection deleted"); };
    p.querySelectorAll("[data-ga]").forEach((el: any) => (el.onclick = () => { selConn = null; select(+el.dataset.ga); }));
  }
  function renderProps() {
    const p = $("props");
    if (!propsOpen) { p.style.display = "none"; return; }
    p.style.display = "flex";
    if (selConn != null && conns[selConn]) { renderConnProps(p); return; }
    const n = sel != null ? find(tree, sel) : null;
    if (!n) { p.innerHTML = '<div class="sec hint">Select an element in the tree or preview to edit it here.</div>'; return; }
    const ct = childOf[n.type] || "item";
    const myConns = conns.map((c, i) => ({ ...c, i })).filter((c) => c.from === n.id || c.to === n.id);
    p.innerHTML =
      '<div class="sec"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
      + '<i class="ti ' + kicon(n) + '" style="font-size:20px;color:var(--text-accent)" aria-hidden="true"></i><span class="chip">' + esc(n.type) + '</span><span class="chip" style="background:var(--surface-1);color:var(--text-secondary);text-transform:none;" title="' + esc(whyOf(n)) + '"><i class="ti ti-cpu" style="font-size:11px;margin-right:3px;"></i>' + esc(modelOf(n)) + "</span></div>"
      + '<label class="flabel">Name</label><input type="text" id="fN" value="' + esc(n.label) + '" style="width:100%;">'
      + '<label class="flabel">What it needs</label><textarea id="fD" rows="2" style="width:100%;">' + esc(n.need || "") + "</textarea>"
      + '<label class="flabel">How it works</label><textarea id="fH" rows="2" style="width:100%;">' + esc(n.how || "") + "</textarea>"
      + (n.type === "section" ? '<label class="flabel">Color (vibe)</label><div class="swatches">' + Object.keys(COLORS).map((c) => '<button class="sw" data-c="' + c + '" title="' + c + '" style="background:' + COLORS[c] + ';"></button>').join("") + "</div>" : "")
      + (n.type === "action" ? '<label class="flabel">Trigger</label><input type="text" id="fTrig" value="' + esc(n.trigger || "Manual") + '" style="width:100%;"><button class="primary" id="runBtn" style="width:100%;justify-content:center;margin-top:10px;"><i class="ti ti-player-play"></i> Test run</button>' + (n.runs && n.runs.length ? '<div class="hint" style="margin-top:6px;">Last run: ' + esc(n.runs[n.runs.length - 1]) + " · total runs: " + n.runs.length + "</div>" : "") : "")
      + "</div>"
      + '<div class="sec">'
      + '<button class="primary" id="pAdd" style="width:100%;justify-content:center;"><i class="ti ti-plus"></i> Add ' + esc(ct) + "</button>"
      + '<button id="pConn" style="width:100%;justify-content:center;margin-top:6px;border:1px solid var(--border);"><i class="ti ti-plug-connected"></i> Connect to…</button>'
      + (n.id !== tree.id ? '<button id="pDel" style="width:100%;justify-content:center;margin-top:6px;color:var(--text-danger);border:1px solid var(--border-danger);"><i class="ti ti-trash"></i> Delete</button>' : "")
      + "</div>"
      + '<div class="sec"><label class="flabel" style="margin-top:0;">Connections (' + myConns.length + ")</label>"
      + (myConns.length ? myConns.map((c) => { const other = find(tree, c.from === n.id ? c.to : c.from); return '<div class="connrow"><i class="ti ti-plug-connected" style="font-size:13px;color:var(--conn)"></i><span class="go" data-go="' + other.id + '">' + (c.from === n.id ? "→ " : "← ") + esc(other.label) + '</span><span style="font-size:10px;color:var(--text-muted);margin-left:4px;">' + (c.type || "nav") + '</span><span class="rm" data-rm="' + c.i + '" title="Remove connection">✕</span></div>'; }).join("") : '<div class="hint">None. Use “Connect to…” or say <i>connect to Orders as data</i> in chat.</div>')
      + "</div>"
      + '<div class="sec"><label class="flabel" style="margin-top:0;">Inside (' + n.children.length + ")</label>"
      + (n.children.length ? n.children.map((c: any) => '<div class="childrow" data-j="' + c.id + '"><i class="ti ' + (iconOf[c.type] || "ti-box") + '" style="font-size:14px;color:var(--text-secondary)"></i><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(c.label) + "</span>" + (c.children.length ? '<span style="font-size:10px;color:var(--text-muted);">' + c.children.length + "</span>" : "") + "</div>").join("") : '<div class="hint">Nothing yet.</div>')
      + "</div>"
      + (n.notes.length ? '<div class="sec"><label class="flabel" style="margin-top:0;">Build notes (' + n.notes.length + ")</label>" + n.notes.map((t: string) => '<div class="hint" style="margin-top:4px;">• ' + esc(t) + "</div>").join("") + "</div>" : "")
      + '<div class="sec hint" style="border-bottom:none;margin-top:auto;">Total elements: ' + count(tree) + "</div>";
    ($("fN") as HTMLInputElement).oninput = (e: any) => { n.label = e.target.value; touchPage(n); const s = root.querySelector('.node[data-id="' + n.id + '"] .lb'); if (s) s.textContent = n.label; };
    ($("fN") as HTMLInputElement).onchange = () => renderAll();
    ($("fD") as HTMLTextAreaElement).oninput = (e: any) => { n.need = e.target.value; touchPage(n); };
    ($("fH") as HTMLTextAreaElement).oninput = (e: any) => (n.how = e.target.value);
    ($("fD") as HTMLTextAreaElement).onchange = () => renderPreview();
    const tg = $("fTrig"); if (tg) (tg as HTMLInputElement).oninput = (e: any) => { n.trigger = e.target.value; };
    const rb = $("runBtn"); if (rb) rb.onclick = () => runFlow(n);
    $("pAdd").onclick = () => { const k = nodeAdd(n); select(k.id); };
    $("pConn").onclick = () => { connectFrom = n.id; $("connFrom").textContent = n.label; $("connectbar").style.display = "flex"; renderTree(); toast("Click a target in the tree or preview"); };
    const d = $("pDel"); if (d) d.onclick = () => delNode(n);
    p.querySelectorAll("[data-j]").forEach((el: any) => (el.onclick = () => select(+el.dataset.j)));
    p.querySelectorAll("[data-go]").forEach((el: any) => (el.onclick = () => select(+el.dataset.go)));
    p.querySelectorAll("[data-rm]").forEach((el: any) => (el.onclick = () => { snap(); conns.splice(+el.dataset.rm, 1); renderAll(); }));
    p.querySelectorAll(".sw").forEach((el: any) => (el.onclick = () => { snap(); n.color = el.dataset.c; touchPage(n); renderAll(); }));
  }
  function nodeAdd(parent: any) {
    snap();
    const ct = childOf[parent.type] || "item";
    const k = node("New " + ct, ct, "", "");
    parent.children.push(k); open.add(parent.id);
    addMsg("ai", "Added a new " + ct + " inside <b>" + esc(parent.label) + "</b> — name it in the panel.");
    return k;
  }
  function delNode(n: any) {
    if (n.id === tree.id) return;
    snap();
    const p = findParent(tree, n.id);
    p.children = p.children.filter((c: any) => c.id !== n.id);
    const dead = new Set(allNodes(n).map((x) => x.id));
    conns = conns.filter((c) => !dead.has(c.from) && !dead.has(c.to));
    sel = p.id; renderAll(); toast('Deleted "' + n.label + '"');
  }
  function toast(m: string) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200); }

  /* ---------------- automation test run ---------------- */
  let runBusy = false;
  function runFlow(act: any) {
    if (runBusy) { toast("A run is already in progress"); return; }
    runBusy = true;
    setView("tree");
    open.add(act.id); expandTo(act.id);
    const sources = conns.filter((c) => c.to === act.id && c.type === "event").map((c) => find(tree, c.from)).filter(Boolean);
    sources.forEach((s: any) => expandTo(s.id));
    renderAll();
    const chain = [...sources, act, ...act.children];
    addMsg("ai", "▶ Test run: <b>" + esc(act.label) + "</b> — trigger “" + esc(act.trigger || "Manual") + "” (simulated)…");
    let i = 0;
    function stepRun() {
      root.querySelectorAll(".node.running").forEach((x) => x.classList.remove("running"));
      if (i >= chain.length) {
        act.runs = act.runs || []; act.runs.push(new Date().toLocaleTimeString());
        runBusy = false; renderAll();
        addMsg("ai", "✓ <b>" + esc(act.label) + "</b> finished — " + act.children.length + " steps executed.");
        toast("Run complete");
        return;
      }
      const nd = chain[i];
      const el = root.querySelector('.node[data-id="' + nd.id + '"]');
      if (el) el.classList.add("running");
      if (i > 0) pulse(chain[i - 1], nd);
      i++; setTimeout(stepRun, 700);
    }
    stepRun();
  }
  function pulse(a: any, b: any) {
    const svgEl = $("world").querySelector("svg"); if (svgEl == null || a.x == null || b.x == null) return;
    const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, m = (x1 + x2) / 2;
    const ns = "http://www.w3.org/2000/svg";
    const pp = document.createElementNS(ns, "path");
    pp.setAttribute("d", "M" + x1 + " " + y1 + " C" + m + " " + y1 + " " + m + " " + y2 + " " + x2 + " " + y2);
    pp.setAttribute("fill", "none"); pp.setAttribute("stroke", "#1D9E75"); pp.setAttribute("stroke-width", "2.5"); pp.setAttribute("opacity", ".9");
    svgEl.appendChild(pp);
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("r", "5"); dot.setAttribute("fill", "#1D9E75"); svgEl.appendChild(dot);
    const len = (pp as any).getTotalLength(), t0 = performance.now();
    (function anim(now: number) {
      const t = Math.min(1, (now - t0) / 600);
      const pt = (pp as any).getPointAtLength(len * t);
      dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y);
      if (t < 1) requestAnimationFrame(anim); else setTimeout(() => { pp.remove(); dot.remove(); }, 150);
    })(t0);
  }

  /* ---------------- view switching ---------------- */
  function setView(v: string) {
    view = v;
    $("vTree").classList.toggle("on", v === "tree");
    $("vPrev").classList.toggle("on", v === "preview");
    $("treeview").style.display = v === "tree" ? "block" : "none";
    $("previewview").style.display = v === "preview" ? "block" : "none";
    if (v === "tree") fit();
  }
  function fit() {
    if (!tree) return;
    lay(tree, 0); place(tree, 0);
    const ns = vis(tree, []);
    const w = Math.max(...ns.map((n) => n.x)) + NW + 80, h = Math.max(...ns.map((n) => n.y)) + NH + 80;
    const r = $("treeview").getBoundingClientRect();
    if (!r.width) return;
    scale = Math.min(1.15, Math.max(0.3, Math.min(r.width / w, r.height / h)));
    panX = (r.width - w * scale) / 2 + 16; panY = (r.height - h * scale) / 2 + 16; tf();
  }

  /* ---------------- tree canvas interactions ---------------- */
  const tv = $("treeview");
  let drag = false, mv = 0, lx = 0, ly = 0;
  tv.addEventListener("mousedown", (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("#treefloat")) return;
    const pt = (e.target as HTMLElement).closest("[data-port]");
    if (pt) { linking = { from: +pt.getAttribute("data-port")! }; e.preventDefault(); return; }
    drag = true; mv = 0; lx = e.clientX; ly = e.clientY; tv.style.cursor = "grabbing";
  });
  const onMove = (e: MouseEvent) => {
    if (linking) {
      const r = tv.getBoundingClientRect();
      const wx = (e.clientX - r.left - panX) / scale, wy = (e.clientY - r.top - panY) / scale;
      const a = find(tree, linking.from);
      const svgEl = $("world").querySelector("svg");
      let gl = root.querySelector("#ghostline") as any;
      if (!gl && svgEl) { gl = document.createElementNS("http://www.w3.org/2000/svg", "path"); gl.setAttribute("id", "ghostline"); gl.setAttribute("fill", "none"); gl.setAttribute("stroke", "#7F77DD"); gl.setAttribute("stroke-width", "2"); gl.setAttribute("stroke-dasharray", "4 3"); svgEl.appendChild(gl); }
      if (gl && a) { const x1 = a.x + NW, y1 = a.y + NH / 2, m = (x1 + wx) / 2; gl.setAttribute("d", "M" + x1 + " " + y1 + " C" + m + " " + y1 + " " + m + " " + wy + " " + wx + " " + wy); }
      return;
    }
    if (!drag) return; const dx = e.clientX - lx, dy = e.clientY - ly; mv += Math.abs(dx) + Math.abs(dy); panX += dx; panY += dy; lx = e.clientX; ly = e.clientY; tf();
  };
  const onUp = (e: MouseEvent) => {
    if (linking) {
      const gl = root.querySelector("#ghostline"); if (gl) gl.remove();
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const tgt = hit ? (hit as HTMLElement).closest(".node") : null;
      if (tgt && +(tgt as HTMLElement).dataset.id! !== linking.from) {
        const b = find(tree, +(tgt as HTMLElement).dataset.id!);
        const tp = b.type === "table" || b.type === "field" ? "data" : b.type === "action" || b.type === "step" ? "event" : "nav";
        snap(); conns.push({ from: linking.from, to: b.id, type: tp, label: "", desc: "" });
        selConn = conns.length - 1; sel = null; renderAll();
        toast("Connected as " + tp + " — edit it in the panel");
      }
      linking = null; return;
    }
    drag = false; tv.style.cursor = "grab";
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  tv.addEventListener("click", (e: MouseEvent) => {
    if (mv > 5) return;
    const cp = (e.target as HTMLElement).closest("[data-conn]");
    if (cp) { selConn = +cp.getAttribute("data-conn")!; sel = null; renderAll(); return; }
    const el = (e.target as HTMLElement).closest(".node"); if (!el) return;
    const id = +(el as HTMLElement).dataset.id!, n = find(tree, id);
    const actEl = (e.target as HTMLElement).closest("[data-act]");
    const act = actEl ? (actEl as HTMLElement).dataset.act : null;
    if (act === "toggle") { if (open.has(id)) (function ca(x: any) { open.delete(x.id); x.children.forEach(ca); })(n); else open.add(id); sel = id; renderAll(); }
    else if (act === "add") { sel = id; const k = nodeAdd(n); select(k.id); }
    else if (act === "del") { delNode(n); }
    else select(id);
  });
  tv.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const old = scale; scale = Math.min(2, Math.max(0.3, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
      const r = tv.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
      panX = cx - (cx - panX) * (scale / old); panY = cy - (cy - panY) * (scale / old);
    } else { panX -= e.deltaX; panY -= e.deltaY; }
    tf();
  }, { passive: false });

  /* ---------------- undo ---------------- */
  const hist: string[] = [];
  function snap() { hist.push(JSON.stringify({ t: tree, c: conns })); if (hist.length > 30) hist.shift(); scheduleAutosave(); }
  function undo() { if (!hist.length) { toast("Nothing to undo"); return; } const s = JSON.parse(hist.pop()!); tree = s.t; conns = s.c; if (sel != null && !find(tree, sel)) sel = tree.id; if (curPage != null && !find(tree, curPage)) curPage = null; renderAll(); toast("Undone"); }

  /* ---------------- save / autosave / projects ---------------- */
  let currentProjectId: string | null = null;
  let autosaveTimer: any = null;
  let saving = false;
  function setSaveLabel(t: string) { const el = $("bSaveTxt"); if (el) el.textContent = t; }
  function setSaveWarn(msg: string | null) {
    const el = $("savewarn");
    if (!el) return;
    if (msg) { el.textContent = "⚠ " + msg; el.style.display = "inline-flex"; }
    else el.style.display = "none";
  }
  async function doSave(silent?: boolean) {
    if (!tree) { if (!silent) toast("Nothing to save yet"); return; }
    if (saving) return;
    saving = true;
    setSaveLabel("Saving…");
    const clean = JSON.parse(JSON.stringify({ tree, conns })); // strips undefined + functions
    const r = await handles.save({ tree: clean.tree, conns: clean.conns, name: tree.label }, currentProjectId);
    saving = false;
    if (r.error) {
      setSaveLabel("Save");
      setSaveWarn("Not saved — " + r.error);
      if (!silent) toast("Save failed: " + r.error);
      return;
    }
    setSaveWarn(null);
    if (r.id) {
      if (!currentProjectId) handles.projects.unshift({ id: r.id, name: tree.label, data: clean });
      currentProjectId = r.id;
      const row = handles.projects.find((p) => p.id === currentProjectId);
      if (row) { row.name = tree.label; row.data = clean; }
    }
    setSaveLabel("Saved ✓");
    setTimeout(() => setSaveLabel("Save"), 2200);
    if (!silent) toast("Project saved ✓");
  }
  function scheduleAutosave() {
    if (!tree) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => doSave(true), 4000);
  }
  function renderProjects() {
    const row = $("projrow"), chips = $("projchips");
    if (!row || !chips) return;
    const list = handles.projects.filter((p) => p.data && p.data.tree);
    if (!list.length) { row.style.display = "none"; return; }
    row.style.display = "flex";
    chips.innerHTML = list.slice(0, 6).map((p) => '<button data-proj="' + esc(p.id) + '"><i class="ti ti-folder-open" style="font-size:12px;margin-right:4px;"></i>' + esc(p.name || "Untitled") + "</button>").join("");
    chips.querySelectorAll("[data-proj]").forEach((b: any) => (b.onclick = () => {
      const p = handles.projects.find((x) => x.id === b.dataset.proj);
      if (p && p.data) { currentProjectId = p.id; restoreProject(JSON.parse(JSON.stringify(p.data))); }
    }));
  }

  /* ---------------- export (.zip of the built site) ---------------- */
  function slugOf(l: string) { return l.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page"; }
  async function exportSite() {
    if (!tree) { toast("Nothing to export yet"); return; }
    const pages = cluster("pages").children;
    const built = pages.filter((p: any) => p.html);
    if (!built.length) { toast("No pages built yet — build the live site first"); return; }
    toast("Packing site…");
    try {
      if (!(window as any).JSZip) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
          s.onload = () => res(); s.onerror = () => rej(new Error("Could not load the zip library"));
          document.head.appendChild(s);
        });
      }
      const JSZip = (window as any).JSZip;
      const zip = new JSZip();
      const fileOf = (p: any) => (p.id === pages[0].id ? "index.html" : slugOf(p.label) + ".html");
      const fileByLabel: Record<string, string> = {};
      pages.forEach((q: any) => (fileByLabel[q.label.toLowerCase()] = fileOf(q)));
      built.forEach((p: any) => {
        const src = p.html.split(NAV_SCRIPT).join("");
        /* DOM-based link rewiring — robust to attribute order and extra attrs */
        const doc = new DOMParser().parseFromString(src, "text/html");
        doc.querySelectorAll("a[data-page]").forEach((a) => {
          const target = (a.getAttribute("data-page") || "").toLowerCase();
          const file = fileByLabel[target];
          if (file) a.setAttribute("href", file);
          a.removeAttribute("data-page");
        });
        zip.file(fileOf(p), "<!DOCTYPE html>\n" + doc.documentElement.outerHTML);
      });
      zip.file("README.txt", tree.label + "\nExported from Devgri AI Builder.\nOpen index.html in a browser, or upload the folder to any static host (Vercel, Netlify, GitHub Pages).\n");
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = slugOf(tree.label) + "-site.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      const missing = pages.filter((p: any) => !p.html).map((p: any) => p.label);
      addMsg("ai", "⬇ Exported <b>" + built.length + " page" + (built.length === 1 ? "" : "s") + "</b> as a static site." + (missing.length ? " Not built yet (skipped): " + esc(missing.join(", ")) + "." : "") + " Open index.html locally or drop the folder on any static host.");
      toast("Site exported ✓");
    } catch (err: any) {
      toast("Export failed: " + (err?.message || "unknown error"));
    }
  }

  /* ---------------- settings ---------------- */
  function refreshKeyHint() {
    const el = $("p0key");
    if (!el) return;
    const provs = (["anthropic", "openai", "google"] as Provider[]).filter((p) => settings.keys[p]).map((p) => PROVIDER_LABEL[p]);
    el.innerHTML = provs.length ? provs.join(" + ") + ' connected — designs are real. <b id="p0keySet">Manage keys</b>' : 'No API keys — offline demo mode. <b id="p0keySet">Add keys</b>';
    const set = $("p0keySet"); if (set) set.onclick = () => { populateSettingsModal(); $("setmodal").style.display = "flex"; };
  }
  function buildModelSelects() {
    const groups: Record<string, string[]> = { anthropic: [], openai: [], google: [] };
    Object.keys(MODELS).forEach((k) => groups[MODELS[k].provider].push(k));
    const html = (["anthropic", "openai", "google"] as Provider[]).map((p) => '<optgroup label="' + PROVIDER_LABEL[p] + '">' + groups[p].map((k) => '<option value="' + k + '">' + esc(MODELS[k].label) + "</option>").join("") + "</optgroup>").join("");
    (["sFront", "sBack", "sMedia"] as const).forEach((id) => { const s = $(id) as HTMLSelectElement; if (s) s.innerHTML = html; });
    ($("sFront") as HTMLSelectElement).value = settings.manual.front;
    ($("sBack") as HTMLSelectElement).value = settings.manual.back;
    ($("sMedia") as HTMLSelectElement).value = settings.manual.media;
  }
  function populateSettingsModal() {
    ($("kKeyAnthropic") as HTMLInputElement).value = settings.keys.anthropic;
    ($("kKeyOpenai") as HTMLInputElement).value = settings.keys.openai;
    ($("kKeyGoogle") as HTMLInputElement).value = settings.keys.google;
    ($("mAuto") as HTMLInputElement).checked = settings.mode !== "manual";
    ($("mMan") as HTMLInputElement).checked = settings.mode === "manual";
    const man = settings.mode === "manual";
    $("manrows").style.opacity = man ? "1" : ".45"; $("manrows").style.pointerEvents = man ? "auto" : "none";
    ($("sFront") as HTMLSelectElement).value = settings.manual.front;
    ($("sBack") as HTMLSelectElement).value = settings.manual.back;
    ($("sMedia") as HTMLSelectElement).value = settings.manual.media;
  }
  function persistSettings() {
    /* sessionStorage: survives refresh in this tab, cleared when the tab closes.
       Never sent to Devgri servers. */
    try { sessionStorage.setItem("devgri.builder.settings", JSON.stringify(settings)); } catch { /* private mode */ }
  }
  function loadSettings() {
    try {
      const raw = sessionStorage.getItem("devgri.builder.settings");
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && s.keys) { settings.keys = { anthropic: s.keys.anthropic || "", openai: s.keys.openai || "", google: s.keys.google || "" }; }
      if (s && s.mode) settings.mode = s.mode;
      if (s && s.manual) settings.manual = { ...settings.manual, ...s.manual };
    } catch { /* ignore corrupt state */ }
  }
  function applySettings() {
    settings.keys = {
      anthropic: ($("kKeyAnthropic") as HTMLInputElement).value.trim(),
      openai: ($("kKeyOpenai") as HTMLInputElement).value.trim(),
      google: ($("kKeyGoogle") as HTMLInputElement).value.trim(),
    };
    settings.mode = ($("mMan") as HTMLInputElement).checked ? "manual" : "auto";
    settings.manual = { front: ($("sFront") as HTMLSelectElement).value, back: ($("sBack") as HTMLSelectElement).value, media: ($("sMedia") as HTMLSelectElement).value };
    persistSettings();
    $("setmodal").style.display = "none";
    refreshKeyHint();
    if (tree) { renderProps(); addMsg("ai", routeSummary()); }
  }

  /* ---------------- wiring ---------------- */
  $("go").onclick = () => { const v = ($("p0") as HTMLTextAreaElement).value.trim(); if (v) createProject(v); };
  $("p0").addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("go").click(); } });
  root.querySelectorAll(".chips button").forEach((b: any) => (b.onclick = () => { ($("p0") as HTMLTextAreaElement).value = b.dataset.ex; $("go").click(); }));
  $("vTree").onclick = () => setView("tree");
  $("vPrev").onclick = () => setView("preview");
  $("bNew").onclick = () => { if (confirm("Start a new project? Your current one stays saved under “Your saved projects”.")) { doSave(true); newProject(); } };
  $("bProps").onclick = () => { propsOpen = !propsOpen; renderProps(); };
  $("bSave").onclick = () => doSave(false);
  $("bExport").onclick = exportSite;
  $("bOut").onclick = () => handles.signOut();
  $("send").onclick = () => {
    if (building) { toast("A page is building — one moment, then send again"); return; }
    const v = ($("pin") as HTMLTextAreaElement).value.trim(); if (!v) return;
    ($("pin") as HTMLTextAreaElement).value = ""; handlePrompt(v);
  };
  $("pin").addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("send").click(); } });
  $("selchipX").onclick = () => select(null);
  $("connCancel").onclick = () => { connectFrom = null; $("connectbar").style.display = "none"; renderTree(); };
  $("tExp").onclick = () => { (function ea(n: any) { if (n.children.length) open.add(n.id); n.children.forEach(ea); })(tree); renderAll(); fit(); };
  $("tCol").onclick = () => { open.clear(); open.add(tree.id); renderAll(); fit(); };
  $("tZi").onclick = () => { scale = Math.min(2, scale + 0.1); tf(); };
  $("tZo").onclick = () => { scale = Math.max(0.3, scale - 0.1); tf(); };
  $("tFit").onclick = fit;
  $("bUndo").onclick = () => undo();
  $("tSearch").addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const q = (e.target as HTMLInputElement).value.trim(); if (!q) return;
    const nd = byLabel(q);
    if (!nd) { toast('No element called "' + q + '"'); return; }
    select(nd.id);
    const r = tv.getBoundingClientRect();
    panX = r.width / 2 - (nd.x + NW / 2) * scale; panY = r.height / 2 - (nd.y + NH / 2) * scale; tf();
  });
  $("dDesk").onclick = () => { $("site").style.maxWidth = "860px"; $("siteLive").style.maxWidth = "100%"; $("dDesk").classList.add("on"); $("dMob").classList.remove("on"); };
  $("dMob").onclick = () => { $("site").style.maxWidth = "390px"; $("siteLive").style.maxWidth = "390px"; $("dMob").classList.add("on"); $("dDesk").classList.remove("on"); };
  $("mBlue").onclick = () => { pvMode = "blueprint"; $("mBlue").classList.add("on"); $("mLive").classList.remove("on"); renderPreview(); };
  $("mLive").onclick = () => { pvMode = "live"; $("mLive").classList.add("on"); $("mBlue").classList.remove("on"); renderPreview(); };
  $("pBuild").onclick = () => { const pg = curPage != null ? find(tree, curPage) : null; if (pg) buildPage(pg); };
  $("bSet").onclick = () => { populateSettingsModal(); $("setmodal").style.display = "flex"; };
  $("setDone").onclick = applySettings;
  $("setClose").onclick = () => { $("setmodal").style.display = "none"; }; /* cancel, don't apply */
  root.querySelectorAll("input[name=rmode]").forEach((r: any) => (r.onchange = () => { const man = ($("mMan") as HTMLInputElement).checked; $("manrows").style.opacity = man ? "1" : ".45"; $("manrows").style.pointerEvents = man ? "auto" : "none"; }));
  window.addEventListener("resize", () => { if (view === "tree") fit(); });
  loadSettings();
  refreshKeyHint();
  buildModelSelects();

  /* ---------------- boot ---------------- */
  renderProjects();
  const latest = handles.projects.find((p) => p.data && p.data.tree);
  if (latest) {
    try { currentProjectId = latest.id; restoreProject(JSON.parse(JSON.stringify(latest.data))); } catch { newProject(); }
  } else {
    ($("p0") as HTMLTextAreaElement).focus();
  }
}
