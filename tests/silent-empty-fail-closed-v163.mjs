import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("sport activity fixture read failures hide empty and creation states", () => {
  const activity = source("src/app/activities/[resourceId]/page.tsx");

  assert.match(
    activity,
    /const sportFixturesReadFailed=Boolean\([\s\S]*sportFixturesResult\.error\|\|[\s\S]*!Array\.isArray\(sportFixturesResult\.data\)\|\|[\s\S]*!sportFixturesResult\.data\.every\(isSportFixtureOption\)/,
  );
  assert.match(
    activity,
    /isLiveSportActivity\?\(sportFixturesReadFailed\?<section role="alert"[\s\S]*Fikstür yüklenemedi[\s\S]*Yeniden dene[\s\S]*:<SportActivityPlanningHero/,
  );
});

test("weather alert RPC failures return a retryable non-200 response", () => {
  const weather = source("src/app/api/weather/plans/[planId]/route.ts");

  assert.match(
    weather,
    /const \{ data, error \} = await supabase\.rpc\("get_plan_weather_alerts"[\s\S]*if \(error\) throw error/,
  );
  assert.match(weather, /if \(!Array\.isArray\(data\)\) throw new Error/);
  assert.match(weather, /if \(alerts\.some\(\(item\) => item === null\)\)[\s\S]*throw new Error/);
  assert.match(
    weather,
    /try \{[\s\S]*base\.alerts = await loadWeatherAlerts[\s\S]*catch \(error\)[\s\S]*status: 503[\s\S]*private, no-store/,
  );
  assert.doesNotMatch(weather, /Array\.isArray\(data\) \? data : \[\]/);
});
