/*
 * UIN static UI source catalogue generator.
 *
 * Usage from the project root:
 *   node src/utils/i18n/generate-source-manifest.mjs
 *
 * The generated manifest is consumed only by Admin > Languages > Sync source texts.
 * It deliberately ignores routes, CSS classes, IDs and free-form user content.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(scriptDirectory, "../..");
const outputFile = path.join(scriptDirectory, "generatedSourceManifest.ts");
const metaFile = path.join(scriptDirectory, "generatedSourceManifestMeta.ts");

const extensions = new Set([".ts", ".tsx"]);
const skipFileName = /(?:\.bak(?:\.|$)|\.backup(?:\.|$)|\.old(?:\.|$)|\.fixed(?:\.|$))/i;
const explicitlySkippedFiles = new Set([
  "components/admin/LanguagesManager.tsx",
  "components/admin/LanguagePackageManager.tsx",
  "utils/i18n/generatedSourceManifest.ts",
  "utils/i18n/generatedSourceManifestMeta.ts",
]);

const translatableAttributes = new Set(["placeholder", "title", "aria-label", "alt"]);
const userFacingProps = new Set([
  "label",
  "title",
  "description",
  "message",
  "placeholder",
  "helperText",
  "emptyText",
  "caption",
  "heading",
  "subtitle",
  "subheading",
  "hint",
  "notice",
  "warning",
  "errorText",
  "successText",
]);
const userFacingCalls = new Set([
  "alert",
  "confirm",
  "setMessage",
  "setError",
  "setNotice",
  "setSuccess",
  "setStatusMessage",
  "onMessage",
  "toast",
]);
const formatterFunctionPattern = /(?:format|label|title|description|message|text|caption|heading|status|role|visibility|recurrence|preference|condition|empty|summary)/i;

function listFiles(directory) {
  const result = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      result.push(...listFiles(absolutePath));
      continue;
    }

    const relativePath = path.relative(sourceRoot, absolutePath).replaceAll("\\", "/");
    if (
      extensions.has(path.extname(entry.name)) &&
      !skipFileName.test(entry.name) &&
      !explicitlySkippedFiles.has(relativePath)
    ) {
      result.push(absolutePath);
    }
  }

  return result;
}

function normalizeText(value) {
  return value.replaceAll("&apos;", "'").replace(/\s+/g, " ").trim();
}

function looksLikeInterfaceText(value) {
  const text = normalizeText(value);

  if (!text || text.length < 2 || text.length > 900) return false;
  if (/^https?:\/\//i.test(text) || /^\//.test(text) || /^(?:mailto|tel):/i.test(text)) return false;
  if (/^[\d\s\-_.:/@#?=&%+*\\|~`$^<>\[\]{}()]+$/.test(text)) return false;
  if (/\.(?:tsx?|jsx?|json|png|jpe?g|webp|svg|pdf|sql|md)$/i.test(text)) return false;
  if (/^[A-Za-z]+\/[A-Za-z_]+$/.test(text)) return false; // MIME/timezone-like values.

  // Tailwind/CSS utility runs are implementation detail, not language.
  if (
    /^(?:bg|text|border|hover|focus|sm|md|lg|xl|2xl|flex|grid|items|justify|gap|p-|px-|py-|m-|mt-|mb-|ml-|mr-|w-|h-|min-|max-|rounded|shadow|overflow|absolute|relative|fixed|sticky|inset|top|left|right|bottom|z-|opacity|transition|duration|cursor|font|leading|tracking|space|divide|ring|outline|col-|row-|object|whitespace|break|select|pointer|backdrop)[-:\w/.\[\]% ]+$/i.test(text)
  ) {
    return false;
  }

  // Single technical identifiers are skipped. Common one-word interface labels are kept.
  if (/^[a-z0-9_-]+$/i.test(text) && !/\s/.test(text)) {
    const commonLabels = /^(?:open|close|save|view|edit|delete|cancel|create|update|active|inactive|required|optional|default|none|search|filter|apply|remove|archive|archived|completed|cancelled|expired|pending|loading|next|previous|back|continue|retry|send|message|messages|profile|timeline|discover|seeds|friends|communities|matches|people|host|participant|participants|owner|moderator|support|member|read|watch|listen|visit|try|learn|play|make|explore|practice|all|now|upcoming|future)$/i;
    if (!commonLabels.test(text)) return false;
  }

  return /[A-Za-zÀ-ž]/.test(text);
}

function namespaceFor(relativePath) {
  const value = relativePath.replaceAll("\\", "/");

  if (value.startsWith("app/admin/")) {
    const segment = value.split("/")[2] || "components";
    return `admin.${segment.replace(/[\[\]]/g, "")}`;
  }
  if (value.startsWith("components/admin/")) return "admin.components";

  const mappings = [
    ["app/timeline/", "timeline"], ["components/timeline/", "timeline"],
    ["app/seeds/", "seeds"], ["components/seeds/", "seeds"],
    ["app/discover/", "discover"], ["components/discover/", "discover"],
    ["app/activities/", "activity"], ["components/activities/", "activity"],
    ["app/plans/", "plan"], ["components/plans/", "plan"], ["components/experiences/", "plan"],
    ["app/settings/", "profile"], ["app/u/", "profile"], ["components/profile/", "profile"],
    ["app/communities/", "community"], ["components/communities/", "community"],
    ["components/onboarding/", "intent"], ["app/onboarding/", "intent"],
    ["app/intents/", "intent"], ["components/intents/", "intent"],
    ["app/messages/", "messages"], ["components/messages/", "messages"],
    ["app/friends/", "friends"], ["components/friends/", "friends"],
    ["app/notifications/", "notification"], ["components/notifications/", "notification"],
    ["components/reputation/", "reputation"], ["app/reputation/", "reputation"],
  ];

  for (const [prefix, namespace] of mappings) {
    if (value.startsWith(prefix)) return namespace;
  }

  const parts = value.split("/");
  if (parts[0] === "app") return (parts[1] || "common").replace(/[\[\]]/g, "");
  if (parts[0] === "components") return parts[1] || "common";
  return "common";
}

function slug(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "text";
}

function shortHash(value) {
  return crypto.createHash("sha1").update(normalizeText(value)).digest("hex").slice(0, 10);
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function enclosingFunctionName(node) {
  let current = node;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current)
    ) {
      if (current.name && ts.isIdentifier(current.name)) return current.name.text;
      if (current.parent && ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) {
        return current.parent.name.text;
      }
      if (current.parent && ts.isPropertyAssignment(current.parent)) return current.parent.name.getText();
      return "";
    }
    current = current.parent;
  }
  return "";
}

function nearestJsxAttribute(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxAttribute(current)) return current;
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current) || ts.isJsxFragment(current)) return null;
    current = current.parent;
  }
  return null;
}

function isJsxChildExpression(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxExpression(current)) return !current.parent || !ts.isJsxAttribute(current.parent);
    if (ts.isJsxAttribute(current)) return false;
    if (ts.isJsxElement(current) || ts.isJsxFragment(current)) return true;
    current = current.parent;
  }
  return false;
}

function objectPropertyName(node) {
  const parent = node.parent;
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
    return parent.name.getText().replace(/^['"]|['"]$/g, "");
  }
  return null;
}

function enclosingCallName(node) {
  const parent = node.parent;
  if (!ts.isCallExpression(parent) || !parent.arguments.includes(node)) return null;
  if (ts.isIdentifier(parent.expression)) return parent.expression.text;
  if (ts.isPropertyAccessExpression(parent.expression)) return parent.expression.name.text;
  return null;
}

const manifest = new Map();

function addCandidate(sourceFile, relativePath, node, rawText, detectionKind) {
  const defaultText = normalizeText(rawText);
  if (!looksLikeInterfaceText(defaultText)) return;

  const namespace = namespaceFor(relativePath);
  const key = `auto.${namespace}.${slug(defaultText)}.${shortHash(defaultText)}`;
  const location = `${relativePath}:${lineOf(sourceFile, node)}`;
  const identity = `${key}\u0000${defaultText}`;
  const existing = manifest.get(identity);

  if (existing) {
    if (existing.locations.length < 8 && !existing.locations.includes(location)) existing.locations.push(location);
    return;
  }

  manifest.set(identity, {
    key,
    namespace,
    default_text: defaultText,
    description: `AUTO-SOURCE: ${detectionKind} · ${location}`,
    locations: [location],
  });
}

for (const absolutePath of listFiles(sourceRoot)) {
  const relativePath = path.relative(sourceRoot, absolutePath).replaceAll("\\", "/");
  const sourceText = fs.readFileSync(absolutePath, "utf8");
  const sourceFile = ts.createSourceFile(
    absolutePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    absolutePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function visit(node) {
    if (ts.isJsxText(node)) addCandidate(sourceFile, relativePath, node, node.getText(sourceFile), "visible JSX text");

    if (ts.isJsxAttribute(node) && node.initializer) {
      const attributeName = node.name.getText(sourceFile);
      if (translatableAttributes.has(attributeName) && ts.isStringLiteral(node.initializer)) {
        addCandidate(sourceFile, relativePath, node, node.initializer.text, `${attributeName} attribute`);
      }
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const attribute = nearestJsxAttribute(node);

      if (attribute) {
        const attributeName = attribute.name.getText(sourceFile);
        if (translatableAttributes.has(attributeName) || userFacingProps.has(attributeName)) {
          addCandidate(sourceFile, relativePath, node, node.text, `${attributeName} prop`);
        }
      } else if (isJsxChildExpression(node)) {
        addCandidate(sourceFile, relativePath, node, node.text, "visible JSX expression");
      } else {
        const propertyName = objectPropertyName(node);
        const callName = enclosingCallName(node);
        const functionName = enclosingFunctionName(node);

        if (propertyName && userFacingProps.has(propertyName)) {
          addCandidate(sourceFile, relativePath, node, node.text, `${propertyName} object field`);
        } else if (callName && userFacingCalls.has(callName)) {
          addCandidate(sourceFile, relativePath, node, node.text, `${callName} message`);
        } else if (ts.isReturnStatement(node.parent) && formatterFunctionPattern.test(functionName)) {
          addCandidate(sourceFile, relativePath, node, node.text, `${functionName} formatter result`);
        }
      }
    }

    if (ts.isTemplateExpression(node)) {
      const pieces = [node.head.text];
      let placeholderIndex = 1;
      for (const span of node.templateSpans) {
        pieces.push(`{${placeholderIndex++}}`, span.literal.text);
      }
      const templateText = pieces.join("");
      const attribute = nearestJsxAttribute(node);

      if (attribute) {
        const attributeName = attribute.name.getText(sourceFile);
        if (translatableAttributes.has(attributeName) || userFacingProps.has(attributeName)) {
          addCandidate(sourceFile, relativePath, node, templateText, `${attributeName} template`);
        }
      } else if (isJsxChildExpression(node)) {
        addCandidate(sourceFile, relativePath, node, templateText, "visible JSX template");
      } else {
        const propertyName = objectPropertyName(node);
        const callName = enclosingCallName(node);
        if (propertyName && userFacingProps.has(propertyName)) {
          addCandidate(sourceFile, relativePath, node, templateText, `${propertyName} object template`);
        } else if (callName && userFacingCalls.has(callName)) {
          addCandidate(sourceFile, relativePath, node, templateText, `${callName} message template`);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const entries = Array.from(manifest.values())
  .map(({ locations: _locations, ...entry }) => entry)
  .sort((left, right) =>
    left.namespace.localeCompare(right.namespace) || left.default_text.localeCompare(right.default_text)
  );

const output = `/* eslint-disable */\n/*\n * AUTO-GENERATED by generate-source-manifest.mjs.\n * Do not hand-edit. Regenerate when user-facing source copy changes.\n */\n\nexport type AppSourceManifestEntry = {\n  key: string;\n  namespace: string;\n  default_text: string;\n  description: string;\n};\n\nexport const APP_SOURCE_MANIFEST: readonly AppSourceManifestEntry[] = ${JSON.stringify(entries, null, 2)};\n\nexport const APP_SOURCE_MANIFEST_COUNT = APP_SOURCE_MANIFEST.length;\n`;

fs.writeFileSync(outputFile, output, "utf8");
fs.writeFileSync(
  metaFile,
  `/* AUTO-GENERATED by generate-source-manifest.mjs. */\nexport const APP_SOURCE_MANIFEST_COUNT = ${entries.length};\n`,
  "utf8"
);
console.log(`UIN i18n source manifest: ${entries.length} static interface strings -> ${path.relative(process.cwd(), outputFile)}`);
