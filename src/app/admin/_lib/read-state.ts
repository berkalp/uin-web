export type AdminReadError = {
  message: string;
};

type ErrorLike = {
  message?: unknown;
};

type CollectionRowRule = {
  requiredFields?: readonly string[];
  countFields?: readonly string[];
};

function normalizeReadError(
  error: unknown,
  label: string
): AdminReadError | null {
  if (!error) {
    return null;
  }

  if (
    typeof error === "object" &&
    typeof (error as ErrorLike).message === "string" &&
    (error as ErrorLike).message
  ) {
    return {
      message: (error as ErrorLike).message as string,
    };
  }

  return {
    message: `${label} could not be loaded.`,
  };
}

export function getAdminArrayReadError(
  data: unknown,
  error: unknown,
  label: string,
  requiredRowFields: readonly string[] = [],
  countRowFields: readonly string[] = []
): AdminReadError | null {
  const queryError = normalizeReadError(error, label);
  if (queryError) {
    return queryError;
  }

  if (!Array.isArray(data)) {
    return {
        message: `${label} returned an invalid response.`,
      };
  }

  const hasInvalidRow = data.some(
    (row) =>
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      requiredRowFields.some(
        (field) => !Object.prototype.hasOwnProperty.call(row, field)
      ) ||
      countRowFields.some((field) => {
        const value = (row as Record<string, unknown>)[field];
        const parsed =
          typeof value === "number" || typeof value === "string"
            ? Number(value)
            : Number.NaN;

        return !Number.isSafeInteger(parsed) || parsed < 0;
      })
  );

  return hasInvalidRow
    ? {
        message: `${label} returned incomplete data.`,
      }
    : null;
}

export function getAdminRecordReadError(
  data: unknown,
  error: unknown,
  label: string,
  collectionFields: readonly string[] = [],
  requiredFields: readonly string[] = [],
  countFields: readonly string[] = [],
  collectionRowRules: Readonly<Record<string, CollectionRowRule>> = {}
): AdminReadError | null {
  const queryError = normalizeReadError(error, label);
  if (queryError) {
    return queryError;
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      message: `${label} returned an invalid response.`,
    };
  }

  const record = data as Record<string, unknown>;
  const hasMissingField = requiredFields.some(
    (field) => !Object.prototype.hasOwnProperty.call(record, field)
  );
  const hasInvalidCollection = collectionFields.some(
    (field) =>
      !Object.prototype.hasOwnProperty.call(record, field) ||
      !Array.isArray(record[field])
  );
  const hasInvalidCount = countFields.some((field) => {
    const value = record[field];
    const parsed =
      typeof value === "number" || typeof value === "string"
        ? Number(value)
        : Number.NaN;

    return !Number.isSafeInteger(parsed) || parsed < 0;
  });
  const hasInvalidCollectionRow = Object.entries(collectionRowRules).some(
    ([field, rule]) => {
      const collection = record[field];
      if (collection === null) {
        return true;
      }

      if (!Array.isArray(collection)) {
        return true;
      }

      return collection.some((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          return true;
        }

        const rowRecord = row as Record<string, unknown>;
        const missingField = (rule.requiredFields ?? []).some(
          (requiredField) =>
            !Object.prototype.hasOwnProperty.call(rowRecord, requiredField)
        );
        const invalidCount = (rule.countFields ?? []).some((countField) => {
          const value = rowRecord[countField];
          const parsed =
            typeof value === "number" || typeof value === "string"
              ? Number(value)
              : Number.NaN;

          return !Number.isSafeInteger(parsed) || parsed < 0;
        });

        return missingField || invalidCount;
      });
    }
  );

  return (
    hasMissingField ||
    hasInvalidCollection ||
    hasInvalidCount ||
    hasInvalidCollectionRow
  )
    ? {
        message: `${label} returned incomplete data.`,
      }
    : null;
}

export function getAdminCountReadError(
  data: unknown,
  error: unknown,
  label: string
): AdminReadError | null {
  const queryError = normalizeReadError(error, label);
  if (queryError) {
    return queryError;
  }

  const parsed =
    typeof data === "number" || typeof data === "string"
      ? Number(data)
      : Number.NaN;

  return Number.isSafeInteger(parsed) && parsed >= 0
    ? null
    : {
        message: `${label} returned an invalid count.`,
      };
}

export function firstAdminReadError(
  ...errors: (AdminReadError | null)[]
): AdminReadError | null {
  return errors.find(Boolean) ?? null;
}
