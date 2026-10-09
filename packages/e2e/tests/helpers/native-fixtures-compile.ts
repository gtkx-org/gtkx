import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const REPOSITORY = "https://github.com/GNOME/gobject-introspection-tests.git";
const REVISION = "5987255086f59ca271a3a0aa53fbbb15b189be65";
const output = join(import.meta.dirname, "../../../../build/native-tests/gi-tests");
const sourceDir = join(output, "source");
const buildDir = join(output, "build");
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

rmSync(buildDir, { recursive: true, force: true });
execFileSync(meson, ["setup", buildDir, sourceDir, "-Dcairo=false"], { stdio: "inherit" });
execFileSync(meson, ["compile", "-C", buildDir], {
    env: { ...process.env, GI_SCANNER_DISABLE_CACHE: "1" },
    stdio: "inherit",
});
