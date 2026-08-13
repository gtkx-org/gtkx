import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    detectPackageManager,
    generateNodeSources,
    installCommandFor,
} from "../../../src/deploy/targets/flatpak-sources.js";
import { runCliTool } from "../../../src/internal/run-cli-tool.js";
import { installTempProject, removeTempProject, type TempProject } from "../fixtures/project.js";

const state: { project: TempProject } = { project: { root: "", settings: {} as TempProject["settings"] } };

const invocation = (): { tool: string; args: string[] } =>
    vi.mocked(runCliTool).mock.calls[0]?.[0] as { tool: string; args: string[] };

vi.mock("../../../src/internal/run-cli-tool.js", () => ({ runCliTool: vi.fn() }));

beforeEach(() => {
    vi.mocked(runCliTool).mockClear();
    state.project = installTempProject();
});

afterEach(() => {
    removeTempProject(state.project);
});

describe("detectPackageManager", () => {
    it("prefers the configured manager over whatever lockfile is present", () => {
        const settings = state.project.settings;
        writeFileSync(join(settings.paths.root, "package-lock.json"), "{}");
        settings.deploy = { flatpak: { packageManager: "pnpm" } };
        expect(detectPackageManager(settings)).toBe("pnpm");
    });

    it("detects the manager from the lockfile the project committed", () => {
        writeFileSync(join(state.project.settings.paths.root, "yarn.lock"), "");
        expect(detectPackageManager(state.project.settings)).toBe("yarn");
    });

    it("explains that the offline sandbox install needs a lockfile when none is committed", () => {
        expect(() => detectPackageManager(state.project.settings)).toThrow(/without a lockfile/);
    });
});

describe("installCommandFor", () => {
    it("installs offline, because the build sandbox has no network", () => {
        expect(installCommandFor("npm")).toBe("npm ci --offline");
        expect(installCommandFor("pnpm")).toBe("pnpm install --offline --frozen-lockfile");
        expect(installCommandFor("yarn")).toBe("yarn install --offline");
    });
});

describe("generateNodeSources", () => {
    it("creates the target directory, which the generator will not create itself", () => {
        const settings = state.project.settings;
        writeFileSync(join(settings.paths.root, "package-lock.json"), "{}");
        const targets = settings.paths.targets;
        rmSync(targets, { recursive: true, force: true });
        generateNodeSources(settings, "npm");
        expect(existsSync(join(targets, "flatpak"))).toBe(true);
    });

    it("reads the lockfile away from the project, where node_modules would hide every package", () => {
        const settings = state.project.settings;
        writeFileSync(join(settings.paths.root, "package-lock.json"), "{}");
        generateNodeSources(settings, "npm");
        const { tool, args } = invocation();
        expect(tool).toBe("flatpak-node-generator");
        expect(args[0]).toBe("npm");
        expect(basename(args[1] ?? "")).toBe("package-lock.json");
        expect(args[1]?.startsWith(settings.paths.root)).toBe(false);
        expect(args[3]).toBe(join(settings.paths.targets, "flatpak", "generated-sources.json"));
    });

    it("reads a lockfile the project points at explicitly", () => {
        const settings = state.project.settings;
        mkdirSync(join(settings.paths.root, "packages", "app"), { recursive: true });
        writeFileSync(join(settings.paths.root, "packages", "app", "pnpm-lock.yaml"), "");
        settings.deploy = { flatpak: { lockfile: "packages/app/pnpm-lock.yaml" } };
        generateNodeSources(settings, "pnpm");
        expect(basename(invocation().args[1] ?? "")).toBe("pnpm-lock.yaml");
    });
});
