import esbuild from "esbuild";
import { cpSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outdir = "dist";

mkdirSync(outdir, { recursive: true });

// Bundle JS entry points
await esbuild.build({
  entryPoints: {
    "background": "src/infra/background/background.ts",
    "content":    "src/presentation/content/main.ts",
    "popup":      "src/presentation/popup/popup.ts",
  },
  bundle: true,
  outdir,
  format: "iife",
  target: "chrome108",
  sourcemap: true,
  logLevel: "info",
});

// Copy static files
const staticFiles = [
  ["manifest.json",                               `${outdir}/manifest.json`],
  ["src/presentation/popup/popup.html",           `${outdir}/popup.html`],
  ["src/presentation/popup/popup.css",            `${outdir}/popup.css`],
];

for (const [src, dest] of staticFiles) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  console.log(`Copied ${src} ? ${dest}`);
}

// Copy asset images if they exist
try {
  cpSync("assets", `${outdir}/assets`, { recursive: true });
  console.log("Copied assets/");
} catch {
  // assets folder may not exist
}
