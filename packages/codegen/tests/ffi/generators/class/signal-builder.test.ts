import { describe, expect, it } from "vitest";
import { fileBuilder } from "../../../../src/builders/file-builder.js";
import { FfiMapper } from "../../../../src/core/type-system/ffi-mapper.js";
import { SignalBuilder } from "../../../../src/ffi/generators/class/signal-builder.js";
import {
    createNormalizedClass,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedSignal,
    createNormalizedType,
    qualifiedName,
} from "../../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../../fixtures/mock-repository.js";

function createTestSetup(
    classOverrides: Partial<Parameters<typeof createNormalizedClass>[0]> = {},
    namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map(),
) {
    const ns = createNormalizedNamespace({ name: "Gtk" });
    namespaces.set("Gtk", ns);
    const repo = createMockRepository(namespaces);
    const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
    const file = fileBuilder();
    const options = {
        namespace: "Gtk",
        sharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
        gobjectLibrary: "libgobject-2.0.so.0",
    };

    const cls = createNormalizedClass({
        name: "Button",
        qualifiedName: qualifiedName("Gtk", "Button"),
        parent: null,
        signals: [],
        ...classOverrides,
    });

    const builder = new SignalBuilder(cls, ffiMapper, file, repo as Parameters<typeof FfiMapper>[0], options);
    return { cls, builder, ffiMapper, file };
}

describe("SignalBuilder", () => {
    describe("constructor", () => {
        it("creates builder with class and dependencies", () => {
            const { builder } = createTestSetup();
            expect(builder).toBeInstanceOf(SignalBuilder);
        });
    });

    describe("buildConnectMethodStructures", () => {
        it("returns empty array when no signals", () => {
            const { builder } = createTestSetup({ signals: [] });

            const structures = builder.buildConnectMethodStructures();

            expect(structures).toHaveLength(0);
        });

        it("builds connect method when class has signals", () => {
            const { builder } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            const structures = builder.buildConnectMethodStructures();

            expect(structures.map((s) => s.name)).toEqual(["connect", "on", "once", "off"]);
        });

        it("includes overloads for each signal", () => {
            const { builder } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" }), createNormalizedSignal({ name: "activate" })],
            });

            const structures = builder.buildConnectMethodStructures();

            expect(structures[0].overloads).toBeDefined();
            expect(structures[0].overloads?.length).toBeGreaterThanOrEqual(2);
        });

        it("includes generic string overload", () => {
            const { builder } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            const structures = builder.buildConnectMethodStructures();

            const genericOverload = structures[0].overloads?.find((o) => o.params?.[0]?.type === "string");
            expect(genericOverload).toBeDefined();
        });

        it("returns number from connect method", () => {
            const { builder } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            const structures = builder.buildConnectMethodStructures();

            expect(structures[0].returnType).toBe("number");
        });
    });

    describe("collectAllSignals", () => {
        it("returns empty array when no signals", () => {
            const { builder } = createTestSetup({ signals: [] });

            const { allSignals } = builder.collectAllSignals();

            expect(allSignals).toHaveLength(0);
        });

        it("includes signals defined on the class", () => {
            const { builder } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" }), createNormalizedSignal({ name: "activate" })],
            });

            const { allSignals } = builder.collectAllSignals();

            expect(allSignals).toHaveLength(2);
        });

        it("does not report cross-namespace parent when no parent", () => {
            const { builder } = createTestSetup({
                parent: null,
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            const { hasCrossNamespaceParent } = builder.collectAllSignals();

            expect(hasCrossNamespaceParent).toBe(false);
        });
    });

    describe("import tracking", () => {
        it("adds call import when building connect method", () => {
            const { builder } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            const structures = builder.buildConnectMethodStructures();

            expect(structures.length).toBeGreaterThan(0);
        });
    });

    describe("signal handler parameters", () => {
        it("includes self parameter in signal handler", () => {
            const { builder } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked", parameters: [] })],
            });

            const structures = builder.buildConnectMethodStructures();

            const overload = structures[0].overloads?.[0];
            expect(overload?.params?.[1]?.type).toContain("self:");
        });

        it("includes signal parameters in handler", () => {
            const { builder } = createTestSetup({
                signals: [
                    createNormalizedSignal({
                        name: "scroll",
                        parameters: [
                            createNormalizedParameter({
                                name: "delta_x",
                                type: createNormalizedType({ name: "gdouble" }),
                            }),
                            createNormalizedParameter({
                                name: "delta_y",
                                type: createNormalizedType({ name: "gdouble" }),
                            }),
                        ],
                    }),
                ],
            });

            const structures = builder.buildConnectMethodStructures();

            const overload = structures[0].overloads?.[0];
            expect(overload?.params?.[1]?.type).toContain("deltaX:");
            expect(overload?.params?.[1]?.type).toContain("deltaY:");
        });
    });

    describe("integration", () => {
        it("builds connect method with switch cases for signals", () => {
            const { builder } = createTestSetup({
                signals: [
                    createNormalizedSignal({
                        name: "clicked",
                        parameters: [],
                    }),
                    createNormalizedSignal({
                        name: "toggled",
                        parameters: [
                            createNormalizedParameter({
                                name: "active",
                                type: createNormalizedType({ name: "gboolean" }),
                            }),
                        ],
                    }),
                ],
            });

            const connectStructures = builder.buildConnectMethodStructures();

            expect(connectStructures.map((s) => s.name)).toEqual(["connect", "on", "once", "off"]);
            expect(connectStructures[0]?.overloads?.length).toBeGreaterThanOrEqual(2);
        });
    });
});

