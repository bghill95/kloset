# Kloset Phase 1 — Identity, Shell, Closet, Today — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand styling_app as **Kloset** with a DESIGN.md-driven design system (white / pink / black, cursive display), a full-screen-menu shell replacing the tab bar, a masonry Closet rebuild, and a new Today home screen — leaving a daily-usable app.

**Architecture:** Same repo, backend plumbing untouched (DB/Drizzle, API routes, auth, MOCK_AI harness). All UI chrome is rebuilt against design tokens defined once in `app/globals.css` (Tailwind v4 `@theme`) and documented in a root `DESIGN.md` adapted from the Pinterest design system (source: `C:\Users\bghil\.opensrc\repos\github.com\VoltAgent\awesome-design-md\main\design-md\pinterest\DESIGN.md`). New pure logic (outfit picking) is TDD'd in `lib/today/`.

**Tech Stack:** Next.js 16 App Router · React 19 · TS 6 · Tailwind v4 (`@theme` tokens) · next/font/google (Inter + Great Vibes) · Drizzle/Neon · Playwright + Vitest.

## Global Constraints

- Roadmap: `C:\Users\bghil\.claude\plans\i-want-to-scrap-quizzical-lecun.md`. Branch: `kloset-p1` off `context-statusbar`.
- All CLAUDE.md rules apply — notably: TDD for logic; done = `npm test && npm run typecheck && npm run test:e2e` green; MOCK_AI=1 for dev/tests; lazy env getters; e2e specs run alphabetically after `auth-flow` seeds the passcode.
- Brand: app name **Kloset** everywhere user-visible. Colors: canvas `#ffffff`, pink `#e60070` (primary CTA only — keep scarce), ink `#111111` for contrast moments (active chips, headlines). Cursive = Great Vibes for the K wordmark, page titles, and menu links ONLY; body/UI text is Inter. Radius vocabulary: 16px (`rounded-card`), 32px (`rounded-big`), pill — nothing else. No card shadows.
- Category enum becomes `top | bottom | dress | jacket | shoes | hat | accessory` (order matters — UI chip order).
- Fresh-start data wipe: `items`, `base_photos` tables + all Vercel blobs. **Never wipe `settings`** (passcode, ICS url, weather location live there).
- Don't touch: `lib/db/client.ts`, `lib/auth/*`, `lib/ai/*`, `lib/context/*`, `lib/closet/{filter,item-validation,suggestion}.ts`, `app/api/*` (except none needed), `proxy.ts`.

---

## File Structure

```
DESIGN.md                                 (new — Kloset design system, root)
PRODUCT.md                                (new — impeccable product context)
assets/fonts/GreatVibes-Regular.ttf       (new — for ImageResponse icons)
app/globals.css                           (rewrite — @theme tokens)
app/layout.tsx                            (modify — fonts, Kloset metadata)
app/manifest.ts                           (modify — Kloset, start_url /today)
app/icon.tsx, app/apple-icon.tsx          (rewrite — cursive K on pink)
app/page.tsx                              (modify — redirect /today)
app/(tabs)/layout.tsx                     (rewrite — drop TabBar/StatusBar)
app/(tabs)/today/page.tsx                 (new — home screen)
app/(tabs)/closet/page.tsx                (rewrite — masonry)
app/(tabs)/{studio,stylist,lookbook}/page.tsx (modify — PageHeader + placeholder copy)
app/(tabs)/settings/page.tsx              (modify — PageHeader + token reskin)
app/login/page.tsx, app/setup/page.tsx    (modify — Kloset wordmark)
components/shell/Menu.tsx                 (new — button + full-screen overlay)
components/shell/PageHeader.tsx           (new)
components/PasscodeForm.tsx               (modify — tokens, push /today)
components/closet/ItemDetailForm.tsx      (modify — token reskin)
components/scan/*.tsx                     (modify — token reskin)
components/today/TodayCard.tsx            (new — client: context + outfit)
components/TabBar.tsx                     (DELETE)
components/context/StatusBar.tsx          (DELETE)
lib/closet/categories.ts                  (modify — 7 categories)
lib/closet/categories.test.ts             (new)
lib/db/schema.ts                          (modify — enum)
lib/today/pick.ts, lib/today/pick.test.ts (new — TDD)
scripts/wipe-data.mts                     (new — one-off)
e2e/menu.spec.ts                          (new — replaces tabs.spec.ts)
e2e/today.spec.ts                         (new — replaces statusbar.spec.ts)
e2e/tabs.spec.ts, e2e/statusbar.spec.ts   (DELETE)
e2e/helpers.ts                            (modify — expect /today)
CLAUDE.md                                 (modify — rename, plan pointer)
```

---

### Task 1: Kloset design foundation (DESIGN.md, tokens, fonts, icons, manifest)

**Files:**
- Create: `DESIGN.md`, `PRODUCT.md`, `assets/fonts/GreatVibes-Regular.ttf`
- Modify: `app/globals.css`, `app/layout.tsx`, `app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx`, `CLAUDE.md`

**Interfaces:**
- Produces: Tailwind utility classes used by ALL later tasks: `bg-canvas bg-blush bg-card bg-pink bg-pink-deep text-ink text-body text-mute text-ash border-hairline font-script font-sans rounded-card rounded-big`. Font CSS vars `--font-inter`, `--font-great-vibes`.

