import type { TextOptions } from "@clack/prompts";
import { vol } from "memfs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { addDependency, detectPackageManager } from "nypm";
import { x } from "tinyexec";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type CreateOptions, scaffold } from "../src/scaffolder.js";

type ScaffoldedManifest = { name?: string; scripts: Record<string, string | undefined> };
type SpinnerLine = { level: "done" | "failed"; message: string };

const clack = vi.hoisted(() => ({
    intro: vi.fn(),
    note: vi.fn(),
    cancel: vi.fn(),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), error: vi.fn() })),
    text: vi.fn<(options: TextOptions) => Promise<string | symbol>>(() => Promise.resolve("")),
    select: vi.fn((opts: { initialValue?: unknown }) => Promise.resolve(opts.initialValue)),
    confirm: vi.fn((): Promise<boolean | string> => Promise.resolve(true)),
    isCancel: vi.fn((value: unknown) => value === "__CANCEL__"),
}));

const addDependencyMock = vi.mocked(addDependency);
const detectMock = vi.mocked(detectPackageManager);
const xMock = vi.mocked(x);
const TEST_DIR = "/test-workspace";
const CANCEL_KEYSTROKE = String.fromCodePoint(3);
const spinnerLines: SpinnerLine[] = [];
const TEMPLATES_DIR = join(import.meta.dirname, "..", "src", "templates");
const SELF_VERSION = (createRequire(import.meta.url)("../package.json") as { version: string }).version;
const templateFiles: Record<string, string> = {};
const CUTOFF = ", within the minimumReleaseAge cutoff (2026-08-09T08:49:41.166Z)";
const INVALID_PROJECT_NAME_ERROR = "Project name must be lowercase letters, numbers, and hyphens only";
const PROD_ARGS = ["@gtkx/css", "@gtkx/runtime", "@gtkx/react", "react"].map((name) => pin(name)).join(" ");

const DEV_ARGS = ["@gtkx/cli", "@gtkx/config", "@gtkx/mcp", "vite", "@types/node", "@types/react", "typescript"]
    .map((name) => pin(name))
    .join(" ");

const RELEASE_AGE_FAILURE = [
    "`corepack pnpm add -D @gtkx/cli@^1.0.0` failed.",
    "[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 2 lockfile entries failed verification:",
    `  @gtkx/config@1.0.0 was published at 2026-08-09T23:05:27.984Z${CUTOFF}`,
    `  @gtkx/runtime@1.0.0 was published at 2026-08-09T23:05:26.446Z${CUTOFF}`,
].join("\n");

function readJson(path: string): ScaffoldedManifest {
    return JSON.parse(read(path)) as ScaffoldedManifest;
}

function pin(name: string): string {
    return name.startsWith("@gtkx/") ? `${name}@^${SELF_VERSION}` : name;
}

function defaultOptions(overrides: Partial<CreateOptions> = {}): CreateOptions {
    return {
        name: "test-app",
        applicationId: "org.test.app",
        packageManager: "pnpm",
        shouldIncludeTesting: false,
        ...overrides,
    };
}

function run(overrides: Partial<CreateOptions> = {}): Promise<void> {
    return scaffold(defaultOptions(overrides));
}

function runNonInteractive(overrides: Partial<CreateOptions> = {}): Promise<void> {
    return scaffold(defaultOptions({ isInteractive: false, ...overrides }));
}

function read(path: string): string {
    return vol.readFileSync(path, "utf8") as string;
}

function seedFile(relPath: string, contents: string): void {
    const full = join(TEST_DIR, relPath);
    vol.mkdirSync(dirname(full), { recursive: true });
    vol.writeFileSync(full, contents);
}

function lastNote(): string {
    return String(clack.note.mock.calls.at(-1)?.[0] ?? "");
}

function lastError(): string {
    return String(clack.log.error.mock.calls.at(-1)?.[0] ?? "");
}

function lastWarning(): string {
    return String(clack.log.warn.mock.calls.at(-1)?.[0] ?? "");
}

function lastInfo(): string {
    return String(clack.log.info.mock.calls.at(-1)?.[0] ?? "");
}

function lastSpinnerLine(): SpinnerLine | undefined {
    return spinnerLines.at(-1);
}

function trackSpinnerLine(level: SpinnerLine["level"]): (message?: string) => void {
    return (message?: string) => {
        spinnerLines.push({ level, message: message ?? "" });
    };
}

