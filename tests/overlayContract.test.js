import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cssPath = path.join(__dirname, "..", "styles.css");

test("overlay hidden contract exists in styles", () => {
  const css = fs.readFileSync(cssPath, "utf8");
  assert.match(css, /\.overlay\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/);
});
