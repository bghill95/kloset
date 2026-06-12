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
                className="h-full w-full object-contain"
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
