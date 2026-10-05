import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli, runCliOrThrow } from "./cli-project.js";

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
        ["SEE LICENSE IN licenses/terms.txt", "licenses/terms.txt"],
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

const licenseField = (notice: string, files: string): string | undefined =>
    notice.split(`Files: ${files}\n`)[1]?.split("\nLicense: ", 2)[1]?.split("\n", 1)[0];

const EXPRESSIONS = [
    { expression: "MIT", expected: "MIT" },
    { expression: "MIT AND Apache-2.0", expected: "MIT and Apache-2.0" },
    { expression: "MIT OR Apache-2.0", expected: "MIT or Apache-2.0" },
    {
        expression: "(MIT OR Apache-2.0) AND BSD-3-Clause",
        expected: "MIT or Apache-2.0, and BSD-3-Clause",
    },
    {
        expression: "MIT AND (Apache-2.0 OR BSD-3-Clause)",
        expected: "MIT, and Apache-2.0 or BSD-3-Clause",
    },
    {
        expression: "MIT OR Apache-2.0 AND BSD-3-Clause",
        expected: "MIT or Apache-2.0, and MIT or BSD-3-Clause",
    },
    {
        expression: "(MIT OR Apache-2.0) AND (BSD-3-Clause OR ISC)",
        expected: "MIT or Apache-2.0, and BSD-3-Clause or ISC",
    },
    {
        expression: "MIT OR (Apache-2.0 AND (BSD-3-Clause OR ISC))",
        expected: "MIT or Apache-2.0, and MIT or BSD-3-Clause or ISC",
    },
    {
        expression: "(MIT AND Apache-2.0) OR (BSD-3-Clause AND ISC)",
        expected: "MIT or BSD-3-Clause, and MIT or ISC, and Apache-2.0 or BSD-3-Clause, and Apache-2.0 or ISC",
    },
];

const SPECIAL_EXPRESSIONS = [
    {
        expression: "GPL-2.0+ WITH Classpath-exception-2.0 OR MIT",
        expected: "GPL-2.0+ with Classpath-exception-2.0 exception or MIT",
        licenseFile: "LICENSE",
    },
    {
        expression: "LicenseRef-Company OR DocumentRef-upstream:LicenseRef-Shared",
        expected: "LicenseRef-Company or DocumentRef-upstream-LicenseRef-Shared",
        licenseFile: "LICENSE",
    },
    { expression: "SEE LICENSE IN terms.txt", expected: "SEE-LICENSE-IN-terms.txt", licenseFile: "terms.txt" },
    { expression: "Custom package terms", expected: "Custom-package-terms", licenseFile: "LICENSE" },
];

describe("Debian license expressions", () => {
    it.each(EXPRESSIONS)("preserves the meaning of $expression", ({ expression, expected }) => {
        using project = createCliProject({
            prefix: "gtkx-dep5-expression-",
            config: CONFIG.replace('license: "MPL-2.0"', () => `license: "${expression}"`),
            files: files(),
            hasStore: true,
        });
        const notice = deploy(project);
        expect(licenseField(notice, "*")).toBe(expected);
        expect(notice).toContain(`Notices Audit (${expression})`);
    });

    it.each(SPECIAL_EXPRESSIONS)("retains bundled $expression terms", ({ expression, expected, licenseFile }) => {
        using project = createCliProject({
            prefix: "gtkx-dep5-special-",
            config: CONFIG,
            files: files(expression, licenseFile),
            hasStore: true,
        });
        const separator = expected.includes(" or ") ? ", and " : " and ";
        const notice = deploy(project);
        const bundle = `lib/${BINARY_NAME}/bundle.mjs`;
        expect(licenseField(notice, bundle)?.split(separator)).toContain(expected);
        expect(notice).toContain(`${DEPENDENCY_NAME} 1.0.0 (${expression})`);
        expect(notice).toContain(ORIGINAL_TERMS);
    });

    it("combines choices from the application and multiple bundled packages", () => {
        const other = "@audit/other-notices";
        const expression = "(MPL-2.0 OR Apache-2.0) AND ISC";
        using project = createCliProject({
            prefix: "gtkx-dep5-combined-",
            config: CONFIG.replace('license: "MPL-2.0"', () => `license: "${expression}"`),
            files: {
                ...files("(BSD-2-Clause OR BSD-3-Clause) AND Zlib"),
                "src/index.ts": `import { message } from "${DEPENDENCY_NAME}";\n` +
                    `import { other } from "${other}"; process.stdout.write(message + other);\n`,
                [`node_modules/${other}/package.json`]: JSON.stringify({
                    name: other, version: "1.0.0", type: "module", exports: "./index.js",
                    license: "LicenseRef-Company OR CC0-1.0",
                }),
                [`node_modules/${other}/index.js`]: 'export const other = "other dependency";\n',
                [`node_modules/${other}/LICENSE`]: ORIGINAL_TERMS,
                LICENSE: ORIGINAL_TERMS,
            },
            hasStore: true,
        });
        const notice = deploy(project);
        expect(licenseField(notice, `lib/${BINARY_NAME}/bundle.mjs`)?.split(", and ")).toEqual(
            expect.arrayContaining([
                "MPL-2.0 or Apache-2.0", "ISC", "BSD-2-Clause or BSD-3-Clause", "Zlib",
                "LicenseRef-Company or CC0-1.0",
            ]),
        );
        expect(notice).toContain(`Notices Audit (${expression})`);
        expect(notice).toContain(`${DEPENDENCY_NAME} 1.0.0 ((BSD-2-Clause OR BSD-3-Clause) AND Zlib)`);
        expect(notice.split(ORIGINAL_TERMS)).toHaveLength(2);
    });

    it("rejects a license value with the wrong configuration type", () => {
        using project = createCliProject({
            prefix: "gtkx-dep5-invalid-",
            config: CONFIG.replace('license: "MPL-2.0"', "license: 42"),
            files: files(),
            hasStore: true,
        });
        expect(runCli(project, ["deploy", "--print-manifests", "--target", "deb"]).status).not.toBe(0);
    });
});