function trackedSpinner(): ReturnType<typeof clack.spinner> {
    return {
        start: vi.fn(),
        stop: vi.fn(trackSpinnerLine("done")),
        error: vi.fn(trackSpinnerLine("failed")),
    };
}

function recoverySteps(): string[] {
    return lastInfo().split("\n").slice(1).map((line) => line.trim());
}

function partialOptions(overrides: Partial<CreateOptions> = {}): CreateOptions {
    return {
        applicationId: "org.test.app",
        shouldIncludeTesting: false,
        isInteractive: true,
        ...overrides,
    };
}

async function answerPrompt(keystrokes: string, options: CreateOptions): Promise<string[]> {
    const prompts = await vi.importActual<typeof import("@clack/prompts")>("@clack/prompts");
    const input = new PassThrough();
    const output = new PassThrough();
    const frames: string[] = [];

    output.on("data", (chunk: Buffer) => {
        frames.push(stripVTControlCharacters(chunk.toString()));
    });

    clack.text.mockImplementation((textOptions) => {
        const answered = prompts.text({ ...textOptions, input, output });
        input.write(keystrokes);

        return answered;
    });

    await scaffold(options);

    return frames;
}

function answerApplicationId(keystrokes: string, name = "tasks"): Promise<string[]> {
    return answerPrompt(keystrokes, {
        name,
        packageManager: "pnpm",
        isTypescript: true,
        shouldIncludeTesting: false,
        isInteractive: true,
    });
}

function answerProjectDirectory(keystrokes: string): Promise<string[]> {
    return answerPrompt(keystrokes, partialOptions({ packageManager: "pnpm", isTypescript: true }));
}

async function expectArgumentRejected(name: string, message: string): Promise<void> {
    clack.text.mockResolvedValue("prompted-app");
    await expect(scaffold(partialOptions({ name }))).rejects.toThrow(message);
    expect(lastError()).toBe(message);
    expect(clack.text).not.toHaveBeenCalled();
    expect(vol.readdirSync(TEST_DIR)).toEqual([]);
}

function scaffoldWithSuggestedId(name: string): Promise<void> {
    return runNonInteractive({ name, applicationId: undefined });
}

async function captureInitialValue(detectedName: string | undefined): Promise<unknown> {
    detectMock.mockResolvedValueOnce(detectedName === undefined ? undefined : ({ name: detectedName } as never));
    let initialValue: unknown;

    clack.select.mockImplementationOnce((opts) => {
        initialValue = opts.initialValue;

        return Promise.resolve(opts.initialValue);
    });

    await scaffold(partialOptions({ name: "test-app" }));

    return initialValue;
}

vi.mock("@clack/prompts", () => clack);

vi.mock("nypm", () => ({
    addDependency: vi.fn(),
    detectPackageManager: vi.fn(() => Promise.resolve({ name: "pnpm" })),
}));

vi.mock("tinyexec", () => ({
    x: vi.fn(),
}));

vi.mock("node:fs", async () => {
    const memfs = await vi.importActual<typeof import("memfs")>("memfs");

    return { ...memfs.fs, default: memfs.fs };
});

vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);

beforeAll(async () => {
    const realFs = await vi.importActual<typeof import("node:fs")>("node:fs");
    const entries = realFs.readdirSync(TEMPLATES_DIR, { recursive: true, withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }

        const absolute = join(entry.parentPath, entry.name);
        templateFiles[absolute] = realFs.readFileSync(absolute, "utf8");
    }
});

beforeEach(() => {
    vi.clearAllMocks();
    spinnerLines.length = 0;
    clack.spinner.mockImplementation(trackedSpinner);
    clack.text.mockResolvedValue("");
    clack.select.mockImplementation((opts) => Promise.resolve(opts.initialValue));
    clack.confirm.mockResolvedValue(true);
    clack.isCancel.mockReturnValue(false);
    addDependencyMock.mockResolvedValue(undefined as never);
    detectMock.mockResolvedValue({ name: "pnpm" } as never);
    xMock.mockResolvedValue(undefined as never);
    vol.reset();
    vol.fromJSON(templateFiles);
    vol.mkdirSync(TEST_DIR, { recursive: true });
});

describe("scaffold (directory structure)", () => {
    it("creates the src and tests directories when shouldIncludeTesting=true", async () => {
        await run({ shouldIncludeTesting: true });
        expect(vol.existsSync(`${TEST_DIR}/test-app`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/src`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/tests`)).toBe(true);
    });

    it("skips the tests directory when shouldIncludeTesting=false", async () => {
        await run();
        expect(vol.existsSync(`${TEST_DIR}/test-app/tests`)).toBe(false);
    });
});

