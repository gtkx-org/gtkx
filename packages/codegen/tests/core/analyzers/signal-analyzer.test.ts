import { describe, expect, it } from "vitest";
import { SignalAnalyzer } from "../../../src/core/analyzers/signal-analyzer.js";
import { FfiMapper } from "../../../src/core/type-system/ffi-mapper.js";
import {
    createNormalizedClass,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedSignal,
    createNormalizedType,
    createWidgetClass,
    qualifiedName,
} from "../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../fixtures/mock-repository.js";

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>>) {
    const repo = createMockRepository(namespaces);
    const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
    const analyzer = new SignalAnalyzer(repo as Parameters<typeof SignalAnalyzer>[0], mapper);
    return { repo, mapper, analyzer };
}

describe("SignalAnalyzer", () => {
    describe("analyzeWidgetSignals", () => {
        it("returns empty array for class with no signals", () => {
            const cls = createNormalizedClass({ signals: [] });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetSignals(cls);

            expect(result).toHaveLength(0);
        });

        it("analyzes signal with no parameters", () => {
            const cls = createNormalizedClass({
                name: "Button",
                parent: null,
                signals: [createNormalizedSignal({ name: "clicked" })],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetSignals(cls);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                name: "clicked",
                camelName: "clicked",
                handlerName: "onClicked",
                parameters: [],
                returnType: "void",
            });
        });

        it("generates correct handler name for hyphenated signal", () => {
            const cls = createNormalizedClass({
                name: "Window",
                parent: null,
                signals: [createNormalizedSignal({ name: "close-request" })],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Window", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetSignals(cls);

            expect(result[0]?.camelName).toBe("closeRequest");
            expect(result[0]?.handlerName).toBe("onCloseRequest");
        });

        it("analyzes signal parameters", () => {
            const cls = createNormalizedClass({
                name: "Scale",
                parent: null,
                signals: [
                    createNormalizedSignal({
                        name: "change-value",
                        parameters: [
                            createNormalizedParameter({
                                name: "scroll",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                            createNormalizedParameter({
                                name: "value",
                                type: createNormalizedType({ name: "gdouble" }),
                            }),
                        ],
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Scale", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetSignals(cls);

            expect(result[0]?.parameters).toHaveLength(2);
            expect(result[0]?.parameters[0]).toMatchObject({
                name: "scroll",
                type: "number",
            });
            expect(result[0]?.parameters[1]).toMatchObject({
                name: "value",
                type: "number",
            });
        });

        it("converts parameter names to camelCase", () => {
            const cls = createNormalizedClass({
                name: "Widget",
                parent: null,
                signals: [
                    createNormalizedSignal({
                        name: "query-tooltip",
                        parameters: [
                            createNormalizedParameter({
                                name: "keyboard_tooltip",
                                type: createNormalizedType({ name: "gboolean" }),
                            }),
                        ],
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Widget", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetSignals(cls);

            expect(result[0]?.parameters[0]?.name).toBe("keyboardTooltip");
        });

        it("analyzes signal with return type", () => {
            const cls = createNormalizedClass({
                name: "Window",
                parent: null,
                signals: [
                    createNormalizedSignal({
                        name: "close-request",
                        returnType: createNormalizedType({ name: "gboolean" }),
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Window", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetSignals(cls);

            expect(result[0]?.returnType).toBe("boolean");
        });

        it("excludes signals inherited from parent class", () => {
            const widgetClass = createWidgetClass();
            const buttonClass = createNormalizedClass({
                name: "Button",
                qualifiedName: qualifiedName("Gtk", "Button"),
                parent: qualifiedName("Gtk", "Widget"),
                signals: [createNormalizedSignal({ name: "clicked" }), createNormalizedSignal({ name: "activate" })],
            });

            widgetClass._setRepository({
                resolveClass: () => undefined,
                resolveInterface: () => undefined,
                findClasses: () => [],
            } as Parameters<typeof widgetClass._setRepository>[0]);

            buttonClass._setRepository({
                resolveClass: () => widgetClass,
                resolveInterface: () => undefined,
                findClasses: () => [],
            } as Parameters<typeof buttonClass._setRepository>[0]);

            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([
                    ["Widget", widgetClass],
                    ["Button", buttonClass],
                ]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetSignals(buttonClass);

            expect(result.map((s) => s.name)).toContain("clicked");
            expect(result.map((s) => s.name)).toContain("activate");
            expect(result.map((s) => s.name)).not.toContain("destroy");
            expect(result.map((s) => s.name)).not.toContain("show");
        });

        it("preserves documentation", () => {
            const cls = createNormalizedClass({
                name: "Button",
                parent: null,
                signals: [
                    createNormalizedSignal({
                        name: "clicked",
                        doc: "Emitted when the button is clicked.",
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetSignals(cls);

            expect(result[0]?.doc).toBe("Emitted when the button is clicked.");
        });

        it("tracks external namespace references in parameters", () => {
            const gdkEvent = createNormalizedClass({
                name: "Event",
                qualifiedName: qualifiedName("Gdk", "Event"),
            });
            const gdkNs = createNormalizedNamespace({
                name: "Gdk",
                classes: new Map([["Event", gdkEvent]]),
            });

            const widgetClass = createNormalizedClass({
                name: "Widget",
                parent: null,
                signals: [
                    createNormalizedSignal({
                        name: "event",
                        parameters: [
                            createNormalizedParameter({
                                name: "event",
                                type: createNormalizedType({ name: "Gdk.Event" }),
                            }),
                        ],
                    }),
                ],
            });
            const gtkNs = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Widget", widgetClass]]),
            });

            const repo = createMockRepository(
                new Map([
                    ["Gtk", gtkNs],
                    ["Gdk", gdkNs],
                ]),
            );
            const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const analyzer = new SignalAnalyzer(repo as Parameters<typeof SignalAnalyzer>[0], mapper);

            const result = analyzer.analyzeWidgetSignals(widgetClass);

            expect(result[0]?.referencedNamespaces).toContain("Gdk");
        });

        it("tracks external namespace references in return type", () => {
            const gdkDragSurface = createNormalizedClass({
                name: "DragSurface",
                qualifiedName: qualifiedName("Gdk", "DragSurface"),
            });
            const gdkNs = createNormalizedNamespace({
                name: "Gdk",
                classes: new Map([["DragSurface", gdkDragSurface]]),
            });

            const dndClass = createNormalizedClass({
                name: "DragSource",
                parent: null,
                signals: [
                    createNormalizedSignal({
                        name: "drag-begin",
                        returnType: createNormalizedType({ name: "Gdk.DragSurface" }),
                    }),
                ],
            });
            const gtkNs = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["DragSource", dndClass]]),
            });

            const repo = createMockRepository(
                new Map([
                    ["Gtk", gtkNs],
                    ["Gdk", gdkNs],
                ]),
            );
            const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const analyzer = new SignalAnalyzer(repo as Parameters<typeof SignalAnalyzer>[0], mapper);

            const result = analyzer.analyzeWidgetSignals(dndClass);

            expect(result[0]?.referencedNamespaces).toContain("Gdk");
        });

        it("handles multiple signals", () => {
            const cls = createNormalizedClass({
                name: "Entry",
                parent: null,
                signals: [
                    createNormalizedSignal({ name: "activate" }),
                    createNormalizedSignal({ name: "changed" }),
                    createNormalizedSignal({ name: "icon-press" }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Entry", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetSignals(cls);

            expect(result).toHaveLength(3);
            expect(result.map((s) => s.name)).toContain("activate");
            expect(result.map((s) => s.name)).toContain("changed");
            expect(result.map((s) => s.name)).toContain("icon-press");
        });

        it("qualifies external types in parameter type", () => {
            const gdkDevice = createNormalizedClass({
                name: "Device",
                qualifiedName: qualifiedName("Gdk", "Device"),
            });
            const gdkNs = createNormalizedNamespace({
                name: "Gdk",
                classes: new Map([["Device", gdkDevice]]),
            });

            const gestureClass = createNormalizedClass({
                name: "Gesture",
                parent: null,
                signals: [
                    createNormalizedSignal({
                        name: "begin",
                        parameters: [
                            createNormalizedParameter({
                                name: "device",
                                type: createNormalizedType({ name: "Gdk.Device" }),
                            }),
                        ],
                    }),
                ],
            });
            const gtkNs = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Gesture", gestureClass]]),
            });

            const repo = createMockRepository(
                new Map([
                    ["Gtk", gtkNs],
                    ["Gdk", gdkNs],
                ]),
            );
            const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const analyzer = new SignalAnalyzer(repo as Parameters<typeof SignalAnalyzer>[0], mapper);

            const result = analyzer.analyzeWidgetSignals(gestureClass);

            expect(result[0]?.parameters[0]?.type).toBe("Gdk.Device");
        });
    });
});
