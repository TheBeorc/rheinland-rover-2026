import { lazy, Suspense, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { usePois, type Poi } from "@/lib/poi";
import { PoiSheet } from "@/components/poi/PoiSheet";
import { NotebookLink } from "@/components/notebook/NotebookLink";

const AranMap = lazy(() => import("@/components/map/AranMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Rheinland Rover 2026 — interactive field guide" },
      {
        name: "description",
        content:
          "A playful illustrated field guide to southern Germany. Tap cartoon markers on a precise map to discover places and stories.",
      },
      { name: "theme-color", content: "#5fb0c9" },
      { property: "og:title", content: "The Rheinland Rover 2026" },
      {
        property: "og:description",
        content:
          "Wander southern Germany with a cartoon field guide on a geographically accurate map.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: pois, isLoading, error } = usePois();
  const [selected, setSelected] = useState<Poi | null>(null);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[var(--color-sea)]">
      {isLoading && (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <p className="text-sm">Loading the map…</p>
        </div>
      )}
      {error && (
        <div className="flex h-full w-full items-center justify-center p-6 text-center">
          <p className="text-sm text-destructive">
            Couldn't load the field guide. Try refreshing the page.
          </p>
        </div>
      )}
      {pois && (
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <p className="text-sm">Unfolding the map…</p>
            </div>
          }
        >
          <AranMap pois={pois} selected={selected} onSelect={setSelected} />
        </Suspense>
      )}
      <PoiSheet poi={selected} onClose={() => setSelected(null)} />
      <NotebookLink />
    </main>
  );
}
