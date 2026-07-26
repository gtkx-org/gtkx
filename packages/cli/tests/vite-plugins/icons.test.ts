import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gtkxIcons } from "../../src/vite-plugins/icons.js";
import { callOutputOptions, expectComposedAsyncBanner, expectComposedBanner } from "./output-options.js";

type ConfigHook = (config: { root?: string }) => void;
type BuildEndHook = (this: { emitFile: (asset: unknown) => void }) => void;

const ICON_REL_PATH = join("icons", "hicolor", "scalable", "apps", "com.example.app.svg");

describe("gtkxIcons", () => {
    let projectDir: string;

    const writeManifest = (): void => {
        writeFileSync(join(projectDir, "package.json"), JSON.stringify({ imports: { "#data/*": "./data/*" } }));
    };

    const writeIcon = (): void => {
        const full = join(projectDir, "data", ICON_REL_PATH);
        mkdirSync(join(full, ".."), { recursive: true });
        writeFileSync(full, "<svg/>");
    };

    const configuredPlugin = (): ReturnType<typeof gtkxIcons> => {
        const plugin = gtkxIcons();
        (plugin.config as ConfigHook)({ root: projectDir });
        return plugin;
    };

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
        writeManifest();
        writeIcon();
        const plugin = configuredPlugin();
        const emitFile = vi.fn();
        (plugin.buildEnd as BuildEndHook).call({ emitFile });
        expect(emitFile).toHaveBeenCalledTimes(1);
        const asset = emitFile.mock.calls[0]?.[0] as { type: string; fileName: string; source: Buffer };
        expect(asset.type).toBe("asset");
        expect(asset.fileName).toBe(ICON_REL_PATH);
        expect(asset.source.toString()).toBe("<svg/>");
    });

    it("emits nothing without a data icons directory", () => {
        writeManifest();
        const plugin = configuredPlugin();
        const emitFile = vi.fn();
        (plugin.buildEnd as BuildEndHook).call({ emitFile });
        expect(emitFile).not.toHaveBeenCalled();
    });

    it("prepends the XDG data dirs banner to build output options when icons exist", () => {
        writeManifest();
        writeIcon();
        const plugin = configuredPlugin();
        const result = callOutputOptions(plugin, {});
        expect(result?.banner).toContain("XDG_DATA_DIRS");
        expect(result?.banner).toContain("import.meta.url");
    });

    it("keeps an existing banner ahead of nothing by combining both", () => {
        writeManifest();
        writeIcon();
        const plugin = configuredPlugin();
        const result = callOutputOptions(plugin, { banner: "existing;" });
        expect(result?.banner).toContain("XDG_DATA_DIRS");
        expect(result?.banner).toContain("existing;");
    });

    it("composes a function banner by prepending the XDG banner to its result", async () => {
        writeManifest();
        writeIcon();
        await expectComposedBanner(configuredPlugin(), "XDG_DATA_DIRS");
    });

    it("awaits an async original banner function", async () => {
        writeManifest();
        writeIcon();
        await expectComposedAsyncBanner(configuredPlugin(), "XDG_DATA_DIRS");
    });

    it("leaves output options untouched without icons", () => {
        writeManifest();
        const plugin = configuredPlugin();
        expect(callOutputOptions(plugin, {})).toBeUndefined();
    });
});
