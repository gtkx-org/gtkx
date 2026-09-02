import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGirPath, runCodegen } from "../packages/codegen/src/index.ts";

type PackageManifest = { version?: string };

const REPOSITORY = "https://github.com/GNOME/gobject-introspection-tests.git";
const REVISION = "5987255086f59ca271a3a0aa53fbbb15b189be65";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "build", "native-tests");
const sourceDir = join(output, "gi-tests", "source");
const buildDir = join(output, "gi-tests", "build");
const storeDir = join(output, "node_modules", ".gtkx", "gi");
const linkDir = join(root, "packages", "e2e", "tests", "native", "node_modules", "@gtkx", "gi");
const require = createRequire(import.meta.url);
const runtimeManifest = JSON.parse(
    readFileSync(require.resolve("@gtkx/runtime/package.json"), "utf8"),
) as PackageManifest;
const git = resolveExecutable("git");
const meson = resolveExecutable("meson");

const checkedOutRevision = (): string | undefined => {
    if (!existsSync(join(sourceDir, ".git"))) {
        return undefined;
    }

    try {
        return execFileSync(git, ["-C", sourceDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
        return undefined;
    }
};

if (checkedOutRevision() !== REVISION) {
    rmSync(sourceDir, { recursive: true, force: true });
    mkdirSync(sourceDir, { recursive: true });
    execFileSync(git, ["init", "--quiet", sourceDir], { stdio: "inherit" });
    execFileSync(git, ["-C", sourceDir, "fetch", "--quiet", "--depth", "1", REPOSITORY, REVISION], {
        stdio: "inherit",
    });
    execFileSync(git, ["-C", sourceDir, "checkout", "--quiet", REVISION], { stdio: "inherit" });
}

if (!existsSync(join(buildDir, "build.ninja"))) {
    execFileSync(meson, ["setup", buildDir, sourceDir, "-Dcairo=false"], { stdio: "inherit" });
}

execFileSync(meson, ["compile", "-C", buildDir], {
    env: { ...process.env, GI_SCANNER_DISABLE_CACHE: "1" },
    stdio: "inherit",
});

await runCodegen({
    libraries: [
        "Regress-1.0",
        "RegressUnix-1.0",
        "GIMarshallingTests-1.0",
        "Utility-1.0",
        "WarnLib-1.0",
        "Gtk-4.0",
        "GioUnix-2.0",
    ],
    girPath: resolveGirPath([buildDir]),
    gi: { storeDir, linkDir, version: runtimeManifest.version ?? "0.0.0" },
});
