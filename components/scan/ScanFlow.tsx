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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function ingest(blob: Blob) {
    setPhase("processing");
    const form = new FormData();
    form.append("photo", blob, "photo.jpg");
    form.append("category", category);
    try {
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      if (!res.ok) {
        // Error bodies are usually our JSON but can be platform-generated
        // (e.g. the deploy edge rejects big bodies before our route runs).
        setErrorMessage(
          res.status === 413
            ? "Photo too large — try again; it should be smaller after the retake."
            : "Couldn't process the photo.",
        );
        setPhase("error");
        return;
      }
      setResult((await res.json()) as IngestResult);
      setPhase("confirm");
    } catch {
      setErrorMessage("Couldn't process the photo.");
      setPhase("error");
    }
  }

  function handlePhoto(blob: Blob) {
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-900" />
        <p className="text-neutral-600">
          Analyzing your {CATEGORY_LABELS[category].toLowerCase()}…
        </p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <p className="text-neutral-700">{errorMessage ?? "Couldn't process the photo."}</p>
        <button
          type="button"
          onClick={() => photo && ingest(photo)}
          className="rounded-xl bg-neutral-900 px-6 py-3 font-semibold text-white"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => setPhase("capture")}
          className="text-sm text-neutral-500 underline"
        >
          Back to camera
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