- [ ] **Step 1: Branch**

```bash
cd /c/Users/bghil/styling_app && git checkout -b kloset-p1
```

- [ ] **Step 2: Download the script font** (SIL OFL — safe to commit)

```bash
mkdir -p assets/fonts && curl -L -o assets/fonts/GreatVibes-Regular.ttf https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf
```
Expected: file ~40-60KB. Verify: `ls -la assets/fonts/`.

- [ ] **Step 3: Write `DESIGN.md`** at repo root. Adapt the Pinterest system (path in plan header) — same structure, Kloset tokens. Full front-matter (the contract) verbatim below; for the prose body, copy the Pinterest file's section skeleton (Overview / Colors / Typography / Layout / Elevation / Shapes / Components / Do's and Don'ts / Responsive / Iteration Guide) and rewrite each section to reference THESE tokens and Kloset's rules. Key prose rules that must appear in Do's and Don'ts: pink is scarce (one pink CTA per screen); script face for wordmark/page-titles/menu-links only, never body; no card shadows (flat + hairline, modal scrim only); photograph/cutout IS the card (no internal padding on pin cards); only radii are 16/32/pill.

```yaml
---
version: alpha
name: Kloset-design-system
description: |
  A photography-first personal closet system: true-white canvas, blush-tinted
  card surfaces, a single confident pink CTA, black ink for contrast moments,
  and a cursive script display face (Great Vibes) for the Kloset wordmark,
  page titles, and the full-screen menu. Garment cutout imagery is the
  load-bearing visual element in a masonry grid of 16px-radius cards with
  tight 8px gutters. Chrome stays quiet: Inter for all UI text, no shadows,
  no gradients.

colors:
  primary: "#e60070"
  on-primary: "#ffffff"
  primary-pressed: "#c4005f"
  ink: "#111111"
  body: "#383236"
  mute: "#6e6270"
  ash: "#a396a0"
  hairline: "#ecdfe6"
  canvas: "#ffffff"
  surface-soft: "#fdf9fb"
  surface-card: "#f9f1f5"
  secondary-bg: "#f1e4ea"
  secondary-pressed: "#e2cdd8"
  on-dark: "#ffffff"
  surface-dark: "#111111"
  error: "#9e0a0a"
  success-deep: "#103c25"
  success-pale: "#c7f0da"

typography:
  script-hero:      { fontFamily: Great Vibes, fontSize: 64px, fontWeight: 400, lineHeight: 1.1 }
  script-title:     { fontFamily: Great Vibes, fontSize: 40px, fontWeight: 400, lineHeight: 1.1 }
  script-menu:      { fontFamily: Great Vibes, fontSize: 48px, fontWeight: 400, lineHeight: 1.3 }
  heading-md:       { fontFamily: Inter, fontSize: 18px, fontWeight: 600, lineHeight: 1.3 }
  body-md:          { fontFamily: Inter, fontSize: 16px, fontWeight: 400, lineHeight: 1.4 }
  body-strong:      { fontFamily: Inter, fontSize: 16px, fontWeight: 600, lineHeight: 1.4 }
  body-sm:          { fontFamily: Inter, fontSize: 14px, fontWeight: 400, lineHeight: 1.4 }
  caption:          { fontFamily: Inter, fontSize: 12px, fontWeight: 500, lineHeight: 1.5 }
  button-md:        { fontFamily: Inter, fontSize: 14px, fontWeight: 700, lineHeight: 1 }

rounded: { none: 0px, card: 16px, big: 32px, full: 9999px }

spacing: { xxs: 4px, xs: 6px, sm: 8px, md: 12px, lg: 16px, xl: 24px, xxl: 32px, section: 64px }

components:
  button-primary:   { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.button-md}", rounded: "{rounded.full}", padding: 12px 20px, height: 44px }
  button-secondary: { backgroundColor: "{colors.secondary-bg}", textColor: "{colors.ink}", typography: "{typography.button-md}", rounded: "{rounded.full}", padding: 12px 20px, height: 44px }
  button-icon-circular: { backgroundColor: "{colors.surface-card}", textColor: "{colors.ink}", rounded: "{rounded.full}", size: 40px }
  filter-chip:      { backgroundColor: "{colors.surface-card}", textColor: "{colors.ink}", typography: "{typography.button-md}", rounded: "{rounded.full}", padding: 8px 16px }
  filter-chip-active: { backgroundColor: "{colors.ink}", textColor: "{colors.on-dark}", typography: "{typography.button-md}", rounded: "{rounded.full}" }
  pin-card:         { backgroundColor: "{colors.surface-card}", textColor: "{colors.ink}", rounded: "{rounded.card}", padding: 0px }
  text-input:       { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", typography: "{typography.body-md}", rounded: "{rounded.card}", padding: 11px 15px, height: 44px }
  menu-overlay:     { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", typography: "{typography.script-menu}", rounded: "{rounded.none}" }
  page-header:      { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", typography: "{typography.script-title}", rounded: "{rounded.none}" }
---
```

- [ ] **Step 4: Write `PRODUCT.md`** at repo root:

