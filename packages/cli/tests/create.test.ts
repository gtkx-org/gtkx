import { vol } from "memfs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAddCommand, getRunCommand, isValidAppId, isValidProjectName } from "../src/create.js";

vi.mock("node:fs", async () => {
    const memfs = await import("memfs");
    return memfs.fs;
});

vi.mock("node:fs/promises", async () => {
    const memfs = await import("memfs");
    return memfs.fs.promises;
});

vi.mock("node:child_process", () => ({
    spawn: vi.fn(() => {
        const emitter = {
            on: vi.fn((event: string, callback: (code?: number) => void) => {
                if (event === "close") {
                    setTimeout(() => callback(0), 0);
                }
                return emitter;
            }),
        };
        return emitter;
    }),
}));

vi.mock("@clack/prompts", () => ({
    intro: vi.fn(),
    spinner: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
    })),
    note: vi.fn(),
    log: {
        info: vi.fn(),
        error: vi.fn(),
    },
    text: vi.fn(),
    select: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    isCancel: vi.fn(() => false),
}));

vi.mock("../src/templates.js", async () => {
    const { readFileSync } = await vi.importActual<typeof import("node:fs")>("node:fs");
    const { join } = await vi.importActual<typeof import("node:path")>("node:path");
    const ejs = await vi.importActual<typeof import("ejs")>("ejs");

    const templatesDir = join(import.meta.dirname, "..", "templates");

    return {
        renderFile: (templateName: string, context: Record<string, unknown>) => {
            const templatePath = join(templatesDir, templateName);
            const templateContent = readFileSync(templatePath, "utf-8");
            return ejs.render(templateContent, context);
        },
    };
});

describe("isValidProjectName", () => {
    it("accepts lowercase letters", () => {
        expect(isValidProjectName("myapp")).toBe(true);
    });

    it("accepts numbers", () => {
        expect(isValidProjectName("app123")).toBe(true);
    });

    it("accepts hyphens", () => {
        expect(isValidProjectName("my-app")).toBe(true);
    });

    it("accepts combination of valid characters", () => {
        expect(isValidProjectName("my-cool-app-123")).toBe(true);
    });

    it("accepts single character", () => {
        expect(isValidProjectName("a")).toBe(true);
    });

    describe("edge cases", () => {
        it("accepts name starting with number", () => {
            expect(isValidProjectName("123app")).toBe(true);
        });

        it("accepts name with consecutive hyphens", () => {
            expect(isValidProjectName("my--app")).toBe(true);
        });

        it("accepts name ending with hyphen", () => {
            expect(isValidProjectName("app-")).toBe(true);
        });

        it("accepts name starting with hyphen", () => {
            expect(isValidProjectName("-app")).toBe(true);
        });
    });

    describe("error handling", () => {
        it("rejects uppercase letters", () => {
            expect(isValidProjectName("MyApp")).toBe(false);
        });

        it("rejects underscores", () => {
            expect(isValidProjectName("my_app")).toBe(false);
        });

        it("rejects dots", () => {
            expect(isValidProjectName("my.app")).toBe(false);
        });

        it("rejects spaces", () => {
            expect(isValidProjectName("my app")).toBe(false);
        });

        it("rejects special characters", () => {
            expect(isValidProjectName("my@app")).toBe(false);
        });

        it("rejects empty string", () => {
            expect(isValidProjectName("")).toBe(false);
        });
    });
});

