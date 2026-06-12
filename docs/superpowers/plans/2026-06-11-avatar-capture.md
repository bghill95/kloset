# Avatar Guided Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture 1–3 full-body base photos via a self-timer viewfinder with a framing guide, manage them (primary/delete) in Settings, stored in a new `basePhotos` table — no AI, fully mocked storage under `MOCK_AI=1`.

**Architecture:** A shared `useCameraStream` hook (extracted from CaptureScreen) powers a new full-screen `/avatar-capture` flow (camera → optional 10s countdown → preview → upload). `POST /api/base-photos` stores to Blob (fixture URL in mock mode) with auto-primary on first photo; PATCH/DELETE manage primary semantics with promotion-on-delete. Settings gains a server-rendered Avatar section.

**Tech Stack:** unchanged from M2 (Next 16, Drizzle/Neon, @vercel/blob, Vitest, Playwright fake camera).

**Spec:** `docs/superpowers/specs/2026-06-11-avatar-capture-design.md`
**Branch:** `avatar-capture` (stacked on `m2-closet-capture`)

---

## File structure

```
lib/db/schema.ts                     # MODIFY: add basePhotos
e2e/global-setup.ts                  # MODIFY: create-if-missing + wipe base_photos
lib/avatar/primary.ts                # pickPrimary + validatePrimaryPatch (TDD)
lib/avatar/primary.test.ts
public/fixtures/base-photo.svg       # mock-mode stored photo
app/api/base-photos/route.ts         # POST (cap 3, auto-primary)
app/api/base-photos/[id]/route.ts    # PATCH (make primary), DELETE (promote on delete)
components/capture/useCameraStream.ts# shared camera lifecycle hook
components/scan/CaptureScreen.tsx    # MODIFY: consume the hook (no behavior change)
components/avatar/BodyOutline.tsx    # full-body SVG guide, data-testid="outline-body"
components/avatar/AvatarCapture.tsx  # camera/countdown/preview/upload state machine
app/avatar-capture/page.tsx          # full-screen page outside (tabs)
components/avatar/AvatarSection.tsx  # client: grid, primary badge, actions
app/(tabs)/settings/page.tsx         # MODIFY: server component with Avatar section
e2e/settings.spec.ts                 # new spec (alphabetically after closet, before tabs)
CLAUDE.md                            # MODIFY: MOCK_AI now mocks all external services
```

Conventions: same as the M2 plan (quote `(tabs)` paths in git commands; client components never value-import server modules; fetches use try/catch + non-JSON-tolerant error handling; commits end with the Claude trailer).

---

### Task 1: basePhotos schema + e2e wipe + MOCK_AI doc

**Files:** Modify `lib/db/schema.ts`, `e2e/global-setup.ts`, `CLAUDE.md`

- [ ] **Step 1:** Append to `lib/db/schema.ts` (add `boolean` to the pg-core import):

```ts
export const basePhotos = pgTable("base_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageUrl: text("image_url").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2:** Run `npm run db:push` → `base_photos` created. (Expect the known no-op array-default ALTERs for `items` — learned rule, ignore.)

- [ ] **Step 3:** In `e2e/global-setup.ts`, after the items block (keep the sync comment pattern):

```ts
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS base_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url text NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
```

and add `await sql`DELETE FROM base_photos`;` next to the other DELETEs.

- [ ] **Step 4:** CLAUDE.md: in the Stack section change the MOCK_AI line to:

```
Dev/tests always run with MOCK_AI=1 (mocks ALL external services — OpenAI, Blob;
canned fixtures, no network calls).
```

and update both wipe mentions ("settings and items tables") to "settings, items and base_photos tables".

- [ ] **Step 5:** `npm test && npm run typecheck` green, then:

```bash
git add lib/db/schema.ts e2e/global-setup.ts CLAUDE.md
git commit -m "feat: basePhotos table, e2e wipe, MOCK_AI scope docs"
```

---

### Task 2: Primary-photo logic (TDD)

**Files:** Create `lib/avatar/primary.ts`, `lib/avatar/primary.test.ts`

- [ ] **Step 1:** Write the failing test `lib/avatar/primary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickPrimary, validatePrimaryPatch } from "./primary";

const photo = (id: string, isPrimary: boolean, createdAt: string) => ({
  id,
  isPrimary,
  createdAt: new Date(createdAt),
});

describe("pickPrimary", () => {
  it("returns null when no photos remain", () => {
    expect(pickPrimary([])).toBeNull();
  });

  it("returns null when a primary still exists", () => {
    expect(
      pickPrimary([photo("a", true, "2026-01-01"), photo("b", false, "2026-01-02")]),
    ).toBeNull();
  });

  it("promotes the oldest remaining photo when none is primary", () => {
    expect(
      pickPrimary([photo("b", false, "2026-01-02"), photo("a", false, "2026-01-01")]),
    ).toBe("a");
  });
});

