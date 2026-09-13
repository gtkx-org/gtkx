import { ESLint } from "eslint";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { config } from "../src/index.js";

type Workspace = {
    root: string;
    source: string;
    tests: string;
};

const roots: string[] = [];

afterEach(() => {
    for (const root of roots) {
        rmSync(root, { force: true, recursive: true });
    }

    roots.length = 0;
});

const createWorkspace = (): Workspace => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-eslint-"));
    const packageRoot = join(root, "packages/pub");
    const source = join(packageRoot, "src/index.ts");
    const tests = join(packageRoot, "tests/naming.ts");
    roots.push(root);
    mkdirSync(join(packageRoot, "src"), { recursive: true });
    mkdirSync(join(packageRoot, "tests"), { recursive: true });
    writeFileSync(join(root, ".gitignore"), "");
    writeFileSync(
        join(root, "tsconfig.base.json"),
        JSON.stringify({
            compilerOptions: {
                customConditions: ["source"],
                module: "NodeNext",
                moduleResolution: "NodeNext",
                noEmit: true,
                strict: true,
                target: "ES2025",
                types: [],
            },
        }),
    );
    writeFileSync(
        join(packageRoot, "tsconfig.json"),
        JSON.stringify({ extends: "../../tsconfig.base.json", include: ["src/**/*.ts", "tests/**/*.ts"] }),
    );
    writeFileSync(
        join(packageRoot, "package.json"),
        JSON.stringify({
            name: "@fixture/pub",
            type: "module",
            exports: { ".": { source: "./src/index.ts" } },
        }),
    );

    return { root, source, tests };
};

const createSharedPackage = (workspace: Workspace): string => {
    const packageRoot = join(workspace.root, "packages/shared");
    mkdirSync(join(packageRoot, "src"), { recursive: true });
    writeFileSync(
        join(packageRoot, "tsconfig.json"),
        JSON.stringify({ extends: "../../tsconfig.base.json", include: ["src/**/*.ts"] }),
    );

    return packageRoot;
};

const lint = async (workspace: Workspace, file: string, source?: string): Promise<ESLint.LintResult[]> => {
    const eslint = new ESLint({
        cwd: workspace.root,
        overrideConfig: config(workspace.root, {
            entrypoints: ["@fixture/pub"],
            modules: [],
        }) as ESLint.Options["overrideConfig"],
        overrideConfigFile: true,
    });

    return source === undefined ? eslint.lintFiles([file]) : eslint.lintText(source, { filePath: file });
};

const publicReports = (results: ESLint.LintResult[]): number =>
    results.flatMap((result) => result.messages).filter((message) => message.ruleId === "gtkx/public-api-jsdoc")
        .length;

test("the public config accepts library names, external keys, and semantic aliases", async () => {
    const workspace = createWorkspace();
    writeFileSync(
        workspace.tests,
        [
            "type Identifier = string;",
            "type GtkWidget = { gtkName: Identifier };",
            "type GLibValue = number;",
            "const GTKX_VERSION = \"2.0\";",
            "const payload = { external_api_key: 1 };",
            "const read = (identifier: Identifier): number => identifier.length + payload.external_api_key;",
            "const gtk = (widget: GtkWidget): GLibValue => widget.gtkName.length;",
            "read(\"id\");",
            "gtk({ gtkName: GTKX_VERSION });",
            "",
        ].join("\n"),
    );

    const results = await lint(workspace, workspace.tests);

    expect(results.flatMap((result) => result.messages)).toEqual([]);
});

test("public declarations refresh with the parser program", async () => {
    const workspace = createWorkspace();
    writeFileSync(
        workspace.source,
        "type ShortShape = { value: string };\n\nexport type { ShortShape };\n",
    );

    const first = await lint(workspace, workspace.source);
    writeFileSync(
        workspace.source,
        "type ExpandedPublicShape = { value: string };\n\nexport type { ExpandedPublicShape };\n",
    );
    const second = await lint(workspace, workspace.source);

    expect(publicReports(first)).toBe(2);
    expect(publicReports(second)).toBe(2);
});

test("public declarations follow reverse exports across package programs", async () => {
    const workspace = createWorkspace();
    const sharedRoot = createSharedPackage(workspace);
    const shared = join(sharedRoot, "src/index.ts");
    writeFileSync(shared, "type SharedShape = { value: string };\n\nexport type { SharedShape };\n");
    writeFileSync(workspace.source, "export type { SharedShape } from \"../../shared/src/index.js\";\n");

    const first = await lint(workspace, shared);
    writeFileSync(shared, "type ExpandedSharedShape = { value: string };\n\nexport type { ExpandedSharedShape };\n");
    writeFileSync(
        workspace.source,
        "export type { ExpandedSharedShape } from \"../../shared/src/index.js\";\n",
    );
    const second = await lint(workspace, shared);

    expect(publicReports(first)).toBe(2);
    expect(publicReports(second)).toBe(2);
});

test("public declarations refresh when only a reverse export changes", async () => {
    const workspace = createWorkspace();
    const sharedRoot = createSharedPackage(workspace);
    const shared = join(sharedRoot, "src/index.ts");
    writeFileSync(shared, "type SharedShape = { value: string };\n\nexport type { SharedShape };\n");
    writeFileSync(workspace.source, "export type { SharedShape } from \"../../shared/src/index.js\";\n");

    const first = await lint(workspace, shared);
    writeFileSync(workspace.source, "export {};\n");
    const second = await lint(workspace, shared);

    expect(publicReports(first)).toBe(2);
    expect(publicReports(second)).toBe(0);
});

