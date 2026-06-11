# M1 — Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed, passcode-gated Next.js PWA shell on Vercel with five tab screens, a live Neon Postgres connection, and a green Vitest + Playwright verification harness.

**Architecture:** Next.js App Router (TypeScript, Tailwind v4) with all secrets server-side. Passcode auth: bcrypt hash in a `settings` key-value table, signed JWT session cookie (jose) checked by edge middleware. Five placeholder tab pages behind the gate. PWA via Next's `manifest.ts` + generated icons so it installs to the iPad home screen.

**Tech Stack:** Next.js 15+ (App Router), React 19, Tailwind v4, Drizzle ORM + Neon (serverless Postgres), jose, bcryptjs, Vitest, Playwright, Vercel hosting.

**Spec:** `docs/superpowers/specs/2026-06-10-virtual-closet-design.md` (§3.5, §3.6, §4, §5 settings, §8, §9 M1)

**Out of scope for M1:** all AI pipelines, Blob uploads, closet/studio/stylist/lookbook functionality (placeholders only), MOCK_AI mode (flag reserved, unused).

---

## File structure

```
app/
  layout.tsx                 # root layout: fonts, PWA metadata, viewport
  globals.css                # Tailwind import + theme tokens
  page.tsx                   # redirects / → /closet
  manifest.ts                # PWA manifest (route: /manifest.webmanifest)
  icon.tsx                   # 512px PNG app icon generated via ImageResponse
  apple-icon.tsx             # 180px iOS home-screen icon
  setup/page.tsx             # first-run: create passcode
  login/page.tsx             # passcode entry
  (tabs)/
    layout.tsx               # wraps tab pages with <TabBar/>
    closet/page.tsx          # placeholder
    studio/page.tsx          # placeholder
    stylist/page.tsx         # placeholder
    lookbook/page.tsx        # placeholder
    settings/page.tsx        # placeholder
  api/
    health/route.ts          # { ok, db } — public, used by deploy verification
    auth/setup/route.ts      # POST create passcode (409 if exists)
    auth/login/route.ts      # POST verify passcode, backoff on failures
components/
  TabBar.tsx                 # bottom tab bar (client component)
  PasscodeForm.tsx           # shared form used by setup + login pages
lib/
  db/
    client.ts                # drizzle + neon-http client
    schema.ts                # settings table
    settings.ts              # getSetting/setSetting/deleteSetting
  auth/
    passcode.ts              # bcrypt hash/verify
    backoff.ts               # pure lockout math (unit-tested)
    backoff.test.ts
    session.ts               # JWT sign/verify (edge-safe)
    session.test.ts
middleware.ts                # session gate for everything non-public
e2e/
  global-setup.ts            # resets settings table before e2e runs
  auth-flow.spec.ts          # setup → login → tabs flow
  tabs.spec.ts               # tab navigation
drizzle.config.ts
playwright.config.ts
vitest.config.ts
next.config.ts / postcss.config.mjs / tsconfig.json / package.json
.env.local (never committed) / .env.example (committed)
CLAUDE.md
.claude/commands/commit-push-pr.md
```

**Environment variables:** `DATABASE_URL` (Neon), `SESSION_SECRET` (32+ random bytes, base64). Reserved for M2+: `GEMINI_API_KEY`, `MOCK_AI`.

---

### Task 1: Project scaffold

The repo already contains `docs/`, `.gitignore`, and `.git` — `create-next-app` refuses non-empty directories, so we scaffold by hand. All commands run from `C:\Users\bghil\styling_app`.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "styling-app",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:push": "drizzle-kit push"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss postcss
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Write `postcss.config.mjs`**

```js
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

- [ ] **Step 6: Write `app/globals.css`**

```css
@import "tailwindcss";

