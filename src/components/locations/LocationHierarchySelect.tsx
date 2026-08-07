"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getLocationScope,
  sortLocations,
  type HierarchicalLocation,
} from "@/utils/location";

type LocationHierarchySelectProps = {
  locations: HierarchicalLocation[];
  value: string;
  onChange: (locationId: string) => void;
  name?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  required?: boolean;
  variant?: "form" | "filter";
};

const COUNTRY_SCOPE_VALUE =
  "__country__";
const CITY_SCOPE_VALUE =
  "__city__";

function getCountryCode(
  location: HierarchicalLocation
) {
  return (
    location.country_code?.trim() ||
    "TR"
  );
}

function getCountryName(
  location: HierarchicalLocation
) {
  return (
    location.country_name?.trim() ||
    "Türkiye"
  );
}

export default function LocationHierarchySelect({
  locations,
  value,
  onChange,
  name,
  allowEmpty = false,
  emptyLabel = "Select location",
  required = false,
  variant = "form",
}: LocationHierarchySelectProps) {
  const sortedLocations =
    useMemo(
      () =>
        sortLocations(
          locations
        ),
      [locations]
    );

  const selectedLocation =
    sortedLocations.find(
      (location) =>
        location.id === value
    ) ?? null;

  const initialCountryCode =
    selectedLocation
      ? getCountryCode(
          selectedLocation
        )
      : allowEmpty
        ? ""
        : getCountryCode(
            sortedLocations[0] ?? {
              id: "",
            }
          );

  const [countryCode, setCountryCode] =
    useState(initialCountryCode);

  const [cityName, setCityName] =
    useState(
      selectedLocation?.city ?? ""
    );

  useEffect(() => {
    if (!selectedLocation) {
      if (allowEmpty && !value) {
        setCountryCode("");
        setCityName("");
      }

      return;
    }

    setCountryCode(
      getCountryCode(
        selectedLocation
      )
    );
    setCityName(
      selectedLocation.city ?? ""
    );
  }, [
    allowEmpty,
    selectedLocation,
    value,
  ]);

  const countries =
    useMemo(() => {
      const countryMap =
        new Map<
          string,
          string
        >();

      sortedLocations.forEach(
        (location) => {
          countryMap.set(
            getCountryCode(
              location
            ),
            getCountryName(
              location
            )
          );
        }
      );

      return Array.from(
        countryMap.entries()
      ).sort((left, right) =>
        left[1].localeCompare(
          right[1],
          "tr"
        )
      );
    }, [sortedLocations]);

  const countryLocations =
    useMemo(
      () =>
        sortedLocations.filter(
          (location) =>
            getCountryCode(
              location
            ) === countryCode
        ),
      [
        countryCode,
        sortedLocations,
      ]
    );

  const countryScopeLocation =
    countryLocations.find(
      (location) =>
        getLocationScope(
          location
        ) === "country"
    ) ?? null;

  const cities =
    useMemo(
      () =>
        Array.from(
          new Set(
            countryLocations
              .map(
                (location) =>
                  location.city?.trim() ||
                  ""
              )
              .filter(Boolean)
          )
        ).sort((left, right) =>
          left.localeCompare(
            right,
            "tr"
          )
        ),
      [countryLocations]
    );

  const cityLocations =
    useMemo(
      () =>
        countryLocations.filter(
          (location) =>
            location.city ===
            cityName
        ),
      [
        cityName,
        countryLocations,
      ]
    );

  const cityScopeLocation =
    cityLocations.find(
      (location) =>
        getLocationScope(
          location
        ) === "city"
    ) ?? null;

  const districtLocations =
    cityLocations.filter(
      (location) =>
        getLocationScope(
          location
        ) === "district"
    );

  const citySelectValue =
    !countryCode
      ? ""
      : selectedLocation &&
          getLocationScope(
            selectedLocation
          ) === "country"
        ? COUNTRY_SCOPE_VALUE
        : cityName;

  const districtSelectValue =
    !cityName
      ? ""
      : selectedLocation &&
          getLocationScope(
            selectedLocation
          ) === "district"
        ? selectedLocation.id
        : CITY_SCOPE_VALUE;

  const fieldClass =
    variant === "filter"
      ? "mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500"
      : "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100";

  const gridClass =
    variant === "filter"
      ? "grid gap-2 sm:grid-cols-3"
      : "grid gap-3 md:grid-cols-3";

  function handleCountryChange(
    nextCountryCode: string
  ) {
    setCountryCode(
      nextCountryCode
    );
    setCityName("");

    if (!nextCountryCode) {
      onChange("");
      return;
    }

    const nextCountryLocation =
      sortedLocations.find(
        (location) =>
          getCountryCode(
            location
          ) ===
            nextCountryCode &&
          getLocationScope(
            location
          ) === "country"
      );

    onChange(
      nextCountryLocation?.id ??
        ""
    );
  }

  function handleCityChange(
    nextCityValue: string
  ) {
    if (
      nextCityValue ===
      COUNTRY_SCOPE_VALUE
    ) {
      setCityName("");
      onChange(
        countryScopeLocation?.id ??
          ""
      );
      return;
    }

    setCityName(nextCityValue);

    const nextCityLocation =
      countryLocations.find(
        (location) =>
          location.city ===
            nextCityValue &&
          getLocationScope(
            location
          ) === "city"
      );

    onChange(
      nextCityLocation?.id ??
        ""
    );
  }

  function handleDistrictChange(
    nextDistrictValue: string
  ) {
    if (
      nextDistrictValue ===
      CITY_SCOPE_VALUE
    ) {
      onChange(
        cityScopeLocation?.id ??
          ""
      );
      return;
    }

    onChange(nextDistrictValue);
  }

  return (
    <div className={gridClass}>
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
        />
      )}

      <label className="min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Country
        </span>

        <select
          value={countryCode}
          onChange={(event) =>
            handleCountryChange(
              event.target.value
            )
          }
          required={required}
          className={fieldClass}
        >
          {allowEmpty && (
            <option value="">
              {emptyLabel}
            </option>
          )}

          {countries.map(
            ([code, label]) => (
              <option
                key={code}
                value={code}
              >
                {label}
              </option>
            )
          )}
        </select>
      </label>

      <label className="min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          City
        </span>

        <select
          value={citySelectValue}
          onChange={(event) =>
            handleCityChange(
              event.target.value
            )
          }
          disabled={!countryCode}
          className={fieldClass}
        >
          <option
            value={COUNTRY_SCOPE_VALUE}
          >
            {countryScopeLocation
              ? `All ${getCountryName(
                  countryScopeLocation
                )}`
              : "All country"}
          </option>

          {cities.map((city) => (
            <option
              key={city}
              value={city}
            >
              {city}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          District
        </span>

        <select
          value={districtSelectValue}
          onChange={(event) =>
            handleDistrictChange(
              event.target.value
            )
          }
          disabled={!cityName}
          className={fieldClass}
        >
          <option
            value={CITY_SCOPE_VALUE}
          >
            {cityName
              ? `All ${cityName}`
              : "Select a city"}
          </option>

          {districtLocations.map(
            (location) => (
              <option
                key={location.id}
                value={location.id}
              >
                {location.district}
              </option>
            )
          )}
        </select>
      </label>
    </div>
  );
}
