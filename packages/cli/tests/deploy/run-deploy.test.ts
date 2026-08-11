import type { Config } from "@gtkx/config";
import { loadConfig } from "@gtkx/config";
import { warn } from "@gtkx/utils";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
    DeployConfig,
    DeployPayload,
    DeploySettings,
    DeployTarget,
    DeployTargetName,
    DeployTool,
} from "../../src/deploy/types.js";
import { build } from "../../src/builder.js";
import { ensureGenerated } from "../../src/codegen/run-codegen.js";
import { validateDesktopEntry, validateMetainfo } from "../../src/deploy/freedesktop/validate.js";
import { resolveNodeRuntime } from "../../src/deploy/node-runtime/index.js";
import { targetsFor } from "../../src/deploy/registry.js";
import { runDeploy } from "../../src/deploy/run-deploy.js";
import { probeTools } from "../../src/deploy/tools.js";
import { installTempProject, removeTempProject, type TempProject } from "./fixtures/project.js";

type DeployOverrides = Partial<Parameters<typeof runDeploy>[0]>;

type TestState = {
    project: TempProject;
    config: Config;
    targets: DeployTarget[];
};

const APPLICATION_ID = "com.gtkx.tutorial";
const ENTRY = "src/main.tsx";
const ARTIFACT_SIZE = 2 * 1024 * 1024;
const NODE_STUB = "node-stub";

const DEPLOY: DeployConfig = {
    summary: "Manage your tasks and to-dos",
    categories: ["Office"],
    developer: { name: "GTKX", email: "hello@gtkx.dev" },
    license: "MPL-2.0",
    version: "1.0.0",
};

const CPIO: DeployTool = { command: "cpio", purpose: "packs the payload", isOptional: false };

const state: TestState = {
    project: { root: "", settings: {} as DeploySettings },
    config: { applicationId: APPLICATION_ID, libraries: ["Gtk-4.0"], deploy: DEPLOY },
    targets: [],
};

const setConfig = (overrides: Partial<Config>): void => {
    state.config = { applicationId: APPLICATION_ID, libraries: ["Gtk-4.0"], deploy: DEPLOY, ...overrides };
};

const setDeploy = (deploy: DeployConfig): void => {
    state.config = { ...state.config, deploy: { ...DEPLOY, ...deploy } };
};

const stubTarget = (name: DeployTargetName, tools: DeployTool[] = []): DeployTarget => ({
    name,
    prefix: "/usr",
    tools,
    render: vi.fn((payload: DeployPayload) => [
        { path: join(payload.settings.paths.targets, `${name}.manifest`), contents: `manifest for ${name}` },
    ]),
    pack: vi.fn((payload: DeployPayload) =>
        Promise.resolve([{ path: join(payload.settings.paths.output, `${name}.pkg`), size: ARTIFACT_SIZE }]),
    ),
});

const deploy = (overrides: DeployOverrides = {}): Promise<void> =>
    runDeploy({
        entry: ENTRY,
        cwd: state.project.root,
        shouldPrintManifests: false,
        shouldSkipBuild: false,
        ...overrides,
    });

const deployWithStub = async (overrides: DeployOverrides = {}): Promise<DeployTarget> => {
    const target = stubTarget("deb");
    state.targets = [target];
    await deploy(overrides);

    return target;
};

const setWebkitPermissions = (finishArgs: string[]): void => {
    setConfig({ libraries: ["Gtk-4.0", "WebKit-6.0"] });
    setDeploy({ flatpak: { finishArgs } });
};

const getInvocationOrder = (mock: { mock: { invocationCallOrder: number[] } }): number =>
    mock.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER;

const getRenderedPayload = (target: DeployTarget): DeployPayload | null =>
    vi.mocked(target.render).mock.calls[0]?.[0] ?? null;

const probedCommands = (): string[] =>
    (vi.mocked(probeTools).mock.calls[0]?.[0] ?? []).map((tool) => tool.command);

const warnings = (): string[] => vi.mocked(warn).mock.calls.map((call) => call[0]);

vi.mock("@gtkx/config", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@gtkx/config")>()),
    loadConfig: vi.fn(),
}));

vi.mock("@gtkx/utils", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@gtkx/utils")>()),
    info: vi.fn(),
    warn: vi.fn(),
}));

vi.mock("../../src/builder.js", () => ({ build: vi.fn(() => Promise.resolve()) }));
vi.mock("../../src/codegen/run-codegen.js", () => ({ ensureGenerated: vi.fn(() => Promise.resolve()) }));

vi.mock("../../src/deploy/freedesktop/validate.js", () => ({
    validateDesktopEntry: vi.fn(),
    validateMetainfo: vi.fn(),
}));