```markdown
# Kloset

Personal virtual closet PWA for a single user. Catalog clothes by photo (AI
tags + cutouts), see today's weather/calendar-aware outfit on the Today
screen, build outfits in the Studio on photoreal AI renders of yourself, get
stylist suggestions, and track wears in the Lookbook.

## Register

product — app UI; the design serves the clothes. Brand personality lives in
the Kloset script identity (Great Vibes) and the single pink accent, applied
per DESIGN.md.

## Platform

web — phone-first responsive PWA (installable, passcode-gated).
```

- [ ] **Step 5: Rewrite `app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-script: var(--font-great-vibes), cursive;

  --color-canvas: #ffffff;
  --color-blush: #fdf9fb;
  --color-card: #f9f1f5;
  --color-pink: #e60070;
  --color-pink-deep: #c4005f;
  --color-secondary: #f1e4ea;
  --color-secondary-deep: #e2cdd8;
  --color-ink: #111111;
  --color-body: #383236;
  --color-mute: #6e6270;
  --color-ash: #a396a0;
  --color-hairline: #ecdfe6;

  --radius-card: 1rem;
  --radius-big: 2rem;
}

body {
  background: var(--color-canvas);
  color: var(--color-body);
}
```

- [ ] **Step 6: Update `app/layout.tsx`** — fonts + Kloset metadata:

```tsx
import type { Metadata, Viewport } from "next";
import { Great_Vibes, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const greatVibes = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-great-vibes",
});

export const metadata: Metadata = {
  title: "Kloset",
  description: "Your virtual closet",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kloset" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${greatVibes.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Update `app/manifest.ts`** — name/short_name `"Kloset"`, description `"Your virtual closet"`, `start_url: "/today"`, `background_color: "#ffffff"`, `theme_color: "#ffffff"` (icons array unchanged).

- [ ] **Step 8: Rewrite `app/icon.tsx`** (and `app/apple-icon.tsx` identically except its existing `size = { width: 180, height: 180 }` and `fontSize: 120`):

```tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
  const font = await readFile(
    path.join(process.cwd(), "assets/fonts/GreatVibes-Regular.ttf"),
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e60070",
          color: "#ffffff",
          fontFamily: "Great Vibes",
          fontSize: 360,
          paddingBottom: 40,
        }}
      >
        K
      </div>
    ),
    { ...size, fonts: [{ name: "Great Vibes", data: font, style: "normal" }] },
  );
}
```

- [ ] **Step 9: Update `CLAUDE.md`** — retitle `# Kloset`, first paragraph: "Personal virtual closet PWA (Kloset): catalog clothes by photo, Today screen with weather/calendar-aware outfit, build outfits on AI photoreal renders, AI stylist suggestions. Single user, passcode-gated." Update `Current plan:` line to `docs/superpowers/plans/2026-07-11-kloset-p1-identity-shell-closet-today.md`. Add under Rules: "UI work follows DESIGN.md (root) — tokens only, no ad-hoc colors/radii."

- [ ] **Step 10: Verify**

Run: `npm run typecheck && MOCK_AI=1 npm run dev` (background), then GET `http://localhost:8000/icon` → PNG, `http://localhost:8000/manifest.webmanifest` → name "Kloset". Kill dev server.
Expected: typecheck clean; icon renders a white cursive K on pink.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat(p1): Kloset design foundation - DESIGN.md tokens, fonts, icons, manifest"
```

---

### Task 2: Categories + schema + data wipe

**Files:**
- Create: `lib/closet/categories.test.ts`, `scripts/wipe-data.mts`
- Modify: `lib/closet/categories.ts`, `lib/db/schema.ts`
- Test: `lib/closet/categories.test.ts`

**Interfaces:**
- Produces: `CATEGORIES` = `["top","bottom","dress","jacket","shoes","hat","accessory"]` (order = UI order); `Category` type widened. All existing consumers (`isCategory`, labels, filter, scan chips) pick the new values up automatically.

- [ ] **Step 1: Write the failing test** `lib/closet/categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_PLURAL_LABELS, isCategory } from "./categories";

