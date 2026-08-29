import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    removeCliProject,
    runCli,
    STORE_LIBRARIES,
} from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.cliagents";
const AGENTS = "AGENTS.md";
const CLAUDE = "CLAUDE.md";
const REFERENCE_INDEX = join(".gtkx", "reference", "index.md");
const BUTTON_PAGE = join(".gtkx", "reference", "gtk", "button.md");
const BEGIN_MARKER = "<!-- BEGIN:gtkx-agent-rules -->";
const END_MARKER = "<!-- END:gtkx-agent-rules -->";

const config = (body = ""): string =>
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(STORE_LIBRARIES)}` +
    `${body} };\n`;

const read = (project: CliProject, name: string): string => readFileSync(join(project.root, name), "utf8");
const hasFile = (project: CliProject, name: string): boolean => existsSync(join(project.root, name));
const stamp = (project: CliProject, name: string): number => statSync(join(project.root, name)).mtimeMs;
const runCodegen = (project: CliProject): number | null => runCli(project, ["codegen"]).status;

describe("gtkx codegen writing agent-facing files", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({ prefix: "gtkx-cli-agents-", config: config(), hasStore: true });
        state.status = runCodegen(state.project);
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes the rules block, an import for Claude Code, and the reference the block points at", () => {
        expect(state.status).toBe(0);
        const rules = read(state.project, AGENTS);
        expect(rules).toContain(BEGIN_MARKER);
        expect(rules).toContain(END_MARKER);
        expect(rules).toContain(".gtkx/reference/index.md");
        expect(read(state.project, CLAUDE).trim()).toBe(`@${AGENTS}`);
        expect(read(state.project, REFERENCE_INDEX)).toContain("Element reference");
        expect(read(state.project, BUTTON_PAGE)).toContain("GtkButton");
    });

    it("links reference pages by a path that resolves from the project root", () => {
        const index = read(state.project, REFERENCE_INDEX);
        const [, link] = /\| (\.gtkx\/reference\/gtk\/index\.md) \|/.exec(index) ?? [];
        expect(link).toBe(".gtkx/reference/gtk/index.md");
        expect(hasFile(state.project, link ?? "")).toBe(true);
    });

    it("leaves an unchanged block alone rather than rewriting it every run", () => {
        const before = stamp(state.project, AGENTS);
        expect(runCodegen(state.project)).toBe(0);
        expect(stamp(state.project, AGENTS)).toBe(before);
    });

    it("replaces only the block and keeps the rest of an existing file", () => {
        const path = join(state.project.root, AGENTS);
        const original = read(state.project, AGENTS);
        const kept = "# House rules\n\nAlways run the linter.\n\n";
        writeFileSync(path, kept + original.replace(/Children are JSX[^\n]*/, "Children are STALE"));
        expect(runCodegen(state.project)).toBe(0);
        const updated = read(state.project, AGENTS);
        expect(updated).toContain("Always run the linter.");
        expect(updated).not.toContain("Children are STALE");
        expect(updated).toContain("## GTKX");
    });
});

describe("gtkx codegen with agent files turned off", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-noagents-",
            config: config(", agents: { rules: false, reference: false }"),
            hasStore: true,
        });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes neither the rules block nor the reference", () => {
        expect(runCodegen(state.project)).toBe(0);
        expect(hasFile(state.project, AGENTS)).toBe(false);
        expect(hasFile(state.project, CLAUDE)).toBe(false);
        expect(hasFile(state.project, REFERENCE_INDEX)).toBe(false);
    });
});
