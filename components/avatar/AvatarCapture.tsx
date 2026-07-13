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
  const [phase, setPhase] = useState<Phase>("camera");
  const { videoRef, cameraError } = useCameraStream(facing, phase === "camera");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; canRetry: boolean } | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Reset videoReady whenever facingMode changes or we re-enter camera phase
  // so the button stays locked until the new stream delivers its first frame.
  useEffect(() => {
    setVideoReady(false);
  }, [facing, phase]);

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
    setCountdown(null);
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
      <div className="flex min-h-dvh flex-col bg-canvas p-4">
        <div className="flex flex-1 items-center justify-center overflow-hidden rounded-card bg-white/10">
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
            className="flex-1 rounded-full bg-ink p-3 text-sm font-bold text-canvas disabled:opacity-50"
          >
            {phase === "uploading" ? "Uploading…" : "Use photo"}
          </button>
          <button
            type="button"
            disabled={phase === "uploading"}
            onClick={() => setPhase("camera")}
            className="flex-1 rounded-full bg-white/15 p-3 text-sm font-bold text-white disabled:opacity-50"
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6">
        <p role="status" className="text-white/80">
          {error?.message ?? "Upload failed — try again."}
        </p>
        {canRetry && (
          <button
            type="button"
            onClick={upload}
            className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-canvas"
          >
            Try again
          </button>
        )}
        <button
          type="button"
          onClick={() => setPhase("camera")}
          className={
            canRetry
              ? "text-sm text-white/70 underline"
              : "rounded-full bg-ink px-6 py-3 text-sm font-bold text-canvas"
          }
        >
          Retake photo
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-canvas p-4">
      <p className="text-center text-sm text-white/70">
        Set the device down, step back, and fit your whole body in the outline.
      </p>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-card bg-white/10">
        {cameraError ? (
          <p className="max-w-xs text-center text-sm text-white/70">
            Camera unavailable — use "Choose from library" below instead.
          </p>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedData={() => setVideoReady(true)}
              className={`absolute inset-0 h-full w-full object-cover ${
                facing === "user" ? "[transform:scaleX(-1)]" : ""
              }`}
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
          disabled={cameraError || !videoReady || countdown !== null}
          onClick={() => setCountdown(TIMER_SECONDS)}
          className="touch-manipulation rounded-full bg-ink px-5 py-3 text-sm font-bold text-canvas disabled:opacity-30"
        >
          ⏱ 10s timer
        </button>
        <button
          type="button"
          disabled={cameraError || !videoReady || countdown !== null || snapping}
          onClick={() => void snap()}
          className="touch-manipulation rounded-full bg-white/15 px-5 py-3 text-sm font-bold text-white disabled:opacity-30"
        >
          Take photo now
        </button>
        <label
          className={countdown !== null ? "pointer-events-none cursor-pointer text-sm text-white/70 opacity-30" : "cursor-pointer text-sm text-white/70"}
        >
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
          disabled={countdown !== null}
          aria-label="Switch camera"
          onClick={() =>
            setFacing((f) => (f === "user" ? "environment" : "user"))
          }
          className="text-sm text-white/70 disabled:opacity-30"
        >
          🔄 Flip
        </button>
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="text-sm text-white/70"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