describe("scaffold (top-level generated files)", () => {
    it("writes package.json with the project name", async () => {
        await run({ shouldIncludeTesting: true });
        const content = readJson(`${TEST_DIR}/test-app/package.json`);
        expect(content.name).toBe("test-app");
        expect(content.scripts.test).toBe("vitest run");
    });

    it("omits the test script from package.json when shouldIncludeTesting=false", async () => {
        await run({ shouldIncludeTesting: false });
        const content = readJson(`${TEST_DIR}/test-app/package.json`);
        expect(content.scripts.test).toBeUndefined();
    });

    it("writes gtkx.config.ts with the default libraries", async () => {
        await run();
        const content = read(`${TEST_DIR}/test-app/gtkx.config.ts`);
        expect(content).toContain('import { defineConfig } from "@gtkx/config"');
        expect(content).toContain('libraries: ["Gtk-4.0"]');
    });

    it("writes .gitignore with node_modules and dist", async () => {
        await run();
        const content = read(`${TEST_DIR}/test-app/.gitignore`);
        expect(content).toContain("node_modules/");
        expect(content).toContain("dist/");
    });
});

describe("scaffold (src/* generated files)", () => {
    it("derives the app title from the project name", async () => {
        await run({ name: "my-cool-app" });
        const content = read(`${TEST_DIR}/my-cool-app/src/app.tsx`);
        expect(content).toContain('title="My Cool App"');
    });

    it("declares the application id in gtkx.config.ts and lets the application default to it", async () => {
        await run();
        const config = read(`${TEST_DIR}/test-app/gtkx.config.ts`);
        expect(config).toContain('applicationId: "org.test.app"');
        const app = read(`${TEST_DIR}/test-app/src/app.tsx`);
        expect(app).toContain("<GtkApplication>");
        expect(app).not.toContain('import { applicationId } from "virtual:gtkx-config";');
    });

    it("writes vitest.config.ts when shouldIncludeTesting=true", async () => {
        await run({ shouldIncludeTesting: true });
        expect(vol.existsSync(`${TEST_DIR}/test-app/vitest.config.ts`)).toBe(true);
    });

    it("omits vitest.config.ts when shouldIncludeTesting=false", async () => {
        await run();
        expect(vol.existsSync(`${TEST_DIR}/test-app/vitest.config.ts`)).toBe(false);
    });

    it("references the generated schema declarations from gtkx-env.d.ts", async () => {
        await run();
        const content = read(`${TEST_DIR}/test-app/src/gtkx-env.d.ts`);
        expect(content).toContain('/// <reference path="../node_modules/.gtkx/env.d.ts" />');
    });

    it("writes the initial empty schema declaration file after install", async () => {
        await run();
        const content = read(`${TEST_DIR}/test-app/node_modules/.gtkx/env.d.ts`);
        expect(content).toContain("Generated by `gtkx codegen`, `gtkx dev`, and `gtkx build`; do not edit.");
        expect(content).not.toContain("declare module");
    });
});

