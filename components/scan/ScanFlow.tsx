"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IngestResult } from "@/lib/ai/ingest";
import { CATEGORY_LABELS, type Category } from "@/lib/closet/categories";
import CaptureScreen from "./CaptureScreen";
import ConfirmSheet from "./ConfirmSheet";

type Phase = "capture" | "processing" | "confirm" | "error";

export default function ScanFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("capture");
  const [category, setCategory] = useState<Category>("top");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<{ message: string; canRetry: boolean } | null>(null);

  async function ingest(blob: Blob) {
    setError(null);
    setPhase("processing");
    const form = new FormData();
    form.append("photo", blob, "photo.jpg");
    form.append("category", category);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(65_000),
      });
      if (!res.ok) {
        // Error bodies are usually our JSON but can be platform-generated
        // (e.g. the deploy edge rejects big bodies before our route runs).
        setError(
          res.status === 413
            ? {
                message: "Photo too large — retake it or pick a smaller one.",
                canRetry: false,
              }
            : { message: "Couldn't process the photo.", canRetry: true },
        );
        setPhase("error");
        return;
      }
      setResult((await res.json()) as IngestResult);
      setPhase("confirm");
    } catch {
      setError({ message: "Couldn't process the photo.", canRetry: true });
      setPhase("error");
    }
  }

  function handlePhoto(blob: Blob) {
    if (phase !== "capture") return;
    setPhoto(blob);
    void ingest(blob);
  }

  if (phase === "capture") {
    return (
      <CaptureScreen
        category={category}
        onCategoryChange={setCategory}
        onPhoto={handlePhoto}
        onCancel={() => router.push("/closet")}
      />
    );
  }

  if (phase === "processing") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-hairline border-t-ink" />
        <p className="text-mute">
          Analyzing your {CATEGORY_LABELS[category].toLowerCase()}…
        </p>
      </div>
    );
  }

  if (phase === "error") {
    const canRetry = error?.canRetry !== false;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <p role="status" className="text-body">
          {error?.message ?? "Couldn't process the photo."}
        </p>
        {canRetry && (
          <button
            type="button"
            onClick={() => photo && ingest(photo)}
            className="rounded-full bg-pink px-6 py-3 font-semibold text-on-pink active:bg-pink-deep"
          >
            Try again
          </button>
        )}
        <button
          type="button"
          onClick={() => setPhase("capture")}
          className={
            canRetry
              ? "text-sm text-mute underline"
              : "rounded-full bg-pink px-6 py-3 font-semibold text-on-pink active:bg-pink-deep"
          }
        >
          {canRetry ? "Back to camera" : "Retake photo"}
        </button>
      </div>
    );
  }

  return (
    <ConfirmSheet
      result={result!}
      initialCategory={category}
      onSaved={(mode) => {
        if (mode === "done") {
          router.push("/closet");
          router.refresh();
        } else {
          setResult(null);
          setPhoto(null);
          setPhase("capture");
        }
      }}
      onRetake={() => setPhase("capture")}
    />
  );
}
