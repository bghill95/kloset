import { asc } from "drizzle-orm";
import Link from "next/link";
import PageHeader from "@/components/shell/PageHeader";
import NewTripForm from "@/components/trips/NewTripForm";
import { getDb } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { parseCapsule } from "@/lib/trips/capsule";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const rows = await getDb().select().from(trips).orderBy(asc(trips.startDate));
  return (
    <>
      <PageHeader title="Trips" />
      <div className="mt-4 flex flex-col gap-4">
        <NewTripForm />
        {rows.length === 0 ? (
          <p className="text-mute">No trips planned yet — add one above.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((t) => {
              const capsule = parseCapsule(t.capsule);
              return (
                <li key={t.id}>
                  <Link
                    href={`/trips/${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-card bg-card p-4"
                  >
                    <span className="font-bold text-ink">{t.destination}</span>
                    <span className="text-sm text-mute">
                      {t.startDate} – {t.endDate}
                      {capsule.length > 0 ? ` · ${t.packedIds.length}/${capsule.length} packed` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
