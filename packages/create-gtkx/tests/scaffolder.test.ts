import { readFileSync } from "node:fs";
import { join } from "node:path";
import ejs from "ejs";
import { vol } from "memfs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackageManager } from "../src/options.js";
import { type CreateOptions, type ScaffolderDeps, scaffold } from "../src/scaffolder.js";
import { listTemplates, type TemplateContext } from "../src/templates.js";

const TEST_DIR = "/test-workspace";
const TEST_SELF_VERSION = "1.2.3";
const TEMPLATES_DIR = join(import.meta.dirname, "..", "templates");

type RecordedInstall = {
    cwd: string;
    packageManager: PackageManager;
    dependencies: string[];
    dev: boolean;
};

type Harness = {
    deps: ScaffolderDeps;
    installs: RecordedInstall[];
    installShouldThrow: boolean;
    gitCalls: string[];
    gitShouldThrow: boolean;
    notes: Array<{ message: string; title: string }>;
    logs: { info: string[]; error: string[] };
    exit: ReturnType<typeof vi.fn<(code: number) => void>>;
    detectedPm: PackageManager | undefined;
};

type ScaffolderFs = ScaffolderDeps["fs"];

const renderRealTemplate = (templateName: string, context: TemplateContext): string => {
    const templateContent = readFileSync(join(TEMPLATES_DIR, templateName), "utf-8");
    return ejs.render(templateContent, context);
};

const buildHarness = (overrides: Partial<Omit<Harness, "deps">> = {}): Harness => {
    const installs: RecordedInstall[] = [];
    const gitCalls: string[] = [];
    const notes: Array<{ message: string; title: string }> = [];
    const logs = { info: [] as string[], error: [] as string[] };
    const state = {
        installs,
        installShouldThrow: false,
        gitCalls,
        gitShouldThrow: false,
        notes,
        logs,
        exit: vi.fn<(code: number) => void>(),
        detectedPm: undefined as PackageManager | undefined,
        ...overrides,
    };
    const exit: ScaffolderDeps["exit"] = (code) => {
        state.exit(code);
        return undefined as never;
    };
    const fs: ScaffolderFs = {
        existsSync: (p) => vol.existsSync(p),
        mkdirSync: (p, opts) => {
            vol.mkdirSync(p, opts);
        },
        writeFileSync: (p, content) => {
            vol.writeFileSync(p, content);
        },
    };
    const deps: ScaffolderDeps = {
        cwd: () => TEST_DIR,
        selfVersion: TEST_SELF_VERSION,
        fs,
        prompts: {
            intro: () => undefined,
            note: (message, title) => {
                state.notes.push({ message: message ?? "", title: title ?? "" });
            },
            cancel: () => undefined,
            text: () => Promise.resolve(""),
            select: <Value>() => Promise.resolve(undefined as Value),
            confirm: () => Promise.resolve(true),
            isCancel: (_value): _value is symbol => false,
            spinner: () => ({ start: () => undefined, stop: () => undefined }),
            log: {
                info: (message) => {
                    state.logs.info.push(message);
                },
                error: (message) => {
                    state.logs.error.push(message);
                },
            },
        },
        listTemplates,
        render: renderRealTemplate,
        install: async (opts) => {
            state.installs.push(opts);
            if (state.installShouldThrow) throw new Error("install failed");
        },
        gitInit: async (cwd) => {
            state.gitCalls.push(cwd);
            if (state.gitShouldThrow) throw new Error("git failed");
        },
        detectPackageManager: async () => state.detectedPm,
        exit,
    };
    return { ...state, deps };
};

const defaultOptions = (overrides: Partial<CreateOptions> = {}): CreateOptions => ({
    name: "test-app",
    applicationId: "org.test.app",
    packageManager: "pnpm",
    includeTesting: false,
    ...overrides,
});

const setupVol = (): void => {
    beforeEach(() => {
        vol.reset();
        vol.mkdirSync(TEST_DIR, { recursive: true });
    });
    afterEach(() => {
        vol.reset();
    });
};

