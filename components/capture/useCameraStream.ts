"use client";

import { useEffect, useRef, useState } from "react";

// Shared getUserMedia lifecycle: requests real resolution, cleans up tracks,
// re-acquires when facingMode changes, degrades to an error flag.
// Pass active=false to suppress the stream (e.g. during preview/upload phases).
export function useCameraStream(
  facingMode: "user" | "environment",
  active = true,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    if (!active) return;
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
  }, [facingMode, active]);

  return { videoRef, cameraError };
}
