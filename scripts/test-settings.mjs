#!/usr/bin/env node
// Lightweight unit checks for settings match-pattern helpers (no browser APIs).
// Run: node scripts/test-settings.mjs

import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const settingsPath = join(__dirname, "..", "src", "extension", "settings.js");
// Browser extension scripts expect a browser-like global object; provide the
// constructors settings.js uses (URL / RegExp / etc.) inside the vm sandbox.
const sandbox = {
  console,
  URL,
  RegExp,
  String,
  Boolean,
  Array,
  Object,
  Math,
  Number,
  JSON,
  Error,
  Promise,
  Date,
  Map,
  Set,
};
const context = createContext(sandbox);
runInContext(readFileSync(settingsPath, "utf8"), context);
const TTPSettings = sandbox.TTPSettings;
if (!TTPSettings) {
  console.error("FAIL: TTPSettings not exported");
  process.exit(1);
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

// urlMatchesPattern — *.apex and ports
assert(
  TTPSettings.urlMatchesPattern("https://example.com/", "*://*.example.com/*"),
  "*.example.com matches apex",
);
assert(
  TTPSettings.urlMatchesPattern("https://www.example.com/x", "*://*.example.com/*"),
  "*.example.com matches subdomain",
);
assert(
  TTPSettings.urlMatchesPattern("https://a.b.example.com/x", "*://*.example.com/*"),
  "*.example.com matches nested subdomain",
);
assert(
  !TTPSettings.urlMatchesPattern("https://notexample.com/", "*://*.example.com/*"),
  "*.example.com does not match suffix host",
);
assert(
  TTPSettings.urlMatchesPattern("https://example.com:8080/foo", "https://example.com/*"),
  "port does not break host match",
);
assert(
  TTPSettings.urlMatchesPattern("https://github.com/org/repo", "https://github.com/*"),
  "github path wildcard",
);
assert(
  !TTPSettings.urlMatchesPattern("http://example.com/x", "https://example.com/*"),
  "scheme mismatch",
);
assert(
  TTPSettings.urlMatchesPattern("http://example.com/x", "*://example.com/*"),
  "scheme * matches http",
);

// validation
assert(TTPSettings.validateMatchPattern("https://github.com/*"), "valid pattern");
assert(!TTPSettings.validateMatchPattern("https://foo*bar.com/*"), "mid-host star invalid");
assert(!TTPSettings.validateMatchPattern("https://*.*.example.com/*"), "double star host invalid");
assert(TTPSettings.getMatchPatternError("") === "empty", "empty error");

// v1 migration
const migrated = TTPSettings.normalizeSettings({ enabled: true, format: "[{name}] " });
assert(migrated.schemaVersion === 2, "migrate schemaVersion");
assert(migrated.containerRule.template === "[{container}] ", "migrate {name} → {container}");
assert(Array.isArray(migrated.urlRules) && migrated.urlRules.length === 0, "migrate clears urlRules");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed.");
