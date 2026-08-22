# Security Hardening & Auth-Coverage Fixes — Design Spec

## Context

A read-only audit (2026-08-22) of every API route (`app/api/**/route.ts`) and
every server-action file (`app/**/actions.ts`) found the authorization model
itself is sound everywhere except six specific gaps, plus a deprecated
Next.js 16 file convention still in use. This spec covers closing those gaps.
Lint/type-warning cleanup is a separate, unrelated effort — not covered here.

## Findings in scope

1. **Hardcoded JWT fallback secret.** `middleware.ts:6` and `lib/jwt.ts:4`
   each independently do
   `process.env.JWT_SECRET || "fallback-secret-at-least-32-chars-long"`.
   If `JWT_SECRET` is ever unset in production, that literal string —
   visible to anyone with the source — becomes a valid signing key for
   forged ADMIN sessions. Local `.env` currently has no `JWT_SECRET` at
   all, meaning dev has been silently running on the fallback the whole
   time.

2. **`app/api/users/route.ts` GET has no auth check.** It's a public,
   unauthenticated dump of every user's name/email/role/verification
   status/organization. Confirmed via repo-wide grep: no client code
   references `/api/users` — the dashboard users page already uses the
   correctly-gated `getUsers()` server action instead. This route is dead
   code and a hole at the same time.

3. **`app/api/upload/route.ts` POST has no auth and no file
   validation.** Its sibling `app/api/blogs/upload/route.ts` is
   admin-gated and validates type/size; this one accepts an unauthenticated
   POST of any file straight to the project's Cloudinary account. Confirmed
   callers are `app/profile/page.tsx` and
   `app/dashboard/edit-profile/page.tsx` — both logged-in users updating
   their own avatar, not admin-only flows. The fix scopes to "any
   authenticated session," not `requireAdmin()`.

4. **No rate limiting on OTP issuance or verification.** `send-otp`,
   `login` (which verifies the OTP and creates the session), and
   `register` (which also independently verifies the OTP) all check a
   6-digit code against `VerificationToken` with a 10-minute expiry and no
   attempt cap — brute-forceable inside the window — and `send-otp` itself
   can be called an unlimited number of times per email (mailbox-bombing
   any address).

5. **`getUsers()` in `app/dashboard/users/actions.ts` returns full `User`
   rows, including the bcrypt `password` hash, to the client.** Grepped:
   nothing in `app/dashboard/users/**` reads `.password`, so dropping it
   from the query is safe.

6. **`createUser()` in the same file logs the freshly generated temporary
   password in plaintext** (`console.log(\`... Temp password: ${tempPassword}\`)`),
   landing in server logs.

7. **`middleware.ts` uses Next.js's deprecated file convention.** Next 16
   renamed it to `proxy.ts` (exported function renamed `middleware` →
   `proxy`; `config`/`matcher` unchanged). Confirmed against the bundled
   Next.js docs and build-time detection logic in
   `node_modules/next/dist/build/analysis/get-page-static-info.js`: the
   new file must export a function named `proxy` (or a default export);
   the `config` object with `matcher` works identically to today.

## Decisions

- **Rate limiting: in-memory, no new dependency.** This app deploys to a
  single VPS process (per prior project context — schema changes there
  require `prisma db push`, confirming a traditional single-instance
  deploy, not serverless/multi-region), so a `Map`-based fixed-window
  limiter is correct and sufficient; a Redis-backed limiter would be
  solving a scaling problem this deployment doesn't have.
- **Rate limit scope:** cover `send-otp`, `login`, and `register` — all
  three independently check a code against the same `VerificationToken`
  table, so all three are brute-forceable if only two are covered.
- **JWT secret: fail fast, don't fall back.** Both `lib/jwt.ts` and the
  renamed `proxy.ts` will import a shared `lib/jwt-secret.ts` that throws
  at module load if `JWT_SECRET` is unset, instead of silently signing
  with a guessable string. This requires `JWT_SECRET` to exist in every
  environment that runs this app, checked in this plan's Task 1.
- **`/api/users` route: delete, not gate.** It's unreferenced dead code
  duplicating `getUsers()`; removing it is less surface area than adding
  auth to a route nothing calls.
- **Upload route: authenticate, don't restrict to admin.** Its real
  callers are self-service profile-avatar uploads by any logged-in user
  (`USER`, `VENDOR`, or `ADMIN` role) — gating it to `requireAdmin()` would
  break that feature. It needs "is there a valid session" plus the same
  type/size validation `blogs/upload` already has, not a role check.

## Out of scope

- Lint/warning cleanup (125 errors / 58 warnings) — separate effort per
  user direction.
- The 24h JWT session / no per-request DB role re-check tradeoff the audit
  flagged (an admin suspending a user doesn't take effect until that
  user's token expires) — noted as a known tradeoff, not a bug; revisit
  only if the user asks for session revocation.
- Any change to `send-otp`'s existing business-email allowlist logic —
  unrelated to authorization coverage.
