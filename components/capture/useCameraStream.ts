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
