"use client";

import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/closet/categories";
import CategoryChips from "./CategoryChips";
import { downscalePhoto } from "./downscale";
import { Outline, OUTLINE_HINTS } from "./outlines";

export default function CaptureScreen({
  category,
  onCategoryChange,
  onPhoto,
  onCancel,
}: {
  category: Category;
  onCategoryChange: (category: Category) => void;
  onPhoto: (photo: Blob) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
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
        setCameraError(true);
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function snap() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (blob) onPhoto(await downscalePhoto(blob));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onPhoto(await downscalePhoto(file));
    e.target.value = "";
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-neutral-950 p-4">
      <CategoryChips value={category} onChange={onCategoryChange} dark />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-neutral-800">
        {cameraError ? (
          <p className="max-w-xs text-center text-sm text-neutral-300">
            Camera unavailable — use "Choose from library" below to add a photo
            instead.
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
              <Outline category={category} />
            </div>
            <p className="absolute bottom-3 w-full text-center text-xs text-neutral-200">
              {OUTLINE_HINTS[category]}
            </p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-4 pb-2">
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
          aria-label="Take photo"
          onClick={snap}
          disabled={cameraError}
          className="h-16 w-16 rounded-full border-4 border-neutral-400 bg-white disabled:opacity-30"
        />
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-neutral-300"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
