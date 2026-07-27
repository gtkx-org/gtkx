import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { gtkxIcons } from "../../src/vite-plugins/icons.js";
import { callOutputOptions, expectComposedAsyncBanner, expectComposedBanner } from "./output-options.js";

type ConfigHook = (config: { root?: string }) => void;
type BuildEndHook = (this: { emitFile: (asset: unknown) => void }) => void;
type IconsPlugin = ReturnType<typeof gtkxIcons>;
type EmitFileMock = Mock<(asset: unknown) => void>;

const ICON_REL_PATH = join("icons", "hicolor", "scalable", "apps", "com.example.app.svg");

const writeManifest = (projectDir: string): void => {
    writeFileSync(join(projectDir, "package.json"), JSON.stringify({ imports: { "#data/*": "./data/*" } }));
};

const writeIcon = (projectDir: string): void => {
    const full = join(projectDir, "data", ICON_REL_PATH);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, "<svg/>");
};

const configuredPlugin = (projectDir: string): IconsPlugin => {
    const plugin = gtkxIcons();
    (plugin.config as ConfigHook)({ root: projectDir });

    return plugin;
};

const pluginWithIcon = (projectDir: string): IconsPlugin => {
    writeManifest(projectDir);
    writeIcon(projectDir);

    return configuredPlugin(projectDir);
};

const pluginWithoutIcons = (projectDir: string): IconsPlugin => {
    writeManifest(projectDir);

    return configuredPlugin(projectDir);
};

const callBuildEnd = (plugin: IconsPlugin): EmitFileMock => {
    const emitFile: EmitFileMock = vi.fn();
    (plugin.buildEnd as BuildEndHook).call({ emitFile });

    return emitFile;
};

describe("gtkxIcons", () => {
    let projectDir: string;

    beforeEach(() => {
        projectDir = mkdtempSync(join(tmpdir(), "gtkx-icons-plugin-test-"));
    });

    afterEach(() => {
        rmSync(projectDir, { recursive: true, force: true });
    });

    it("returns a plugin with the expected name, pre-enforce, and build-only apply", () => {
        const plugin = gtkxIcons();
        expect(plugin.name).toBe("gtkx:icons");
        expect(plugin.enforce).toBe("pre");
        expect(plugin.apply).toBe("build");
    });

    it("emits every data icon as a build asset preserving the theme layout", () => {
        const emitFile = callBuildEnd(pluginWithIcon(projectDir));
        expect(emitFile).toHaveBeenCalledTimes(1);
        const asset = emitFile.mock.calls[0]?.[0] as { type: string; fileName: string; source: Buffer };
        expect(asset.type).toBe("asset");
        expect(asset.fileName).toBe(ICON_REL_PATH);
        expect(asset.source.toString()).toBe("<svg/>");
    });

    it("emits nothing without a data icons directory", () => {
        const emitFile = callBuildEnd(pluginWithoutIcons(projectDir));
        expect(emitFile).not.toHaveBeenCalled();
    });

    it("prepends the XDG data dirs banner to build output options when icons exist", () => {
        const result = callOutputOptions(pluginWithIcon(projectDir), {});
        expect(result?.banner).toContain("XDG_DATA_DIRS");
        expect(result?.banner).toContain("import.meta.url");
    });

    it("keeps an existing banner ahead of nothing by combining both", () => {
        const result = callOutputOptions(pluginWithIcon(projectDir), { banner: "existing;" });
        expect(result?.banner).toContain("XDG_DATA_DIRS");
        expect(result?.banner).toContain("existing;");
    });

    it("composes a function banner by prepending the XDG banner to its result", async () => {
        await expectComposedBanner(pluginWithIcon(projectDir), "XDG_DATA_DIRS");
    });

    it("awaits an async original banner function", async () => {
        await expectComposedAsyncBanner(pluginWithIcon(projectDir), "XDG_DATA_DIRS");
    });

    it("leaves output options untouched without icons", () => {
        expect(callOutputOptions(pluginWithoutIcons(projectDir), {})).toBeUndefined();
    });
});
