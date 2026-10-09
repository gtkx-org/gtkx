import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { resolveGirPath, runCodegen } from "../../../codegen/src/index.js";

type PackageManifest = { version?: string };

const root = join(import.meta.dirname, "../../../..");
const output = join(root, "build", "native-tests");
const buildDir = join(output, "gi-tests", "build");
const storeDir = join(output, "node_modules", ".gtkx", "gi");
const linkDir = join(root, "packages", "e2e", "tests", "native", "node_modules", "@gtkx", "gi");
const require = createRequire(import.meta.url);
const runtimeManifest = JSON.parse(
    readFileSync(require.resolve("@gtkx/runtime/package.json"), "utf8"),
) as PackageManifest;
await runCodegen({
    libraries: ["Regress-1.0", "GIMarshallingTests-1.0"],
    girPath: resolveGirPath([buildDir]),
    gi: { storeDir, linkDir, version: runtimeManifest.version ?? "0.0.0" },
});
