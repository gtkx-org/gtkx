import { describe, expect, it } from "vitest";
import {
    defineConfig,
    type GtkxConfig,
    resolveGtkxConfig,
    resolveReactCompilerOptions,
    validateGtkxConfig,
} from "../src/index.js";

const validateUnknown = (config: unknown): void => validateGtkxConfig(config as GtkxConfig);

describe("defineConfig", () => {
    it("returns the config unchanged", () => {
        const config = { libraries: ["Gtk-4.0", "Adw-1"] };
        expect(defineConfig(config)).toBe(config);
    });

    it("returns a config-defining function unchanged", () => {
        const fn = (env: { mode?: string }): GtkxConfig => ({
            libraries: env.mode === "production" ? ["Gtk-4.0"] : ["Gtk-4.0", "Adw-1"],
        });
        expect(defineConfig(fn)).toBe(fn);
        expect(defineConfig(fn)({ mode: "production" }).libraries).toEqual(["Gtk-4.0"]);
    });

    it("returns a promise-returning config unchanged", async () => {
        const promised = Promise.resolve<GtkxConfig>({ libraries: ["Gtk-4.0"] });
        expect(defineConfig(promised)).toBe(promised);
        expect((await defineConfig(promised)).libraries).toEqual(["Gtk-4.0"]);
    });
});