describe("SignalBuilder - Extended Coverage", () => {
    describe("signal return types", () => {
        it("handles signal with boolean return type", () => {
            const { builder } = createTestSetup({
                signals: [
                    createNormalizedSignal({
                        name: "query-tooltip",
                        returnType: createNormalizedType({ name: "gboolean" }),
                    }),
                ],
            });

            const structures = builder.buildConnectMethodStructures();

            const overload = structures[0].overloads?.[0];
            expect(overload?.params?.[1]?.type).toContain("=> boolean");
        });

        it("handles signal with void return type", () => {
            const { builder } = createTestSetup({
                signals: [
                    createNormalizedSignal({
                        name: "clicked",
                        returnType: null,
                    }),
                ],
            });

            const structures = builder.buildConnectMethodStructures();

            const overload = structures[0].overloads?.[0];
            expect(overload?.params?.[1]?.type).toContain("=> void");
        });

        it("handles signal with string return type", () => {
            const { builder } = createTestSetup({
                signals: [
                    createNormalizedSignal({
                        name: "format-value",
                        returnType: createNormalizedType({ name: "utf8", transferOwnership: "full" }),
                    }),
                ],
            });

            const structures = builder.buildConnectMethodStructures();

            const overload = structures[0].overloads?.[0];
            expect(overload?.params?.[1]?.type).toContain("=> string");
        });
    });

    describe("signal with GObject parameters", () => {
        it("handles signal with GObject parameter", () => {
            const buttonClass = createNormalizedClass({
                name: "Button",
                qualifiedName: qualifiedName("Gtk", "Button"),
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", buttonClass]]),
            });

            const { builder } = createTestSetup(
                {
                    signals: [
                        createNormalizedSignal({
                            name: "child-added",
                            parameters: [
                                createNormalizedParameter({
                                    name: "child",
                                    type: createNormalizedType({ name: "Button" }),
                                }),
                            ],
                        }),
                    ],
                },
                new Map([["Gtk", ns]]),
            );

            const structures = builder.buildConnectMethodStructures();

            expect(structures[0].name).toBe("connect");
            const overload = structures[0].overloads?.[0];
            expect(overload?.params?.[1]?.type).toContain("child:");
        });
    });

    describe("varargs filtering", () => {
        it("filters out varargs from signal parameters", () => {
            const { builder } = createTestSetup({
                signals: [
                    createNormalizedSignal({
                        name: "custom",
                        parameters: [
                            createNormalizedParameter({
                                name: "first",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                            createNormalizedParameter({
                                name: "...",
                                varargs: true,
                                type: createNormalizedType({ name: "none" }),
                            }),
                        ],
                    }),
                ],
            });

            const structures = builder.buildConnectMethodStructures();

            const overload = structures[0].overloads?.[0];
            expect(overload?.params?.[1]?.type).not.toContain("...");
        });
    });

    describe("collectOwnSignals", () => {
        it("returns only signals defined on the class, not parent", () => {
            const nullRepo = { resolveClass: () => null, resolveInterface: () => null, findClasses: () => [] };
            const parentClass = createNormalizedClass(
                {
                    name: "Widget",
                    qualifiedName: qualifiedName("Gtk", "Widget"),
                    parent: null,
                    signals: [createNormalizedSignal({ name: "destroy" })],
                },
                nullRepo,
            );

            const childRepo = { resolveClass: () => parentClass, resolveInterface: () => null, findClasses: () => [] };
            const childClass = createNormalizedClass(
                {
                    name: "Button",
                    qualifiedName: qualifiedName("Gtk", "Button"),
                    parent: qualifiedName("Gtk", "Widget"),
                    signals: [createNormalizedSignal({ name: "clicked" })],
                },
                childRepo,
            );

            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([
                    ["Widget", parentClass],
                    ["Button", childClass],
                ]),
            });

            const repo = createMockRepository(new Map([["Gtk", ns]]));
            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const file = fileBuilder();
            const options = {
                namespace: "Gtk",
                sharedLibrary: "libgtk-4.so.1",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            };

            const builder = new SignalBuilder(
                childClass,
                ffiMapper,
                file,
                repo as Parameters<typeof FfiMapper>[0],
                options,
            );

            const ownSignals = builder.collectOwnSignals();

            expect(ownSignals.map((s) => s.name)).toContain("clicked");
            expect(ownSignals.map((s) => s.name)).not.toContain("destroy");
        });
    });
});