describe("categories", () => {
  it("includes dress and accessory in UI order", () => {
    expect(CATEGORIES).toEqual(["top", "bottom", "dress", "jacket", "shoes", "hat", "accessory"]);
  });
  it("accepts new categories", () => {
    expect(isCategory("dress")).toBe(true);
    expect(isCategory("accessory")).toBe(true);
    expect(isCategory("sock")).toBe(false);
  });
  it("labels every category", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_LABELS[c]).toBeTruthy();
      expect(CATEGORY_PLURAL_LABELS[c]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run it** — `npm test -- categories` — Expected: FAIL (array mismatch).

- [ ] **Step 3: Update `lib/closet/categories.ts`** — `CATEGORIES = ["top", "bottom", "dress", "jacket", "shoes", "hat", "accessory"] as const;` add labels `dress: "Dress"`, `accessory: "Accessory"` and plurals `dress: "Dresses"`, `accessory: "Accessories"` (keep object key order matching CATEGORIES).

- [ ] **Step 4: Update `lib/db/schema.ts`** items.category enum to `["top", "bottom", "dress", "jacket", "shoes", "hat", "accessory"]` (keep the sync comment).

- [ ] **Step 5: Run** `npm test && npm run typecheck` — Expected: PASS (enum is TS-level on a text column; no migration needed). Then `npm run db:push` — expect only the known no-op `SET DEFAULT '{}'::text[]` noise (CLAUDE.md learned rule — do not "fix").

- [ ] **Step 6: Write `scripts/wipe-data.mts`** (one-off, fresh-start decision — wipes items/base_photos/blobs, NOT settings):

```ts
import { del, list } from "@vercel/blob";
import { getDb } from "../lib/db/client";
import { basePhotos, items } from "../lib/db/schema";

const db = getDb();
const deletedItems = await db.delete(items).returning({ id: items.id });
const deletedPhotos = await db.delete(basePhotos).returning({ id: basePhotos.id });
const { blobs } = await list();
await Promise.all(blobs.map((b) => del(b.url)));
console.log(
  `wiped ${deletedItems.length} items, ${deletedPhotos.length} base photos, ${blobs.length} blobs`,
);
```

- [ ] **Step 7: Run the wipe** — `npx tsx --env-file=.env.local scripts/wipe-data.mts` — Expected: counts printed, exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(p1): add dress + accessory categories, fresh-start data wipe"
```

---

### Task 3: Shell — full-screen menu, PageHeader, layout rewrite

**Files:**
- Create: `components/shell/Menu.tsx`, `components/shell/PageHeader.tsx`, `app/(tabs)/today/page.tsx` (minimal — Task 8 completes it), `e2e/menu.spec.ts`
- Modify: `app/(tabs)/layout.tsx`, `app/(tabs)/{studio,stylist,lookbook,settings}/page.tsx` (headers only here; settings full reskin stays light), `app/page.tsx`, `components/PasscodeForm.tsx` (redirect only), `e2e/helpers.ts`
- Delete: `components/TabBar.tsx`, `components/context/StatusBar.tsx`, `e2e/tabs.spec.ts`, `e2e/statusbar.spec.ts`
- Test: `e2e/menu.spec.ts`

**Interfaces:**
- Produces: `PageHeader({ title }: { title: string })` — script h1 + menu button; used by every (tabs) page. `Menu()` — self-contained client component (button + overlay). Home route is now `/today`.

- [ ] **Step 1: Write the failing e2e** `e2e/menu.spec.ts` (absorbs tabs.spec's health/manifest tests — tabs.spec and statusbar.spec are deleted this task):

```ts
import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test("health endpoint reports db connectivity without auth", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, db: true });
});

test("full-screen menu navigates between all six screens", async ({ page }) => {
  await unlock(page);
  for (const name of ["Closet", "Studio", "Stylist", "Lookbook", "Settings", "Today"]) {
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("link", { name }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }
});

test("menu closes on Escape without navigating", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  await expect(page).toHaveURL(/\/today$/);
});

test("PWA manifest and icons are served without auth", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = await manifest.json();
  expect(body.name).toBe("Kloset");
  expect(body.display).toBe("standalone");
  const icon = await request.get("/icon");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");
});
```

- [ ] **Step 2: Update `e2e/helpers.ts`** — final line becomes `await expect(page).toHaveURL(/\/today$/);`. Delete `e2e/tabs.spec.ts` and `e2e/statusbar.spec.ts`. Run `npm run test:e2e -- menu` — Expected: FAIL (no menu button, /today 404).

- [ ] **Step 3: Write `components/shell/Menu.tsx`**:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/closet", label: "Closet" },
  { href: "/studio", label: "Studio" },
  { href: "/stylist", label: "Stylist" },
  { href: "/lookbook", label: "Lookbook" },
  { href: "/settings", label: "Settings" },
] as const;

export default function Menu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (open) closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
          <path d="M1 1h16M1 7h16M1 13h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col bg-canvas"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <span className="font-script text-3xl text-pink" aria-hidden="true">
              Kloset
            </span>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav aria-label="Main" className="flex flex-1 flex-col justify-center gap-2 px-8">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`py-1 font-script text-5xl ${active ? "text-pink" : "text-ink"}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Write `components/shell/PageHeader.tsx`**:

```tsx
import Menu from "./Menu";

export default function PageHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between pb-2">
      <h1 className="font-script text-4xl text-ink">{title}</h1>
      <Menu />
    </header>
  );
}
```

- [ ] **Step 5: Rewrite `app/(tabs)/layout.tsx`** (no more TabBar/StatusBar; pages own their headers):

```tsx
export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
```

Delete `components/TabBar.tsx` and `components/context/StatusBar.tsx` (`git rm`).

- [ ] **Step 6: Create minimal `app/(tabs)/today/page.tsx`** (Task 8 completes it):

```tsx
import PageHeader from "@/components/shell/PageHeader";

export default function TodayPage() {
  return <PageHeader title="Today" />;
}
```

- [ ] **Step 7: Update placeholder pages** — `studio`, `stylist`, `lookbook` each become (Studio shown; same pattern with title/copy swapped — Stylist: "Inspiration and occasion styling arrive in Phase 3.", Lookbook: "Saved outfits and wear history arrive in Phase 3."):

```tsx
import PageHeader from "@/components/shell/PageHeader";

export default function StudioPage() {
  return (
    <>
      <PageHeader title="Studio" />
      <p className="mt-4 text-mute">Outfit building arrives in Phase 2.</p>
    </>
  );
}
```

