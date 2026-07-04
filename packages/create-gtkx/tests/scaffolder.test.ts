import { createRequire } from "node:module";
import { join } from "node:path";
import { vol } from "memfs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const clack = vi.hoisted(() => ({
    intro: vi.fn(),
    note: vi.fn(),
    cancel: vi.fn(),
    log: { info: vi.fn(), error: vi.fn() },
    spinner: vi.fn(() => ({ start: () => undefined, stop: () => undefined })),
    text: vi.fn(async () => ""),
    select: vi.fn(async (opts: { initialValue?: unknown }) => opts.initialValue),
    confirm: vi.fn(async () => true),
    isCancel: vi.fn((_value: unknown) => false),
}));

vi.mock("@clack/prompts", () => clack);

vi.mock("nypm", () => ({
    addDependency: vi.fn(async () => undefined),
    detectPackageManager: vi.fn(async () => ({ name: "pnpm" })),
}));

vi.mock("tinyexec", () => ({
    x: vi.fn(async () => undefined),
}));

vi.mock("node:fs", async () => {
    const memfs = await vi.importActual<typeof import("memfs")>("memfs");
    return { ...memfs.fs, default: memfs.fs };
});

import { addDependency, detectPackageManager } from "nypm";
import { x } from "tinyexec";
import { type CreateOptions, scaffold } from "../src/scaffolder.js";

const addDependencyMock = vi.mocked(addDependency);
const detectMock = vi.mocked(detectPackageManager);
const xMock = vi.mocked(x);

const TEST_DIR = "/test-workspace";
const TEMPLATES_DIR = join(import.meta.dirname, "..", "src", "templates");
const SELF_VERSION = (createRequire(import.meta.url)("../package.json") as { version: string }).version;

const pin = (name: string): string => (name.startsWith("@gtkx/") ? `${name}@^${SELF_VERSION}` : name);

vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);
const exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation(((_code?: string | number | null) => undefined) as (code?: string | number | null) => never);

const templateFiles: Record<string, string> = {};

