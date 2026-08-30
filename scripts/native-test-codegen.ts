import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../gtkx.config.base.ts";
import { resolveGirPath, runCodegen } from "../packages/codegen/src/index.ts";
import { writeDescriptorInventory } from "./descriptor-inventory.ts";

type PackageManifest = { version?: string };

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join(root, "packages", "native", "fixtures", "lifecycle");
const output = join(root, "build", "native-tests", "lifecycle");
const mesonBuild = join(output, "meson");
const nodeModules = join(output, "node_modules");
const storeDir = join(nodeModules, ".gtkx", "gi");
const linkDir = join(root, "packages", "native", "node_modules", "@gtkx", "gi");
const require = createRequire(import.meta.url);
const runtimeManifest = JSON.parse(
    readFileSync(require.resolve("@gtkx/runtime/package.json"), "utf8"),
) as PackageManifest;
const runtimeVersion = runtimeManifest.version ?? "0.0.0";
const meson = resolveExecutable("meson");
const projectLibraries = ["Gtk-4.0", "Adw-1", ...config.libraries];

mkdirSync(output, { recursive: true });
execFileSync(meson, ["setup", mesonBuild, fixture], { cwd: root, stdio: "inherit" });
execFileSync(meson, ["compile", "-C", mesonBuild], { cwd: root, stdio: "inherit" });
const girPath = resolveGirPath([mesonBuild]);

await runCodegen({
    libraries: ["GtkxLifecycle-1.0", ...projectLibraries],
    girPath,
    gi: { storeDir, linkDir, version: runtimeVersion },
    isForced: true,
});

writeDescriptorInventory({
    root,
    giStore: storeDir,
    output: join(output, "descriptors.json"),
});
