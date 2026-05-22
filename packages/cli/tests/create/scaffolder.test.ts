import { readFileSync } from "node:fs";
import { join } from "node:path";
import ejs from "ejs";
import { vol } from "memfs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type CreateOptions,
    createScaffolder,
    getRunCommand,
    type PackageManager,
    type ScaffolderDeps,
} from "../../src/create/scaffolder.js";

const TEST_DIR = "/test-workspace";
const TEMPLATES_DIR = join(import.meta.dirname, "..", "..", "templates");

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
    exit: ReturnType<typeof vi.fn>;
    detectedPm: PackageManager | undefined;
};

const renderRealTemplate = (templateName: string, context: Record<string, unknown>): string => {
    const templateContent = readFileSync(join(TEMPLATES_DIR, templateName), "utf-8");
    return ejs.render(templateContent, context);
};

const buildHarness = (overrides: Partial<Omit<Harness, "deps">> = {}): Harness => {
    const installs: RecordedInstall[] = [];
    const gitCalls: string[] = [];
    const notes: Array<{ message: string; title: string }> = [];
    const logs = { info: [] as string[], error: [] as string[] };
    const harness: Harness = {
        installs,
        installShouldThrow: false,
        gitCalls,
        gitShouldThrow: false,
        notes,
        logs,
        exit: vi.fn(((_code: number) => undefined) as unknown as never),
        detectedPm: undefined,
        deps: null as unknown as ScaffolderDeps,
        ...overrides,
    };
    const memfsAsAny = vol as unknown as ScaffolderDeps["fs"];
    harness.deps = {
        cwd: () => TEST_DIR,
        fs: {
            existsSync: (p: string) => memfsAsAny.existsSync(p),
            mkdirSync: (p: string, opts) => memfsAsAny.mkdirSync(p, opts),
            writeFileSync: (p: string, content: string) => memfsAsAny.writeFileSync(p, content),
        },
        prompts: {
            intro: (() => undefined) as unknown as ScaffolderDeps["prompts"]["intro"],
            note: ((message: string, title?: string) => {
                notes.push({ message, title: title ?? "" });
            }) as unknown as ScaffolderDeps["prompts"]["note"],
            cancel: (() => undefined) as unknown as ScaffolderDeps["prompts"]["cancel"],
            text: (() => Promise.resolve("")) as unknown as ScaffolderDeps["prompts"]["text"],
            select: (() => Promise.resolve(undefined)) as unknown as ScaffolderDeps["prompts"]["select"],
            confirm: (() => Promise.resolve(true)) as unknown as ScaffolderDeps["prompts"]["confirm"],
            isCancel: ((_value: unknown) => false) as unknown as ScaffolderDeps["prompts"]["isCancel"],
            spinner: () => ({ start: () => undefined, stop: () => undefined }),
            log: {
                info: (msg: string) => {
                    logs.info.push(msg);
                },
                error: (msg: string) => {
                    logs.error.push(msg);
                },
            },
        },
        render: renderRealTemplate,
        install: async (opts) => {
            installs.push(opts);
            if (harness.installShouldThrow) throw new Error("install failed");
        },
        gitInit: async (cwd: string) => {
            gitCalls.push(cwd);
            if (harness.gitShouldThrow) throw new Error("git failed");
        },
        detectPackageManager: async () => harness.detectedPm,
        exit: harness.exit as unknown as (code: number) => never,
    };
    return harness;
};

