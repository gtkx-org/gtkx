import runtimeManifest from "@gtkx/runtime/package.json" with { type: "json" };
import { join } from "node:path";
import { resolveGirPath, runCodegen } from "../../../codegen/src/index.js";

const root = join(import.meta.dirname, "../../../..");
const output = join(root, "build", "native-tests");
const buildDir = join(output, "gi-tests", "build");
const storeDir = join(output, "node_modules", ".gtkx", "gi");
const linkDir = join(root, "packages", "e2e", "tests", "native", "node_modules", "@gtkx", "gi");
await runCodegen({
    libraries: ["Regress-1.0", "GIMarshallingTests-1.0"],
    girPath: resolveGirPath([buildDir]),
    gi: { storeDir, linkDir, version: runtimeManifest.version },
});