For `settings/page.tsx`: replace its current `<h1>` with `<PageHeader title="Settings" />` — leave section internals alone this task.

- [ ] **Step 8: Point home at /today** — `app/page.tsx` redirect becomes `redirect("/today")`; in `components/PasscodeForm.tsx` change `router.push("/closet")` to `router.push("/today")`.

- [ ] **Step 9: Run** `npm run typecheck && npm run test:e2e` — Expected: menu.spec PASS; auth-flow/closet/settings specs still PASS (auth-flow asserts post-login URL via helpers). If closet.spec asserted TabBar/StatusBar presence, update those assertions to the new shell (menu button visible).

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(p1): full-screen menu shell, /today home, drop TabBar+StatusBar"
```

---

### Task 4: Login & setup restyle

**Files:**
- Modify: `app/login/page.tsx`, `app/setup/page.tsx`, `components/PasscodeForm.tsx`

**Interfaces:**
- Consumes: tokens from Task 1. No API/behavior changes — `e2e/auth-flow.spec.ts` must pass unchanged (labels "Passcode", "Confirm passcode", buttons "Unlock" / "Create passcode", `p[role='alert']` errors).

- [ ] **Step 1: `app/login/page.tsx`** — replace the `<h1>` line with the Kloset wordmark (keep redirect logic and PasscodeForm props identical):

```tsx
<h1 className="font-script text-6xl text-pink">Kloset</h1>
<p className="text-mute">Your virtual closet</p>
```

- [ ] **Step 2: `app/setup/page.tsx`** — the wordmark is the `<h1>` (same treatment as login), followed by `<h2 className="text-lg font-semibold text-ink">Welcome</h2>` and `<p className="text-mute">Create a passcode to protect your closet.</p>`. No e2e heading assertions exist for auth pages.

- [ ] **Step 3: `components/PasscodeForm.tsx`** — reskin classes only (logic untouched): inputs → `rounded-card border border-hairline bg-canvas p-4 text-lg text-ink placeholder:text-ash focus:outline-2 focus:outline-offset-2 focus:outline-ink`; submit button → `rounded-full bg-pink p-4 text-lg font-semibold text-white active:bg-pink-deep disabled:opacity-50`; error line keeps `role="alert"` and its existing `text-sm text-red-600` classes.

- [ ] **Step 4: Run** `npm run test:e2e -- auth-flow` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(p1): Kloset login and setup restyle"
```

---

### Task 5: Closet masonry rebuild

**Files:**
- Modify: `app/(tabs)/closet/page.tsx`, `e2e/closet.spec.ts` (selector updates only if needed)

**Interfaces:**
- Consumes: `PageHeader` (Task 3), tokens (Task 1), widened `CATEGORIES` (Task 2). Reuses untouched `filterItems`, `distinctColors`, `chipClass`-style pill pattern.
- Produces: masonry closet at `/closet`; scan entry is a fixed pink FAB linking `/scan` labeled "Scan item".

- [ ] **Step 1: Rewrite `app/(tabs)/closet/page.tsx`** — same data flow (fetch all → `filterItems`), new presentation:

```tsx
import { desc } from "drizzle-orm";
import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_PLURAL_LABELS,
  isCategory,
} from "@/lib/closet/categories";
import { distinctColors, filterItems } from "@/lib/closet/filter";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";
import PageHeader from "@/components/shell/PageHeader";

export const dynamic = "force-dynamic";

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm font-bold ${
    active ? "bg-ink text-white" : "bg-card text-ink"
  }`;
}

function href(category?: string, color?: string) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (color) params.set("color", color);
  const qs = params.toString();
  return qs ? `/closet?${qs}` : "/closet";
}

