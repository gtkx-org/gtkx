import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cliEnvironment, createCliProject } from "./cli-project.js";

const CLI_ENTRY = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const APPLICATION_ARGS = ["literal value", "--consumer-option"];
const CONFIG = 'export default { applicationId: "org.gtkx.nodeoptions", codegen: false };';
const ENTRY = `import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
writeFileSync("result.json", JSON.stringify({
    selection: require("node-options-probe"),
    options: process.env.NODE_OPTIONS,
    args: process.argv.slice(2),
    title: process.title,
}));
process.exit(0);
`;
const PACKAGE = JSON.stringify({
    name: "node-options-probe",
    version: "1.0.0",
    exports: { "gtkx-probe": "./selected.cjs", default: "./default.cjs" },
});
const CASES = [
    { name: "default options", args: [], options: "", selection: "default" },
    { name: "environment conditions", args: [], options: "--conditions=gtkx-probe", selection: "selected" },
    { name: "command-line conditions", args: ["-C", "gtkx-probe"], options: "", selection: "selected" },
    {
        name: "quoted environment values",
        args: [],
        options: '--conditions=gtkx-probe --title="GTKX   consumer"',
        selection: "selected",
        title: "GTKX   consumer",
    },
];

describe("gtkx dev Node options", () => {
    it.each(CASES)("preserves $name and application arguments", ({ args, options, selection, title }) => {
        using project = createCliProject({
            prefix: "gtkx-cli-node-options-",
            config: CONFIG,
            hasStore: true,
            shouldShareStore: true,
            files: {
                "src/index.ts": ENTRY,
                "node_modules/node-options-probe/package.json": PACKAGE,
                "node_modules/node-options-probe/selected.cjs": 'module.exports = "selected";',
                "node_modules/node-options-probe/default.cjs": 'module.exports = "default";',
            },
        });
        const result = spawnSync(process.execPath, [
            ...args, CLI_ENTRY, "dev", "--cwd", project.root, "--", ...APPLICATION_ARGS,
        ], {
            cwd: project.root,
            encoding: "utf8",
            env: { ...cliEnvironment(project), NODE_OPTIONS: options },
            timeout: 120_000,
        });

        expect(result.status).toBe(0);
        const observed: unknown = JSON.parse(readFileSync(join(project.root, "result.json"), "utf8"));
        expect(observed).toMatchObject({ selection, options, args: APPLICATION_ARGS, ...title && { title } });
    });

    it("preserves rejection of invalid Node options before application startup", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-invalid-node-options-",
            config: CONFIG,
            files: { "src/index.ts": ENTRY },
        });
        const result = spawnSync(process.execPath, [CLI_ENTRY, "dev", "--cwd", project.root], {
            cwd: project.root,
            encoding: "utf8",
            env: { ...cliEnvironment(project), NODE_OPTIONS: "--gtkx-invalid-node-option" },
            timeout: 120_000,
        });

        expect(result.status).toBe(9);
        expect(existsSync(join(project.root, "result.json"))).toBe(false);
    });
});
