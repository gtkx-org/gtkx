import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    removeCliProject,
    runCli,
    STORE_FUTURE,
    STORE_LIBRARIES,
} from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.clidocs";
const OUT_DIR = join("site", "elements");
const BASE_PATH = "/elements";
const INDEX_PAGE = "index.md";
const MANIFEST = "manifest.json";
const NAMESPACE_PREFIX = "gtk/";
const ELEMENT_PAGE = `${NAMESPACE_PREFIX}button.md`;
const NAMESPACE_INDEX = `${NAMESPACE_PREFIX}index.md`;
const REJECTED_OUT_DIRS = ["", ".", "..", "../sibling", "docs/../..", "/elsewhere/docs"];

const config = (body = ""): string =>
    `export default { applicationId: "${APPLICATION_ID}", ` +
    `libraries: ${JSON.stringify(STORE_LIBRARIES)}, ` +
    `future: ${JSON.stringify(STORE_FUTURE)}${body} };\n`;

const docsDir = (project: CliProject): string => join(project.root, OUT_DIR);

const runDocs = (project: CliProject, args: string[] = []): number | null =>
    runCli(project, ["docs", "--out", OUT_DIR, "--base-path", BASE_PATH, ...args]).status;

const indexStamp = (project: CliProject): number => statSync(join(docsDir(project), INDEX_PAGE)).mtimeMs;
const readPage = (project: CliProject, name: string): string => readFileSync(join(docsDir(project), name), "utf8");

describe("gtkx docs", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({ prefix: "gtkx-cli-docs-", config: config(), hasStore: true });
        state.status = runDocs(state.project);
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes an element page per namespace under the requested directory", () => {
        const written = readdirSync(docsDir(state.project), { recursive: true, encoding: "utf8" });
        const index = readPage(state.project, INDEX_PAGE);
        expect(state.status).toBe(0);
        expect(written).toContain(INDEX_PAGE);
        expect(written).toContain(MANIFEST);
        expect(written).toContain(NAMESPACE_INDEX);
        expect(written).toContain(ELEMENT_PAGE);
        expect(readPage(state.project, ELEMENT_PAGE)).toContain("GtkButton");
        expect(index).toContain(BASE_PATH);
    });

    it("leaves pages that are up to date alone, and rewrites them when forced", () => {
        const before = indexStamp(state.project);
        expect(runDocs(state.project)).toBe(0);
        expect(indexStamp(state.project)).toBe(before);
        expect(runDocs(state.project, ["--force"])).toBe(0);
        expect(indexStamp(state.project)).not.toBe(before);
    });
});

describe("gtkx docs (directories it refuses to write to)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({ prefix: "gtkx-cli-docs-out-", config: config(), hasStore: true });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it.each(REJECTED_OUT_DIRS)("fails over an out directory of %j", (out) => {
        expect(runCli(state.project, ["docs", "--out", out]).status).not.toBe(0);
        expect(existsSync(join(state.project.root, "docs"))).toBe(false);
    });
});

describe("gtkx docs (a project with nothing to document)", () => {
    it("fails when the project generates no bindings", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-docs-disabled-",
            config: config(", codegen: false"),
            hasStore: true,
        });

        try {
            expect(runDocs(project)).not.toBe(0);
            expect(existsSync(docsDir(project))).toBe(false);
        } finally {
            removeCliProject(project);
        }
    });
});
