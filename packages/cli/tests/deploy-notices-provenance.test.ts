import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const DEPENDENCY_NAME = "@audit/notices";
const BINARY_NAME = "gtkx-notices-audit";
const ORIGINAL_TERMS = "Original dependency license terms.";
const REPLACEMENT_TERMS = "Replacement dependency license terms.";
const CONFIG = `export default {
    applicationId: "org.gtkx.noticesaudit",
    applicationIcon: "application.svg",
    codegen: false,
    deploy: {
        name: "Notices Audit",
        binaryName: "${BINARY_NAME}",
        developer: { name: "GTKX" },
        summary: "Exercises bundled dependency notices",
        description: ["An integration application for bundled dependency license metadata."],
        categories: ["Utility"],
        license: "MPL-2.0",
        metadataLicense: "CC0-1.0",
        node: { source: "host" },
    },
};\n`;

const files = (license = "MIT", licenseFile = "LICENSE"): Record<string, string> => ({
    "application.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>\n',
    "src/index.ts": `import { message } from "${DEPENDENCY_NAME}"; process.stdout.write(message);\n`,
    [`node_modules/${DEPENDENCY_NAME}/package.json`]: JSON.stringify({
        name: DEPENDENCY_NAME,
        version: "1.0.0",
        type: "module",
        exports: "./index.js",
        license,
        repository: "https://github.com/example/original.git",
    }),
    [`node_modules/${DEPENDENCY_NAME}/index.js`]: 'export const message = "original dependency";\n',
    [`node_modules/${DEPENDENCY_NAME}/${licenseFile}`]: ORIGINAL_TERMS,
});

const copyright = (root: string): string => readFileSync(
    join(root, "build", process.arch, "overlay", "deb", "share", "doc", BINARY_NAME, "copyright"),
    "utf8",
);

const deploy = (project: Parameters<typeof runCliOrThrow>[0], shouldSkipBuild = false): string => {
    runCliOrThrow(project, [
        "deploy",
        "--print-manifests",
        "--target",
        "deb",
        ...(shouldSkipBuild ? ["--skip-build"] : []),
    ]);

    return copyright(project.root);
};

describe("bundled dependency notice provenance", () => {
    it("retains the built dependency's terms after an installed dependency is replaced", () => {
        using project = createCliProject({
            prefix: "gtkx-notices-upgraded-",
            config: CONFIG,
            files: files(),
            hasStore: true,
        });
        runCliOrThrow(project, ["build"]);
        const bundlePath = join(project.root, "dist/bundle.mjs");
        const bundle = readFileSync(bundlePath, "utf8");
        const dependency = join(project.nodeModules, DEPENDENCY_NAME);
        writeFileSync(join(dependency, "package.json"), JSON.stringify({
            name: DEPENDENCY_NAME,
            version: "2.0.0",
            type: "module",
            exports: "./index.js",
            license: "ISC",
            repository: "https://github.com/example/replacement.git",
        }));
        writeFileSync(join(dependency, "index.js"), 'export const message = "replacement dependency";\n');
        writeFileSync(join(dependency, "LICENSE"), REPLACEMENT_TERMS);
        const notice = deploy(project, true);
        expect(readFileSync(bundlePath, "utf8")).toBe(bundle);
        expect(notice).toContain(`${DEPENDENCY_NAME} 1.0.0`);
        expect(notice).toContain(ORIGINAL_TERMS);
        expect(notice).not.toContain(REPLACEMENT_TERMS);
        expect(notice).toContain("Source: https://github.com/example/original");
        expect(notice).not.toContain("https://github.com/example/replacement");
    });

    it.each([
        ["MIT", "LICENSE"],
        ["SEE LICENSE IN terms.txt", "terms.txt"],
        ["SEE LICENSE IN copyright terms.txt", "copyright terms.txt"],
        ["SEE LICENSE IN LICENSE", "LICENSE"],
    ])("carries package terms declared with %s", (license, licenseFile) => {
        using project = createCliProject({
            prefix: "gtkx-notices-explicit-",
            config: CONFIG,
            files: files(license, licenseFile),
            hasStore: true,
        });
        expect(deploy(project).split(ORIGINAL_TERMS)).toHaveLength(2);
    });

    it("retains the terms after the bundled package is removed from the install tree", () => {
        using project = createCliProject({
            prefix: "gtkx-notices-removed-",
            config: CONFIG,
            files: files(),
            hasStore: true,
        });
        runCliOrThrow(project, ["build"]);
        rmSync(join(project.nodeModules, DEPENDENCY_NAME), { recursive: true });
        const notice = deploy(project, true);
        expect(notice).toContain(`${DEPENDENCY_NAME} 1.0.0`);
        expect(notice).toContain(ORIGINAL_TERMS);
    });

    it("combines an explicit custom license with the package's notice file", () => {
        const extraTerms = "Additional package notice terms.";
        using project = createCliProject({
            prefix: "gtkx-notices-additional-",
            config: CONFIG,
            files: {
                ...files("SEE LICENSE IN terms.txt", "terms.txt"),
                [`node_modules/${DEPENDENCY_NAME}/NOTICE`]: extraTerms,
            },
            hasStore: true,
        });
        const notice = deploy(project);
        expect(notice).toContain(ORIGINAL_TERMS);
        expect(notice).toContain(extraTerms);
    });

    it.each([
        { formatVersion: 2 },
        {
            packages: [{
                name: DEPENDENCY_NAME, version: "1.0.0", license: null, source: null, copyright: [], text: 42,
            }],
        },
        {
            packages: [{
                name: DEPENDENCY_NAME, version: "1.0.0", license: null, source: null, copyright: [42], text: null,
            }],
        },
    ])("rejects unsupported or malformed build metadata", (replacement) => {
        using project = createCliProject({
            prefix: "gtkx-notices-invalid-",
            config: CONFIG,
            files: files(),
            hasStore: true,
        });
        runCliOrThrow(project, ["build"]);
        const metadataPath = join(project.root, "dist/gtkx-schemas.json");
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
        writeFileSync(metadataPath, JSON.stringify({ ...metadata, ...replacement }));
        expect(() => deploy(project, true)).toThrow();
    });
});
