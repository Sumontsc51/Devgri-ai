import { describe, expect, it } from "vitest";
import { parseAuthCallback } from "./auth-callback";

describe("parseAuthCallback", () => {
  it("parses a PKCE ?code= link", () => {
    expect(parseAuthCallback("?code=abc-123", "")).toEqual({
      errorDescription: null,
      next: "/builder",
      code: "abc-123",
      tokenHash: null,
      type: null,
    });
  });

  it("parses a ?token_hash= link", () => {
    expect(parseAuthCallback("?token_hash=deadbeef&type=signup", "")).toEqual({
      errorDescription: null,
      next: "/builder",
      code: null,
      tokenHash: "deadbeef",
      type: "signup",
    });
  });

  it("leaves implicit-flow hash tokens alone so detectSessionInUrl can read them", () => {
    const hash =
      "#access_token=foo&refresh_token=bar&type=recovery&expires_in=3600";
    expect(parseAuthCallback("", hash)).toEqual({
      errorDescription: null,
      next: "/builder",
      code: null,
      tokenHash: null,
      type: null,
    });
  });

  it("surfaces error_description from the query string", () => {
    expect(parseAuthCallback("?error_description=Email+link+expired", "")).toEqual(
      {
        errorDescription: "Email link expired",
        next: "/builder",
        code: null,
        tokenHash: null,
        type: null,
      }
    );
  });

  it("surfaces error_description from the hash", () => {
    expect(parseAuthCallback("", "#error_description=Invalid+token")).toEqual({
      errorDescription: "Invalid token",
      next: "/builder",
      code: null,
      tokenHash: null,
      type: null,
    });
  });

  it("returns an empty result for a malformed link", () => {
    expect(parseAuthCallback("", "")).toEqual({
      errorDescription: null,
      next: "/builder",
      code: null,
      tokenHash: null,
      type: null,
    });
  });

  it("honours a ?next= destination", () => {
    expect(
      parseAuthCallback("?code=abc&next=%2Fdashboard", "").next
    ).toBe("/dashboard");
  });
});
