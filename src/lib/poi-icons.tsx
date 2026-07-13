import type { ReactElement } from "react";
import type { IconType } from "./poi";

/**
 * POI icon registry — each icon_type maps to an SVG file in /public/icons/.
 * Unknown types fall back to `natural_feature`.
 */

const ICON_FILES: Record<IconType, string> = {
  burg_schloss: "/icons/burg_schloss.svg",
  church_abbey: "/icons/church_abbey.svg",
  altstadt_village: "/icons/altstadt_village.svg",
  museum: "/icons/museum.svg",
  brewery_gastro: "/icons/brewery_gastro.svg",
  lake_river: "/icons/lake_river.svg",
  mountain_view: "/icons/mountain_view.svg",
  spa_thermal: "/icons/spa_thermal.svg",
  transit_hub: "/icons/transit_hub.svg",
  natural_feature: "/icons/natural_feature.svg",
};

export function renderPoiIcon(icon: IconType): ReactElement {
  const src = ICON_FILES[icon] ?? ICON_FILES.natural_feature;
  return <img src={src} alt="" width="100%" height="100%" draggable={false} />;
}

export const POI_LABELS: Record<IconType, string> = {
  burg_schloss: "Castle / palace",
  church_abbey: "Church / abbey",
  altstadt_village: "Old town / village",
  museum: "Museum",
  brewery_gastro: "Brewery / gastronomy",
  lake_river: "Lake / river",
  mountain_view: "Mountain / viewpoint",
  spa_thermal: "Spa / thermal bath",
  transit_hub: "Transit hub",
  natural_feature: "Natural feature",
};
