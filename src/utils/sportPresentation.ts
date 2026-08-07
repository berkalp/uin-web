export type SportPresentation = {
  icon: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

const DEFAULT_PRESENTATION: SportPresentation = {
  icon: "🏅",
  backgroundColor: "#F9FAFB",
  borderColor: "#D1D5DB",
  textColor: "#374151",
};

const SPORT_PRESENTATIONS: Record<
  string,
  SportPresentation
> = {
  football: {
    icon: "⚽",
    backgroundColor: "#ECFDF5",
    borderColor: "#86EFAC",
    textColor: "#166534",
  },
  basketball: {
    icon: "🏀",
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
    textColor: "#9A3412",
  },
  volleyball: {
    icon: "🏐",
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
    textColor: "#1D4ED8",
  },
  tennis: {
    icon: "🎾",
    backgroundColor: "#F7FEE7",
    borderColor: "#BEF264",
    textColor: "#3F6212",
  },
  motorsports: {
    icon: "🏁",
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    textColor: "#991B1B",
  },
  "combat sports": {
    icon: "🥊",
    backgroundColor: "#FFF1F2",
    borderColor: "#FDA4AF",
    textColor: "#9F1239",
  },
  handball: {
    icon: "🤾",
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
    textColor: "#92400E",
  },
  "ice hockey": {
    icon: "🏒",
    backgroundColor: "#ECFEFF",
    borderColor: "#67E8F9",
    textColor: "#155E75",
  },
  rugby: {
    icon: "🏉",
    backgroundColor: "#FEFCE8",
    borderColor: "#FDE047",
    textColor: "#854D0E",
  },
  baseball: {
    icon: "⚾",
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    textColor: "#334155",
  },
};

export function getSportPresentation(
  sportName:
    | string
    | null
    | undefined
): SportPresentation {
  const normalizedName =
    sportName
      ?.trim()
      .toLocaleLowerCase(
        "en-US"
      ) ?? "";

  return (
    SPORT_PRESENTATIONS[
      normalizedName
    ] ??
    DEFAULT_PRESENTATION
  );
}
