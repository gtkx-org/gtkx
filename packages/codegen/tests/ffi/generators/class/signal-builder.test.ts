import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../../src/core/generation-context.js";
import { FfiMapper } from "../../../../src/core/type-system/ffi-mapper.js";
import { createWriters } from "../../../../src/core/writers/index.js";
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
    const ctx = new GenerationContext();
    const writers = createWriters({
        sharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
    });
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

    const builder = new SignalBuilder(cls, ffiMapper, ctx, repo as Parameters<typeof FfiMapper>[0], writers, options);
    return { cls, builder, ctx, ffiMapper };
}

describe("SignalBuilder", () => {
    describe("constructor", () => {
        it("creates builder with class and dependencies", () => {
            const { builder } = createTestSetup();
            expect(builder).toBeInstanceOf(SignalBuilder);
        });
    });

    describe("collectOwnSignals", () => {
        it("returns empty array when no signals", () => {
            const { builder } = createTestSetup({ signals: [] });

            const signals = builder.collectOwnSignals();

            expect(signals).toHaveLength(0);
        });

        it("returns signals defined on the class", () => {
            const { builder } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" }), createNormalizedSignal({ name: "activate" })],
            });

            const signals = builder.collectOwnSignals();

            expect(signals).toHaveLength(2);
            expect(signals[0].name).toBe("clicked");
            expect(signals[1].name).toBe("activate");
        });
    });

    describe("buildSignalMetaEntries", () => {
        it("returns empty array when no signals", () => {
            const { builder } = createTestSetup({ signals: [] });

            const entries = builder.buildSignalMetaEntries();

            expect(entries).toHaveLength(0);
        });

        it("builds entry for signal without parameters", () => {
            const { builder } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked", parameters: [] })],
            });

            const entries = builder.buildSignalMetaEntries();

            expect(entries).toHaveLength(1);
            expect(entries[0].name).toBe("clicked");
            expect(entries[0].params).toHaveLength(0);
        });

        it("builds entry for signal with parameters", () => {
            const { builder } = createTestSetup({
                signals: [
                    createNormalizedSignal({
                        name: "value_changed",
                        parameters: [
                            createNormalizedParameter({
                                name: "value",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                        ],
                    }),
                ],
            });

            const entries = builder.buildSignalMetaEntries();

            expect(entries).toHaveLength(1);
            expect(entries[0].name).toBe("value_changed");
            expect(entries[0].params).toHaveLength(1);
        });

        it("filters out varargs from signal parameters", () => {
            const { builder } = createTestSetup({
                signals: [
                    createNormalizedSignal({
                        name: "custom",
                        parameters: [
                            createNormalizedParameter({
                                name: "value",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                            createNormalizedParameter({ name: "..." }),
                        ],
                    }),
                ],
            });

            const entries = builder.buildSignalMetaEntries();

            expect(entries[0].params).toHaveLength(1);
        });

        it("includes return type when signal has return value", () => {
            const { builder } = createTestSetup({
                signals: [
                    createNormalizedSignal({
                        name: "query",
                        returnType: createNormalizedType({ name: "gboolean" }),
                        parameters: [],
                    }),
                ],
            });

            const entries = builder.buildSignalMetaEntries();

            expect(entries[0].returnType).toBeDefined();
        });

        it("builds entries for multiple signals", () => {
            const { builder } = createTestSetup({
                signals: [
                    createNormalizedSignal({ name: "clicked" }),
                    createNormalizedSignal({ name: "activate" }),
                    createNormalizedSignal({ name: "toggled" }),
                ],
            });

            const entries = builder.buildSignalMetaEntries();

            expect(entries).toHaveLength(3);
            expect(entries.map((e) => e.name)).toEqual(["clicked", "activate", "toggled"]);
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

            expect(structures).toHaveLength(1);
            expect(structures[0].name).toBe("connect");
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

            const genericOverload = structures[0].overloads?.find((o) => o.parameters?.[0]?.type === "string");
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

    describe("context updates", () => {
        it("sets usesCall flag when building connect method", () => {
            const { builder, ctx } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            builder.buildConnectMethodStructures();

            expect(ctx.usesCall).toBe(true);
        });

        it("sets usesResolveSignalMeta flag when building connect method", () => {
            const { builder, ctx } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            builder.buildConnectMethodStructures();

            expect(ctx.usesResolveSignalMeta).toBe(true);
        });

        it("sets usesType flag when building connect method", () => {
            const { builder, ctx } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            builder.buildConnectMethodStructures();

            expect(ctx.usesType).toBe(true);
        });

        it("sets usesGetNativeObject flag when building connect method", () => {
            const { builder, ctx } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            builder.buildConnectMethodStructures();

            expect(ctx.usesGetNativeObject).toBe(true);
        });

        it("sets usesGObjectNamespace flag for non-GObject namespaces", () => {
            const { builder, ctx } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            builder.buildConnectMethodStructures();

            expect(ctx.usesGObjectNamespace).toBe(true);
        });
    });

    describe("signal handler parameters", () => {
        it("includes self parameter in signal handler", () => {
            const { builder } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked", parameters: [] })],
            });

            const structures = builder.buildConnectMethodStructures();

            const overload = structures[0].overloads?.[0];
            expect(overload?.parameters?.[1]?.type).toContain("self:");
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
            expect(overload?.parameters?.[1]?.type).toContain("deltaX:");
            expect(overload?.parameters?.[1]?.type).toContain("deltaY:");
        });
    });

    describe("integration", () => {
        it("builds complete signal infrastructure", () => {
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

            const metaEntries = builder.buildSignalMetaEntries();
            const connectStructures = builder.buildConnectMethodStructures();

            expect(metaEntries).toHaveLength(2);
            expect(connectStructures).toHaveLength(1);
            expect(connectStructures[0].overloads?.length).toBeGreaterThanOrEqual(2);
        });
    });
});