describe("validateGtkxConfig (libraries)", () => {
    it("accepts a girPath array", () => {
        expect(() => validateGtkxConfig({ libraries: ["Gtk-4.0"], girPath: ["/usr/share/gir-1.0"] })).not.toThrow();
    });

    it("rejects an empty libraries array", () => {
        expect(() => validateGtkxConfig({ libraries: [] })).toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it("rejects a non-array, non-wildcard libraries field", () => {
        expect(() => validateUnknown({ libraries: "Gtk-4.0" })).toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it('accepts the "*" wildcard', () => {
        expect(() => validateGtkxConfig({ libraries: "*" })).not.toThrow();
    });

    it("accepts a config that omits libraries", () => {
        expect(() => validateGtkxConfig({})).not.toThrow();
        expect(() => validateGtkxConfig({ girPath: ["/usr/share/gir-1.0"] })).not.toThrow();
    });

    it('rejects "*" used as an array entry and hints at the bare-string form', () => {
        expect(() => validateGtkxConfig({ libraries: ["*"] })).toThrow(
            'set `libraries: "*"` as a bare string, not an array entry',
        );
    });

    it("rejects a library identifier without a version suffix", () => {
        expect(() => validateGtkxConfig({ libraries: ["Gtk"] })).toThrow(/invalid library identifier/);
    });

    it("rejects a library identifier that starts with a digit", () => {
        expect(() => validateGtkxConfig({ libraries: ["4Gtk-1.0"] })).toThrow(/invalid library identifier/);
    });

    it("accepts multi-component versions", () => {
        expect(() => validateGtkxConfig({ libraries: ["Glib-2.0.1"] })).not.toThrow();
    });

    it("rejects a non-string library entry", () => {
        expect(() => validateUnknown({ libraries: [123] })).toThrow(/invalid library identifier/);
    });

    it("rejects a non-array girPath", () => {
        expect(() => validateUnknown({ libraries: ["Gtk-4.0"], girPath: "/usr/share/gir-1.0" })).toThrow(
            /`girPath` must be an array of strings if provided/,
        );
    });
});

describe("validateGtkxConfig (applicationId)", () => {
    it("accepts a valid applicationId", () => {
        expect(() => validateGtkxConfig({ applicationId: "org.gtk.Demo4" })).not.toThrow();
    });

    it("rejects an invalid applicationId", () => {
        expect(() => validateGtkxConfig({ applicationId: "not valid" })).toThrow(/invalid `applicationId`/);
        expect(() => validateGtkxConfig({ applicationId: "singletoken" })).toThrow(/invalid `applicationId`/);
    });

    it("rejects a non-string applicationId", () => {
        expect(() => validateUnknown({ applicationId: 123 })).toThrow(/invalid `applicationId`/);
    });

    it("accepts a config that omits applicationId", () => {
        expect(() => validateGtkxConfig({ libraries: ["Gtk-4.0"] })).not.toThrow();
    });
});

describe("validateGtkxConfig containerProps validation", () => {
    it("accepts a containerProps map", () => {
        const config: GtkxConfig = {
            libraries: ["Gtk-4.0"],
            containerProps: { MyAppHeaderBar: { start: { attach: "packStart" } } },
        };
        expect(() => validateGtkxConfig(config)).not.toThrow();
    });

    it("accepts a row with a detach verb and guard", () => {
        const config: GtkxConfig = {
            containerProps: {
                MyAppWidget: {
                    controllers: {
                        attach: "addController",
                        attachArgs: "child",
                        detach: "removeController",
                        detachArgs: "child",
                        detachGuard: { side: "child", getter: "getWidget" },
                    },
                },
            },
        };
        expect(() => validateGtkxConfig(config)).not.toThrow();
    });

    it("rejects a value that is not an object", () => {
        expect(() => validateUnknown({ containerProps: "nope" })).toThrow(
            /invalid `containerProps` — must be an object/,
        );
    });

    it("rejects an array value", () => {
        expect(() => validateUnknown({ containerProps: [] })).toThrow(/invalid `containerProps` — must be an object/);
    });

    it("rejects a key that is not PascalCase", () => {
        expect(() => validateUnknown({ containerProps: { "kebab-name": { start: { attach: "packStart" } } } })).toThrow(
            /invalid `containerProps key "kebab-name"`/,
        );
    });

    it("rejects an entry with no props", () => {
        expect(() => validateUnknown({ containerProps: { MyAppHeaderBar: {} } })).toThrow(
            /invalid `containerProps\.MyAppHeaderBar` — must declare at least one prop/,
        );
    });

    it("rejects a prop name that is not camelCase", () => {
        expect(() =>
            validateUnknown({ containerProps: { MyAppHeaderBar: { Start: { attach: "packStart" } } } }),
        ).toThrow(/invalid `containerProps\.MyAppHeaderBar prop "Start"`/);
    });

    it("rejects a row without an attach method", () => {
        expect(() => validateUnknown({ containerProps: { MyAppHeaderBar: { start: {} } } })).toThrow(
            /invalid `containerProps\.MyAppHeaderBar\.start\.attach`/,
        );
    });

    it("rejects an attach method that is not camelCase", () => {
        expect(() =>
            validateUnknown({ containerProps: { MyAppHeaderBar: { start: { attach: "PackStart" } } } }),
        ).toThrow(/invalid `containerProps\.MyAppHeaderBar\.start\.attach`/);
    });

    it("rejects an unknown detachArgs value", () => {
        expect(() =>
            validateUnknown({
                containerProps: { MyAppHeaderBar: { start: { attach: "packStart", detachArgs: "nope" } } },
            }),
        ).toThrow(/invalid `containerProps\.MyAppHeaderBar\.start\.detachArgs` — must be one of/);
    });
});

const ARRAY_PROP_VERB_CONFIG: GtkxConfig = {
    libraries: ["Gtk-4.0"],
    arrayProps: {
        MyAppChart: {
            series: {
                itemType: "ChartSeries",
                clear: "clearSeries",
                add: [
                    {
                        method: "addSeries",
                        args: [
                            { kind: "item", path: "id" },
                            { kind: "value", value: 3 },
                        ],
                        when: { path: "id", is: "defined" },
                    },
                ],
                remove: { method: "removeSeries", args: [{ kind: "item" }] },
            },
        },
    },
};

const ARRAY_PROP_CONSTRUCT_CONFIG: GtkxConfig = {
    arrayProps: {
        MyAppChart: {
            series: {
                itemType: "ChartSeries",
                construct: {
                    type: "MyAppSeries",
                    setters: [{ method: "setLabel", path: "label", when: "nonNull" }],
                    attach: "add",
                },
            },
        },
    },
};

describe("validateGtkxConfig arrayProps validation", () => {
    it("accepts an arrayProps row with verbs", () => {
        expect(() => validateGtkxConfig(ARRAY_PROP_VERB_CONFIG)).not.toThrow();
    });

    it("accepts a construct row", () => {
        expect(() => validateGtkxConfig(ARRAY_PROP_CONSTRUCT_CONFIG)).not.toThrow();
    });

    it("rejects a value that is not an object", () => {
        expect(() => validateUnknown({ arrayProps: "nope" })).toThrow(/invalid `arrayProps` — must be an object/);
    });

    it("rejects an array value", () => {
        expect(() => validateUnknown({ arrayProps: [] })).toThrow(/invalid `arrayProps` — must be an object/);
    });

    it("rejects a key that is not PascalCase", () => {
        expect(() =>
            validateUnknown({ arrayProps: { "kebab-name": { series: { itemType: "ChartSeries" } } } }),
        ).toThrow(/invalid `arrayProps key "kebab-name"`/);
    });

    it("rejects an entry with no props", () => {
        expect(() => validateUnknown({ arrayProps: { MyAppChart: {} } })).toThrow(
            /invalid `arrayProps\.MyAppChart` — must declare at least one prop/,
        );
    });

    it("rejects an entry that is not an object", () => {
        expect(() => validateUnknown({ arrayProps: { MyAppChart: ["series"] } })).toThrow(
            /invalid `arrayProps\.MyAppChart` — must be an object/,
        );
    });

    it("rejects a prop name that is not camelCase", () => {
        expect(() => validateUnknown({ arrayProps: { MyAppChart: { Series: { itemType: "ChartSeries" } } } })).toThrow(
            /invalid `arrayProps\.MyAppChart prop "Series"`/,
        );
    });

    it("rejects an item type that is not PascalCase", () => {
        expect(() => validateUnknown({ arrayProps: { MyAppChart: { series: { itemType: "chartSeries" } } } })).toThrow(
            /invalid `arrayProps\.MyAppChart\.series\.itemType`/,
        );
    });

    it("rejects a row without an itemType", () => {
        expect(() => validateUnknown({ arrayProps: { MyAppChart: { series: { clear: "clearSeries" } } } })).toThrow(
            /invalid `arrayProps\.MyAppChart\.series\.itemType`/,
        );
    });
});

describe("validateGtkxConfig arrayProps verb validation", () => {
    it("rejects a clear verb that is not camelCase", () => {
        expect(() =>
            validateUnknown({ arrayProps: { MyAppChart: { series: { itemType: "ChartSeries", clear: "Clear" } } } }),
        ).toThrow(/invalid `arrayProps\.MyAppChart\.series\.clear`/);
    });

    it("rejects an add verb that is not an array", () => {
        expect(() =>
            validateUnknown({ arrayProps: { MyAppChart: { series: { itemType: "ChartSeries", add: "addSeries" } } } }),
        ).toThrow(/invalid `arrayProps\.MyAppChart\.series\.add` — must be an array of call steps/);
    });

    it("rejects a call arg with an unknown kind", () => {
        expect(() =>
            validateUnknown({
                arrayProps: {
                    MyAppChart: {
                        series: {
                            itemType: "ChartSeries",
                            add: [{ method: "addSeries", args: [{ kind: "prop" }] }],
                        },
                    },
                },
            }),
        ).toThrow(/invalid `arrayProps\.MyAppChart\.series\.add\[0\]\.args\[0\]\.kind` — must be "item" or "value"/);
    });

    it("rejects an invalid when condition", () => {
        expect(() =>
            validateUnknown({
                arrayProps: {
                    MyAppChart: {
                        series: {
                            itemType: "ChartSeries",
                            add: [{ method: "addSeries", args: [], when: { path: "id", is: "truthy" } }],
                        },
                    },
                },
            }),
        ).toThrow(/invalid `arrayProps\.MyAppChart\.series\.add\[0\]\.when\.is` — must be one of defined, nonNull/);
    });

    it("rejects a construct setter with an invalid condition", () => {
        expect(() =>
            validateUnknown({
                arrayProps: {
                    MyAppChart: {
                        series: {
                            itemType: "ChartSeries",
                            construct: {
                                type: "MyAppSeries",
                                setters: [{ method: "setLabel", path: "label", when: "always" }],
                                attach: "add",
                            },
                        },
                    },
                },
            }),
        ).toThrow(/invalid `arrayProps\.MyAppChart\.series\.construct\.setters\[0\]\.when`/);
    });
});

const METHOD_RULE_CONFIG: GtkxConfig = {
    elementMap: [
        {
            child: "MyAppGadget",
            parentType: "MyAppBoard",
            verb: {
                kind: "method",
                attach: "addGadget",
                attachArgs: "child",
                detach: "removeGadget",
                detachArgs: "child",
                detachGuard: { side: "child", getter: "getBoard" },
            },
        },
    ],
};

const ORDERED_INSERT_RULE_CONFIG: GtkxConfig = {
    elementMap: [
        {
            child: "MyAppColumn",
            parentMethod: "insertColumn",
            verb: {
                kind: "orderedInsert",
                attach: "insertColumn",
                detach: "removeColumn",
                collection: "getColumns",
            },
        },
    ],
};

describe("validateGtkxConfig elementMap validation", () => {
    it("accepts a method-verb rule", () => {
        expect(() => validateGtkxConfig(METHOD_RULE_CONFIG)).not.toThrow();
    });

    it("accepts an ordered-insert rule with a parent method", () => {
        expect(() => validateGtkxConfig(ORDERED_INSERT_RULE_CONFIG)).not.toThrow();
    });

    it("rejects a non-array value", () => {
        expect(() => validateUnknown({ elementMap: {} })).toThrow(/invalid `elementMap` — must be an array/);
    });

    it("rejects a rule without a parent", () => {
        expect(() =>
            validateUnknown({
                elementMap: [
                    {
                        child: "MyAppGadget",
                        verb: {
                            kind: "method",
                            attach: "add",
                            attachArgs: "child",
                            detach: "remove",
                            detachArgs: "child",
                        },
                    },
                ],
            }),
        ).toThrow(/invalid `elementMap\[0\]` — must declare `parentType` or `parentMethod`/);
    });

    it("rejects a child that is not a GLib type name", () => {
        expect(() =>
            validateUnknown({
                elementMap: [
                    {
                        child: "kebab-name",
                        parentType: "MyAppBoard",
                        verb: {
                            kind: "method",
                            attach: "add",
                            attachArgs: "child",
                            detach: "remove",
                            detachArgs: "child",
                        },
                    },
                ],
            }),
        ).toThrow(/invalid `elementMap\[0\]\.child`/);
    });
});

describe("validateGtkxConfig elementMap verb validation", () => {
    it("rejects an unknown verb kind", () => {
        expect(() =>
            validateUnknown({
                elementMap: [{ child: "MyAppGadget", parentType: "MyAppBoard", verb: { kind: "magic" } }],
            }),
        ).toThrow(/invalid `elementMap\[0\]\.verb\.kind` — must be "method" or "orderedInsert"/);
    });

    it("rejects an unknown argument shape", () => {
        expect(() =>
            validateUnknown({
                elementMap: [
                    {
                        child: "MyAppGadget",
                        parentType: "MyAppBoard",
                        verb: {
                            kind: "method",
                            attach: "add",
                            attachArgs: "widget",
                            detach: "remove",
                            detachArgs: "child",
                        },
                    },
                ],
            }),
        ).toThrow(
            /invalid `elementMap\[0\]\.verb\.attachArgs` — must be one of child, childName, null, prefixChild, prefixNull/,
        );
    });

    it("rejects an invalid detach guard", () => {
        expect(() =>
            validateUnknown({
                elementMap: [
                    {
                        child: "MyAppGadget",
                        parentType: "MyAppBoard",
                        verb: {
                            kind: "method",
                            attach: "add",
                            attachArgs: "child",
                            detach: "remove",
                            detachArgs: "child",
                            detachGuard: { side: "owner", getter: "getBoard" },
                        },
                    },
                ],
            }),
        ).toThrow(/invalid `elementMap\[0\]\.verb\.detachGuard\.side` — must be "child" or "parent"/);
    });
});

describe("validateGtkxConfig reactCompiler validation", () => {
    it("accepts a boolean", () => {
        expect(() => validateGtkxConfig({ reactCompiler: false })).not.toThrow();
        expect(() => validateGtkxConfig({ reactCompiler: true })).not.toThrow();
    });

    it("accepts an options object", () => {
        const config: GtkxConfig = {
            reactCompiler: { compilationMode: "annotation", panicThreshold: "all_errors" },
        };
        expect(() => validateGtkxConfig(config)).not.toThrow();
    });

    it("accepts a config that omits reactCompiler", () => {
        expect(() => validateGtkxConfig({ libraries: ["Gtk-4.0"] })).not.toThrow();
    });

    it("rejects a non-boolean, non-object value", () => {
        expect(() => validateUnknown({ reactCompiler: "yes" })).toThrow(
            /`reactCompiler` must be a boolean or an options object/,
        );
    });

    it("rejects an array value", () => {
        expect(() => validateUnknown({ reactCompiler: [] })).toThrow(
            /`reactCompiler` must be a boolean or an options object/,
        );
    });

    it("rejects an invalid compilationMode", () => {
        expect(() => validateUnknown({ reactCompiler: { compilationMode: "eager" } })).toThrow(
            /invalid `reactCompiler\.compilationMode` "eager"/,
        );
    });

    it("rejects an invalid panicThreshold", () => {
        expect(() => validateUnknown({ reactCompiler: { panicThreshold: "warn" } })).toThrow(
            /invalid `reactCompiler\.panicThreshold` "warn"/,
        );
    });
});

describe("resolveReactCompilerOptions", () => {
    it("returns null when disabled", () => {
        expect(resolveReactCompilerOptions(false)).toBeNull();
    });

    it("enables with target 19 by default", () => {
        expect(resolveReactCompilerOptions(undefined)).toEqual({ target: "19" });
        expect(resolveReactCompilerOptions(true)).toEqual({ target: "19" });
    });

    it("merges overrides while forcing target 19", () => {
        expect(resolveReactCompilerOptions({ compilationMode: "all", panicThreshold: "none" })).toEqual({
            target: "19",
            compilationMode: "all",
            panicThreshold: "none",
        });
    });
});

describe("resolveGtkxConfig", () => {
    it("defaults every optional field on an empty config", () => {
        expect(resolveGtkxConfig({})).toEqual({
            libraries: [],
            girPath: [],
            applicationId: undefined,
            containerProps: {},
            arrayProps: {},
            objectProps: {},
            virtualProps: {},
            elementMap: [],
            reactCompiler: { target: "19" },
        });
    });

    it("carries configured values through unchanged", () => {
        const configured: GtkxConfig = {
            libraries: ["Gtk-4.0", "Adw-1"],
            girPath: ["/opt/gir"],
            applicationId: "org.gtk.Demo4",
            containerProps: { MyAppHeaderBar: { start: { attach: "packStart" } } },
            arrayProps: { MyAppChart: { series: { itemType: "ChartSeries", clear: "clearSeries" } } },
            objectProps: {
                MyAppCanvas: {
                    viewport: {
                        itemType: "CanvasViewport",
                        set: [{ method: "setViewport", args: [{ kind: "item" }] }],
                    },
                },
            },
            virtualProps: {
                MyAppList: { sortFunc: { type: "MyApp.ListSortFunc", setter: "setSortFunc" } },
            },
            elementMap: [
                {
                    child: "MyAppGadget",
                    parentType: "MyAppBoard",
                    verb: { kind: "method", attach: "add", attachArgs: "child", detach: "remove", detachArgs: "child" },
                },
            ],
            reactCompiler: { compilationMode: "annotation" },
        };
        expect(resolveGtkxConfig(configured)).toEqual({
            ...configured,
            reactCompiler: { target: "19", compilationMode: "annotation" },
        });
    });

    it("preserves the libraries wildcard", () => {
        expect(resolveGtkxConfig({ libraries: "*" }).libraries).toBe("*");
    });

    it("collapses a disabled reactCompiler to null", () => {
        expect(resolveGtkxConfig({ reactCompiler: false }).reactCompiler).toBeNull();
    });
});
