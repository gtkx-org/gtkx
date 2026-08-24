import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type Lockfile = { packages: Record<string, { resolved?: string }> };

const SCRIPT_PATH = fileURLToPath(
    new URL("../../../scripts/normalize-package-lock-registry.ts", import.meta.url),
);

const SOURCE = "http://localhost:4873/";
const DESTINATION = "https://registry.npmjs.org/";
const roots: string[] = [];

const createLockfile = (packages: Lockfile["packages"]): string => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-package-lock-"));
    const path = join(root, "package-lock.json");
    roots.push(root);
    writeFileSync(path, JSON.stringify({ lockfileVersion: 3, packages }));

    return path;
};

const normalize = (path: string, source = SOURCE): void => {
    execFileSync(resolveExecutable("tsx"), [SCRIPT_PATH, path, source, DESTINATION], {
        stdio: "pipe",
    });
};

const readLockfile = (path: string): Lockfile =>
    JSON.parse(readFileSync(path, "utf8")) as Lockfile;

afterEach(() => {
    for (const root of roots) {
        rmSync(root, { recursive: true, force: true });
    }

    roots.length = 0;
});

describe("package lock registry normalization", () => {
    it("makes local-registry tarballs installable from the public registry", () => {
        const path = createLockfile({
            "": {},
            "node_modules/@gtkx/react": {
                resolved: "http://localhost:4873/@gtkx/react/-/react-1.4.0.tgz",
            },
        });

        normalize(path);

        expect(readLockfile(path).packages["node_modules/@gtkx/react"]?.resolved).toBe(
            "https://registry.npmjs.org/@gtkx/react/-/react-1.4.0.tgz",
        );
    });

    it("leaves tarballs outside the configured registry path unchanged", () => {
        const external = "https://example.com/pkg.tgz";
        const siblingPath = "http://localhost:4873/other/pkg.tgz";

        const path = createLockfile({
            "": {},
            "node_modules/external": { resolved: external },
            "node_modules/sibling": { resolved: siblingPath },
        });

        normalize(path, "http://localhost:4873/npm/");

        expect(readLockfile(path).packages).toMatchObject({
            "node_modules/external": { resolved: external },
            "node_modules/sibling": { resolved: siblingPath },
        });
    });

    it("throws for a malformed package lock", () => {
        const path = createLockfile({});
        writeFileSync(path, "not JSON");

        expect(() => {
            normalize(path);
        }).toThrow();
    });
});

describe("package lock registry replacement", () => {
    it("does not follow a predictable temporary symlink", () => {
        const path = createLockfile({
            "node_modules/@gtkx/react": {
                resolved: "http://localhost:4873/@gtkx/react/-/react-1.4.0.tgz",
            },
        });

        const victim = join(dirname(path), "victim.json");
        const contents = "unrelated\n";
        writeFileSync(victim, contents);

        const command = [
            'temporary_path="$1.$$.tmp"',
            'ln -s "$2" "$temporary_path"',
            'exec "$3" "$4" "$1" "$5" "$6"',
        ].join("\n");

        execFileSync(
            resolveExecutable("bash"),
            [
                "-c",
                command,
                "normalize-package-lock",
                path,
                victim,
                resolveExecutable("tsx"),
                SCRIPT_PATH,
                SOURCE,
                DESTINATION,
            ],
            { stdio: "pipe" },
        );

        expect(readFileSync(victim, "utf8")).toBe(contents);
        expect(lstatSync(path).isSymbolicLink()).toBe(false);

        expect(readLockfile(path).packages["node_modules/@gtkx/react"]?.resolved).toBe(
            "https://registry.npmjs.org/@gtkx/react/-/react-1.4.0.tgz",
        );
    });
});
