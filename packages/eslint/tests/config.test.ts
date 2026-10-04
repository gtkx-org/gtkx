import { ESLint } from "eslint";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";
import { config } from "../src/index.js";

type Workspace = {
    root: string;
    tests: string;
};

const roots: string[] = [];
const run = promisify(execFile);

afterEach(() => {
    for (const root of roots) {
        rmSync(root, { force: true, recursive: true });
    }

    roots.length = 0;
});

const createWorkspace = (): Workspace => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-eslint-"));
    const packageRoot = join(root, "packages/pub");
    const tests = join(packageRoot, "tests/naming.ts");
    roots.push(root);
    mkdirSync(join(packageRoot, "tests"), { recursive: true });
    writeFileSync(join(root, ".gitignore"), "");
    writeFileSync(
        join(root, "tsconfig.base.json"),
        JSON.stringify({
            compilerOptions: {
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
        JSON.stringify({ extends: "../../tsconfig.base.json", include: ["tests/**/*.ts"] }),
    );
    writeFileSync(
        join(packageRoot, "package.json"),
        JSON.stringify({
            name: "@fixture/pub",
            type: "module",
        }),
    );

    return { root, tests };
};

const lint = async (workspace: Workspace, file: string): Promise<ESLint.LintResult[]> => {
    const eslint = new ESLint({
        cwd: workspace.root,
        overrideConfig: config(workspace.root) as ESLint.Options["overrideConfig"],
        overrideConfigFile: true,
    });

    return eslint.lintFiles([file]);
};

const lintCommand = async (workspace: Workspace, source: string): Promise<void> => {
    const configuration = new URL("../src/index.ts", import.meta.url).href;
    const eslint = fileURLToPath(new URL("../bin/eslint.js", import.meta.resolve("eslint")));
    symlinkSync(fileURLToPath(new URL("../../../node_modules", import.meta.url)), join(workspace.root, "node_modules"));
    writeFileSync(
        join(workspace.root, "eslint.config.ts"),
        `import { config } from ${JSON.stringify(configuration)};\n` +
        "export default config(import.meta.dirname);\n",
    );
    writeFileSync(workspace.tests, source);
    await run(process.execPath, [eslint, workspace.tests], { cwd: workspace.root });
};

test("the lint command accepts initialized declarations and checked unknown values", async () => {
    const workspace = createWorkspace();
    const source = [
        "class Value {",
        "    value: string;",
        "    constructor(value: unknown) {",
        "        this.value = typeof value === \"string\" ? value : \"\";",
        "    }",
        "}",
        "console.log(new Value(\"value\").value);",
        "",
    ].join("\n");

    await expect(lintCommand(workspace, source)).resolves.toBeUndefined();
});

test.each([
    "const value = \"value\" as unknown as number;\nconsole.log(value);\n",
    "const value = <number><unknown>\"value\";\nconsole.log(value);\n",
    "class Value {\n    value!: string;\n}\nconsole.log(new Value().value);\n",
    "let value!: string;\nconsole.log(value);\n",
    "const values: string[] = [];\nconsole.log(values[0]!);\n",
    "/* eslint-disable no-debugger */\nconst value = \"value\";\nconsole.log(value);\n",
])("the lint command rejects prohibited assertions: %s", async (source) => {
    const workspace = createWorkspace();

    await expect(lintCommand(workspace, source)).rejects.toThrow();
});

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