describe("scaffold (JavaScript variant)", () => {
    it("emits .jsx sources and a .js config instead of the TypeScript files", async () => {
        await run({ isTypescript: false, shouldIncludeTesting: true });
        expect(vol.existsSync(`${TEST_DIR}/test-app/src/app.jsx`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/src/index.jsx`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/gtkx.config.js`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/vitest.config.js`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/tests/app.test.jsx`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/src/app.tsx`)).toBe(false);
        expect(vol.existsSync(`${TEST_DIR}/test-app/gtkx.config.ts`)).toBe(false);
    });

    it("omits the TypeScript-only files", async () => {
        await run({ isTypescript: false });
        expect(vol.existsSync(`${TEST_DIR}/test-app/tsconfig.json`)).toBe(false);
        expect(vol.existsSync(`${TEST_DIR}/test-app/src/gtkx-env.d.ts`)).toBe(false);
        expect(vol.existsSync(`${TEST_DIR}/test-app/node_modules/.gtkx/env.d.ts`)).toBe(false);
    });

    it("wires the entry import to the .jsx source", async () => {
        await run({ isTypescript: false });
        expect(read(`${TEST_DIR}/test-app/src/index.jsx`)).toContain('from "./app.jsx"');
    });

    it("omits the typecheck script from package.json", async () => {
        await run({ isTypescript: false });
        const content = readJson(`${TEST_DIR}/test-app/package.json`);
        expect(content.scripts.typecheck).toBeUndefined();
    });

    it("drops typescript and @types/react from the installed dev dependencies", async () => {
        await run({ isTypescript: false, shouldIncludeTesting: true });
        const devCall = addDependencyMock.mock.calls[1];

        expect(devCall?.[0]).toEqual([
            pin("@gtkx/cli"),
            pin("@gtkx/config"),
            pin("@gtkx/mcp"),
            "vite",
            pin("@gtkx/testing"),
            "vitest",
        ]);
    });
});

describe("scaffold (dependency installation)", () => {
    it("invokes install twice: pinned production deps then dev deps with silent flag", async () => {
        await run({ shouldIncludeTesting: true });
        expect(addDependencyMock).toHaveBeenCalledTimes(2);
        const [prodCall, devCall] = addDependencyMock.mock.calls;
        expect(prodCall?.[0]).toEqual([pin("@gtkx/css"), pin("@gtkx/runtime"), pin("@gtkx/react"), "react"]);

        expect(prodCall?.[1]).toEqual({
            cwd: `${TEST_DIR}/test-app`,
            packageManager: "pnpm",
            dev: false,
            silent: true,
        });

        expect(devCall?.[1]).toMatchObject({ dev: true, silent: true });

        expect(devCall?.[0]).toEqual([
            pin("@gtkx/cli"),
            pin("@gtkx/config"),
            pin("@gtkx/mcp"),
            "vite",
            "@types/node",
            "@types/react",
            "typescript",
            pin("@gtkx/testing"),
            "vitest",
        ]);
    });

    it("pins @gtkx packages to the current create-gtkx version", () => {
        expect(SELF_VERSION).toMatch(/^\d+\.\d+\.\d+/);
        expect(pin("@gtkx/css")).toBe(`@gtkx/css@^${SELF_VERSION}`);
        expect(pin("react")).toBe("react");
    });

    it("forwards the chosen package manager", async () => {
        await run({ packageManager: "npm" });
        expect(addDependencyMock.mock.calls[0]?.[1]).toMatchObject({ packageManager: "npm" });
        expect(addDependencyMock.mock.calls[1]?.[1]).toMatchObject({ packageManager: "npm" });
    });

    it("hides an inherited allow-scripts policy from the install, then restores it", async () => {
        process.env.npm_config_allow_scripts = "nx";
        let seen: string | undefined = "unset";

        addDependencyMock.mockImplementation(() => {
            seen = process.env.npm_config_allow_scripts;

            return Promise.resolve(undefined as never);
        });

        await run({ packageManager: "npm" });
        expect(seen).toBeUndefined();
        expect(process.env.npm_config_allow_scripts).toBe("nx");
        delete process.env.npm_config_allow_scripts;
    });
});

describe("scaffold (install failure)", () => {
    it("aborts with a non-zero exit and the commands that re-add every dependency", async () => {
        addDependencyMock.mockRejectedValueOnce(new Error("install failed"));
        await expect(run({ packageManager: "npm" })).rejects.toThrow(/Failed to install dependencies/);
        expect(lastError()).toContain("install failed");
        expect(recoverySteps()).toEqual(["cd test-app", `npm install ${PROD_ARGS}`, `npm install -D ${DEV_ARGS}`]);
        expect(clack.log.warn).not.toHaveBeenCalled();
    });

    it("announces the failed install on a failed spinner line instead of repeating it", async () => {
        addDependencyMock.mockRejectedValueOnce(new Error("install failed"));
        await expect(run()).rejects.toThrow(/Failed to install dependencies/);
        expect(lastSpinnerLine()).toEqual({ level: "failed", message: "Failed to install dependencies" });
        expect(clack.log.error).toHaveBeenCalledTimes(1);
        expect(lastError()).toBe("install failed");
    });

    it("recovers by adding the dependencies rather than a plain install", async () => {
        addDependencyMock.mockRejectedValueOnce(new Error("install failed"));
        await expect(run()).rejects.toThrow(/Failed to install dependencies/);
        expect(lastInfo()).toContain("safe to repeat");
        expect(recoverySteps()).not.toContain("pnpm install");
    });

    it("omits the cd step when scaffolding into the current directory", async () => {
        addDependencyMock.mockRejectedValueOnce(new Error("install failed"));
        await expect(run({ name: "." })).rejects.toThrow(/Failed to install dependencies/);
        expect(recoverySteps()).toEqual([`pnpm add ${PROD_ARGS}`, `pnpm add -D ${DEV_ARGS}`]);
    });
});

describe("scaffold (release-age install failure)", () => {
    it("explains pnpm's release-age policy and lists the versions it rejected", async () => {
        addDependencyMock.mockRejectedValueOnce(new Error(RELEASE_AGE_FAILURE));
        await expect(run()).rejects.toThrow(/Failed to install dependencies/);
        const warning = lastWarning();
        expect(warning).toContain("minimumReleaseAge policy");
        expect(warning).toContain("\nminimumReleaseAgeExclude:\n  - '@gtkx/config@1.0.0'\n  - '@gtkx/runtime@1.0.0'");
    });

    it("puts the exclusion at the top level and warns that a later install can name more", async () => {
        addDependencyMock.mockRejectedValueOnce(new Error(RELEASE_AGE_FAILURE));
        await expect(run()).rejects.toThrow(/Failed to install dependencies/);
        const warning = lastWarning();
        expect(warning).toContain("sibling of packages: and allowBuilds:");
        expect(warning).toContain("a later install can name more");
    });

    it("keeps the raw package manager output and the re-add commands alongside the explanation", async () => {
        addDependencyMock.mockRejectedValueOnce(new Error(RELEASE_AGE_FAILURE));
        await expect(run()).rejects.toThrow(/Failed to install dependencies/);
        expect(lastError()).toContain("ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION");
        expect(recoverySteps()).toEqual(["cd test-app", `pnpm add ${PROD_ARGS}`, `pnpm add -D ${DEV_ARGS}`]);
    });

    it("never writes the exclusion into the scaffolded pnpm-workspace.yaml", async () => {
        addDependencyMock.mockRejectedValueOnce(new Error(RELEASE_AGE_FAILURE));
        await expect(run()).rejects.toThrow(/Failed to install dependencies/);
        const workspace = read(`${TEST_DIR}/test-app/pnpm-workspace.yaml`);
        expect(workspace).not.toContain("minimumReleaseAgeExclude");
        expect(workspace).not.toContain("minimumReleaseAge");
    });
});

describe("scaffold (git initialization)", () => {
    it("runs git init, add -A, and commit in the scaffolded project", async () => {
        await run();
        expect(xMock).toHaveBeenCalledTimes(3);

        expect(xMock).toHaveBeenNthCalledWith(
            1,
            "git",
            ["init"],
            expect.objectContaining({ nodeOptions: { cwd: `${TEST_DIR}/test-app` } }),
        );

        expect(xMock).toHaveBeenNthCalledWith(2, "git", ["add", "-A"], expect.anything());
        expect(xMock).toHaveBeenNthCalledWith(3, "git", ["commit", "-m", "Initial commit"], expect.anything());
    });

    it("swallows git initialization errors and marks its spinner line as failed", async () => {
        xMock.mockRejectedValueOnce(new Error("git failed"));
        await expect(run()).resolves.toBeUndefined();
        expect(vol.existsSync(`${TEST_DIR}/test-app`)).toBe(true);
        expect(lastSpinnerLine()).toEqual({ level: "failed", message: "Failed to initialize git repository" });
    });
});

describe("scaffold (next steps)", () => {
    it("prints the package-manager-specific dev command and the compositor note for vitest", async () => {
        await run({ packageManager: "npm", shouldIncludeTesting: true });
        const note = lastNote();
        expect(note).toContain("cd test-app");
        expect(note).toContain("npm run dev");
        expect(note).toContain("sway");
    });

    it("prints the pnpm dev command", async () => {
        await run({ packageManager: "pnpm", shouldIncludeTesting: false });
        expect(lastNote()).toContain("pnpm dev");
    });

    it("prints the yarn dev command", async () => {
        await run({ packageManager: "yarn", shouldIncludeTesting: false });
        expect(lastNote()).toContain("yarn dev");
    });

    it("omits the compositor note when shouldIncludeTesting=false", async () => {
        await run();
        expect(lastNote()).not.toContain("weston");
    });
});

describe("scaffold (prompting)", () => {
    it("cancels the operation and aborts when the user cancels a prompt", async () => {
        clack.text.mockResolvedValueOnce("__CANCEL__");
        clack.isCancel.mockImplementationOnce((value) => value === "__CANCEL__");
        await expect(scaffold(partialOptions({ packageManager: "pnpm" }))).rejects.toThrow(/Operation canceled/);
        expect(clack.cancel).toHaveBeenCalledWith("Operation canceled");
    });

    it("uses a detected supported package manager as the prompt initial value", async () => {
        expect(await captureInitialValue("yarn")).toBe("yarn");
    });

    it("falls back to pnpm when the detected package manager is unsupported", async () => {
        expect(await captureInitialValue("bun")).toBe("pnpm");
    });

    it("falls back to pnpm when no package manager is detected", async () => {
        expect(await captureInitialValue(undefined)).toBe("pnpm");
    });
});

describe("scaffold (application id prompt)", () => {
    it("suggests the application id as a placeholder the typed answer replaces", async () => {
        const frames = await answerApplicationId("com.gtkx.tutorial\r");
        expect(frames.some((frame) => frame.includes("com.tasks.app"))).toBe(true);
        expect(frames.filter((frame) => frame.includes("com.tasks.appc"))).toEqual([]);
        expect(read(`${TEST_DIR}/tasks/gtkx.config.ts`)).toContain('applicationId: "com.gtkx.tutorial"');
    });

    it("scaffolds the suggested application id when the prompt is submitted empty", async () => {
        await answerApplicationId("\r");
        expect(read(`${TEST_DIR}/tasks/gtkx.config.ts`)).toContain('applicationId: "com.tasks.app"');
    });

    it("accepts an empty answer when the project name starts with a digit", async () => {
        await answerApplicationId("\r", "42-app");
        expect(read(`${TEST_DIR}/42-app/gtkx.config.ts`)).toContain('applicationId: "com._42app.app"');
        expect(clack.log.error).not.toHaveBeenCalled();
    });

    it("keeps the prompt open instead of failing the run when the typed application id is invalid", async () => {
        clack.isCancel.mockImplementation((value) => typeof value === "symbol");
        await expect(answerApplicationId(`nodots\r${CANCEL_KEYSTROKE}`)).rejects.toThrow(/Operation canceled/);
        expect(clack.text).toHaveBeenCalledTimes(1);
        expect(clack.log.error).not.toHaveBeenCalled();
    });
});

describe("scaffold (suggested application id)", () => {
    it("prefixes a suggestion whose middle segment would start with a digit", async () => {
        await scaffoldWithSuggestedId("2048");
        expect(read(`${TEST_DIR}/2048/gtkx.config.ts`)).toContain('applicationId: "com._2048.app"');
    });

    it("suggests a valid id when the project name collapses to nothing", async () => {
        await scaffoldWithSuggestedId("---");
        expect(read(`${TEST_DIR}/---/gtkx.config.ts`)).toContain('applicationId: "com._.app"');
    });

    it("keeps the suggestion within the length the id format accepts", async () => {
        await scaffoldWithSuggestedId("a".repeat(250));
        const config = read(`${TEST_DIR}/${"a".repeat(250)}/gtkx.config.ts`);
        expect(config).toContain(`applicationId: "com.${"a".repeat(247)}.app"`);
    });
});

describe("scaffold (non-interactive and overwrite)", () => {
    it("rejects a flag-supplied name with an invalid format", async () => {
        await expect(runNonInteractive({ name: "Invalid_Name" })).rejects.toThrow(/lowercase letters/);
        expect(lastError()).toContain("lowercase letters");
    });

    it("rejects a flag-supplied name whose directory is non-empty without overwrite", async () => {
        seedFile("test-app/keep.txt", "keep");
        await expect(runNonInteractive()).rejects.toThrow(/is not empty/);
        expect(lastError()).toContain("is not empty");
    });

    it("proceeds without prompting when the target directory exists but is empty", async () => {
        vol.mkdirSync(`${TEST_DIR}/test-app`, { recursive: true });
        await runNonInteractive();
        expect(clack.log.error).not.toHaveBeenCalled();
        expect(vol.existsSync(`${TEST_DIR}/test-app/package.json`)).toBe(true);
    });

    it("proceeds when the target directory contains only a .git folder and preserves it", async () => {
        seedFile("test-app/.git/config", "[core]");
        await runNonInteractive();
        expect(clack.log.error).not.toHaveBeenCalled();
        expect(vol.existsSync(`${TEST_DIR}/test-app/.git/config`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/package.json`)).toBe(true);
    });

    it("resolves defaults from a partial non-TTY invocation without prompting", async () => {
        await scaffold({ name: "test-app", isInteractive: false });
        expect(clack.text).not.toHaveBeenCalled();
        expect(clack.select).not.toHaveBeenCalled();
        expect(clack.confirm).not.toHaveBeenCalled();
        const config = read(`${TEST_DIR}/test-app/gtkx.config.ts`);
        expect(config).toContain('applicationId: "com.testapp.app"');
        const pkg = readJson(`${TEST_DIR}/test-app/package.json`);
        expect(pkg.scripts.test).toBe("vitest run");
        expect(vol.existsSync(`${TEST_DIR}/test-app/vitest.config.ts`)).toBe(true);
        expect(addDependencyMock.mock.calls[0]?.[1]).toMatchObject({ packageManager: "pnpm" });
    });
});