:root {
  --background: #faf9f7;
  --foreground: #2b2b2e;
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

- [ ] **Step 7: Write `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Styling App",
  description: "Your virtual closet",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Styling App",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b2b2e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Write `app/page.tsx`** (placeholder for now; becomes a redirect in Task 3)

```tsx
export default function Home() {
  return <h1 className="p-8 text-2xl font-semibold">Styling App</h1>;
}
```

- [ ] **Step 9: Verify dev server**

Run: `npm run dev` (background), then `curl -s -o NUL -w "%{http_code}" http://localhost:3000` (PowerShell: `(Invoke-WebRequest http://localhost:3000 -UseBasicParsing).StatusCode`)
Expected: `200`, page shows "Styling App". Stop the server.

- [ ] **Step 10: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0 (a `next-env.d.ts` is generated by the dev run; if missing, `npx next build` once)

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app shell with Tailwind v4"
```

---

### Task 2: Test harness (Vitest + Playwright)

**Files:**
- Create: `vitest.config.ts`, `playwright.config.ts`, `lib/sanity.test.ts`, `e2e/tabs.spec.ts`

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest @playwright/test dotenv
npx playwright install chromium
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Write a sanity unit test `lib/sanity.test.ts`** (deleted in Task 5 when real tests exist)

```ts
import { describe, expect, it } from "vitest";

describe("harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run unit tests**

Run: `npm test`
Expected: 1 passed

- [ ] **Step 5: Write `playwright.config.ts`** (globalSetup is added in Task 7, once the DB exists)

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 6: Write `e2e/tabs.spec.ts`** (minimal now; expanded in Task 3)

```ts
import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Styling App" })).toBeVisible();
});
```

- [ ] **Step 7: Run e2e**

Run: `npm run test:e2e`
Expected: 1 passed

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: add Vitest and Playwright harness"
```

---

### Task 3: Tab shell and navigation

**Files:**
- Create: `components/TabBar.tsx`, `app/(tabs)/layout.tsx`, `app/(tabs)/closet/page.tsx`, `app/(tabs)/studio/page.tsx`, `app/(tabs)/stylist/page.tsx`, `app/(tabs)/lookbook/page.tsx`, `app/(tabs)/settings/page.tsx`
- Modify: `app/page.tsx`, `e2e/tabs.spec.ts`

- [ ] **Step 1: Write `components/TabBar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/closet", label: "Closet", icon: "👕" },
  { href: "/studio", label: "Studio", icon: "🪞" },
  { href: "/stylist", label: "Stylist", icon: "💡" },
  { href: "/lookbook", label: "Lookbook", icon: "📔" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
] as const;

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              active ? "font-semibold text-neutral-900" : "text-neutral-400"
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Write `app/(tabs)/layout.tsx`**

```tsx
import TabBar from "@/components/TabBar";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh pb-20">
      <main className="mx-auto max-w-5xl p-4">{children}</main>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 3: Write the five placeholder pages**

`app/(tabs)/closet/page.tsx`:

```tsx
export default function ClosetPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Closet</h1>
      <p className="mt-2 text-neutral-500">Your wardrobe will appear here (M2).</p>
    </>
  );
}
```

`app/(tabs)/studio/page.tsx`:

```tsx
export default function StudioPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Studio</h1>
      <p className="mt-2 text-neutral-500">Outfit builder arrives in M3.</p>
    </>
  );
}
```

`app/(tabs)/stylist/page.tsx`:

```tsx
export default function StylistPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Stylist</h1>
      <p className="mt-2 text-neutral-500">AI outfit suggestions arrive in M4.</p>
    </>
  );
}
```

`app/(tabs)/lookbook/page.tsx`:

```tsx
export default function LookbookPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Lookbook</h1>
      <p className="mt-2 text-neutral-500">Saved outfits arrive in M5.</p>
    </>
  );
}
```

`app/(tabs)/settings/page.tsx`:

```tsx
export default function SettingsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-neutral-500">Passcode, base photos, calendar, weather.</p>
    </>
  );
}
```

- [ ] **Step 4: Replace `app/page.tsx` with a redirect**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/closet");
}
```

- [ ] **Step 5: Replace `e2e/tabs.spec.ts` with navigation tests**

```ts
import { expect, test } from "@playwright/test";

test("root redirects to closet", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/closet$/);
  await expect(page.getByRole("heading", { name: "Closet" })).toBeVisible();
});

test("tab bar navigates between all five screens", async ({ page }) => {
  await page.goto("/closet");
  for (const name of ["Studio", "Stylist", "Lookbook", "Settings", "Closet"]) {
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
});
```

- [ ] **Step 6: Run e2e to verify it passes**

