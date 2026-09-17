/* Pure parsing for the /auth/callback landing route.

   Supabase has shipped three email-link shapes and any of them can land on
   the callback, depending on the project's email templates:

     1. implicit flow  -> tokens in the URL hash  (#access_token=...)
     2. PKCE flow      -> ?code=...
     3. newer templates -> ?token_hash=...&type=signup

   This module only parses the URL — it never talks to Supabase — so it can be
   unit-tested without a browser. The component keeps the side effects. */

export type AuthCallbackParams = {
  errorDescription: string | null;
  next: string;
  code: string | null;
  tokenHash: string | null;
  type: string | null;
};

export function parseAuthCallback(
  search: string,
  hash: string
): AuthCallbackParams {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));

  return {
    errorDescription:
      query.get("error_description") || fragment.get("error_description"),
    next: query.get("next") || "/builder",
    code: query.get("code"),
    tokenHash: query.get("token_hash"),
    type: query.get("type"),
  };
}
