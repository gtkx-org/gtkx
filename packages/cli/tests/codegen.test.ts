import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli, STORE_LIBRARIES } from "./cli-project.js";

type BrokenCase = { title: string; config: string | undefined };

const APPLICATION_ID = "com.gtkx.clicodegen";
const MARKER = "probe-marker.txt";

const GI_MODULES = [
    join("gtk", "gtk.js"),
    join("gtk", "index.js"),
    join("gtk", "index.d.ts"),
    "package.json",
];

const JSX_MODULES = ["metadata.js", join("gtk", "gtk.js"), "package.json"];
const HEAD = `export default { applicationId: "${APPLICATION_ID}"`;

const BROKEN_CASES: BrokenCase[] = [
    { title: "no configuration file at all", config: undefined },
    { title: "a configuration that declares no application id", config: "export default { libraries: [] };\n" },
    { title: "a configuration whose libraries are empty", config: `${HEAD}, libraries: [] };\n` },
    { title: "a configuration whose gir path is not a list", config: `${HEAD}, girPath: 5 };\n` },
    { title: "a library that has no GIR file installed", config: `${HEAD}, libraries: ["Absent-1.0"] };\n` },
];

const config = (body: string): string => `${HEAD}${body} };\n`;

const storePath = (project: CliProject, ...segments: string[]): string =>
    join(project.nodeModules, ".gtkx", ...segments);

const linkPath = (project: CliProject, ...segments: string[]): string =>
    join(project.nodeModules, "@gtkx", ...segments);

const markStore = (project: CliProject): void => {
    writeFileSync(storePath(project, "gi", MARKER), "");
};

const isStoreMarked = (project: CliProject): boolean => existsSync(storePath(project, "gi", MARKER));

const expectModules = (directory: string, modules: string[]): void => {
    expect(modules.filter((name) => !existsSync(join(directory, name)))).toEqual([]);
};

describe("gtkx codegen", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({ prefix: "gtkx-cli-codegen-", config: config("") });
        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes both stores where the project imports them", () => {
        expect(state.status).toBe(0);
        expectModules(storePath(state.project, "gi"), GI_MODULES);
        expectModules(storePath(state.project, "jsx"), JSX_MODULES);
        expectModules(linkPath(state.project, "gi"), GI_MODULES);
        expectModules(linkPath(state.project, "jsx"), JSX_MODULES);
    });

    it("leaves a fresh store alone, and restores a link an install pruned", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(true);
        rmSync(linkPath(state.project, "gi"), { recursive: true, force: true });
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(existsSync(linkPath(state.project, "gi", "gtk", "index.js"))).toBe(true);
        expect(isStoreMarked(state.project)).toBe(true);
    });

    it("rebuilds the store from scratch when it is forced", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen", "--force"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(false);
        expectModules(storePath(state.project, "gi"), GI_MODULES);
        expectModules(storePath(state.project, "jsx"), JSX_MODULES);
    });
});

describe("gtkx codegen (a project that generates no store)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-disabled-",
            config: config(`, codegen: false, libraries: ${JSON.stringify(STORE_LIBRARIES)}`),
            hasStore: true,
        });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("keeps the store the project installed for itself", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(true);
        expectModules(linkPath(state.project, "gi"), GI_MODULES);
    });

    it("refuses to force a store it does not generate", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen", "--force"]).status).not.toBe(0);
        expect(isStoreMarked(state.project)).toBe(true);
    });
});

describe("gtkx codegen (projects it cannot generate from)", () => {
    it.each(BROKEN_CASES)("fails over $title", ({ config: body }) => {
        const project = createCliProject({ prefix: "gtkx-cli-codegen-broken-", config: body });

        try {
            expect(runCli(project, ["codegen"]).status).not.toBe(0);
            expect(existsSync(storePath(project, "gi"))).toBe(false);
        } finally {
            removeCliProject(project);
        }
    });
});
