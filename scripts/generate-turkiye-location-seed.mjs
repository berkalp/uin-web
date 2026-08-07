import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const PROVINCES_URL =
  "https://api.turkiyeapi.dev/v2/datasets/2025/provinces.json";
const DISTRICTS_URL =
  "https://api.turkiyeapi.dev/v2/datasets/2025/districts.json";

function unwrapDataset(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    payload &&
    Array.isArray(payload.data)
  ) {
    return payload.data;
  }

  throw new Error(
    "Unexpected TurkiyeAPI dataset shape."
  );
}

function sqlText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "null";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

async function loadJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "UIN-location-seed-generator/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Dataset download failed (${response.status}) for ${url}`
    );
  }

  return response.json();
}

const [provincePayload, districtPayload] =
  await Promise.all([
    loadJson(PROVINCES_URL),
    loadJson(DISTRICTS_URL),
  ]);

const provinces =
  unwrapDataset(provincePayload);
const districts =
  unwrapDataset(districtPayload);

if (provinces.length !== 81) {
  throw new Error(
    `Expected 81 provinces, received ${provinces.length}.`
  );
}

if (districts.length < 970) {
  throw new Error(
    `Expected roughly 973 districts, received ${districts.length}.`
  );
}

const provinceById =
  new Map(
    provinces.map((province) => [
      Number(province.id),
      String(province.name).trim(),
    ])
  );

const rows = [
  [
    "TR",
    "Türkiye",
    null,
    null,
    "country",
    "TR",
    null,
    null,
  ],
];

for (const province of provinces) {
  const provinceId = Number(province.id);
  const provinceName = String(province.name).trim();

  rows.push([
    "TR",
    "Türkiye",
    provinceName,
    null,
    "city",
    `TR:${provinceId}`,
    provinceId,
    null,
  ]);
}

for (const district of districts) {
  const provinceId = Number(district.provinceId);
  const provinceName =
    provinceById.get(provinceId);

  if (!provinceName) {
    throw new Error(
      `District ${district.id} refers to unknown province ${provinceId}.`
    );
  }

  rows.push([
    "TR",
    "Türkiye",
    provinceName,
    String(district.name).trim(),
    "district",
    `TR:${provinceId}:${district.id}`,
    provinceId,
    Number(district.id),
  ]);
}

const valuesSql = rows
  .map(
    ([
      countryCode,
      countryName,
      city,
      district,
      scope,
      sourceKey,
      provinceExternalId,
      externalId,
    ]) =>
      `  (${[
        countryCode,
        countryName,
        city,
        district,
        scope,
        sourceKey,
        provinceExternalId,
        externalId,
      ]
        .map(sqlText)
        .join(", ")})`
  )
  .join(",\n");

const sql = `begin;

insert into public.locations (
  country_code,
  country_name,
  city,
  district,
  scope,
  source_key,
  province_external_id,
  external_id
)
values
${valuesSql}
on conflict do nothing;

commit;
`;

const outputDirectory = path.resolve(
  "supabase/generated"
);
const outputFile = path.join(
  outputDirectory,
  "20260720183500_seed_turkiye_locations.sql"
);

await mkdir(outputDirectory, {
  recursive: true,
});
await writeFile(
  outputFile,
  sql,
  "utf8"
);

console.log(
  `Generated ${outputFile}`
);
console.log(
  `${provinces.length} provinces, ${districts.length} districts, ${rows.length} canonical location rows.`
);