export default async function ClosetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const rawCategory = first(params.category);
  const category = isCategory(rawCategory) ? rawCategory : undefined;
  const color = first(params.color) || undefined;

  // Single-user scale: fetch all, filter in memory (unit-tested pure logic).
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  const visible = filterItems(all, { category, color });
  const colors = distinctColors(all);

  return (
    <>
      <PageHeader title="Closet" />

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by category">
        <Link href={href(undefined, color)} className={chipClass(!category)} aria-current={!category ? "true" : undefined}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={href(c, color)} className={chipClass(category === c)} aria-current={category === c ? "true" : undefined}>
            {CATEGORY_PLURAL_LABELS[c]}
          </Link>
        ))}
      </div>

      {colors.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by color">
          <Link href={href(category)} className={chipClass(!color)} aria-current={!color ? "true" : undefined}>
            Any color
          </Link>
          {colors.map((c) => (
            <Link key={c} href={href(category, c)} className={chipClass(color === c)} aria-current={color === c ? "true" : undefined}>
              {c}
            </Link>
          ))}
        </div>
      )}

      {all.length === 0 && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="font-script text-3xl text-ink">Your closet awaits</p>
          <p className="text-mute">Scan your first item to start your Kloset.</p>
        </div>
      )}

      <div className="mt-4 columns-2 gap-2 sm:columns-3 md:columns-4 [&>a]:mb-2">
        {visible.map((item) => (
          <Link
            key={item.id}
            href={`/closet/${item.id}`}
            className="relative block break-inside-avoid overflow-hidden rounded-card bg-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className="w-full object-contain p-3"
            />
            <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-canvas px-3 py-1 text-xs font-bold text-ink">
              {item.name}
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/scan"
        aria-label="Scan item"
        className="fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-pink text-white"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      </Link>
    </>
  );
}
```

- [ ] **Step 2: Run** `npm run test:e2e -- closet` — closet.spec previously found the scan entry as a link named "Scan item" (emoji tile) — the FAB keeps `aria-label="Scan item"` so role/name selectors survive. Fix any assertion that targeted the old grid structure (e.g., item name now `alt`/pill text — `getByText(name)` still matches the pill).
Expected: PASS after at most selector-level updates.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(p1): masonry closet with pin cards and pink scan FAB"
```

---

### Task 6: Scan flow + item detail reskin

**Files:**
- Modify: `components/scan/CaptureScreen.tsx`, `components/scan/ConfirmSheet.tsx`, `components/scan/CategoryChips.tsx`, `components/scan/TagChips.tsx`, `components/scan/ScanFlow.tsx`, `components/closet/ItemDetailForm.tsx`, `app/(tabs)/closet/[id]/page.tsx`, `app/scan/page.tsx`

**Interfaces:**
- Consumes: tokens (Task 1), 7 categories (Task 2 — CategoryChips reads `CATEGORIES`, gains dress/accessory automatically).
- Behavior, aria labels, and flow logic unchanged — class-level reskin only. e2e closet.spec's scan path is the regression gate.

- [ ] **Step 1: Reskin pass** — in each listed file replace the old neutral palette with tokens, following these mappings (apply consistently; DESIGN.md is the reference):
  - `bg-neutral-900 text-white` (primary buttons) → `bg-pink text-white active:bg-pink-deep rounded-full`
  - `bg-neutral-200 text-neutral-600` (chips/secondary) → `bg-card text-ink` (chips) / `bg-secondary text-ink` (secondary buttons), active chip → `bg-ink text-white`
  - `bg-white` cards/sheets → `bg-canvas rounded-big` (sheets) / `bg-card rounded-card` (tiles)
  - `border-neutral-*` → `border-hairline`; `text-neutral-500/600` → `text-mute`; `rounded-xl` → `rounded-card`
  - Any `<h1>`/screen title in the scan flow gets `font-script text-4xl text-ink` (page-title rule); `app/scan/page.tsx` and `app/(tabs)/closet/[id]/page.tsx` titles likewise.

- [ ] **Step 2: Run the full scan-path e2e** — `MOCK_AI=1 npm run test:e2e -- closet` — Expected: PASS (flow logic untouched).

- [ ] **Step 3: Visual smoke** — `MOCK_AI=1 npm run dev`, walk `/scan` at 390px width: capture → confirm sheet → save; check chips show all 7 categories. Kill server.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(p1): Kloset reskin for scan flow and item detail"
```

---

### Task 7: pickOutfit — TDD

**Files:**
- Create: `lib/today/pick.ts`
- Test: `lib/today/pick.test.ts`

**Interfaces:**
- Consumes: `ClosetItem` (`lib/closet/types.ts`), `WeatherSummary` (`lib/context/types.ts`), `Category` (`lib/closet/categories.ts`).
- Produces (Task 8 renders this):

```ts
export type OutfitPick = { picks: { category: Category; item: ClosetItem }[] };
export function pickOutfit(
  all: ClosetItem[],
  weather: WeatherSummary | null,
  dateKey: string, // "YYYY-MM-DD" — same key → same outfit all day
): OutfitPick | null;
```

Rules: base = top + bottom; if either slot is empty and a dress exists, base = dress. No base possible → `null`. Add shoes if any. Add jacket if `weather && weather.tempMax <= 15`. Add hat if `weather && weather.tempMax <= 5`. Within a slot, selection is deterministic: `djb2(dateKey + category) % candidates.length`.

- [ ] **Step 1: Write the failing tests** `lib/today/pick.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ClosetItem } from "@/lib/closet/types";
import type { WeatherSummary } from "@/lib/context/types";
import { pickOutfit } from "./pick";

let n = 0;
function item(category: ClosetItem["category"], name?: string): ClosetItem {
  n += 1;
  return {
    id: `id-${n}`,
    name: name ?? `${category} ${n}`,
    category,
    colors: [],
    styleTags: [],
    imageUrl: `https://mock/img-${n}.png`,
    originalImageUrl: `https://mock/orig-${n}.png`,
    createdAt: new Date("2026-07-01T00:00:00Z"),
  };
}

const COLD: WeatherSummary = { tempMin: 1, tempMax: 5, code: 3, label: "Overcast", emoji: "☁️" };
const MILD: WeatherSummary = { tempMin: 10, tempMax: 14, code: 2, label: "Cloudy", emoji: "⛅" };
const WARM: WeatherSummary = { tempMin: 18, tempMax: 26, code: 0, label: "Clear", emoji: "☀️" };

