import { describe, expect, it, vi } from "vitest";

type BuildStartHook = (this: {
    emitFile: (asset: { type: string; fileName: string; source: Buffer }) => void;
}) => void;
type TransformHook = (code: string, id: string) => string | undefined;

describe("gtkxNative", () => {
    it("returns a plugin with the expected name and pre-enforce", async () => {
        const { gtkxNative } = await import("../src/vite-plugin-gtkx-native.js");
        const plugin = gtkxNative("/tmp");
        expect(plugin.name).toBe("gtkx:native");
        expect(plugin.enforce).toBe("pre");
    });

    it("transform returns undefined for ids other than the native package entry", async () => {
        const { gtkxNative } = await import("../src/vite-plugin-gtkx-native.js");
        const plugin = gtkxNative("/tmp");
        const result = (plugin.transform as TransformHook)("export const x = 1;", "/some/other/file.js");
        expect(result).toBeUndefined();
    });

    it("buildStart throws on unsupported platform", async () => {
        vi.resetModules();
        vi.doMock("node:os", () => ({
            platform: () => "darwin",
            arch: () => "x64",
        }));
        const { gtkxNative } = await import("../src/vite-plugin-gtkx-native.js");
        const plugin = gtkxNative("/tmp");

        expect(() =>
            (plugin.buildStart as BuildStartHook).call({
                emitFile: () => undefined,
            }),
        ).toThrow(/Unsupported build platform/);

        vi.doUnmock("node:os");
        vi.resetModules();
    });

    it("buildStart throws on unsupported architecture", async () => {
        vi.resetModules();
        vi.doMock("node:os", () => ({
            platform: () => "linux",
            arch: () => "ia32",
        }));
        const { gtkxNative } = await import("../src/vite-plugin-gtkx-native.js");
        const plugin = gtkxNative("/tmp");

        expect(() =>
            (plugin.buildStart as BuildStartHook).call({
                emitFile: () => undefined,
            }),
        ).toThrow(/Unsupported build architecture/);

        vi.doUnmock("node:os");
        vi.resetModules();
    });

    it("transform rewrites loadNativeBinding to require ./gtkx.node", async () => {
        vi.resetModules();
        vi.doMock("node:os", () => ({
            platform: () => "linux",
            arch: () => "x64",
        }));
        vi.doMock("node:module", () => ({
            createRequire: () => {
                const fn = (id: string) => {
                    if (id === "@gtkx/native") return { default: undefined };
                    return Buffer.alloc(0);
                };
                fn.resolve = (id: string) => `/fake/path/${id}.js`;
                return fn;
            },
        }));
        vi.doMock("node:fs", async () => {
            const real = await vi.importActual<typeof import("node:fs")>("node:fs");
            return { ...real, readFileSync: () => Buffer.from("native-bytes") };
        });

        const { gtkxNative } = await import("../src/vite-plugin-gtkx-native.js");
        const plugin = gtkxNative("/tmp");

        const emitFile = vi.fn();
        (plugin.buildStart as BuildStartHook).call({ emitFile });
        expect(emitFile).toHaveBeenCalledWith({
            type: "asset",
            fileName: "gtkx.node",
            source: Buffer.from("native-bytes"),
        });

        const original = `import { x } from "node:os";\nfunction loadNativeBinding() {\n  return doSomething();\n}\nexport default loadNativeBinding();`;
        const transformed = (plugin.transform as TransformHook)(original, "/fake/path/@gtkx/native.js");
        expect(transformed).not.toContain('from "node:os"');
        expect(transformed).toContain('function loadNativeBinding() { return require("./gtkx.node"); }');

        vi.doUnmock("node:os");
        vi.doUnmock("node:module");
        vi.doUnmock("node:fs");
        vi.resetModules();
    });
});