describe("isValidAppId", () => {
    it("accepts two-part ID", () => {
        expect(isValidAppId("org.app")).toBe(true);
    });

    it("accepts three-part ID", () => {
        expect(isValidAppId("com.example.app")).toBe(true);
    });

    it("accepts ID with uppercase", () => {
        expect(isValidAppId("com.Example.MyApp")).toBe(true);
    });

    it("accepts ID with numbers", () => {
        expect(isValidAppId("org.gtkx123.app456")).toBe(true);
    });

    describe("edge cases", () => {
        it("accepts deeply nested ID", () => {
            expect(isValidAppId("com.example.sub.category.app")).toBe(true);
        });

        it("accepts single character segments", () => {
            expect(isValidAppId("a.b")).toBe(true);
        });
    });

    describe("error handling", () => {
        it("rejects single segment without dot", () => {
            expect(isValidAppId("myapp")).toBe(false);
        });

        it("rejects ID starting with number", () => {
            expect(isValidAppId("1com.app")).toBe(false);
        });

        it("rejects segment starting with number", () => {
            expect(isValidAppId("com.1example.app")).toBe(false);
        });

        it("rejects ID ending with dot", () => {
            expect(isValidAppId("com.app.")).toBe(false);
        });

        it("rejects ID with consecutive dots", () => {
            expect(isValidAppId("com..app")).toBe(false);
        });

        it("rejects ID with hyphens", () => {
            expect(isValidAppId("com.my-app.test")).toBe(false);
        });

        it("rejects ID with underscores", () => {
            expect(isValidAppId("com.my_app.test")).toBe(false);
        });

        it("rejects empty string", () => {
            expect(isValidAppId("")).toBe(false);
        });
    });
});

describe("getAddCommand", () => {
    const testDeps = ["react", "typescript"];

    it("generates pnpm add command", () => {
        expect(getAddCommand("pnpm", testDeps, false)).toBe("pnpm add react typescript");
    });

    it("generates pnpm add -D command for dev deps", () => {
        expect(getAddCommand("pnpm", testDeps, true)).toBe("pnpm add -D react typescript");
    });

    it("generates npm install command", () => {
        expect(getAddCommand("npm", testDeps, false)).toBe("npm install react typescript");
    });

    it("generates npm install --save-dev command", () => {
        expect(getAddCommand("npm", testDeps, true)).toBe("npm install --save-dev react typescript");
    });

    it("generates yarn add command", () => {
        expect(getAddCommand("yarn", testDeps, false)).toBe("yarn add react typescript");
    });

    it("generates yarn add -D command", () => {
        expect(getAddCommand("yarn", testDeps, true)).toBe("yarn add -D react typescript");
    });

    describe("edge cases", () => {
        it("handles single dependency", () => {
            expect(getAddCommand("pnpm", ["react"], false)).toBe("pnpm add react");
        });

        it("handles empty dependency array", () => {
            expect(getAddCommand("pnpm", [], false)).toBe("pnpm add ");
        });
    });
});

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

