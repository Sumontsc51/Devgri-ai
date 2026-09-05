import { describe, expect, it } from "vitest";
import { stripApiKeys } from "./workspace";

describe("stripApiKeys", () => {
  it("removes a top-level apiKey field", () => {
    const workspace = {
      tree: { id: 1, label: "App", apiKey: "sk-ant-secret" },
      conns: [],
    };
    const cleaned = stripApiKeys(workspace) as typeof workspace;
    expect(cleaned.tree).not.toHaveProperty("apiKey");
    expect(cleaned.tree).toEqual({ id: 1, label: "App" });
  });

  it("removes nested key-bearing fields and arrays", () => {
    const workspace = {
      tree: {
        id: 1,
        children: [
          { id: 2, label: "Section", keys: { anthropic: "sk-secret" } },
          { id: 3, label: "Node", token: "tok-abc" },
        ],
      },
      conns: [{ from: 1, to: 2, secret: "hunter2" }],
    };
    const cleaned = stripApiKeys(workspace) as typeof workspace;
    expect(cleaned.tree.children[0]).not.toHaveProperty("keys");
    expect(cleaned.tree.children[1]).not.toHaveProperty("token");
    expect(cleaned.conns[0]).not.toHaveProperty("secret");
  });

  it("does not mutate the input", () => {
    const workspace = { tree: { apiKey: "sk-secret", label: "App" }, conns: [] };
    stripApiKeys(workspace);
    expect(workspace.tree).toHaveProperty("apiKey", "sk-secret");
  });

  it("leaves primitives untouched", () => {
    expect(stripApiKeys("sk-secret")).toBe("sk-secret");
    expect(stripApiKeys(42)).toBe(42);
    expect(stripApiKeys(null)).toBeNull();
  });
});
