export type LocationScope =
  | "country"
  | "city"
  | "district";

export type HierarchicalLocation = {
  id: string;
  country_code?: string | null;
  country_name?: string | null;
  city?: string | null;
  district?: string | null;
  scope?: LocationScope | string | null;
};

export function getLocationScope(
  location: HierarchicalLocation
): LocationScope {
  if (
    location.scope === "country" ||
    location.scope === "city" ||
    location.scope === "district"
  ) {
    return location.scope;
  }

  if (location.district?.trim()) {
    return "district";
  }

  if (location.city?.trim()) {
    return "city";
  }

  return "country";
}

export function formatLocationLabel(
  location:
    | HierarchicalLocation
    | null
    | undefined,
  options?: {
    includeCountry?: boolean;
  }
) {
  if (!location) {
    return "";
  }

  const includeCountry =
    options?.includeCountry ?? true;

  const scope =
    getLocationScope(location);

  const country =
    location.country_name?.trim() ||
    "Türkiye";

  const city =
    location.city?.trim() || "";

  const district =
    location.district?.trim() || "";

  if (scope === "country") {
    return country;
  }

  if (scope === "city") {
    return [
      city,
      includeCountry ? country : "",
    ]
      .filter(Boolean)
      .join(", ");
  }

  return [
    district,
    city,
    includeCountry ? country : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export function sortLocations<
  T extends HierarchicalLocation
>(locations: T[]) {
  return [...locations].sort(
    (left, right) => {
      const countryCompare =
        (
          left.country_name ||
          "Türkiye"
        ).localeCompare(
          right.country_name ||
            "Türkiye",
          "tr"
        );

      if (countryCompare !== 0) {
        return countryCompare;
      }

      const leftCity =
        left.city || "";
      const rightCity =
        right.city || "";

      const cityCompare =
        leftCity.localeCompare(
          rightCity,
          "tr"
        );

      if (cityCompare !== 0) {
        return cityCompare;
      }

      const scopeRank = {
        country: 0,
        city: 1,
        district: 2,
      } as const;

      const rankCompare =
        scopeRank[
          getLocationScope(left)
        ] -
        scopeRank[
          getLocationScope(right)
        ];

      if (rankCompare !== 0) {
        return rankCompare;
      }

      return (
        left.district || ""
      ).localeCompare(
        right.district || "",
        "tr"
      );
    }
  );
}
