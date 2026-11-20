import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { format } from "oxfmt";
import { describe, expect, it } from "vitest";
import { createVitest } from "vitest/node";
import { createProject, linkWorkspaceBindings } from "./project.js";
import { invoke } from "./invoke.js";

describe("gtkx codegen", () => {
    it("generates upstream bindings and documentation through their command arguments", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"] });
        expect(await invoke(["codegen", "--cwd", project.root])).toContain("generated bindings missing");
        expect(existsSync(join(project.root, "node_modules/@gtkx/gi/gio/index.d.ts"))).toBe(true);
        expect(await invoke(["codegen", "--cwd", project.root])).toContain("codegen: bindings up to date");
        await invoke(["docs", "--cwd", project.root, "--out", "reference"]);
        const files = readdirSync(join(project.root, "reference"), { recursive: true });
        expect(files.some((file) => file.toString().endsWith(".md"))).toBe(true);
        await expect(invoke(["docs", "--cwd", project.root, "--out", "../outside"])).rejects.toThrow("below");
    });

    it.each([
        { name: "without a configuration file", config: null },
        { name: "whose configuration names no application ID", config: { codegen: false } },
    ])("tests a component library $name", async ({ config }) => {
        using project = createProject();
        if (config === null) {
            rmSync(join(project.root, "gtkx.config.ts"));
        } else {
            project.write("gtkx.config.ts", `export default ${JSON.stringify(config)};`);
            linkWorkspaceBindings(project.root);
        }
        project.write(
            "src/badge.tsx",
            `import { GtkLabel } from "@gtkx/jsx/gtk";
            export const Badge = ({ label }: { label: string }) => <GtkLabel label={label} cssClasses={["badge"]} />;`,
        );
        project.write(
            "tests/badge.test.tsx",
            `import { render, screen } from "@gtkx/testing";
            import { expect, test } from "vitest";
            import { Badge } from "../src/badge.tsx";
            test("renders the badge", async () => {
                await render(<Badge label="New" />);
                expect(await screen.findByText("New")).toBeTruthy();
            });`,
        );
        project.write(
            "vitest.config.mjs",
            `import gtkx from "@gtkx/cli/vitest-plugin";
            export default { plugins: [gtkx()], test: { include: ["tests/*.test.tsx"] } };`,
        );
        const runner = await createVitest({
            root: project.root,
            config: join(project.root, "vitest.config.mjs"),
            watch: false,
            reporters: [],
        });
        try {
            const results = await runner.start();
            expect(results.testModules.map((module) => module.state())).toEqual(["passed"]);
        } finally {
            await runner.close();
        }
        for (const path of ["AGENTS.md", "CLAUDE.md", ".gtkx/reference"]) {
            expect(existsSync(join(project.root, path))).toBe(false);
        }
    });

    it.each([
        { name: "without a configuration file", config: null },
        { name: "whose configuration names no application ID", config: { libraries: ["Gio-2.0"] } },
    ])("generates bindings and documentation for a component library $name", async ({ config }) => {
        using project = createProject();
        if (config === null) {
            rmSync(join(project.root, "gtkx.config.ts"));
        } else {
            project.write("gtkx.config.ts", `export default ${JSON.stringify(config)};`);
        }
        expect(await invoke(["codegen", "--cwd", project.root])).toContain("codegen: bindings generated");
        expect(existsSync(join(project.root, "node_modules/@gtkx/gi/gtk/index.d.ts"))).toBe(true);
        for (const path of ["AGENTS.md", "CLAUDE.md", ".gtkx/reference"]) {
            expect(existsSync(join(project.root, path))).toBe(false);
        }
        await invoke(["docs", "--cwd", project.root, "--out", "reference"]);
        expect(existsSync(join(project.root, "reference/index.md"))).toBe(true);
    });

    it("loads one copy of the bindings in tests after they are regenerated", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"] });
        project.write(
            "src/cancellable.ts",
            'import { Cancellable } from "@gtkx/gi/gio"; export const create = () => new Cancellable();',
        );
        const writeTest = (name: string) =>
            project.write(
                "tests/bindings.test.ts",
                `import { Cancellable } from "@gtkx/gi/gio";
                import { expect, test } from "vitest";
                import { create } from "../src/cancellable.js";
                test(${JSON.stringify(name)}, () => expect(create()).toBeInstanceOf(Cancellable));`,
            );
        project.write(
            "vitest.config.mjs",
            `import gtkx from "@gtkx/cli/vitest-plugin";
            export default { plugins: [gtkx()], test: { include: ["tests/*.test.ts"] } };`,
        );
        const runTests = async () => {
            const runner = await createVitest({
                root: project.root,
                config: join(project.root, "vitest.config.mjs"),
                watch: false,
                reporters: [],
            });
            try {
                const results = await runner.start();
                return results.testModules.map((module) => module.state());
            } finally {
                await runner.close();
            }
        };

        writeTest("creates a cancellable");
        expect(await runTests()).toEqual(["passed"]);
        await invoke(["codegen", "--cwd", project.root, "--force"]);
        writeTest("creates a cancellable after regeneration");
        expect(await runTests()).toEqual(["passed"]);
    });

    it("applies a changed React Compiler setting to the next test run", async () => {
        using project = createProject({ codegen: true });
        project.write(
            "src/reading.tsx",
            `import { GtkLabel } from "@gtkx/jsx/gtk";
            export const Reading = ({ source }: { source: { read: () => string } }) => <GtkLabel label={source.read()} />;`,
        );
        const writeTest = (expected: string) =>
            project.write(
                "tests/reading.test.tsx",
                `import { render, screen } from "@gtkx/testing";
                import { expect, test } from "vitest";
                import { Reading } from "../src/reading.js";
                test("shows ${expected} after a rerender", async () => {
                    let value = "first";
                    const source = { read: () => value };
                    const { rerender } = await render(<Reading source={source} />);
                    value = "second";
                    await rerender(<Reading source={source} />);
                    expect(await screen.findByText(${JSON.stringify(expected)})).toBeTruthy();
                });`,
            );
        project.write(
            "vitest.config.mjs",
            `import gtkx from "@gtkx/cli/vitest-plugin";
            export default { plugins: [gtkx()], test: { include: ["tests/*.test.tsx"] } };`,
        );
        const runTests = async () => {
            const runner = await createVitest({
                root: project.root,
                config: join(project.root, "vitest.config.mjs"),
                watch: false,
                reporters: [],
            });
            try {
                const results = await runner.start();
                return results.testModules.map((module) => module.state());
            } finally {
                await runner.close();
            }
        };

        writeTest("first");
        expect(await runTests()).toEqual(["passed"]);
        project.write(
            "gtkx.config.ts",
            `export default ${JSON.stringify({ applicationId: "org.gtkx.example", codegen: true, agents: { reference: false, rules: false }, reactCompiler: false })};`,
        );
        writeTest("second");
        expect(await runTests()).toEqual(["passed"]);
    });

    it("keeps the agent rules in step with the generated reference", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"], agents: { rules: true } });
        const rules = () => readFileSync(join(project.root, "AGENTS.md"), "utf8");
        await invoke(["codegen", "--cwd", project.root]);
        expect(rules()).toContain("`.gtkx/reference/index.md`");
        expect(existsSync(join(project.root, ".gtkx/reference/index.md"))).toBe(true);

        project.write(
            "gtkx.config.ts",
            `export default ${JSON.stringify({ applicationId: "org.gtkx.example", libraries: ["Gio-2.0"], agents: { reference: false } })};`,
        );
        await invoke(["codegen", "--cwd", project.root]);
        expect(rules()).not.toContain(".gtkx/reference");
        expect(existsSync(join(project.root, ".gtkx/reference"))).toBe(false);
    });

    it("writes agent rules that a Markdown formatter leaves unchanged", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"], agents: { rules: true } });
        await invoke(["codegen", "--cwd", project.root]);
        const rules = readFileSync(join(project.root, "AGENTS.md"), "utf8");
        expect((await format("AGENTS.md", rules)).code).toBe(rules);
    });

    it("leaves agent rules that a Markdown formatter rewrapped unchanged", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"], agents: { rules: true } });
        const agentsPath = join(project.root, "AGENTS.md");
        await invoke(["codegen", "--cwd", project.root]);
        const { code: wrapped } = await format("AGENTS.md", readFileSync(agentsPath, "utf8"), {
            proseWrap: "always",
        });
        writeFileSync(agentsPath, wrapped);

        await invoke(["codegen", "--cwd", project.root]);
        expect(readFileSync(agentsPath, "utf8")).toBe(wrapped);
    });

    it("lists only the commands that the project's packages provide in the agent rules", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"], agents: { rules: true } });
        const rules = () => readFileSync(join(project.root, "AGENTS.md"), "utf8");
        const hoisted = "node_modules/.pnpm/node_modules";
        const typescriptManifest = JSON.stringify({ name: "typescript", version: "6.0.3" });
        project.write(`${hoisted}/typescript/package.json`, typescriptManifest);
        const codegen = () =>
            promisify(execFile)(
                process.execPath,
                [join(project.root, "node_modules/@gtkx/cli/bin/gtkx.js"), "codegen"],
                {
                    cwd: project.root,
                    env: { ...process.env, NODE_PATH: join(project.root, hoisted) },
                },
            );

        await codegen();
        expect(rules()).toContain("`vitest run`");
        expect(rules()).not.toContain("`tsc --noEmit`");

        project.write("node_modules/typescript/package.json", typescriptManifest);
        await codegen();
        expect(rules()).toContain("`tsc --noEmit`");
    });

    it("removes the agent rules it wrote once rules are disabled", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"], agents: { rules: true } });
        const configure = (rules: boolean) =>
            project.write(
                "gtkx.config.ts",
                `export default ${JSON.stringify({ applicationId: "org.gtkx.example", libraries: ["Gio-2.0"], agents: { rules } })};`,
            );
        const agentsPath = join(project.root, "AGENTS.md");
        const claudePath = join(project.root, "CLAUDE.md");
        await invoke(["codegen", "--cwd", project.root]);
        expect(existsSync(claudePath)).toBe(true);

        configure(false);
        await invoke(["codegen", "--cwd", project.root]);
        expect(existsSync(agentsPath)).toBe(false);
        expect(existsSync(claudePath)).toBe(false);

        project.write("AGENTS.md", "# Notes\n\nKeep this.\n");
        configure(true);
        await invoke(["codegen", "--cwd", project.root]);
        expect(readFileSync(agentsPath, "utf8")).toContain("gtkx-agent-rules");
        expect(readFileSync(agentsPath, "utf8")).toContain("https://gtkx.dev/v2/llms.txt");

        configure(false);
        await invoke(["codegen", "--cwd", project.root]);
        expect(readFileSync(agentsPath, "utf8")).toBe("# Notes\n\nKeep this.\n");
        expect(existsSync(claudePath)).toBe(true);
    });
});
