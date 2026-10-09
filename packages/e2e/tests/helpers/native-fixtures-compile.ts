import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPOSITORY = "https://github.com/GNOME/gobject-introspection-tests.git";
const REVISION = "5987255086f59ca271a3a0aa53fbbb15b189be65";
const output = join(import.meta.dirname, "../../../../build/native-tests/gi-tests");
const sourceDir = join(output, "source");
const buildDir = join(output, "build");
const git = resolveExecutable("git");
const meson = resolveExecutable("meson");
const sanitizer = execFileSync(resolveExecutable("gcc"), ["-print-file-name=libasan.so.8"], {
    encoding: "utf8",
}).trim();

if (sanitizer === "libasan.so.8") {
    throw new Error("The AddressSanitizer runtime is required to build native test fixtures");
}

const buildEnvironment = {
    ...process.env,
    LD_PRELOAD: sanitizer,
    ASAN_OPTIONS: "detect_leaks=0:verify_asan_link_order=0",
    GI_SCANNER_DISABLE_CACHE: "1",
};

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
execFileSync(meson, ["setup", buildDir, sourceDir, "-Dcairo=true", "-Db_sanitize=address"], {
    env: buildEnvironment,
    stdio: "inherit",
});
execFileSync(meson, ["compile", "-C", buildDir], {
    env: buildEnvironment,
    stdio: "inherit",
});

/** The scanner can record the preloaded sanitizer ahead of the actual API library. */
for (const filename of readdirSync(buildDir).filter((name) => name.endsWith(".gir"))) {
    const path = join(buildDir, filename);
    const source = readFileSync(path, "utf8");
    const normalized = source.replace(/shared-library="([^"]+)"/g, (_attribute, libraries: string) => {
        const apiLibraries = libraries.split(",").filter((library) => !/^libasan\./.test(library));

        return `shared-library="${apiLibraries.join(",")}"`;
    });
    writeFileSync(path, normalized);
    execFileSync(
        resolveExecutable("g-ir-compiler"),
        ["--includedir", buildDir, path, "-o", path.replace(/\.gir$/, ".typelib")],
        {
            env: buildEnvironment,
            stdio: "inherit",
        },
    );
}