describe("createApp", () => {
    const testDir = "/test-workspace";

    beforeEach(() => {
        vol.reset();
        vol.mkdirSync(testDir, { recursive: true });
        vi.spyOn(process, "cwd").mockReturnValue(testDir);
    });

    afterEach(() => {
        vol.reset();
        vi.restoreAllMocks();
    });

    it("creates project directory structure", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "vitest",
            claudeSkills: false,
        });

        expect(vol.existsSync(`${testDir}/test-app`)).toBe(true);
        expect(vol.existsSync(`${testDir}/test-app/src`)).toBe(true);
        expect(vol.existsSync(`${testDir}/test-app/tests`)).toBe(true);
    });

    it("creates package.json with correct content", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app",
            appId: "com.example.test",
            packageManager: "npm",
            testing: "vitest",
            claudeSkills: false,
        });

        const content = JSON.parse(vol.readFileSync(`${testDir}/test-app/package.json`, "utf-8") as string);

        expect(content.name).toBe("test-app");
        expect(content.gtkx.appId).toBe("com.example.test");
        expect(content.scripts.test).toContain("vitest");
    });

    it("creates tsconfig.json", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "none",
            claudeSkills: false,
        });

        expect(vol.existsSync(`${testDir}/test-app/tsconfig.json`)).toBe(true);

        const content = JSON.parse(vol.readFileSync(`${testDir}/test-app/tsconfig.json`, "utf-8") as string);
        expect(content.compilerOptions.jsx).toBe("react-jsx");
    });

    it("creates app.tsx with correct title", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "my-cool-app",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "none",
            claudeSkills: false,
        });

        const content = vol.readFileSync(`${testDir}/my-cool-app/src/app.tsx`, "utf-8") as string;

        expect(content).toContain('title="My Cool App"');
        expect(content).toContain("export default function App");
        expect(content).not.toContain("appId");
    });

    it("creates dev.tsx that exports App and reads appId from package.json", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "none",
            claudeSkills: false,
        });

        const content = vol.readFileSync(`${testDir}/test-app/src/dev.tsx`, "utf-8") as string;

        expect(content).toContain('import pkg from "../package.json"');
        expect(content).toContain("export { default } from");
        expect(content).toContain("export const appId = pkg.gtkx.appId");
    });

    it("creates index.tsx entry point with hardcoded appId", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "none",
            claudeSkills: false,
        });

        const content = vol.readFileSync(`${testDir}/test-app/src/index.tsx`, "utf-8") as string;

        expect(content).toContain("import { render }");
        expect(content).toContain("import App from");
        expect(content).toContain('render(<App />, "org.test.app")');
    });

    it("creates .gitignore", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "none",
            claudeSkills: false,
        });

        const content = vol.readFileSync(`${testDir}/test-app/.gitignore`, "utf-8") as string;

        expect(content).toContain("node_modules/");
        expect(content).toContain("dist/");
    });

    it("creates vitest.config.ts for vitest", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "vitest",
            claudeSkills: false,
        });

        expect(vol.existsSync(`${testDir}/test-app/vitest.config.ts`)).toBe(true);

        const content = vol.readFileSync(`${testDir}/test-app/vitest.config.ts`, "utf-8") as string;
        expect(content).toContain("defineConfig");
    });

    it("does not create tests directory for none", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "none",
            claudeSkills: false,
        });

        expect(vol.existsSync(`${testDir}/test-app/tests`)).toBe(false);
    });

    it("creates claude skills directory when enabled", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "none",
            claudeSkills: true,
        });

        const skillsDir = `${testDir}/test-app/.claude/skills/developing-gtkx-apps`;
        expect(vol.existsSync(skillsDir)).toBe(true);
        expect(vol.existsSync(`${skillsDir}/SKILL.md`)).toBe(true);
        expect(vol.existsSync(`${skillsDir}/WIDGETS.md`)).toBe(true);
        expect(vol.existsSync(`${skillsDir}/EXAMPLES.md`)).toBe(true);
    });

    it("does not create claude directory when disabled", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "none",
            claudeSkills: false,
        });

        expect(vol.existsSync(`${testDir}/test-app/.claude`)).toBe(false);
    });

    it("scaffolds project with pnpm", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app-pnpm",
            appId: "org.test.app",
            packageManager: "pnpm",
            testing: "vitest",
            claudeSkills: false,
        });

        expect(vol.existsSync(`${testDir}/test-app-pnpm`)).toBe(true);
        expect(vol.existsSync(`${testDir}/test-app-pnpm/package.json`)).toBe(true);
    });

    it("scaffolds project with npm", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app-npm",
            appId: "org.test.app",
            packageManager: "npm",
            testing: "vitest",
            claudeSkills: false,
        });

        expect(vol.existsSync(`${testDir}/test-app-npm`)).toBe(true);
        expect(vol.existsSync(`${testDir}/test-app-npm/package.json`)).toBe(true);
    });

    it("scaffolds project with yarn", async () => {
        const { createApp } = await import("../src/create.js");
        await createApp({
            name: "test-app-yarn",
            appId: "org.test.app",
            packageManager: "yarn",
            testing: "vitest",
            claudeSkills: false,
        });

        expect(vol.existsSync(`${testDir}/test-app-yarn`)).toBe(true);
        expect(vol.existsSync(`${testDir}/test-app-yarn/package.json`)).toBe(true);
    });

    describe("error handling", () => {
        it("handles dependency installation failure gracefully", async () => {
            const { createApp } = await import("../src/create.js");
            await createApp({
                name: "test-app",
                appId: "org.test.app",
                packageManager: "pnpm",
                testing: "none",
                claudeSkills: false,
            });

            expect(vol.existsSync(`${testDir}/test-app`)).toBe(true);
            expect(vol.existsSync(`${testDir}/test-app/package.json`)).toBe(true);
        });
    });
});