test("public declarations follow unsaved edits across package programs", async () => {
    const workspace = createWorkspace();
    const sharedRoot = createSharedPackage(workspace);
    const shared = join(sharedRoot, "src/index.ts");
    writeFileSync(shared, "type SharedShape = { value: string };\n\nexport type { SharedShape };\n");
    writeFileSync(workspace.source, "export type { SharedShape } from \"../../shared/src/index.js\";\n");

    const first = await lint(workspace, shared);
    const second = await lint(
        workspace,
        shared,
        "type SharedShape = { value: string; added: number };\n\nexport type { SharedShape };\n",
    );

    expect(publicReports(first)).toBe(2);
    expect(publicReports(second)).toBe(3);
});

test("public declarations refresh when an exported source is removed", async () => {
    const workspace = createWorkspace();
    const sharedRoot = createSharedPackage(workspace);
    const shared = join(sharedRoot, "src/index.ts");
    const removed = join(sharedRoot, "src/removed.ts");
    writeFileSync(shared, "type SharedShape = { value: string };\n\nexport type { SharedShape };\n");
    writeFileSync(removed, "type RemovedShape = { value: string };\n\nexport type { RemovedShape };\n");
    writeFileSync(
        workspace.source,
        [
            "export type { SharedShape } from \"../../shared/src/index.js\";",
            "export type { RemovedShape } from \"../../shared/src/removed.js\";",
            "",
        ].join("\n"),
    );

    const first = await lint(workspace, shared);
    rmSync(removed);
    const second = await lint(workspace, shared);

    expect(publicReports(first)).toBe(2);
    expect(publicReports(second)).toBe(2);
});

test("public declarations refresh when a missing export is created", async () => {
    const workspace = createWorkspace();
    const sharedRoot = createSharedPackage(workspace);
    const shared = join(sharedRoot, "src/index.ts");
    const added = join(sharedRoot, "src/added.ts");
    writeFileSync(shared, "export {};\n");
    writeFileSync(workspace.source, "export type { AddedShape } from \"../../shared/src/added.js\";\n");

    const first = await lint(workspace, shared);
    writeFileSync(added, "type AddedShape = { value: string };\n\nexport type { AddedShape };\n");
    const second = await lint(workspace, added);

    expect(publicReports(first)).toBe(0);
    expect(publicReports(second)).toBe(2);
});

test("public declarations refresh when compiler paths change", async () => {
    const workspace = createWorkspace();
    const sharedRoot = createSharedPackage(workspace);
    const firstSource = join(sharedRoot, "src/first.ts");
    const secondSource = join(sharedRoot, "src/second.ts");
    const configFile = join(workspace.root, "tsconfig.base.json");
    const compilerConfig = JSON.parse(readFileSync(configFile, "utf8")) as {
        compilerOptions: Record<string, unknown>;
    };
    compilerConfig.compilerOptions.baseUrl = ".";
    compilerConfig.compilerOptions.paths = { model: ["./packages/shared/src/first.ts"] };
    writeFileSync(configFile, JSON.stringify(compilerConfig));
    writeFileSync(firstSource, "type Model = { value: string };\n\nexport type { Model };\n");
    writeFileSync(secondSource, "type Model = { value: number };\n\nexport type { Model };\n");
    writeFileSync(workspace.source, "export type { Model } from \"model\";\n");

    const first = await lint(workspace, firstSource);
    compilerConfig.compilerOptions.paths = { model: ["./packages/shared/src/second.ts"] };
    writeFileSync(configFile, JSON.stringify(compilerConfig));
    const second = await lint(workspace, firstSource);

    expect(publicReports(first)).toBe(2);
    expect(publicReports(second)).toBe(0);
});

test.each(["created", "changed"] as const)("public declarations refresh when imported exports are %s", async (mode) => {
    const workspace = createWorkspace();
    const sharedRoot = createSharedPackage(workspace);
    const firstSource = join(sharedRoot, "src/first.ts");
    const secondSource = join(sharedRoot, "src/second.ts");
    const manifestFile = join(sharedRoot, "package.json");
    const manifest = {
        exports: { ".": { source: "./src/first.ts" } },
        name: "@fixture/shared",
        type: "module",
    };
    mkdirSync(join(workspace.root, "node_modules/@fixture"), { recursive: true });
    symlinkSync(sharedRoot, join(workspace.root, "node_modules/@fixture/shared"));
    if (mode === "changed") {
        writeFileSync(manifestFile, JSON.stringify(manifest));
    }

    writeFileSync(firstSource, "type Model = { value: string };\n\nexport type { Model };\n");
    writeFileSync(secondSource, "type Model = { value: number };\n\nexport type { Model };\n");
    writeFileSync(workspace.source, "export type { Model } from \"@fixture/shared\";\n");

    const first = await lint(workspace, firstSource);
    manifest.exports["."].source = mode === "created" ? "./src/first.ts" : "./src/second.ts";
    writeFileSync(manifestFile, JSON.stringify(manifest));
    const second = await lint(workspace, firstSource);

    expect(publicReports(first)).toBe(mode === "created" ? 0 : 2);
    expect(publicReports(second)).toBe(mode === "created" ? 2 : 0);
});