describe("pickOutfit", () => {
  it("returns null for an empty closet", () => {
    expect(pickOutfit([], WARM, "2026-07-11")).toBeNull();
  });

  it("returns null when no base outfit is possible (only shoes)", () => {
    expect(pickOutfit([item("shoes")], WARM, "2026-07-11")).toBeNull();
  });

  it("picks top + bottom + shoes on a warm day", () => {
    const closet = [item("top"), item("bottom"), item("shoes"), item("jacket"), item("hat")];
    const pick = pickOutfit(closet, WARM, "2026-07-11");
    expect(pick?.picks.map((p) => p.category)).toEqual(["top", "bottom", "shoes"]);
  });

  it("falls back to a dress when there are no bottoms", () => {
    const closet = [item("top"), item("dress"), item("shoes")];
    const pick = pickOutfit(closet, WARM, "2026-07-11");
    expect(pick?.picks.map((p) => p.category)).toEqual(["dress", "shoes"]);
  });

  it("adds a jacket at 15° or below, and a hat at 5° or below", () => {
    const closet = [item("top"), item("bottom"), item("jacket"), item("hat")];
    expect(pickOutfit(closet, MILD, "2026-07-11")?.picks.map((p) => p.category)).toEqual([
      "top", "bottom", "jacket",
    ]);
    expect(pickOutfit(closet, COLD, "2026-07-11")?.picks.map((p) => p.category)).toEqual([
      "top", "bottom", "jacket", "hat",
    ]);
  });

  it("works without weather (no jacket/hat)", () => {
    const closet = [item("top"), item("bottom"), item("jacket")];
    expect(pickOutfit(closet, null, "2026-07-11")?.picks.map((p) => p.category)).toEqual([
      "top", "bottom",
    ]);
  });

  it("is deterministic for a dateKey and rotates across dates", () => {
    const closet = [item("top", "A"), item("top", "B"), item("top", "C"), item("bottom")];
    const first = pickOutfit(closet, null, "2026-07-11");
    const again = pickOutfit(closet, null, "2026-07-11");
    expect(first?.picks[0].item.id).toBe(again?.picks[0].item.id);
    const tops = new Set(
      Array.from({ length: 10 }, (_, i) =>
        pickOutfit(closet, null, `2026-07-${String(11 + i).padStart(2, "0")}`)?.picks[0].item.id,
      ),
    );
    expect(tops.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run** `npm test -- pick` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/today/pick.ts`**:

```ts
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import type { WeatherSummary } from "@/lib/context/types";

export type OutfitPick = { picks: { category: Category; item: ClosetItem }[] };

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function choose(
  all: ClosetItem[],
  category: Category,
  dateKey: string,
): ClosetItem | null {
  const candidates = all.filter((i) => i.category === category);
  if (candidates.length === 0) return null;
  return candidates[djb2(dateKey + category) % candidates.length];
}

export function pickOutfit(
  all: ClosetItem[],
  weather: WeatherSummary | null,
  dateKey: string,
): OutfitPick | null {
  const picks: OutfitPick["picks"] = [];

  const top = choose(all, "top", dateKey);
  const bottom = choose(all, "bottom", dateKey);
  if (top && bottom) {
    picks.push({ category: "top", item: top }, { category: "bottom", item: bottom });
  } else {
    const dress = choose(all, "dress", dateKey);
    if (!dress) return null;
    picks.push({ category: "dress", item: dress });
  }

  const shoes = choose(all, "shoes", dateKey);
  if (shoes) picks.push({ category: "shoes", item: shoes });

  if (weather && weather.tempMax <= 15) {
    const jacket = choose(all, "jacket", dateKey);
    if (jacket) picks.push({ category: "jacket", item: jacket });
  }
  if (weather && weather.tempMax <= 5) {
    const hat = choose(all, "hat", dateKey);
    if (hat) picks.push({ category: "hat", item: hat });
  }

  return { picks };
}
```

- [ ] **Step 4: Run** `npm test -- pick && npm run typecheck` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(p1): deterministic weather-aware outfit pick (TDD)"
```

---

### Task 8: Today screen

**Files:**
- Create: `components/today/TodayCard.tsx`, `e2e/today.spec.ts`
- Modify: `app/(tabs)/today/page.tsx`

**Interfaces:**
- Consumes: `pickOutfit`/`OutfitPick` (Task 7), `PageHeader` (Task 3), `ContextResponse` (`lib/context/types.ts`), `/api/context` (existing — MOCK_AI returns `FIXTURE_WEATHER` + `fixtureEvents`), items via `getDb()` (pattern from closet page).
- Produces: `/today` — greeting, weather chip, up to 3 events, today's outfit as cutout cards, or closet-empty CTA. "Wearing it" logging arrives in P3 (roadmap) — no stub button.

- [ ] **Step 1: Write the failing e2e** `e2e/today.spec.ts` (runs after closet.spec alphabetically — closet may or may not have items by then; assert only deterministic fixtures + structure):

```ts
import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test("today shows heading, date, and fixture weather", async ({ page }) => {
  await unlock(page); // lands on /today
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  // MOCK_AI fixture weather renders as a labeled chip.
  await expect(page.getByLabel("Today's weather")).toBeVisible();
  // Either an outfit or the empty-closet CTA is present.
  await expect(
    page.getByLabel("Today's outfit").or(page.getByRole("link", { name: "Scan your first item" })),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run** `npm run test:e2e -- today` — Expected: FAIL (page is the Task-3 stub).

- [ ] **Step 3: Write `components/today/TodayCard.tsx`**:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClosetItem } from "@/lib/closet/types";
import { CATEGORY_LABELS } from "@/lib/closet/categories";
import type { ContextResponse } from "@/lib/context/types";
import { pickOutfit } from "@/lib/today/pick";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function TodayCard({ items }: { items: ClosetItem[] }) {
  const [context, setContext] = useState<ContextResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    (async () => {
      try {
        const params = new URLSearchParams({
          from: from.toISOString(),
          to: to.toISOString(),
        });
        const res = await fetch(`/api/context?${params}`, { signal: controller.signal });
        if (res.ok) setContext((await res.json()) as ContextResponse);
      } catch {
        // Context is allowed to fail; the page isn't.
      }
    })();
    return () => controller.abort();
  }, []);

  const weather = context?.weather ?? null;
  const events = context?.events.slice(0, 3) ?? [];
  const dateKey = new Date().toISOString().slice(0, 10);
  const outfit = pickOutfit(items, weather, dateKey);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-mute">
          {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </p>
        {weather && (
          <span
            aria-label="Today's weather"
            className="rounded-full bg-card px-3 py-1 text-sm font-bold text-ink"
          >
            {weather.emoji} {weather.tempMin}–{weather.tempMax}° {weather.label}
          </span>
        )}
      </div>

      {events.length > 0 && (
        <ul aria-label="Today's events" className="flex flex-col gap-1">
          {events.map((event) => (
            <li key={event.start + event.title} className="text-sm text-body">
              <span className="font-semibold text-ink">
                {event.allDay ? "All day" : formatTime(event.start)}
              </span>{" "}
              {event.title}
            </li>
          ))}
        </ul>
      )}

      {outfit ? (
        <section aria-label="Today's outfit">
          <h2 className="font-script text-3xl text-ink">Today&apos;s outfit</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {outfit.picks.map(({ category, item }) => (
              <Link
                key={item.id}
                href={`/closet/${item.id}`}
                className="relative block overflow-hidden rounded-card bg-card"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.name} className="w-full object-contain p-3" />
                <span className="absolute bottom-2 left-2 rounded-full bg-canvas px-3 py-1 text-xs font-bold text-ink">
                  {CATEGORY_LABELS[category]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="font-script text-3xl text-ink">Your closet awaits</p>
          <p className="text-mute">Add a top and bottom (or a dress) to see today&apos;s outfit.</p>
          <Link
            href="/scan"
            className="rounded-full bg-pink px-5 py-3 text-sm font-bold text-white active:bg-pink-deep"
          >
            Scan your first item
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Complete `app/(tabs)/today/page.tsx`**:

```tsx
import { desc } from "drizzle-orm";
import PageHeader from "@/components/shell/PageHeader";
import TodayCard from "@/components/today/TodayCard";
import { getDb } from "@/lib/db/client";
import { items } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const all = await getDb().select().from(items).orderBy(desc(items.createdAt));
  return (
    <>
      <PageHeader title="Today" />
      <TodayCard items={all} />
    </>
  );
}
```

- [ ] **Step 5: Run** `npm run test:e2e -- today && npm test && npm run typecheck` — Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(p1): Today home - weather, events, deterministic daily outfit"
```

---

### Task 9: Impeccable audit + polish + full gates

**Files:**
- Modify: whatever the audit flags (UI files only; tokens stay the source of truth)

**Note for orchestrator:** run this task INLINE (not via subagent) — it uses the impeccable skill (`/impeccable audit`, then `polish`) which needs the session's browser tooling for screenshot-driven iteration.

- [ ] **Step 1:** Start `MOCK_AI=1 npm run dev`; run the impeccable skill's `audit` flow over `/login`, `/today`, `/closet`, `/scan`, and the menu overlay at 390×844 (phone) and 1024px. Its setup will read PRODUCT.md + DESIGN.md (written in Task 1).
- [ ] **Step 2:** Apply audit findings that are token-conformance, contrast (body ≥4.5:1 — check `text-mute #6e6270` on `bg-card #f9f1f5` especially), touch-target (≥44px), and hierarchy fixes. Reject findings that fight the roadmap decisions (full-screen menu, script titles, pink scarcity).
- [ ] **Step 3:** Run the `polish` flow on the two money screens: `/today` and `/closet`.
- [ ] **Step 4: Full gates** — `npm test && npm run typecheck && MOCK_AI=1 npm run test:e2e` — Expected: all green; paste output.
- [ ] **Step 5: Commit + push branch**

```bash
git add -A && git commit -m "polish(p1): impeccable audit fixes across Kloset screens" && git push -u origin kloset-p1
```

---

## Verification (Phase 1 exit bar)

1. `npm test && npm run typecheck && MOCK_AI=1 npm run test:e2e` — all green.
2. `MOCK_AI=1 npm run dev` at 390px: login shows cursive pink **Kloset** → unlock lands on **/today** → fixture weather chip + events render → scan a garment (MOCK_AI canned) → it appears in the masonry closet → menu button opens full-screen cursive menu → all six destinations reachable.
3. `/manifest.webmanifest` says Kloset, `/icon` is the cursive K on pink, installable as PWA.
4. One real-AI smoke test (unset MOCK_AI, real keys): scan one garment end-to-end, confirm tagging/cutout still works post-reskin. Then re-wipe if desired.