const defaultOptions = (overrides: Partial<CreateOptions> = {}): CreateOptions => ({
    name: "test-app",
    appId: "org.test.app",
    packageManager: "pnpm",
    testing: "none",
    claudeSkills: false,
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
    await createScaffolder(harness.deps).run(defaultOptions(optionOverrides));
    return harness;
};

describe("getRunCommand", () => {
    it("returns pnpm dev", () => {
        expect(getRunCommand("pnpm")).toBe("pnpm dev");
    });

    it("returns npm run dev", () => {
        expect(getRunCommand("npm")).toBe("npm run dev");
    });

    it("returns yarn dev", () => {
        expect(getRunCommand("yarn")).toBe("yarn dev");
    });
});

describe("createScaffolder (directory structure)", () => {
    setupVol();

    it("creates the src and tests directories when testing=vitest", async () => {
        await runScaffolder({ testing: "vitest" });

        expect(vol.existsSync(`${TEST_DIR}/test-app`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/src`)).toBe(true);
        expect(vol.existsSync(`${TEST_DIR}/test-app/tests`)).toBe(true);
    });

    it("skips the tests directory when testing=none", async () => {
        await runScaffolder();
        expect(vol.existsSync(`${TEST_DIR}/test-app/tests`)).toBe(false);
    });
});

describe("createScaffolder (top-level generated files)", () => {
    setupVol();

    it("writes package.json with the project name", async () => {
        await runScaffolder({ testing: "vitest" });

        const content = JSON.parse(vol.readFileSync(`${TEST_DIR}/test-app/package.json`, "utf-8") as string);
        expect(content.name).toBe("test-app");
        expect(content.scripts.test).toContain("vitest");
    });

    it("writes gtkx.config.ts with the default libraries", async () => {
        await runScaffolder();

        const content = vol.readFileSync(`${TEST_DIR}/test-app/gtkx.config.ts`, "utf-8") as string;
        expect(content).toContain('import { defineConfig } from "@gtkx/cli"');
        expect(content).toContain('libraries: ["Gtk-4.0", "Adw-1"]');
    });

    it("writes .gitignore with node_modules and dist", async () => {
        await runScaffolder();

        const content = vol.readFileSync(`${TEST_DIR}/test-app/.gitignore`, "utf-8") as string;
        expect(content).toContain("node_modules/");
        expect(content).toContain("dist/");
    });
});

describe("createScaffolder (src/* generated files)", () => {
    setupVol();

    it("derives the app title from the project name", async () => {
        await runScaffolder({ name: "my-cool-app" });

        const content = vol.readFileSync(`${TEST_DIR}/my-cool-app/src/app.tsx`, "utf-8") as string;
        expect(content).toContain('title="My Cool App"');
    });

    it("uses the supplied app id in src/index.tsx", async () => {
        await runScaffolder();

        const content = vol.readFileSync(`${TEST_DIR}/test-app/src/index.tsx`, "utf-8") as string;
        expect(content).toContain('new Gtk.Application(undefined, "org.test.app")');
    });

    it("writes vitest.config.ts when testing=vitest", async () => {
        await runScaffolder({ testing: "vitest" });
        expect(vol.existsSync(`${TEST_DIR}/test-app/vitest.config.ts`)).toBe(true);
    });
});

describe("createScaffolder (claude skills)", () => {
    setupVol();

    it("writes the skills directory when enabled", async () => {
        await runScaffolder({ claudeSkills: true });

        const skillsDir = `${TEST_DIR}/test-app/.claude/skills/developing-gtkx-apps`;
        expect(vol.existsSync(skillsDir)).toBe(true);
        expect(vol.existsSync(`${skillsDir}/SKILL.md`)).toBe(true);
        expect(vol.existsSync(`${skillsDir}/WIDGETS.md`)).toBe(true);
        expect(vol.existsSync(`${skillsDir}/EXAMPLES.md`)).toBe(true);
    });

    it("skips the skills directory when disabled", async () => {
        await runScaffolder();
        expect(vol.existsSync(`${TEST_DIR}/test-app/.claude`)).toBe(false);
    });
});

describe("createScaffolder (dependency installation)", () => {
    setupVol();

    it("invokes install twice: production deps then dev deps", async () => {
        const harness = await runScaffolder({ testing: "vitest" });

        expect(harness.installs).toHaveLength(2);
        const [prod, dev] = harness.installs;
        expect(prod?.dev).toBe(false);
        expect(prod?.dependencies).toEqual(["@gtkx/css", "@gtkx/ffi", "@gtkx/react", "react"]);
        expect(dev?.dev).toBe(true);
        expect(dev?.dependencies).toEqual(
            expect.arrayContaining(["@gtkx/cli", "vitest", "@gtkx/testing", "@gtkx/vitest"]),
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

describe("createScaffolder (git initialization)", () => {
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

describe("createScaffolder (next steps)", () => {
    setupVol();

    it("prints the package-manager-specific dev command and the xvfb note for vitest", async () => {
        const harness = await runScaffolder({ packageManager: "npm", testing: "vitest" });

        const note = harness.notes.at(-1);
        expect(note?.message).toContain("cd test-app");
        expect(note?.message).toContain("npm run dev");
        expect(note?.message).toContain("xvfb");
    });

    it("omits the xvfb note when testing=none", async () => {
        const harness = await runScaffolder();

        const note = harness.notes.at(-1);
        expect(note?.message).not.toContain("xvfb");
    });
});

describe("createScaffolder (prompting cancellations)", () => {
    setupVol();

    it("calls the exit hook when the user cancels a prompt", async () => {
        const harness = buildHarness();
        harness.deps.prompts.isCancel = ((value: unknown) =>
            value === "__CANCEL__") as unknown as ScaffolderDeps["prompts"]["isCancel"];
        harness.deps.prompts.text = (() =>
            Promise.resolve("__CANCEL__")) as unknown as ScaffolderDeps["prompts"]["text"];

        const scaffolder = createScaffolder(harness.deps);
        await scaffolder.run({ appId: "org.test.app", packageManager: "pnpm", testing: "none", claudeSkills: false });

        expect(harness.exit).toHaveBeenCalledWith(0);
    });

    it("uses the detected package manager as the prompt initial value when none is supplied", async () => {
        const calls: Array<{ initialValue?: PackageManager }> = [];
        const harness = buildHarness({ detectedPm: "yarn" });
        harness.deps.prompts.select = ((opts: { initialValue?: PackageManager }) => {
            calls.push(opts);
            return Promise.resolve(opts.initialValue);
        }) as unknown as ScaffolderDeps["prompts"]["select"];

        const scaffolder = createScaffolder(harness.deps);
        await scaffolder.run({ name: "test-app", appId: "org.test.app", testing: "none", claudeSkills: false });

        expect(calls[0]?.initialValue).toBe("yarn");
    });
});