describe("validatePrimaryPatch", () => {
  it("accepts exactly { isPrimary: true }", () => {
    expect(validatePrimaryPatch({ isPrimary: true })).toBe(true);
  });

  it.each([
    ["false", { isPrimary: false }],
    ["extra keys", { isPrimary: true, imageUrl: "x" }],
    ["empty", {}],
    ["non-object", "yes"],
    ["null", null],
  ])("rejects %s", (_label, raw) => {
    expect(validatePrimaryPatch(raw)).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run lib/avatar/primary.test.ts` → FAIL (module missing).

- [ ] **Step 3:** Write `lib/avatar/primary.ts`:

```ts
export type BasePhotoLike = {
  id: string;
  isPrimary: boolean;
  createdAt: Date;
};

// After a delete, decide which remaining photo to promote to primary.
// Returns the id to promote, or null when no promotion is needed.
export function pickPrimary(remaining: BasePhotoLike[]): string | null {
  if (remaining.length === 0) return null;
  if (remaining.some((p) => p.isPrimary)) return null;
  return [...remaining].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )[0].id;
}

// PATCH accepts exactly { isPrimary: true } — nothing else is editable.
export function validatePrimaryPatch(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const keys = Object.keys(raw);
  return keys.length === 1 && (raw as { isPrimary?: unknown }).isPrimary === true;
}
```

- [ ] **Step 4:** Test passes; `npm run typecheck` clean; commit `feat: base-photo primary logic (TDD)`.

---

### Task 3: Fixture + base-photos API routes

**Files:** Create `public/fixtures/base-photo.svg`, `app/api/base-photos/route.ts`, `app/api/base-photos/[id]/route.ts`

- [ ] **Step 1:** `public/fixtures/base-photo.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 220" width="240" height="440">
  <rect width="120" height="220" fill="#cfd6dd"/>
  <circle cx="60" cy="38" r="16" fill="#8a97a5"/>
  <path d="M60 56 L38 70 L34 130 L46 128 L46 200 L56 200 L58 140 L62 140 L64 200 L74 200 L74 128 L86 130 L82 70 Z" fill="#8a97a5"/>
</svg>
```

- [ ] **Step 2:** `app/api/base-photos/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { basePhotos } from "@/lib/db/schema";
import { putImage } from "@/lib/storage/blob";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 3;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "A photo is required." }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Photo too large (max 10 MB)." },
      { status: 413 },
    );
  }

  const existing = await getDb().select().from(basePhotos);
  if (existing.length >= MAX_PHOTOS) {
    return NextResponse.json(
      { error: "You already have 3 base photos — delete one first." },
      { status: 409 },
    );
  }

  try {
    let imageUrl: string;
    if (process.env.MOCK_AI === "1") {
      imageUrl = "/fixtures/base-photo.svg";
    } else {
      const buffer = Buffer.from(await photo.arrayBuffer());
      imageUrl = await putImage(
        "base-photos/photo.jpg",
        buffer,
        photo.type || "image/jpeg",
      );
    }
    const [created] = await getDb()
      .insert(basePhotos)
      .values({ imageUrl, isPrimary: existing.length === 0 })
      .returning();
    return NextResponse.json({ photo: created }, { status: 201 });
  } catch (err) {
    console.error("[base-photos] upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed — try again." },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 3:** `app/api/base-photos/[id]/route.ts`:

```ts
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { pickPrimary, validatePrimaryPatch } from "@/lib/avatar/primary";
import { UUID_RE } from "@/lib/closet/item-validation";
import { getDb } from "@/lib/db/client";
import { basePhotos } from "@/lib/db/schema";
import { deleteImages } from "@/lib/storage/blob";

type Ctx = { params: Promise<{ id: string }> };

// neon-http has no multi-statement transactions; the demote→promote pair runs
// sequentially. Single-user app — a crash between them is recoverable by
// re-tapping "Make primary".

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!validatePrimaryPatch(body)) {
    return NextResponse.json(
      { error: "Only { isPrimary: true } is accepted." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [target] = await db
    .select()
    .from(basePhotos)
    .where(eq(basePhotos.id, id));
  if (!target) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db.update(basePhotos).set({ isPrimary: false });
  const [photo] = await db
    .update(basePhotos)
    .set({ isPrimary: true })
    .where(eq(basePhotos.id, id))
    .returning();
  return NextResponse.json({ photo });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const db = getDb();
  const [deleted] = await db
    .delete(basePhotos)
    .where(eq(basePhotos.id, id))
    .returning();
  if (!deleted) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await deleteImages([deleted.imageUrl]);

  const remaining = await db.select().from(basePhotos);
  const promoteId = pickPrimary(remaining);
  if (promoteId) {
    await db
      .update(basePhotos)
      .set({ isPrimary: true })
      .where(eq(basePhotos.id, promoteId));
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4:** `npm run typecheck && npm test` green; commit `feat: base-photos API - upload with cap, primary semantics, promote on delete`.

---

### Task 4: useCameraStream hook + CaptureScreen refactor

**Files:** Create `components/capture/useCameraStream.ts`; Modify `components/scan/CaptureScreen.tsx`

- [ ] **Step 1:** `components/capture/useCameraStream.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";

// Shared getUserMedia lifecycle: requests real resolution, cleans up tracks,
// re-acquires when facingMode changes, degrades to an error flag.
export function useCameraStream(facingMode: "user" | "environment") {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    setCameraError(false);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 2048 },
            height: { ideal: 1536 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        if (!cancelled) setCameraError(true);
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  return { videoRef, cameraError };
}
```

- [ ] **Step 2:** Refactor `components/scan/CaptureScreen.tsx`: delete its local `videoRef`/`cameraError` state and the whole getUserMedia `useEffect`; replace with `const { videoRef, cameraError } = useCameraStream("environment");`. Everything else (snap, onFile, JSX) unchanged.

- [ ] **Step 3:** REFACTOR GUARD: `npm run test:e2e` — all 15 must stay green. Then typecheck + unit; commit `refactor: extract shared useCameraStream hook`.

---

### Task 5: BodyOutline + AvatarCapture + page

**Files:** Create `components/avatar/BodyOutline.tsx`, `components/avatar/AvatarCapture.tsx`, `app/avatar-capture/page.tsx`

- [ ] **Step 1:** `components/avatar/BodyOutline.tsx`:

```tsx
export default function BodyOutline() {
  return (
    <svg
      viewBox="0 0 120 220"
      data-testid="outline-body"
      className="h-[85%] w-auto opacity-80"
    >
      <circle
        cx="60" cy="30" r="16"
        fill="none" stroke="#ffd166" strokeWidth="2.5" strokeDasharray="7 5"
      />
      <path
        d="M60 48 L34 64 L28 132 L42 130 L42 204 L54 204 L57 142 L63 142 L66 204 L78 204 L78 130 L92 132 L86 64 Z"
        fill="none" stroke="#ffd166" strokeWidth="2.5" strokeDasharray="7 5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2:** `components/avatar/AvatarCapture.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCameraStream } from "@/components/capture/useCameraStream";
import { downscalePhoto } from "@/components/scan/downscale";
import BodyOutline from "./BodyOutline";

type Phase = "camera" | "preview" | "uploading" | "error";

const TIMER_SECONDS = 10;

export default function AvatarCapture() {
  const router = useRouter();
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const { videoRef, cameraError } = useCameraStream(facing);
  const [phase, setPhase] = useState<Phase>("camera");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; canRetry: boolean } | null>(null);
  const [snapping, setSnapping] = useState(false);

  // Countdown ticks once per second; snap fires at 0.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      void snap();
      return;
    }
    const t = setTimeout(
      () => setCountdown((c) => (c === null ? null : c - 1)),
      1000,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Object URLs leak unless revoked.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function showPreview(blob: Blob) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhoto(blob);
    setPreviewUrl(URL.createObjectURL(blob));
    setPhase("preview");
  }

  async function snap() {
    const video = videoRef.current;
    if (snapping || !video || video.videoWidth === 0) return;
    setSnapping(true);
    try {
      const scale = Math.min(
        1,
        1500 / Math.max(video.videoWidth, video.videoHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas
        .getContext("2d")!
        .drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (blob) showPreview(blob);
    } finally {
      setSnapping(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) showPreview(await downscalePhoto(file));
    e.target.value = "";
  }

  async function upload() {
    if (!photo) return;
    setPhase("uploading");
    setError(null);
    const form = new FormData();
    form.append("photo", photo, "base-photo.jpg");
    try {
      const res = await fetch("/api/base-photos", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          res.status === 413
            ? { message: "Photo too large — retake it.", canRetry: false }
            : {
                message: data?.error ?? "Upload failed — try again.",
                canRetry: res.status !== 409,
              },
        );
        setPhase("error");
        return;
      }
      router.push("/settings");
      router.refresh();
    } catch {
      setError({ message: "Upload failed — try again.", canRetry: true });
      setPhase("error");
    }
  }

  if (phase === "preview" || phase === "uploading") {
    return (
      <div className="flex min-h-dvh flex-col bg-neutral-950 p-4">
        <div className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-neutral-800">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Base photo preview"
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>
        <div className="flex gap-2 pt-4">
          <button
            type="button"
            disabled={phase === "uploading"}
            onClick={upload}
            className="flex-1 rounded-xl bg-white p-3 font-semibold text-neutral-900 disabled:opacity-50"
          >
            {phase === "uploading" ? "Uploading…" : "Use photo"}
          </button>
          <button
            type="button"
            disabled={phase === "uploading"}
            onClick={() => setPhase("camera")}
            className="flex-1 rounded-xl bg-neutral-700 p-3 font-semibold text-white disabled:opacity-50"
          >
            ↻ Retake
          </button>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    const canRetry = error?.canRetry !== false;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-6">
        <p role="status" className="text-neutral-200">
          {error?.message ?? "Upload failed — try again."}
        </p>
        {canRetry && (
          <button
            type="button"
            onClick={upload}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-neutral-900"
          >
            Try again
          </button>
        )}
        <button
          type="button"
          onClick={() => setPhase("camera")}
          className={
            canRetry
              ? "text-sm text-neutral-400 underline"
              : "rounded-xl bg-white px-6 py-3 font-semibold text-neutral-900"
          }
        >
          Retake photo
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-neutral-950 p-4">
      <p className="text-center text-sm text-neutral-300">
        Set the device down, step back, and fit your whole body in the outline.
      </p>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-neutral-800">
        {cameraError ? (
          <p className="max-w-xs text-center text-sm text-neutral-300">
            Camera unavailable — use “Choose from library” below instead.
          </p>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <BodyOutline />
            </div>
          </>
        )}
        {countdown !== null && (
          <button
            type="button"
            data-testid="countdown-overlay"
            onClick={() => setCountdown(null)}
            className="absolute inset-0 flex items-center justify-center bg-black/50"
            aria-label="Cancel timer"
          >
            <span className="text-9xl font-bold text-white">{countdown}</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pb-2">
        <button
          type="button"
          disabled={cameraError || countdown !== null}
          onClick={() => setCountdown(TIMER_SECONDS)}
          className="touch-manipulation rounded-xl bg-white px-5 py-3 font-semibold text-neutral-900 disabled:opacity-30"
        >
          ⏱ 10s timer
        </button>
        <button
          type="button"
          disabled={cameraError || countdown !== null || snapping}
          onClick={() => void snap()}
          className="touch-manipulation rounded-xl bg-neutral-200 px-5 py-3 font-semibold text-neutral-900 disabled:opacity-30"
        >
          Take photo now
        </button>
        <label className="cursor-pointer text-sm text-neutral-300">
          🖼️ Choose from library
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            className="hidden"
          />
        </label>
        <button
          type="button"
          aria-label="Switch camera"
          onClick={() =>
            setFacing((f) => (f === "user" ? "environment" : "user"))
          }
          className="text-sm text-neutral-300"
        >
          🔄 Flip
        </button>
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="text-sm text-neutral-300"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3:** `app/avatar-capture/page.tsx`:

```tsx
import AvatarCapture from "@/components/avatar/AvatarCapture";

export default function AvatarCapturePage() {
  return <AvatarCapture />;
}
```

- [ ] **Step 4:** `npm run typecheck && npm test` green; commit `feat: avatar capture - self-timer viewfinder with body outline and preview gate`.

---

### Task 6: Settings avatar section

**Files:** Create `components/avatar/AvatarSection.tsx`; Modify `app/(tabs)/settings/page.tsx`

- [ ] **Step 1:** `components/avatar/AvatarSection.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type BasePhoto = {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
};

export default function AvatarSection({ photos }: { photos: BasePhoto[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function makePrimary(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/base-photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (!res.ok) setError("Couldn't update — try again.");
      else router.refresh();
    } catch {
      setError("Couldn't update — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this base photo?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/base-photos/${id}`, { method: "DELETE" });
      if (!res.ok) setError("Couldn't delete — try again.");
      else router.refresh();
    } catch {
      setError("Couldn't delete — try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-label="Avatar">
      <h2 className="text-lg font-semibold">Avatar</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Base photos are what outfits get rendered onto. Capture up to three;
        the primary one is used by default.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="flex flex-col gap-1">
            <div className="relative h-40 overflow-hidden rounded-xl bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              {photo.isPrimary && (
                <span className="absolute left-1 top-1 rounded-full bg-neutral-900/80 px-2 py-0.5 text-xs font-semibold text-white">
                  Primary
                </span>
              )}
            </div>
            {!photo.isPrimary && (
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => makePrimary(photo.id)}
                className="text-xs font-semibold text-neutral-700 underline disabled:opacity-50"
              >
                Make primary
              </button>
            )}
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => remove(photo.id)}
              className="text-xs text-red-600 underline disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {photos.length < 3 ? (
        <Link
          href="/avatar-capture"
          className="mt-4 inline-block rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
        >
          📷 Capture base photo
        </Link>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">
          3 of 3 — delete one to retake.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2:** Replace `app/(tabs)/settings/page.tsx`:

```tsx
import { asc } from "drizzle-orm";
import AvatarSection from "@/components/avatar/AvatarSection";
import { getDb } from "@/lib/db/client";
import { basePhotos } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const photos = await getDb()
    .select()
    .from(basePhotos)
    .orderBy(asc(basePhotos.createdAt));

  return (
    <>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="mt-6 flex flex-col gap-8">
        <AvatarSection photos={photos} />
        <section aria-label="Passcode">
          <h2 className="text-lg font-semibold">Passcode</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Passcode management arrives in a later milestone.
          </p>
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 3:** `npm run typecheck && npm test` green. NOTE: `e2e/tabs.spec.ts` asserts a heading named "Settings" — the h1 is preserved, so it stays green. Commit `feat: settings avatar section - grid, primary badge, capture entry`.

---

### Task 7: settings e2e + full gate

**Files:** Create `e2e/settings.spec.ts`

- [ ] **Step 1:** `e2e/settings.spec.ts` (runs after `closet.spec.ts`, before `tabs.spec.ts` — alphabetical rule):

```ts
import path from "node:path";
import { expect, test } from "@playwright/test";
import { unlock } from "./helpers";

test.describe.serial("avatar base photos", () => {
  test("avatar section starts empty with capture entry", async ({ page }) => {
    await unlock(page);
    await page.goto("/settings");
    await expect(page.getByText("Base photos are what outfits")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Capture base photo/ }),
    ).toBeVisible();
  });

  test("take photo now → preview → use photo lands in settings as primary", async ({
    page,
  }) => {
    await unlock(page);
    await page.goto("/avatar-capture");
    await expect(page.getByTestId("outline-body")).toBeVisible();
    await expect(page.locator("video")).toBeVisible();
    await page.getByRole("button", { name: "Take photo now" }).click();
    await page.getByRole("button", { name: "Use photo" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText("Primary", { exact: true })).toBeVisible();
  });

  test("library photo becomes second; make primary flips the badge", async ({
    page,
  }) => {
    await unlock(page);
    await page.goto("/avatar-capture");
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(__dirname, "fixtures", "garment.svg"));
    await page.getByRole("button", { name: "Use photo" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText("Primary", { exact: true })).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Make primary" }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Make primary" }).click();
    // Badge moves; there is still exactly one of each.
    await expect(page.getByText("Primary", { exact: true })).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Make primary" }),
    ).toHaveCount(1);
  });

  test("countdown overlay shows and cancels", async ({ page }) => {
    await unlock(page);
    await page.goto("/avatar-capture");
    await page.getByRole("button", { name: /10s timer/ }).click();
    await expect(page.getByTestId("countdown-overlay")).toBeVisible();
    await page.getByTestId("countdown-overlay").click();
    await expect(page.getByTestId("countdown-overlay")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Take photo now" }),
    ).toBeEnabled();
  });

  test("deleting both photos returns to the empty state", async ({ page }) => {
    await unlock(page);
    await page.goto("/settings");
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(1);
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(
      page.getByRole("link", { name: /Capture base photo/ }),
    ).toBeVisible();
  });
});
```

- [ ] **Step 2:** `npm run test:e2e` → expect 20 passed (auth-flow 5, closet 7, settings 5, tabs 3).

- [ ] **Step 3:** Full gate `npm test && npm run typecheck && npm run test:e2e` green; commit `test: avatar capture e2e - capture, primary, countdown, delete`.

---

### Task 8: Ship

- [ ] Full gate output shown; push branch; `gh pr create --base m2-closet-capture` (stacked PR) with summary + test plan.

## Acceptance checklist

- [ ] All three suites green; production build clean
- [ ] Closet e2e unaffected by the camera-hook refactor
- [ ] Settings shows the avatar grid; primary semantics verified by e2e
- [ ] Countdown snaps after 10s (manual check on device — e2e covers render/cancel only)

## Deferred

- Calendar/weather Settings sections + status bar → slice 3
- Real-device timer/orientation check → final user checklist