Run: `npm run test:e2e`
Expected: 2 passed

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck` → exit 0

```bash
git add -A
git commit -m "feat: five-tab shell with bottom tab bar"
```

---

### Task 4: Neon Postgres + Drizzle + health endpoint

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/client.ts`, `lib/db/settings.ts`, `drizzle.config.ts`, `.env.example`, `app/api/health/route.ts`
- Modify: `e2e/tabs.spec.ts` (add health check)

- [ ] **Step 1 (USER ACTION — pause and ask):** Create the Neon database

Ask the user to:
1. Sign up / log in at https://neon.tech (free tier).
2. Create a project named `styling-app` (default region is fine).
3. Copy the connection string (starts `postgresql://…neon.tech/neondb?sslmode=require`).
4. Paste it into the session so `.env.local` can be written.

- [ ] **Step 2: Write `.env.local`** (gitignored — verify `git status` does NOT list it)

```
DATABASE_URL=postgresql://<paste from Neon>
SESSION_SECRET=<paste output of: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
```

- [ ] **Step 3: Write `.env.example`** (committed; documents required env)

```
# Neon Postgres connection string
DATABASE_URL=
# 32+ random bytes, base64 — sessions are signed with this
SESSION_SECRET=
# --- reserved for M2+ ---
# GEMINI_API_KEY=
# MOCK_AI=
# BLOB_READ_WRITE_TOKEN=  (auto-set on Vercel when the Blob store is created)
```

- [ ] **Step 4: Install DB dependencies**

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

- [ ] **Step 5: Write `lib/db/schema.ts`**

```ts
import { pgTable, text } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
```

- [ ] **Step 6: Write `lib/db/client.ts`**

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 7: Write `lib/db/settings.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "./client";
import { settings } from "./schema";

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}
```

- [ ] **Step 8: Write `drizzle.config.ts`**

```ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 9: Push schema to Neon**

Run: `npm run db:push`
Expected: output reports `settings` table created, exit 0

- [ ] **Step 10: Write `app/api/health/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";

export async function GET() {
  try {
    await db.select().from(settings).limit(1);
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
```

- [ ] **Step 11: Add health check to `e2e/tabs.spec.ts`** (append)

```ts
test("health endpoint reports db connectivity", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, db: true });
});
```

- [ ] **Step 12: Run e2e to verify**

Run: `npm run test:e2e`
Expected: 3 passed

- [ ] **Step 13: Typecheck and commit**

Run: `npm run typecheck` → exit 0

```bash
git add -A
git commit -m "feat: wire Neon Postgres via Drizzle with health endpoint"
```

Confirm `git show --stat HEAD` does NOT include `.env.local`.

---

### Task 5: Auth primitives (TDD)

Pure logic first, fully unit-tested: lockout math, passcode hashing, session tokens.

**Files:**
- Create: `lib/auth/backoff.ts`, `lib/auth/backoff.test.ts`, `lib/auth/passcode.ts`, `lib/auth/session.ts`, `lib/auth/session.test.ts`
- Delete: `lib/sanity.test.ts`

- [ ] **Step 1: Install auth dependencies**

```bash
npm install jose bcryptjs
```

(bcryptjs v3 ships its own TypeScript types.)

- [ ] **Step 2: Write the failing test `lib/auth/backoff.test.ts`**

Spec §7: exponential backoff on failed passcode attempts. Free below 5 attempts, then 30s doubling per attempt, capped at 64 minutes.

```ts
import { describe, expect, it } from "vitest";
import { lockoutMs } from "./backoff";