const runScaffolder = async (
    optionOverrides: Partial<CreateOptions> = {},
    harnessOverrides: Partial<Omit<Harness, "deps">> = {},
): Promise<Harness> => {
    const harness = buildHarness(harnessOverrides);
    await scaffold(harness.deps, defaultOptions(optionOverrides));
    return harness;
};

describe("scaffold (directory structure)", () => {
    setupVol();

    it("creates the src and tests directories when includeTesting=true", async () => {
        await runScaffolder({ includeTesting: true });

        expect(vol.existsSync(`${TEST_DIR}/test-app`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/src`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/tests`)).toBe(true);
    });

    it("skips the tests directory when includeTesting=false", async () => {
        await runScaffolder();
        expect(vol.existsSync(`${TEST_DIR}/test-app/tests`)).toBe(false);
    });
});

describe("scaffold (top-level generated files)", () => {
    setupVol();

    it("writes package.json with the project name", async () => {
        await runScaffolder({ includeTesting: true });

        const content = JSON.parse(vol.readFileSync(`${TEST_DIR}/test-app/package.json`, "utf-8") as string);
        expect(content.name).toBe("test-app");
        expect(content.scripts.test).toContain("vitest");
    });

    it("writes gtkx.config.ts with the default libraries", async () => {
        await runScaffolder();

        const content = vol.readFileSync(`${TEST_DIR}/test-app/gtkx.config.ts`, "utf-8") as string;
        expect(content).toContain('import { defineConfig } from "@gtkx/config"');
        expect(content).toContain('libraries: ["Gtk-4.0", "Adw-1"]');
    });

    it("writes .gitignore with node_modules and dist", async () => {
        await runScaffolder();

        const content = vol.readFileSync(`${TEST_DIR}/test-app/.gitignore`, "utf-8") as string;
        expect(content).toContain("node_modules/");
        expect(content).toContain("dist/");
    });
});

describe("scaffold (src/* generated files)", () => {
    setupVol();

    it("derives the app title from the project name", async () => {
        await runScaffolder({ name: "my-cool-app" });

        const content = vol.readFileSync(`${TEST_DIR}/my-cool-app/src/app.tsx`, "utf-8") as string;
        expect(content).toContain('title="My Cool App"');
    });

    it("declares the application id in gtkx.config.ts and lets the application default to it", async () => {
        await runScaffolder();

        const config = vol.readFileSync(`${TEST_DIR}/test-app/gtkx.config.ts`, "utf-8") as string;
        expect(config).toContain('applicationId: "org.test.app"');

        const app = vol.readFileSync(`${TEST_DIR}/test-app/src/app.tsx`, "utf-8") as string;
        expect(app).toContain("<GtkApplication>");
        expect(app).not.toContain('import { applicationId } from "virtual:gtkx-config";');
    });

    it("writes vitest.config.ts when includeTesting=true", async () => {
        await runScaffolder({ includeTesting: true });
        expect(vol.existsSync(`${TEST_DIR}/test-app/vitest.config.ts`)).toBe(true);
    });

    it("references the generated schema declarations from gtkx-env.d.ts", async () => {
        await runScaffolder();

        const content = vol.readFileSync(`${TEST_DIR}/test-app/src/gtkx-env.d.ts`, "utf-8") as string;
        expect(content).toContain('/// <reference path="../node_modules/.gtkx/env.d.ts" />');
    });

    it("writes the initial empty schema declaration file after install", async () => {
        await runScaffolder();

        const content = vol.readFileSync(`${TEST_DIR}/test-app/node_modules/.gtkx/env.d.ts`, "utf-8") as string;
        expect(content).toContain("GSettings schema modules generated by GTKX");
        expect(content).not.toContain("declare module");
    });
});

