import { describe, expect, it, vi } from "vitest";

type BuildStartHook = (this: {
    emitFile: (asset: { type: string; fileName: string; source: Buffer }) => void;
}) => void;
type TransformHook = (code: string, id: string) => string | null | undefined;
type ResolveIdHook = (id: string) => { id: string; external: boolean } | null;

const LOADER_PATH = "/fake/path/@gtkx/native/index.js";

const mockOs = (platform: string, arch: string): void => {
    vi.resetModules();
    vi.doMock("node:os", () => ({
        platform: () => platform,
        arch: () => arch,
    }));
};

const mockModuleResolution = (): void => {
    vi.doMock("node:module", () => ({
        createRequire: () => {
            const fn = (id: string) => id;
            fn.resolve = (id: string) =>
                id === "@gtkx/native/package.json" ? "/fake/path/@gtkx/native/package.json" : `/fake/path/${id}.node`;
            return fn;
        },
    }));
};

const unmockOs = (): void => {
    vi.doUnmock("node:os");
    vi.resetModules();
};

describe("gtkxNative (plugin shape)", () => {
    it("returns a plugin with the expected name and pre-enforce", async () => {
        const { gtkxNative } = await import("../../src/vite-plugins/native.js");
        const plugin = gtkxNative("/tmp");
        expect(plugin.name).toBe("gtkx:native");
        expect(plugin.enforce).toBe("pre");
    });

    it("resolveId marks the emitted binary as external", async () => {
        const { gtkxNative } = await import("../../src/vite-plugins/native.js");
        const plugin = gtkxNative("/tmp");
        expect((plugin.resolveId as ResolveIdHook)("./gtkx.node")).toEqual({
            id: "./gtkx.node",
            external: true,
        });
        expect((plugin.resolveId as ResolveIdHook)("./other.js")).toBeNull();
    });
});

describe("gtkxNative (transform)", () => {
    it("transform returns null for ids other than the native loader", async () => {
        vi.resetModules();
        mockModuleResolution();
        const { gtkxNative } = await import("../../src/vite-plugins/native.js");
        const plugin = gtkxNative("/tmp");
        const result = (plugin.transform as TransformHook)("export const x = 1;", "/some/other/file.js");
        expect(result).toBeNull();
        vi.doUnmock("node:module");
        vi.resetModules();
    });

    it("transform rewrites the native loader to load the emitted binary", async () => {
        vi.resetModules();
        mockModuleResolution();
        const { gtkxNative } = await import("../../src/vite-plugins/native.js");
        const plugin = gtkxNative("/tmp");
        const loaderSource = ["export { init }", "export { bind }", "export { call }"].join("\n");
        const result = (plugin.transform as TransformHook)(loaderSource, LOADER_PATH);
        expect(result).toBe(
            [
                'import { createRequire as __gtkxCreateRequire } from "node:module";',
                'const __gtkxNative = __gtkxCreateRequire(import.meta.url)("./gtkx.node");',
                "const { init, bind, call } = __gtkxNative;",
                "export { init, bind, call };",
            ].join("\n"),
        );
        vi.doUnmock("node:module");
        vi.resetModules();
    });
});

describe("gtkxNative (buildStart platform guards)", () => {
    const expectBuildStartThrows = async (platform: string, arch: string, message: RegExp): Promise<void> => {
        mockOs(platform, arch);
        const { gtkxNative } = await import("../../src/vite-plugins/native.js");
        const plugin = gtkxNative("/tmp");

        expect(() =>
            (plugin.buildStart as BuildStartHook).call({
                emitFile: () => undefined,
            }),
        ).toThrow(message);

        unmockOs();
    };

    it("buildStart throws on unsupported platform", async () => {
        await expectBuildStartThrows("darwin", "x64", /Unsupported build platform/);
    });

    it("buildStart throws on unsupported architecture", async () => {
        await expectBuildStartThrows("linux", "ia32", /Unsupported build architecture/);
    });
});

describe("gtkxNative (buildStart success)", () => {
    it("buildStart emits the platform binary", async () => {
        mockOs("linux", "x64");
        mockModuleResolution();
        vi.doMock("node:fs", async () => {
            const real = await vi.importActual<typeof import("node:fs")>("node:fs");
            return { ...real, readFileSync: () => Buffer.from("native-bytes") };
        });

        const { gtkxNative } = await import("../../src/vite-plugins/native.js");
        const plugin = gtkxNative("/tmp");

        const emitFile = vi.fn();
        (plugin.buildStart as BuildStartHook).call({ emitFile });
        expect(emitFile).toHaveBeenCalledWith({
            type: "asset",
            fileName: "gtkx.node",
            source: Buffer.from("native-bytes"),
        });

        vi.doUnmock("node:module");
        vi.doUnmock("node:fs");
        unmockOs();
    });
});
