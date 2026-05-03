import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { repositoryLoadMock, ffiGenerateMock, reactGenerateMock, reactCtorSpy } = vi.hoisted(() => ({
    repositoryLoadMock: vi.fn(),
    ffiGenerateMock: vi.fn(),
    reactGenerateMock: vi.fn(),
    reactCtorSpy: vi.fn(),
}));

vi.mock("@gtkx/gir", () => ({
    GirRepository: { load: repositoryLoadMock },
}));

vi.mock("../../src/ffi/ffi-generator.js", () => ({
    FfiGenerator: class {
        generateNamespace(...args: unknown[]) {
            return ffiGenerateMock(...args);
        }
    },
}));

vi.mock("../../src/react/react-generator.js", () => ({
    ReactGenerator: class {
        constructor(
            public widgetMeta: unknown,
            public controllerMeta: unknown,
            public namespaceNames: string[],
        ) {
            reactCtorSpy(widgetMeta, controllerMeta, namespaceNames);
        }
        generate() {
            return reactGenerateMock();
        }
    },
}));

import type { CodegenControllerMeta, CodegenWidgetMeta } from "../../src/core/codegen-metadata.js";
import { CodegenMetadata } from "../../src/core/codegen-metadata.js";
import { CodegenOrchestrator } from "../../src/core/codegen-orchestrator.js";

function makeWidgetMeta(jsxName: string, namespace = "Gtk"): CodegenWidgetMeta {
    return {
        className: jsxName.replace(/^(Gtk|Adw|Gio)/, ""),
        namespace,
        jsxName,
        slots: [],
        propNames: [],
        signalNames: [],
        properties: [],
        signals: [],
        parentClassName: "Widget",
        parentNamespace: "Gtk",
        modulePath: `./gtk/${jsxName.toLowerCase()}.js`,
        hiddenPropNames: [],
        doc: undefined,
    };
}

function makeControllerMeta(jsxName: string): CodegenControllerMeta {
    return {
        className: jsxName.replace(/^Gtk/, ""),
        namespace: "Gtk",
        jsxName,
        propNames: [],
        signalNames: [],
        properties: [],
        signals: [],
        parentClassName: null,
        parentNamespace: null,
        doc: undefined,
        abstract: false,
    };
}

function configureMocks(options: {
    namespaces: string[];
    widgetsByNamespace: Record<string, CodegenWidgetMeta[]>;
    controllersByNamespace?: Record<string, CodegenControllerMeta[]>;
    ffiFiles?: string[];
    reactFiles?: string[];
}) {
    repositoryLoadMock.mockReset();
    ffiGenerateMock.mockReset();
    reactGenerateMock.mockReset();

    repositoryLoadMock.mockResolvedValue({
        getNamespaceNames: () => options.namespaces,
    });

    ffiGenerateMock.mockImplementation((namespace: string) => {
        const meta = new CodegenMetadata();
        for (const widget of options.widgetsByNamespace[namespace] ?? []) {
            meta.addWidgetMeta(widget);
        }
        for (const controller of options.controllersByNamespace?.[namespace] ?? []) {
            meta.addControllerMeta(controller);
        }
        return {
            files: (options.ffiFiles ?? [`gtk/${namespace.toLowerCase()}.ts`]).map((path) => ({
                path,
                content: `// ${path}\n`,
            })),
            metadata: meta,
        };
    });

    reactGenerateMock.mockReturnValue(
        (options.reactFiles ?? ["jsx.ts"]).map((path) => ({
            path,
            content: `// ${path}\n`,
        })),
    );
}