describe("lockoutMs", () => {
  it("no lockout below 5 failed attempts", () => {
    expect(lockoutMs(0)).toBe(0);
    expect(lockoutMs(4)).toBe(0);
  });

  it("starts at 30s on the 5th failure and doubles", () => {
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(7)).toBe(120_000);
  });

  it("caps at 64 minutes", () => {
    expect(lockoutMs(12)).toBe(3_840_000);
    expect(lockoutMs(50)).toBe(3_840_000);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './backoff'`

- [ ] **Step 4: Write `lib/auth/backoff.ts`**

```ts
const BASE_MS = 30_000;
const FREE_ATTEMPTS = 5;
const MAX_EXPONENT = 7; // 30s * 2^7 = 64 minutes

export function lockoutMs(failedAttempts: number): number {
  if (failedAttempts < FREE_ATTEMPTS) return 0;
  const exponent = Math.min(failedAttempts - FREE_ATTEMPTS, MAX_EXPONENT);
  return BASE_MS * 2 ** exponent;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: backoff tests PASS

- [ ] **Step 6: Write the failing test `lib/auth/session.test.ts`**

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { createSession, verifySession } from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret!!";
});

describe("session tokens", () => {
  it("round-trips a signed token", async () => {
    const token = await createSession();
    expect(await verifySession(token)).toBe(true);
  });

  it("rejects garbage", async () => {
    expect(await verifySession("not-a-token")).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSession();
    process.env.SESSION_SECRET = "a-completely-different-secret-value!!";
    expect(await verifySession(token)).toBe(false);
    process.env.SESSION_SECRET = "test-secret-test-secret-test-secret!!";
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './session'`

- [ ] **Step 8: Write `lib/auth/session.ts`** (edge-safe: only Web Crypto via jose)

```ts
import { SignJWT, jwtVerify } from "jose";

const SESSION_DURATION = "30d";

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function createSession(): Promise<string> {
  return new SignJWT({ scope: "app" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(secret());
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS

- [ ] **Step 10: Write `lib/auth/passcode.ts`** (thin bcrypt wrapper — bcryptjs is already battle-tested, no unit test needed; covered by e2e)

```ts
import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPasscode(passcode: string): Promise<string> {
  return bcrypt.hash(passcode, ROUNDS);
}

export async function verifyPasscode(
  passcode: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(passcode, hash);
}
```

- [ ] **Step 11: Delete `lib/sanity.test.ts`, typecheck, commit**

Run: `npm test && npm run typecheck` → all pass, exit 0

```bash
git add -A
git commit -m "feat: auth primitives - lockout math, sessions, passcode hashing (TDD)"
```

---

### Task 6: Auth API routes

**Files:**
- Create: `app/api/auth/setup/route.ts`, `app/api/auth/login/route.ts`, `lib/auth/cookies.ts`

Settings keys used: `passcodeHash`, `failedAttempts`, `lastFailedAt` (ms epoch as string).

- [ ] **Step 1: Write `lib/auth/cookies.ts`**

```ts
import { cookies } from "next/headers";
import { createSession } from "./session";

export const SESSION_COOKIE = "session";

export async function setSessionCookie(): Promise<void> {
  const token = await createSession();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}
```

- [ ] **Step 2: Write `app/api/auth/setup/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookies";
import { hashPasscode } from "@/lib/auth/passcode";
import { getSetting, setSetting } from "@/lib/db/settings";

export async function POST(req: NextRequest) {
  const { passcode } = (await req.json()) as { passcode?: string };

  if (typeof passcode !== "string" || passcode.length < 4) {
    return NextResponse.json(
      { error: "Passcode must be at least 4 characters." },
      { status: 400 },
    );
  }
  if (await getSetting("passcodeHash")) {
    return NextResponse.json(
      { error: "Passcode already configured." },
      { status: 409 },
    );
  }

  await setSetting("passcodeHash", await hashPasscode(passcode));
  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Write `app/api/auth/login/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { lockoutMs } from "@/lib/auth/backoff";
import { setSessionCookie } from "@/lib/auth/cookies";
import { verifyPasscode } from "@/lib/auth/passcode";
import { deleteSetting, getSetting, setSetting } from "@/lib/db/settings";

export async function POST(req: NextRequest) {
  const { passcode } = (await req.json()) as { passcode?: string };
  if (typeof passcode !== "string") {
    return NextResponse.json({ error: "Passcode required." }, { status: 400 });
  }

  const hash = await getSetting("passcodeHash");
  if (!hash) {
    return NextResponse.json({ error: "setup_required" }, { status: 409 });
  }

  const failedAttempts = Number((await getSetting("failedAttempts")) ?? "0");
  const lastFailedAt = Number((await getSetting("lastFailedAt")) ?? "0");
  const lockedUntil = lastFailedAt + lockoutMs(failedAttempts);
  if (Date.now() < lockedUntil) {
    return NextResponse.json(
      { error: "locked", retryAfterMs: lockedUntil - Date.now() },
      { status: 429 },
    );
  }

  if (!(await verifyPasscode(passcode, hash))) {
    await setSetting("failedAttempts", String(failedAttempts + 1));
    await setSetting("lastFailedAt", String(Date.now()));
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }

  await deleteSetting("failedAttempts");
  await deleteSetting("lastFailedAt");
  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Typecheck and commit** (e2e coverage lands with the pages in Task 7)

Run: `npm run typecheck` → exit 0

```bash
git add -A
git commit -m "feat: passcode setup and login API routes with lockout"
```

---

### Task 7: Middleware gate + setup/login pages + e2e flow

**Files:**
- Create: `middleware.ts`, `components/PasscodeForm.tsx`, `app/setup/page.tsx`, `app/login/page.tsx`, `e2e/global-setup.ts`, `e2e/auth-flow.spec.ts`
- Modify: `playwright.config.ts`, `e2e/tabs.spec.ts`

- [ ] **Step 1: Write `middleware.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = [
  /^\/login$/,
  /^\/setup$/,
  /^\/api\/auth\//,
  /^\/api\/health$/,
  /^\/manifest\.webmanifest$/,
  /^\/icon/,
  /^\/apple-icon/,
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => p.test(pathname))) return NextResponse.next();

  const token = req.cookies.get("session")?.value;
  if (token && (await verifySession(token))) return NextResponse.next();

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
```

- [ ] **Step 2: Write `components/PasscodeForm.tsx`** (shared by setup and login)

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PasscodeForm({
  endpoint,
  buttonLabel,
  confirm = false,
}: {
  endpoint: string;
  buttonLabel: string;
  confirm?: boolean;
}) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (confirm && passcode !== confirmValue) {
      setError("Passcodes don't match.");
      return;
    }
    setBusy(true);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/closet");
      router.refresh();
      return;
    }
    const body = (await res.json()) as { error?: string; retryAfterMs?: number };
    if (body.error === "locked" && body.retryAfterMs) {
      setError(`Locked. Try again in ${Math.ceil(body.retryAfterMs / 60000)} min.`);
    } else {
      setError(body.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="Passcode"
        aria-label="Passcode"
        className="rounded-xl border border-neutral-300 p-4 text-lg"
        autoFocus
      />
      {confirm && (
        <input
          type="password"
          value={confirmValue}
          onChange={(e) => setConfirmValue(e.target.value)}
          placeholder="Confirm passcode"
          aria-label="Confirm passcode"
          className="rounded-xl border border-neutral-300 p-4 text-lg"
        />
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-neutral-900 p-4 text-lg font-semibold text-white disabled:opacity-50"
      >
        {busy ? "…" : buttonLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write `app/setup/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import PasscodeForm from "@/components/PasscodeForm";
import { getSetting } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await getSetting("passcodeHash")) redirect("/login");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Welcome 👋</h1>
      <p className="text-neutral-500">Create a passcode to protect your closet.</p>
      <PasscodeForm endpoint="/api/auth/setup" buttonLabel="Create passcode" confirm />
    </div>
  );
}
```

- [ ] **Step 4: Write `app/login/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import PasscodeForm from "@/components/PasscodeForm";
import { getSetting } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await getSetting("passcodeHash"))) redirect("/setup");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Styling App</h1>
      <PasscodeForm endpoint="/api/auth/login" buttonLabel="Unlock" />
    </div>
  );
}
```

- [ ] **Step 5: Write `e2e/global-setup.ts`** (wipes settings so every e2e run starts at first-run)

```ts
import { config } from "dotenv";
config({ path: ".env.local" });

export default async function globalSetup() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL)`;
  await sql`DELETE FROM settings`;
}
```

- [ ] **Step 6: Add globalSetup to `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

(`workers: 1` — tests share one database; parallel workers would race on auth state.)

- [ ] **Step 7: Write `e2e/auth-flow.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

const PASSCODE = "test-1234";

test.describe.serial("first-run auth flow", () => {
  test("unauthenticated visit is sent to setup via login", async ({ page }) => {
    await page.goto("/closet");
    await expect(page).toHaveURL(/\/setup$/);
  });

  test("creating a passcode unlocks the app", async ({ page }) => {
    await page.goto("/setup");
    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByLabel("Confirm passcode").fill(PASSCODE);
    await page.getByRole("button", { name: "Create passcode" }).click();
    await expect(page).toHaveURL(/\/closet$/);
    await expect(page.getByRole("heading", { name: "Closet" })).toBeVisible();
  });

  test("wrong passcode is rejected, correct one unlocks", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Passcode", { exact: true }).fill("wrong-passcode");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("alert")).toContainText("Wrong passcode");

    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page).toHaveURL(/\/closet$/);
  });

  test("session persists across reload", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page).toHaveURL(/\/closet$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Closet" })).toBeVisible();
  });
});
```

- [ ] **Step 8: Update `e2e/tabs.spec.ts`** — tab tests now need auth. Replace the file:

```ts
import { expect, test } from "@playwright/test";

const PASSCODE = "test-1234";

async function unlock(page: import("@playwright/test").Page) {
  await page.goto("/login");
  if (page.url().endsWith("/setup")) {
    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByLabel("Confirm passcode").fill(PASSCODE);
    await page.getByRole("button", { name: "Create passcode" }).click();
  } else {
    await page.getByLabel("Passcode", { exact: true }).fill(PASSCODE);
    await page.getByRole("button", { name: "Unlock" }).click();
  }
  await expect(page).toHaveURL(/\/closet$/);
}

test("health endpoint reports db connectivity without auth", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, db: true });
});

test("tab bar navigates between all five screens", async ({ page }) => {
  await unlock(page);
  for (const name of ["Studio", "Stylist", "Lookbook", "Settings", "Closet"]) {
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
});
```

(Note: `auth-flow.spec.ts` runs alphabetically before `tabs.spec.ts`, so the passcode exists by the time `unlock` runs; the helper handles both cases anyway.)

- [ ] **Step 9: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: 6 passed (4 auth-flow + 2 tabs)

- [ ] **Step 10: Run everything, then commit**

Run: `npm test && npm run typecheck && npm run test:e2e` → all green

```bash
git add -A
git commit -m "feat: passcode gate - middleware, setup/login pages, e2e flow"
```

---

### Task 8: PWA installability

**Files:**
- Create: `app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx`
- Modify: `e2e/tabs.spec.ts` (manifest test)

- [ ] **Step 1: Write `app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Styling App",
    short_name: "Styling",
    description: "Your virtual closet",
    start_url: "/closet",
    display: "standalone",
    background_color: "#faf9f7",
    theme_color: "#2b2b2e",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
```

- [ ] **Step 2: Write `app/icon.tsx`** (build-time generated PNG — no binary assets in git)

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2b2b2e",
          fontSize: 320,
        }}
      >
        👕
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 3: Write `app/apple-icon.tsx`**

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2b2b2e",
          fontSize: 110,
        }}
      >
        👕
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 4: Append manifest test to `e2e/tabs.spec.ts`**

```ts
test("PWA manifest and icons are served without auth", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = await manifest.json();
  expect(body.display).toBe("standalone");

  const icon = await request.get("/icon");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");
});
```

- [ ] **Step 5: Run e2e, typecheck, commit**

Run: `npm run test:e2e && npm run typecheck` → all green

```bash
git add -A
git commit -m "feat: PWA manifest and generated app icons"
```

---

### Task 9: CLAUDE.md + commit-push-pr slash command

**Files:**
- Create: `CLAUDE.md`, `.claude/commands/commit-push-pr.md`

- [ ] **Step 1: Write `CLAUDE.md`**

```markdown
# Styling App

Personal virtual closet PWA: catalog clothes by photo, build outfits on AI
photoreal renders, get AI stylist suggestions. Single user, passcode-gated.

- Spec: docs/superpowers/specs/2026-06-10-virtual-closet-design.md
- Current plan: docs/superpowers/plans/2026-06-10-m1-walking-skeleton.md

## Stack

Next.js App Router (TS, Tailwind v4) on Vercel · Neon Postgres via Drizzle ·
Vercel Blob · Gemini API (all AI) · jose sessions + bcryptjs passcode.

## Commands

- `npm run dev` — dev server on :3000
- `npm test` — Vitest unit tests (lib/**/*.test.ts)
- `npm run test:e2e` — Playwright (resets the settings table first!)
- `npm run typecheck` — tsc --noEmit
- `npm run db:push` — push Drizzle schema to Neon

## Rules

- TDD for logic: failing test first, then implement. UI flows get Playwright specs.
- A task is done only when `npm test && npm run typecheck && npm run test:e2e`
  are all green — run them, show output, then claim done.
- All AI calls go through server routes; never expose keys client-side.
  From M2 on, develop and test against MOCK_AI=1.
- `.env.local` is never committed. New env vars also go in `.env.example`.
- e2e wipes the settings table — never point DATABASE_URL at data you care
  about when running tests.

## Learned rules

(Append a rule here every time Claude makes a mistake in this repo.)
```

- [ ] **Step 2: Write `.claude/commands/commit-push-pr.md`**

```markdown
---
description: Verify, commit, push, and open a PR for the current work
---

1. Run `npm test && npm run typecheck && npm run test:e2e`. If anything fails,
   stop and report — do not commit broken work.
2. `git status` and `git diff` to review what changed. Stage everything that
   belongs to the current task (never `.env.local`).
3. Commit with a conventional message (feat:/fix:/test:/docs:/chore:)
   describing the change.
4. If on `main`, create a branch named for the change first.
5. Push with `git push -u origin HEAD`.
6. Open a PR with `gh pr create --fill` and report the URL.
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add CLAUDE.md and commit-push-pr slash command"
```

---

### Task 10: GitHub + Vercel deployment

**Files:** none created locally (Vercel dashboard + GitHub)

- [ ] **Step 1: Create the GitHub repo and push**

Run: `gh auth status` — if not logged in, this is a **USER ACTION**: ask the user to run `gh auth login` themselves (interactive browser auth).

```bash
gh repo create styling-app --private --source=. --remote=origin --push
```

Expected: repo created, `main` pushed.

- [ ] **Step 2 (USER ACTION — pause and ask):** Import the repo into Vercel

Ask the user to:
1. Log in at https://vercel.com (sign in with GitHub).
2. "Add New… → Project" → import `styling-app`. Framework preset auto-detects Next.js — accept defaults.
3. Before deploying, add Environment Variables (Production + Preview):
   - `DATABASE_URL` = the same Neon connection string as `.env.local`
   - `SESSION_SECRET` = generate a NEW value (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) — do not reuse the dev secret
4. Click Deploy and paste the production URL into the session.
5. After the first deploy: project → Storage tab → Create → **Blob** → accept defaults. This provisions the store and injects `BLOB_READ_WRITE_TOKEN` into the project env automatically (spec §9 M1: "DB/Blob wired"). Then pull it locally for M2 development: run `npx vercel link` then `npx vercel env pull .env.local` — or copy the token into `.env.local` by hand.

- [ ] **Step 3: Verify the deployment**

Run (replace with the real URL):

```bash
curl -s https://<app>.vercel.app/api/health
```

Expected: `{"ok":true,"db":true}`

Then ask the user to open the URL on the iPad, complete passcode setup, and confirm: Safari → Share → **Add to Home Screen** → app launches standalone with the 👕 icon.

- [ ] **Step 4: Record the URL**

Add the production URL to `CLAUDE.md` under a `## Deployment` heading:

```markdown
## Deployment

- Production: https://<app>.vercel.app (Vercel project: styling-app)
- Deploys: push to main → production; any branch → preview URL
```

```bash
git add CLAUDE.md
git commit -m "docs: record production deployment URL"
git push
```

---

## M1 acceptance checklist

- [ ] `npm test`, `npm run typecheck`, `npm run test:e2e` all green locally
- [ ] Production URL serves the app; `/api/health` returns `{"ok":true,"db":true}`
- [ ] Passcode setup → tabs work on the iPad; wrong passcode rejected
- [ ] App installs to the iPad home screen and launches standalone
- [ ] `.env.local` absent from git history (`git log --all --full-history -- .env.local` is empty)

## Deferred to M2 planning

- `items` table + Blob wiring (with first real upload)
- Gemini client + MOCK_AI fixtures
- Logout/passcode-change UI in Settings