describe("scaffold (dependency installation)", () => {
    setupVol();

    it("invokes install twice: production deps then dev deps", async () => {
        const harness = await runScaffolder({ includeTesting: true });

        expect(harness.installs).toHaveLength(2);
        const [prod, dev] = harness.installs;
        expect(prod?.dev).toBe(false);
        expect(prod?.dependencies).toEqual(["@gtkx/css@^1.2.3", "@gtkx/ffi@^1.2.3", "@gtkx/react@^1.2.3", "react"]);
        expect(dev?.dev).toBe(true);
        expect(dev?.dependencies).toEqual(
            expect.arrayContaining(["@gtkx/cli@^1.2.3", "vitest", "@gtkx/testing@^1.2.3"]),
        );
    });

    it("forwards the chosen package manager", async () => {
        const harness = await runScaffolder({ packageManager: "npm" });

        expect(harness.installs[0]?.packageManager).toBe("npm");
        expect(harness.installs[1]?.packageManager).toBe("npm");
    });

    it("continues past an install failure and logs a manual hint", async () => {
        const harness = await runScaffolder({}, { installShouldThrow: true });

        expect(harness.logs.error.some((m) => m.includes("install failed"))).toBe(true);
        expect(harness.logs.info.some((m) => m.includes("cd test-app"))).toBe(true);
    });
});

describe("scaffold (git initialization)", () => {
    setupVol();

    it("initializes the git repository in the scaffolded project", async () => {
        const harness = await runScaffolder();
        expect(harness.gitCalls).toEqual([`${TEST_DIR}/test-app`]);
    });

    it("swallows git initialization errors", async () => {
        await expect(runScaffolder({}, { gitShouldThrow: true })).resolves.toBeDefined();
        expect(vol.existsSync(`${TEST_DIR}/test-app`)).toBe(true);
    });
});

describe("scaffold (next steps)", () => {
    setupVol();

    it("prints the package-manager-specific dev command and the compositor note for vitest", async () => {
        const harness = await runScaffolder({ packageManager: "npm", includeTesting: true });

        const note = harness.notes.at(-1);
        expect(note?.message).toContain("cd test-app");
        expect(note?.message).toContain("npm run dev");
        expect(note?.message).toContain("weston");
    });

    it("prints the pnpm dev command", async () => {
        const harness = await runScaffolder({ packageManager: "pnpm", includeTesting: false });

        expect(harness.notes.at(-1)?.message).toContain("pnpm dev");
    });

    it("prints the yarn dev command", async () => {
        const harness = await runScaffolder({ packageManager: "yarn", includeTesting: false });

        expect(harness.notes.at(-1)?.message).toContain("yarn dev");
    });

    it("omits the compositor note when includeTesting=false", async () => {
        const harness = await runScaffolder();

        const note = harness.notes.at(-1);
        expect(note?.message).not.toContain("weston");
    });
});

describe("scaffold (prompting cancellations)", () => {
    setupVol();

    it("calls the exit hook when the user cancels a prompt", async () => {
        const harness = buildHarness();
        harness.deps.prompts.isCancel = (value): value is symbol => value === "__CANCEL__";
        harness.deps.prompts.text = () => Promise.resolve("__CANCEL__");

        await scaffold(harness.deps, {
            applicationId: "org.test.app",
            packageManager: "pnpm",
            includeTesting: false,
        });

        expect(harness.exit).toHaveBeenCalledWith(0);
    });

    it("uses the detected package manager as the prompt initial value when none is supplied", async () => {
        const calls: Array<{ initialValue?: PackageManager }> = [];
        const harness = buildHarness({ detectedPm: "yarn" });
        harness.deps.prompts.select = <Value>(opts: { initialValue?: Value }) => {
            calls.push({ initialValue: opts.initialValue as PackageManager });
            return Promise.resolve(opts.initialValue as Value);
        };

        await scaffold(harness.deps, { name: "test-app", applicationId: "org.test.app", includeTesting: false });

        expect(calls[0]?.initialValue).toBe("yarn");
    });
});