vi.mock("../../src/deploy/node-runtime/index.js", () => ({ resolveNodeRuntime: vi.fn() }));

vi.mock("../../src/deploy/registry.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../src/deploy/registry.js")>()),
    targetsFor: vi.fn(),
}));

vi.mock("../../src/deploy/tools.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../src/deploy/tools.js")>()),
    probeTools: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
    state.project = installTempProject();
    state.targets = [stubTarget("deb")];
    setConfig({});
    writeFileSync(join(state.project.root, NODE_STUB), "ELF stub");

    vi.mocked(loadConfig).mockImplementation(() =>
        Promise.resolve({
            config: state.config,
            configFile: join(state.project.root, "gtkx.config.ts"),
            root: state.project.root,
        }),
    );

    vi.mocked(targetsFor).mockImplementation(() => state.targets);

    vi.mocked(resolveNodeRuntime).mockImplementation(() =>
        Promise.resolve({
            path: join(state.project.root, NODE_STUB),
            version: "24.18.1",
            glibcFloor: "2.28",
            isStripped: true,
        }),
    );

    vi.mocked(probeTools).mockReturnValue({ missingRequired: [], missingOptional: [] });
});

afterEach(() => {
    removeTempProject(state.project);
});

describe("runDeploy — code generation and build", () => {
    it("generates the bindings before it builds", async () => {
        await deploy();
        expect(ensureGenerated).toHaveBeenCalledWith(state.project.root, { shouldAnnounce: true, mode: "production" });
    });

    it("builds the entry against the project root", async () => {
        await deploy();
        expect(build).toHaveBeenCalledWith({ entry: ENTRY, vite: { root: state.project.root } });
    });

    it("generates nothing when the build is skipped", async () => {
        await deploy({ shouldSkipBuild: true });
        expect(ensureGenerated).not.toHaveBeenCalled();
    });

    it("builds nothing when the build is skipped", async () => {
        await deploy({ shouldSkipBuild: true });
        expect(build).not.toHaveBeenCalled();
    });

    it("still renders the manifests when the build is skipped", async () => {
        await deploy({ shouldSkipBuild: true });
        expect(state.targets[0]?.render).toHaveBeenCalled();
    });
});

describe("runDeploy — metadata validation", () => {
    it("validates the desktop entry before it builds", async () => {
        await deploy();

        expect(getInvocationOrder(vi.mocked(validateDesktopEntry))).toBeLessThan(
            getInvocationOrder(vi.mocked(build)),
        );
    });

    it("validates the metainfo before it builds", async () => {
        await deploy();
        expect(getInvocationOrder(vi.mocked(validateMetainfo))).toBeLessThan(getInvocationOrder(vi.mocked(build)));
    });

    it("writes the desktop entry and the metainfo it validates", async () => {
        await deploy();
        const metadata = join(state.project.root, "build/metadata");
        expect(validateDesktopEntry).toHaveBeenCalledWith(join(metadata, `${APPLICATION_ID}.desktop`));
        expect(validateMetainfo).toHaveBeenCalledWith(join(metadata, `${APPLICATION_ID}.metainfo.xml`), false);
    });

    it("treats metainfo warnings as fatal when the manifest is bound for Flathub", async () => {
        state.targets = [stubTarget("flatpak")];
        setDeploy({ flatpak: { mode: "source" } });
        await deploy();
        expect(vi.mocked(validateMetainfo).mock.calls[0]?.[1]).toBe(true);
    });

    it("leaves warnings non-fatal for a flatpak built for local distribution", async () => {
        state.targets = [stubTarget("flatpak")];
        await deploy();
        expect(vi.mocked(validateMetainfo).mock.calls[0]?.[1]).toBe(false);
    });
});

describe("runDeploy — target selection", () => {
    it("takes the targets from the list when one is given", async () => {
        await deploy({ targets: "deb, rpm" });
        expect(targetsFor).toHaveBeenCalledWith(["deb", "rpm"]);
    });

    it("ignores empty entries in the list", async () => {
        await deploy({ targets: "deb,," });
        expect(targetsFor).toHaveBeenCalledWith(["deb"]);
    });

    it("takes the targets from the configuration when no list is given", async () => {
        setDeploy({ targets: ["rpm"] });
        await deploy();
        expect(targetsFor).toHaveBeenCalledWith(["rpm"]);
    });

    it("falls back to the default targets", async () => {
        await deploy();
        expect(targetsFor).toHaveBeenCalledWith(["flatpak"]);
    });

    it("rejects a project without a deploy section", async () => {
        setConfig({ deploy: undefined });
        await expect(deploy()).rejects.toThrow("no `deploy` section");
    });
});