beforeAll(async () => {
    const realFs = await vi.importActual<typeof import("node:fs")>("node:fs");
    for (const entry of realFs.readdirSync(TEMPLATES_DIR, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const absolute = join(entry.parentPath, entry.name);
        templateFiles[absolute] = realFs.readFileSync(absolute, "utf-8");
    }
});

beforeEach(() => {
    vi.clearAllMocks();
    clack.spinner.mockImplementation(() => ({ start: () => undefined, stop: () => undefined }));
    clack.text.mockResolvedValue("");
    clack.select.mockImplementation(async (opts) => opts.initialValue);
    clack.confirm.mockResolvedValue(true);
    clack.isCancel.mockReturnValue(false);
    addDependencyMock.mockResolvedValue(undefined as never);
    detectMock.mockResolvedValue({ name: "pnpm" } as never);
    xMock.mockResolvedValue(undefined as never);
    vol.reset();
    vol.fromJSON(templateFiles);
    vol.mkdirSync(TEST_DIR, { recursive: true });
});

const defaultOptions = (overrides: Partial<CreateOptions> = {}): CreateOptions => ({
    name: "test-app",
    applicationId: "org.test.app",
    packageManager: "pnpm",
    includeTesting: false,
    ...overrides,
});

const run = (overrides: Partial<CreateOptions> = {}): Promise<void> => scaffold(defaultOptions(overrides));

const read = (path: string): string => vol.readFileSync(path, "utf-8") as string;

const lastNote = (): string => String(clack.note.mock.calls.at(-1)?.[0] ?? "");

describe("scaffold (directory structure)", () => {
    it("creates the src and tests directories when includeTesting=true", async () => {
        await run({ includeTesting: true });

        expect(vol.existsSync(`${TEST_DIR}/test-app`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/src`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/tests`)).toBe(true);
    });

    it("skips the tests directory when includeTesting=false", async () => {
        await run();
        expect(vol.existsSync(`${TEST_DIR}/test-app/tests`)).toBe(false);
    });
});

describe("scaffold (top-level generated files)", () => {
    it("writes package.json with the project name", async () => {
        await run({ includeTesting: true });

        const content = JSON.parse(read(`${TEST_DIR}/test-app/package.json`));
        expect(content.name).toBe("test-app");
        expect(content.scripts.test).toContain("vitest");
    });

    it("omits the test script from package.json when includeTesting=false", async () => {
        await run({ includeTesting: false });

        const content = JSON.parse(read(`${TEST_DIR}/test-app/package.json`));
        expect(content.scripts.test).toBeUndefined();
    });

    it("writes gtkx.config.ts with the default libraries", async () => {
        await run();

        const content = read(`${TEST_DIR}/test-app/gtkx.config.ts`);
        expect(content).toContain('import { defineConfig } from "@gtkx/config"');
        expect(content).toContain('libraries: ["Gtk-4.0", "Adw-1"]');
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

    it("writes vitest.config.ts when includeTesting=true", async () => {
        await run({ includeTesting: true });
        expect(vol.existsSync(`${TEST_DIR}/test-app/vitest.config.ts`)).toBe(true);
    });

    it("omits vitest.config.ts when includeTesting=false", async () => {
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

describe("scaffold (dependency installation)", () => {
    it("invokes install twice: pinned production deps then dev deps with silent flag", async () => {
        await run({ includeTesting: true });

        expect(addDependencyMock).toHaveBeenCalledTimes(2);
        const [prodCall, devCall] = addDependencyMock.mock.calls;
        expect(prodCall?.[0]).toEqual([
            pin("@gtkx/css"),
            pin("@gtkx/ffi"),
            pin("@gtkx/native"),
            pin("@gtkx/react"),
            "react",
        ]);
        expect(prodCall?.[1]).toEqual({
            cwd: `${TEST_DIR}/test-app`,
            packageManager: "pnpm",
            dev: false,
            silent: true,
        });
        expect(devCall?.[1]).toMatchObject({ dev: true, silent: true });
        expect(devCall?.[0]).toEqual(expect.arrayContaining([pin("@gtkx/cli"), "vitest", pin("@gtkx/testing")]));
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

    it("aborts with a non-zero exit and a manual install command when installation fails", async () => {
        addDependencyMock.mockRejectedValueOnce(new Error("install failed"));

        await run({ packageManager: "npm" });

        expect(clack.log.error.mock.calls.some(([m]) => String(m).includes("install failed"))).toBe(true);
        expect(clack.log.info.mock.calls.some(([m]) => String(m).includes("cd test-app"))).toBe(true);
        expect(clack.log.info.mock.calls.some(([m]) => String(m).includes("npm install"))).toBe(true);
        expect(exitSpy).toHaveBeenCalledWith(1);
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

    it("swallows git initialization errors", async () => {
        xMock.mockRejectedValueOnce(new Error("git failed"));

        await expect(run()).resolves.toBeUndefined();
        expect(vol.existsSync(`${TEST_DIR}/test-app`)).toBe(true);
    });
});

describe("scaffold (next steps)", () => {
    it("prints the package-manager-specific dev command and the compositor note for vitest", async () => {
        await run({ packageManager: "npm", includeTesting: true });

        const note = lastNote();
        expect(note).toContain("cd test-app");
        expect(note).toContain("npm run dev");
        expect(note).toContain("weston");
    });

    it("prints the pnpm dev command", async () => {
        await run({ packageManager: "pnpm", includeTesting: false });
        expect(lastNote()).toContain("pnpm dev");
    });

    it("prints the yarn dev command", async () => {
        await run({ packageManager: "yarn", includeTesting: false });
        expect(lastNote()).toContain("yarn dev");
    });

    it("omits the compositor note when includeTesting=false", async () => {
        await run();
        expect(lastNote()).not.toContain("weston");
    });
});

describe("scaffold (prompting)", () => {
    const partialOptions = (overrides: Partial<CreateOptions> = {}): CreateOptions => ({
        applicationId: "org.test.app",
        includeTesting: false,
        interactive: true,
        ...overrides,
    });

    it("cancels the operation and exits when the user cancels a prompt", async () => {
        clack.text.mockResolvedValueOnce("__CANCEL__");
        clack.isCancel.mockImplementationOnce((value) => value === "__CANCEL__");

        await scaffold(partialOptions({ packageManager: "pnpm" }));

        expect(clack.cancel).toHaveBeenCalledWith("Operation canceled");
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    const captureInitialValue = async (detectedName: string | undefined): Promise<unknown> => {
        detectMock.mockResolvedValueOnce(
            detectedName === undefined ? (undefined as never) : ({ name: detectedName } as never),
        );
        let initialValue: unknown;
        clack.select.mockImplementationOnce(async (opts) => {
            initialValue = opts.initialValue;
            return opts.initialValue;
        });

        await scaffold(partialOptions({ name: "test-app" }));
        return initialValue;
    };

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

describe("scaffold (non-interactive and overwrite)", () => {
    const lastError = (): string => String(clack.log.error.mock.calls.at(-1)?.[0] ?? "");

    it("rejects a flag-supplied name with an invalid format", async () => {
        await scaffold({
            name: "Invalid_Name",
            applicationId: "org.test.app",
            packageManager: "pnpm",
            includeTesting: false,
            interactive: false,
        });

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(lastError()).toContain("lowercase letters");
    });

    it("rejects a flag-supplied name whose directory is non-empty without overwrite", async () => {
        vol.mkdirSync(`${TEST_DIR}/test-app`, { recursive: true });
        vol.writeFileSync(`${TEST_DIR}/test-app/keep.txt`, "keep");

        await scaffold({
            name: "test-app",
            applicationId: "org.test.app",
            packageManager: "pnpm",
            includeTesting: false,
            interactive: false,
        });

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(lastError()).toContain("is not empty");
    });

    it("proceeds without prompting when the target directory exists but is empty", async () => {
        vol.mkdirSync(`${TEST_DIR}/test-app`, { recursive: true });

        await scaffold({
            name: "test-app",
            applicationId: "org.test.app",
            packageManager: "pnpm",
            includeTesting: false,
            interactive: false,
        });

        expect(exitSpy).not.toHaveBeenCalled();
        expect(vol.existsSync(`${TEST_DIR}/test-app/package.json`)).toBe(true);
    });

    it("proceeds when the target directory contains only a .git folder and preserves it", async () => {
        vol.mkdirSync(`${TEST_DIR}/test-app/.git`, { recursive: true });
        vol.writeFileSync(`${TEST_DIR}/test-app/.git/config`, "[core]");

        await scaffold({
            name: "test-app",
            applicationId: "org.test.app",
            packageManager: "pnpm",
            includeTesting: false,
            interactive: false,
        });

        expect(exitSpy).not.toHaveBeenCalled();
        expect(vol.existsSync(`${TEST_DIR}/test-app/.git/config`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/package.json`)).toBe(true);
    });

    it("preserves .git while clearing other files when --overwrite is set", async () => {
        vol.mkdirSync(`${TEST_DIR}/test-app/.git`, { recursive: true });
        vol.writeFileSync(`${TEST_DIR}/test-app/.git/config`, "[core]");
        vol.writeFileSync(`${TEST_DIR}/test-app/stale.txt`, "stale");

        await scaffold({
            name: "test-app",
            applicationId: "org.test.app",
            packageManager: "pnpm",
            includeTesting: false,
            interactive: false,
            overwrite: true,
        });

        expect(vol.existsSync(`${TEST_DIR}/test-app/stale.txt`)).toBe(false);
        expect(vol.existsSync(`${TEST_DIR}/test-app/.git/config`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/package.json`)).toBe(true);
    });

    it("resolves defaults from a partial non-TTY invocation without prompting", async () => {
        await scaffold({ name: "test-app", interactive: false });

        expect(clack.text).not.toHaveBeenCalled();
        expect(clack.select).not.toHaveBeenCalled();
        expect(clack.confirm).not.toHaveBeenCalled();

        const config = read(`${TEST_DIR}/test-app/gtkx.config.ts`);
        expect(config).toContain('applicationId: "com.testapp.app"');

        const pkg = JSON.parse(read(`${TEST_DIR}/test-app/package.json`));
        expect(pkg.scripts.test).toContain("vitest");
        expect(vol.existsSync(`${TEST_DIR}/test-app/vitest.config.ts`)).toBe(true);
        expect(addDependencyMock.mock.calls[0]?.[1]).toMatchObject({ packageManager: "pnpm" });
    });

    it("empties an existing directory when --overwrite is set", async () => {
        vol.mkdirSync(`${TEST_DIR}/test-app`, { recursive: true });
        vol.writeFileSync(`${TEST_DIR}/test-app/stale.txt`, "stale");

        await scaffold({
            name: "test-app",
            applicationId: "org.test.app",
            packageManager: "pnpm",
            includeTesting: false,
            interactive: false,
            overwrite: true,
        });

        expect(vol.existsSync(`${TEST_DIR}/test-app/stale.txt`)).toBe(false);
        expect(vol.existsSync(`${TEST_DIR}/test-app/package.json`)).toBe(true);
    });
});

describe("scaffold (directory target)", () => {
    it("scaffolds into a nested path and derives the package name from its basename", async () => {
        await scaffold({
            name: "apps/my-app",
            applicationId: "org.test.app",
            packageManager: "pnpm",
            includeTesting: false,
            interactive: false,
        });

        expect(vol.existsSync(`${TEST_DIR}/apps/my-app/src/index.tsx`)).toBe(true);
        const pkg = JSON.parse(read(`${TEST_DIR}/apps/my-app/package.json`));
        expect(pkg.name).toBe("my-app");
    });

    it("scaffolds into the current directory when the target is '.'", async () => {
        await scaffold({
            name: ".",
            applicationId: "org.test.app",
            packageManager: "pnpm",
            includeTesting: false,
            interactive: false,
        });

        expect(vol.existsSync(`${TEST_DIR}/package.json`)).toBe(true);
        const pkg = JSON.parse(read(`${TEST_DIR}/package.json`));
        expect(pkg.name).toBe("test-workspace");
        expect(lastNote()).not.toContain("cd .");
    });
});