describe("scaffold (unusable inputs)", () => {
    it("reports an unknown package manager as one line naming the values it accepts", async () => {
        await expect(runNonInteractive({ packageManager: "bun" })).rejects.toThrow(/Unknown package manager "bun"/);
        expect(lastError()).toBe('Unknown package manager "bun". Expected one of: pnpm, npm, yarn');
        expect(vol.existsSync(`${TEST_DIR}/test-app`)).toBe(false);
    });

    it("reports a target that already exists as a file instead of reading it as a directory", async () => {
        seedFile("test-app", "not a directory");
        await expect(runNonInteractive()).rejects.toThrow(/is not a directory/);
        expect(lastError()).toBe('Target "test-app" is not a directory');
        expect(read(`${TEST_DIR}/test-app`)).toBe("not a directory");
    });

    it("reports a project directory it cannot create once, on a failed spinner line", async () => {
        seedFile("apps", "not a directory");
        const scaffolded = runNonInteractive({ name: "apps/my-app" });
        await expect(scaffolded).rejects.toThrow(/Failed to create the project structure/);
        expect(spinnerLines).toEqual([{ level: "failed", message: "Failed to create the project structure" }]);
        expect(clack.log.error).toHaveBeenCalledTimes(1);
        expect(lastError()).toContain("ENOTDIR");
        expect(lastError()).toContain("apps/my-app");
        expect(lastError()).not.toContain("Failed to create the project structure");
    });

    it("rejects an omitted project directory without prompting", async () => {
        const scaffolded = scaffold({ applicationId: "org.test.app", isInteractive: false });
        await expect(scaffolded).rejects.toThrow(/Project directory is required/);
        expect(lastError()).toBe("Project directory is required");
        expect(clack.text).not.toHaveBeenCalled();
        expect(vol.existsSync(`${TEST_DIR}/package.json`)).toBe(false);
    });

    it("rejects an empty project directory the way an omitted one is rejected", async () => {
        await expect(runNonInteractive({ name: "" })).rejects.toThrow(/Project directory is required/);
        expect(lastError()).toBe("Project directory is required");
        expect(vol.existsSync(`${TEST_DIR}/package.json`)).toBe(false);
    });

    it("rejects an empty flag-supplied application id", async () => {
        await expect(runNonInteractive({ applicationId: "" })).rejects.toThrow(/Application ID is required/);
        expect(lastError()).toBe("Application ID is required");
        expect(vol.existsSync(`${TEST_DIR}/test-app`)).toBe(false);
    });

    it("rejects a flag-supplied application id that is not reverse domain notation", async () => {
        await expect(runNonInteractive({ applicationId: "nodots" })).rejects.toThrow(/reverse domain notation/);
        expect(lastError()).toBe("Application ID must be reverse domain notation (e.g., com.example.myapp)");
        expect(vol.existsSync(`${TEST_DIR}/test-app`)).toBe(false);
    });

    it("rejects a project directory left empty by sanitization", async () => {
        await expect(runNonInteractive({ name: "/" })).rejects.toThrow(/Project directory is required/);
        expect(lastError()).toBe("Project directory is required");
        expect(vol.existsSync(`${TEST_DIR}/package.json`)).toBe(false);
    });
});

