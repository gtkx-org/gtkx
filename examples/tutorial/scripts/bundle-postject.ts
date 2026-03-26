import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const vendorDir = join(__dirname, "..", "vendor");

const postjectMain = require.resolve("postject");
const postjectCli = join(dirname(postjectMain), "cli.js");

await mkdir(vendorDir, { recursive: true });

await esbuild.build({
    entryPoints: [postjectCli],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: join(vendorDir, "postject.cjs"),
});
