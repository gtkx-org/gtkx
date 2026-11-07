import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempDisposableSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

const ROOT = join(import.meta.dirname, "..");

test("runtime hash covers GIR files under the introspection libdir", () => {
    using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-environment-hash-"));
    const pkgConfigPath = join(directory.path, "pkgconfig");
    const libdir = join(directory.path, "lib");
    const gir = join(libdir, "gir-1.0", "Example-1.0.gir");
    mkdirSync(pkgConfigPath);
    mkdirSync(join(libdir, "gir-1.0"), { recursive: true });
    writeFileSync(
        join(pkgConfigPath, "gobject-introspection-1.0.pc"),
        `libdir=${libdir}\ngirdir=${join(directory.path, "share", "gir-1.0")}\n\nName: gobject-introspection\nDescription: Fixture\nVersion: 1.0\n`,
    );
    writeFileSync(gir, '<repository version="1.2"/>\n');

    const computeHash = (): string =>
        execFileSync(process.execPath, ["scripts/compute-environment-hash.ts", "runtime"], {
            cwd: ROOT,
            encoding: "utf8",
            env: { ...process.env, PKG_CONFIG_PATH: pkgConfigPath },
        });

    const initial = computeHash();
    expect(computeHash()).toBe(initial);

    writeFileSync(gir, '<repository version="1.2"><namespace name="Example"/></repository>\n');
    expect(computeHash()).not.toBe(initial);
});
