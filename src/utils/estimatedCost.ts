export type EstimatedCostMode =
  | "unknown"
  | "free"
  | "amount";

function toNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export function getEstimatedCostMode(
  value: unknown
): EstimatedCostMode {
  const amount =
    toNullableNumber(value);

  if (amount === null) {
    return "unknown";
  }

  if (amount === 0) {
    return "free";
  }

  return "amount";
}

export function parseEstimatedCost(
  mode: EstimatedCostMode,
  amountInput: string
): number | null {
  if (mode === "unknown") {
    return null;
  }

  if (mode === "free") {
    return 0;
  }

  const amount =
    Number(
      amountInput.trim()
    );

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Estimated cost per person must be greater than zero."
    );
  }

  return amount;
}

export function serializeEstimatedCost(
  mode: EstimatedCostMode,
  amountInput: string
): string {
  const value =
    parseEstimatedCost(
      mode,
      amountInput
    );

  return value === null
    ? ""
    : String(value);
}

export function formatEstimatedCost(
  value: unknown,
  {
    includePerPerson = true,
    unknownLabel = "Not sure yet",
  }: {
    includePerPerson?: boolean;
    unknownLabel?: string;
  } = {}
) {
  const amount =
    toNullableNumber(value);

  if (amount === null) {
    return unknownLabel;
  }

  if (amount === 0) {
    return "Free";
  }

  const formatted =
    new Intl.NumberFormat(
      "en-US",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    ).format(amount);

  return includePerPerson
    ? `${formatted} TL / person`
    : `${formatted} TL`;
}

export function getEstimatedCostPreviewText(
  value: unknown
) {
  const amount =
    toNullableNumber(value);

  if (amount === null) {
    return "with the cost not decided yet";
  }

  if (amount === 0) {
    return "as a free Activity";
  }

  return `with an estimated cost of ${formatEstimatedCost(
    amount
  )}`;
}