describe("CodegenOrchestrator", () => {
    beforeEach(() => {
        repositoryLoadMock.mockReset();
        ffiGenerateMock.mockReset();
        reactGenerateMock.mockReset();
        reactCtorSpy.mockReset();
    });

    describe("constructor", () => {
        it("accepts explicit libraries plus girPath", () => {
            expect(
                () =>
                    new CodegenOrchestrator({
                        libraries: ["Gtk-4.0"],
                        girPath: ["/usr/share/gir-1.0"],
                    }),
            ).not.toThrow();
        });

        it("accepts a girsDir alone", () => {
            expect(() => new CodegenOrchestrator({ girsDir: "/tmp/girs" })).not.toThrow();
        });

        it("rejects libraries without girPath", () => {
            expect(() => new CodegenOrchestrator({ libraries: ["Gtk-4.0"] })).toThrow(
                /provide either `girsDir` or both `libraries` and `girPath`/,
            );
        });

        it("rejects girPath without libraries", () => {
            expect(() => new CodegenOrchestrator({ girPath: ["/usr/share/gir-1.0"] })).toThrow();
        });

        it("rejects empty options", () => {
            expect(() => new CodegenOrchestrator({})).toThrow();
        });
    });

    describe("generate with libraries + girPath", () => {
        it("loads the repository, runs FFI per namespace, and runs React with collected meta", async () => {
            const buttonMeta = makeWidgetMeta("GtkButton");
            const dropdownMeta = makeWidgetMeta("AdwAvatar", "Adw");
            const controllerMeta = makeControllerMeta("GtkGestureClick");

            configureMocks({
                namespaces: ["Gtk", "Adw"],
                widgetsByNamespace: { Gtk: [buttonMeta], Adw: [dropdownMeta] },
                controllersByNamespace: { Gtk: [controllerMeta] },
                ffiFiles: ["a.ts", "b.ts"],
                reactFiles: ["x.ts"],
            });

            const orchestrator = new CodegenOrchestrator({
                libraries: ["Gtk-4.0", "Adw-1"],
                girPath: ["/usr/share/gir-1.0"],
            });

            const result = await orchestrator.generate();

            expect(repositoryLoadMock).toHaveBeenCalledWith(["Gtk-4.0", "Adw-1"], {
                girPath: ["/usr/share/gir-1.0"],
            });
            expect(ffiGenerateMock).toHaveBeenCalledTimes(2);
            expect(reactGenerateMock).toHaveBeenCalledTimes(1);
            expect(result.stats).toEqual({
                namespaces: 2,
                widgets: 2,
                totalFiles: result.ffiFiles.size + result.reactFiles.size,
                duration: expect.any(Number),
            });
            expect(result.stats.duration).toBeGreaterThanOrEqual(0);
            expect(result.ffiFiles.size).toBe(2);
            expect(result.reactFiles.size).toBe(1);
        });

        it("skips React generation when no widget metadata was collected", async () => {
            configureMocks({
                namespaces: ["Gtk"],
                widgetsByNamespace: { Gtk: [] },
            });

            const orchestrator = new CodegenOrchestrator({
                libraries: ["Gtk-4.0"],
                girPath: ["/usr/share/gir-1.0"],
            });

            const result = await orchestrator.generate();

            expect(reactGenerateMock).not.toHaveBeenCalled();
            expect(result.reactFiles.size).toBe(0);
            expect(result.stats.widgets).toBe(0);
        });

        it("deduplicates namespaces collected from widgets when calling React generator", async () => {
            const w1 = makeWidgetMeta("GtkA", "Gtk");
            const w2 = makeWidgetMeta("GtkB", "Gtk");
            const w3 = makeWidgetMeta("AdwC", "Adw");

            configureMocks({
                namespaces: ["Gtk", "Adw"],
                widgetsByNamespace: { Gtk: [w1, w2], Adw: [w3] },
            });

            const orchestrator = new CodegenOrchestrator({
                libraries: ["Gtk-4.0", "Adw-1"],
                girPath: ["/usr/share/gir-1.0"],
            });

            await orchestrator.generate();

            const reactCall = reactCtorSpy.mock.calls[0];
            if (!reactCall) throw new Error("ReactGenerator was not constructed");
            expect(new Set(reactCall[2] as string[])).toEqual(new Set(["Gtk", "Adw"]));
        });
    });

    describe("generate with girsDir", () => {
        let dir: string;

        beforeEach(async () => {
            dir = await mkdtemp(join(tmpdir(), "codegen-orchestrator-"));
            await writeFile(join(dir, "Gtk-4.0.gir"), "");
            await writeFile(join(dir, "Adw-1.gir"), "");
            await writeFile(join(dir, "ignored.txt"), "");
        });

        afterEach(async () => {
            await rm(dir, { recursive: true, force: true });
        });

        it("enumerates .gir files and uses them as both roots and search path", async () => {
            configureMocks({
                namespaces: ["Gtk", "Adw"],
                widgetsByNamespace: { Gtk: [makeWidgetMeta("GtkButton")], Adw: [] },
            });

            const orchestrator = new CodegenOrchestrator({ girsDir: dir });
            await orchestrator.generate();

            const repoCall = repositoryLoadMock.mock.calls[0];
            if (!repoCall) throw new Error("GirRepository.load was not invoked");
            const [roots, opts] = repoCall;
            expect(new Set(roots)).toEqual(new Set(["Gtk-4.0", "Adw-1"]));
            expect(opts).toEqual({ girPath: [dir] });
        });
    });
});
