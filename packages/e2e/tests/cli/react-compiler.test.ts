import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, type DisposableCliProject, runCli, runCliOrThrow } from "./cli-project.js";

type AppRun = { status: number | null; signal: NodeJS.Signals | null; reports: unknown[] };

const SOURCES = ["index.tsx", "banner.tsx", "javascript-banner.mjs", "label.ts", "typescript-banner.mts"];
const READ_ONLY_CACHE = "read-only-cache";
const FIRST_LABEL = "first-build";
const SECOND_LABEL = "second-build";
const sources = Object.fromEntries(SOURCES.map((name) => [
    `src/${name}`,
    readFileSync(new URL(`fixtures/react-compiler/${name}`, import.meta.url), "utf8"),
]));

const createProject = (settings = "", cacheDir = "cache"): DisposableCliProject => createCliProject({
    prefix: "gtkx-react-compiler-",
    config: `export default { applicationId: "com.gtkx.clireactcompiler", codegen: false, ${settings} };`,
    hasStore: true,
    files: { ...sources, "vite.config.mjs": `export default { cacheDir: ${JSON.stringify(cacheDir)} };` },
});

const runApp = (project: CliProject): Promise<AppRun> => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(project.root, "dist/bundle.mjs")], {
        cwd: join(project.root, "dist"),
        stdio: ["ignore", "ignore", "inherit", "ipc"],
    });
    const reports: unknown[] = [];
    const timeout = setTimeout(() => {
        child.kill("SIGKILL");
    }, 30_000);

    child.on("message", (message) => {
        reports.push(message);
        if (reports.length < 3) {
            child.send({ action: "increment" });
        }
    });
    child.once("error", reject);
    child.once("close", (status, signal) => {
        clearTimeout(timeout);
        resolve({ status, signal, reports });
    });
});

const renderedCounters = (label: string, isCompiled = true): unknown[] => [0, 1, 2].map((count) => ({
    counter: `plain-typescript-${label}-${String(count)}`,
    banner: "banner-create-element",
    javascriptRenders: isCompiled ? 1 : count + 1,
    typescriptRenders: isCompiled ? 1 : count + 1,
}));

describe("gtkx build (React Compiler)", () => {
    it("preserves rendered state and interactions with the default compiler", async () => {
        using project = createProject();
        runCliOrThrow(project, ["build"]);

        const result = await runApp(project);

        expect(result.status).toBe(0);
        expect(result.signal).toBeNull();
        expect(result.reports).toEqual(renderedCounters(FIRST_LABEL));
    });

    it("builds an interactive application with the compiler disabled", async () => {
        using project = createProject("reactCompiler: false");
        runCliOrThrow(project, ["build"]);

        const result = await runApp(project);

        expect(result.status).toBe(0);
        expect(result.signal).toBeNull();
        expect(result.reports).toEqual(renderedCounters(FIRST_LABEL, false));
    });

    it("renders changed component code after rebuilding with the same cache", async () => {
        using project = createProject();
        runCliOrThrow(project, ["build"]);
        const first = await runApp(project);
        expect(first.status).toBe(0);
        expect(first.reports).toEqual(renderedCounters(FIRST_LABEL));

        const entry = join(project.root, "src/index.tsx");
        writeFileSync(entry, readFileSync(entry, "utf8").replace(FIRST_LABEL, () => SECOND_LABEL));
        runCliOrThrow(project, ["build"]);
        const second = await runApp(project);

        expect(second.status).toBe(0);
        expect(second.signal).toBeNull();
        expect(second.reports).toEqual(renderedCounters(SECOND_LABEL));
    });

    it("builds an interactive application when its cache is not writable", async () => {
        using project = createProject("", READ_ONLY_CACHE);
        const cache = join(project.root, READ_ONLY_CACHE);
        mkdirSync(cache);
        chmodSync(cache, 0o500);

        try {
            runCliOrThrow(project, ["build"]);
            const result = await runApp(project);

            expect(result.status).toBe(0);
            expect(result.signal).toBeNull();
            expect(result.reports).toEqual(renderedCounters(FIRST_LABEL));
        } finally {
            chmodSync(cache, 0o700);
        }
    });

    it("rejects an invalid compiler configuration", () => {
        using project = createProject("reactCompiler: { compilationMode: \"unsupported\" }");

        expect(runCli(project, ["build"]).status).not.toBe(0);
    });

    it("rejects invalid component syntax", () => {
        using project = createProject();
        writeFileSync(join(project.root, "src/index.tsx"), "export const App = () => <;");

        expect(runCli(project, ["build"]).status).not.toBe(0);
    });
});
