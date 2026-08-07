"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  getSports,
  type Sport,
} from "@/services/sportService";

type SportPickerProps = {
  value: string;
  onChange: (sportId: string) => void;
  required?: boolean;
};

export default function SportPicker({
  value,
  onChange,
  required = false,
}: SportPickerProps) {
  const [sports, setSports] = useState<Sport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSports() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const result = await getSports();

        if (isMounted) {
          setSports(result);
        }
      } catch (error) {
        console.error(error);

        if (isMounted) {
          setErrorMessage(
            "Sports could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSports();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-gray-600">
        Sport
        {required && (
          <span className="ml-1 text-red-600">
            *
          </span>
        )}
      </span>

      <select
        value={value}
        required={required}
        disabled={isLoading}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:bg-gray-100"
      >
        <option value="">
          {isLoading
            ? "Loading sports..."
            : "Select sport"}
        </option>

        {sports.map((sport) => (
          <option
            key={sport.id}
            value={sport.id}
          >
            {sport.name}
          </option>
        ))}
      </select>

      {errorMessage && (
        <span className="text-sm text-red-600">
          {errorMessage}
        </span>
      )}
    </label>
  );
}
