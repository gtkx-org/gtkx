import { beforeEach, describe, expect, it, vi } from "vitest";

const { ffiGenerateMock, reactGenerateMock, reactCtorSpy } = vi.hoisted(() => ({
    ffiGenerateMock: vi.fn(),
    reactGenerateMock: vi.fn(),
    reactCtorSpy: vi.fn(),
}));

vi.mock("../src/ffi/ffi-generator.js", () => ({
    FfiGenerator: class {
        generateNamespace(...args: unknown[]) {
            return ffiGenerateMock(...args);
        }
    },
}));

vi.mock("../src/react/react-generator.js", () => ({
    ReactGenerator: class {
        // biome-ignore lint/complexity/useMaxParams: mirrors the real ReactGenerator constructor
        constructor(
            public widgetMeta: unknown,
            public controllerMeta: unknown,
            public layoutManagerMeta: unknown,
            public namespaceNames: string[],
            public renderableSlots: unknown,
        ) {
            reactCtorSpy(widgetMeta, controllerMeta, layoutManagerMeta, namespaceNames, renderableSlots);
        }
        generate() {
            return reactGenerateMock();
        }
    },
}));

import type { CodegenControllerMeta, CodegenWidgetMeta } from "../src/codegen-metadata.js";
import { CodegenMetadata } from "../src/codegen-metadata.js";
import { CodegenOrchestrator } from "../src/codegen-orchestrator.js";
import type { GirRepository } from "../src/gir/index.js";

function makeWidgetMeta(jsxName: string, namespace = "Gtk"): CodegenWidgetMeta {
    return {
        className: jsxName.replace(/^(Gtk|Adw|Gio)/, ""),
        namespace,
        jsxName,
        slots: [],
        containerMethods: [],
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

function makeRepository(namespaces: string[]): GirRepository {
    return { getNamespaceNames: () => namespaces } as unknown as GirRepository;
}

function configureMocks(options: {
    widgetsByNamespace: Record<string, CodegenWidgetMeta[]>;
    controllersByNamespace?: Record<string, CodegenControllerMeta[]>;
    ffiFiles?: string[];
    reactFiles?: string[];
}) {
    ffiGenerateMock.mockReset();
    reactGenerateMock.mockReset();

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

describe("CodegenOrchestrator (1)", () => {
    beforeEach(() => {
        ffiGenerateMock.mockReset();
        reactGenerateMock.mockReset();
        reactCtorSpy.mockReset();
    });

    describe("constructor", () => {
        it("accepts a resolved repository", () => {
            expect(() => new CodegenOrchestrator({ repository: makeRepository(["Gtk"]) })).not.toThrow();
        });
    });
});

describe("CodegenOrchestrator (2) / generate (1)", () => {
    beforeEach(() => {
        ffiGenerateMock.mockReset();
        reactGenerateMock.mockReset();
        reactCtorSpy.mockReset();
    });

    it("runs FFI per namespace and runs React with the collected metadata", () => {
        configureMocks({
            widgetsByNamespace: {
                Gtk: [makeWidgetMeta("GtkButton")],
                Adw: [makeWidgetMeta("AdwAvatar", "Adw")],
            },
            controllersByNamespace: { Gtk: [makeControllerMeta("GtkGestureClick")] },
            ffiFiles: ["a.ts", "b.ts"],
            reactFiles: ["x.ts"],
        });

        const orchestrator = new CodegenOrchestrator({ repository: makeRepository(["Gtk", "Adw"]) });

        const result = orchestrator.generate();

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

    it("skips React generation when no widget metadata was collected", () => {
        configureMocks({ widgetsByNamespace: { Gtk: [] } });

        const orchestrator = new CodegenOrchestrator({ repository: makeRepository(["Gtk"]) });

        const result = orchestrator.generate();

        expect(reactGenerateMock).not.toHaveBeenCalled();
        expect(result.reactFiles.size).toBe(0);
        expect(result.stats.widgets).toBe(0);
    });
});

describe("CodegenOrchestrator (2) / generate (2)", () => {
    beforeEach(() => {
        ffiGenerateMock.mockReset();
        reactGenerateMock.mockReset();
        reactCtorSpy.mockReset();
    });

    it("deduplicates namespaces collected from widgets when calling the React generator", () => {
        configureMocks({
            widgetsByNamespace: {
                Gtk: [makeWidgetMeta("GtkA", "Gtk"), makeWidgetMeta("GtkB", "Gtk")],
                Adw: [makeWidgetMeta("AdwC", "Adw")],
            },
        });

        const orchestrator = new CodegenOrchestrator({ repository: makeRepository(["Gtk", "Adw"]) });

        orchestrator.generate();

        const reactCall = reactCtorSpy.mock.calls[0];
        if (!reactCall) throw new Error("ReactGenerator was not constructed");
        expect(new Set(reactCall[3] as string[])).toEqual(new Set(["Gtk", "Adw"]));
    });

    it("forwards slotProps overrides into the ReactGenerator's renderable slot registry", () => {
        configureMocks({
            widgetsByNamespace: { MyApp: [makeWidgetMeta("MyAppFooBar", "MyApp")] },
        });

        const orchestrator = new CodegenOrchestrator({
            repository: makeRepository(["MyApp"]),
            slotProps: { MyAppFooBar: ["content"] },
        });

        orchestrator.generate();

        const reactCall = reactCtorSpy.mock.calls[0];
        if (!reactCall) throw new Error("ReactGenerator was not constructed");
        const registry = reactCall[4] as { get: (jsx: string) => ReadonlySet<string> };
        expect([...registry.get("MyAppFooBar")]).toEqual(["content"]);
    });
});
