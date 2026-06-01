export function formatProductRegionLabel(region: string) {
  const normalizedRegion = region.trim();

  if (!normalizedRegion) {
    return "Market not captured";
  }

  if (/^AU[-\s]?ready$/i.test(normalizedRegion)) {
    return "AU verification pending";
  }

  switch (normalizedRegion.toUpperCase()) {
    case "AU":
      return "Australia";
    case "US":
      return "United States";
    default:
      return normalizedRegion;
  }
}
