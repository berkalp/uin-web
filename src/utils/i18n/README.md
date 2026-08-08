# UIN i18n source catalogue

UIN currently uses two complementary translation layers:

1. **Explicit/database catalogue keys** for dynamic controlled vocabularies such as Activities, Sports, Communities and Seed Types.
2. **Static source manifest** for user-facing copy written in TS/TSX components.

## When UI copy changes

From the project root run:

```bash
node src/utils/i18n/generate-source-manifest.mjs
```

This regenerates:

- `generatedSourceManifest.ts`
- `generatedSourceManifestMeta.ts`

Deploy those generated files with the feature. Then open **Admin → Languages** and use **Sync source texts**. New copy becomes `missing`, changed copy becomes `outdated`, and obsolete `auto.*` entries are retired.

After the sync, use **Download missing + outdated** for the translation pass.

## What is intentionally excluded

Do not register free-form user content such as Intent notes, Seed titles, biographies, Planning Room messages or chat. Database catalogue vocabulary is registered by database triggers instead.

## Build integration

The recommended project-level build hook is:

```json
{
  "scripts": {
    "prebuild": "node src/utils/i18n/generate-source-manifest.mjs"
  }
}
```

Keep the existing `build` command unchanged. This hook belongs in the project root `package.json` and is not installed from the `src` overlay by itself.