describe("runDeploy — manifests", () => {
    it("renders every target", async () => {
        state.targets = [stubTarget("deb"), stubTarget("rpm")];
        await deploy();
        expect(state.targets.every((target) => vi.mocked(target.render).mock.calls.length === 1)).toBe(true);
    });

    it("packs every target it rendered", async () => {
        await deploy();
        expect(state.targets[0]?.pack).toHaveBeenCalled();
    });

    it("writes each rendered manifest to its own path", async () => {
        await deploy();
        const path = join(state.project.root, "build/targets/deb.manifest");
        expect(readFileSync(path, "utf8")).toBe("manifest for deb");
    });

    it("hands the packer the manifests the target rendered", async () => {
        const target = await deployWithStub();
        expect(vi.mocked(target.pack).mock.calls[0]?.[1]).toEqual(vi.mocked(target.render).mock.results[0]?.value);
    });
});

describe("runDeploy — the payload", () => {
    it("stages the resolved Node.js runtime beside the bundle", async () => {
        const target = await deployWithStub();
        expect(getRenderedPayload(target)?.node?.version).toBe("24.18.1");
    });

    it("stages the payload and the per-target overlays", async () => {
        const payload = getRenderedPayload(await deployWithStub());
        expect(payload?.stage.map((file) => file.rel)).toContain("lib/gtkx-tutorial/bundle.js");
        expect(payload?.overlays.deb.map((file) => file.rel)).toContain("share/doc/gtkx-tutorial/copyright");
    });

    it("resolves the settings against the output directory override", async () => {
        const target = await deployWithStub({ outDir: "dist-packages" });
        expect(getRenderedPayload(target)?.settings.paths.outDir).toBe(join(state.project.root, "dist-packages"));
    });
});

describe("runDeploy — printing manifests", () => {
    it("renders the manifests", async () => {
        await deploy({ shouldPrintManifests: true });
        expect(state.targets[0]?.render).toHaveBeenCalled();
    });

    it("packs nothing", async () => {
        await deploy({ shouldPrintManifests: true });
        expect(state.targets[0]?.pack).not.toHaveBeenCalled();
    });

    it("resolves no Node.js runtime", async () => {
        await deploy({ shouldPrintManifests: true });
        expect(resolveNodeRuntime).not.toHaveBeenCalled();
    });

    it("leaves the payload without a runtime", async () => {
        const target = await deployWithStub({ shouldPrintManifests: true });
        expect(getRenderedPayload(target)?.node).toBeNull();
    });

    it("probes no packaging tools", async () => {
        state.targets = [stubTarget("deb", [CPIO])];
        await deploy({ shouldPrintManifests: true });
        expect(probedCommands()).not.toContain("cpio");
    });
});

describe("runDeploy — preflight", () => {
    it("probes the metadata validators", async () => {
        await deploy();
        expect(probedCommands()).toEqual(expect.arrayContaining(["desktop-file-validate", "appstreamcli", "strip"]));
    });

    it("probes the tools every target needs", async () => {
        state.targets = [stubTarget("deb", [CPIO])];
        await deploy();
        expect(probedCommands()).toEqual(expect.arrayContaining(["tar", "cpio"]));
    });

    it("probes the node generator when the flatpak is built from source", async () => {
        state.targets = [stubTarget("flatpak")];
        setDeploy({ flatpak: { mode: "source" } });
        await deploy();
        expect(probedCommands()).toContain("flatpak-node-generator");
    });

    it("leaves the node generator out when no flatpak is packaged", async () => {
        setDeploy({ flatpak: { mode: "source" } });
        await deploy();
        expect(probedCommands()).not.toContain("flatpak-node-generator");
    });

    it("reports the tools it cannot find", async () => {
        vi.mocked(probeTools).mockReturnValue({ missingRequired: [CPIO], missingOptional: [] });
        await expect(deploy()).rejects.toThrow("1 required tool is missing");
    });
});

describe("runDeploy — network permissions", () => {
    it("warns when a webkit app keeps the network out of its flatpak permissions", async () => {
        setWebkitPermissions(["--socket=wayland"]);
        await deploy();
        expect(warnings().join("\n")).toContain("--share=network");
    });

    it("stays quiet when the finish args share the network", async () => {
        setWebkitPermissions(["--share=network"]);
        await deploy();
        expect(warnings().join("\n")).not.toContain("--share=network");
    });

    it("stays quiet when the app declares no webkit", async () => {
        setDeploy({ flatpak: { finishArgs: ["--socket=wayland"] } });
        await deploy();
        expect(warnings()).toEqual([]);
    });

    it("stays quiet when the flatpak permissions are left unset", async () => {
        setConfig({ libraries: ["Gtk-4.0", "WebKit-6.0"] });
        await deploy();
        expect(warnings()).toEqual([]);
    });
});