describe("scaffold (overwrite)", () => {
    it("preserves .git while clearing other files when --overwrite is set", async () => {
        seedFile("test-app/.git/config", "[core]");
        seedFile("test-app/stale.txt", "stale");
        await run({ shouldOverwrite: true });
        expect(vol.existsSync(`${TEST_DIR}/test-app/stale.txt`)).toBe(false);
        expect(vol.existsSync(`${TEST_DIR}/test-app/.git/config`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/package.json`)).toBe(true);
    });

    it("empties an existing directory when --overwrite is set", async () => {
        seedFile("test-app/stale.txt", "stale");
        await run({ shouldOverwrite: true });
        expect(vol.existsSync(`${TEST_DIR}/test-app/stale.txt`)).toBe(false);
        expect(vol.existsSync(`${TEST_DIR}/test-app/package.json`)).toBe(true);
    });
});

describe("scaffold (cancellation after the overwrite answer)", () => {
    it("keeps the target contents when the package manager prompt is canceled", async () => {
        seedFile("test-app/keep.txt", "keep");
        seedFile("test-app/src/main.js", "work");
        clack.select.mockResolvedValueOnce("__CANCEL__");
        clack.isCancel.mockImplementation((value) => value === "__CANCEL__");
        await expect(scaffold(partialOptions({ name: "test-app" }))).rejects.toThrow(/Operation canceled/);
        expect(read(`${TEST_DIR}/test-app/keep.txt`)).toBe("keep");
        expect(read(`${TEST_DIR}/test-app/src/main.js`)).toBe("work");
    });

    it("keeps the target contents when the TypeScript prompt is canceled", async () => {
        seedFile("test-app/keep.txt", "keep");
        clack.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce("__CANCEL__");
        clack.isCancel.mockImplementation((value) => value === "__CANCEL__");
        const canceled = scaffold(partialOptions({ name: "test-app", packageManager: "pnpm" }));
        await expect(canceled).rejects.toThrow(/Operation canceled/);
        expect(read(`${TEST_DIR}/test-app/keep.txt`)).toBe("keep");
    });
});

describe("scaffold (directory target)", () => {
    it("scaffolds into a nested path and derives the package name from its basename", async () => {
        await runNonInteractive({ name: "apps/my-app" });
        expect(vol.existsSync(`${TEST_DIR}/apps/my-app/src/index.tsx`)).toBe(true);
        const pkg = readJson(`${TEST_DIR}/apps/my-app/package.json`);
        expect(pkg.name).toBe("my-app");
    });

    it("scaffolds into the current directory when the target is '.'", async () => {
        await runNonInteractive({ name: "." });
        expect(vol.existsSync(`${TEST_DIR}/package.json`)).toBe(true);
        const pkg = readJson(`${TEST_DIR}/package.json`);
        expect(pkg.name).toBe("test-workspace");
        expect(lastNote()).not.toContain("cd .");
    });

    it("omits the cd step when an absolute target names the current directory", async () => {
        await runNonInteractive({ name: TEST_DIR });
        expect(vol.existsSync(`${TEST_DIR}/package.json`)).toBe(true);
        expect(lastNote()).not.toContain("cd ");
    });
});

describe("scaffold (interactive target argument)", () => {
    it("prompts for the project directory when the argument is omitted", async () => {
        clack.text.mockResolvedValue("prompted-app");
        await scaffold(partialOptions());
        expect(clack.text).toHaveBeenCalled();
        expect(vol.existsSync(`${TEST_DIR}/prompted-app/package.json`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/package.json`)).toBe(false);
    });

    it("rejects an empty argument instead of prompting for another directory", async () => {
        await expectArgumentRejected("", "Project directory is required");
    });

    it("rejects an argument left empty by sanitization instead of prompting for another directory", async () => {
        await expectArgumentRejected("/", "Project directory is required");
    });

    it("keeps the prompt open instead of scaffolding when the typed project directory is invalid", async () => {
        clack.isCancel.mockImplementation((value) => typeof value === "symbol");
        const answered = answerProjectDirectory(`Bad_Name\r${CANCEL_KEYSTROKE}`);
        await expect(answered).rejects.toThrow(/Operation canceled/);
        expect(clack.text).toHaveBeenCalledTimes(1);
        expect(clack.log.error).not.toHaveBeenCalled();
        expect(vol.existsSync(`${TEST_DIR}/Bad_Name`)).toBe(false);
        expect(vol.existsSync(`${TEST_DIR}/package.json`)).toBe(false);
    });

    it("rejects an argument with an invalid format instead of prompting for another directory", async () => {
        await expectArgumentRejected("Invalid_Name", INVALID_PROJECT_NAME_ERROR);
    });
});
