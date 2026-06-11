import { describe, expect, it } from "vitest";
import {
    defineConfig,
    type GtkxConfig,
    isValidApplicationId,
    resolveGtkxConfig,
    resolveReactCompilerOptions,
} from "../src/index.js";

const defineUnknown = (config: unknown): GtkxConfig => defineConfig(config as GtkxConfig);

describe("defineConfig", () => {
    it("returns the config unchanged when valid", () => {
        const config = { libraries: ["Gtk-4.0", "Adw-1"] };
        expect(defineConfig(config)).toBe(config);
    });

    it("accepts a girPath array", () => {
        const config = { libraries: ["Gtk-4.0"], girPath: ["/usr/share/gir-1.0"] };
        expect(defineConfig(config)).toBe(config);
    });

    it("rejects an empty libraries array", () => {
        expect(() => defineConfig({ libraries: [] })).toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it("rejects a non-array, non-wildcard libraries field", () => {
        expect(() => defineUnknown({ libraries: "Gtk-4.0" })).toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it('accepts the "*" wildcard', () => {
        expect(defineConfig({ libraries: "*" }).libraries).toBe("*");
    });

    it("accepts a config that omits libraries", () => {
        expect(() => defineConfig({})).not.toThrow();
        expect(() => defineConfig({ girPath: ["/usr/share/gir-1.0"] })).not.toThrow();
    });

    it('rejects "*" used as an array entry and hints at the bare-string form', () => {
        expect(() => defineConfig({ libraries: ["*"] })).toThrow(
            'set `libraries: "*"` as a bare string, not an array entry',
        );
    });

    it("rejects a library identifier without a version suffix", () => {
        expect(() => defineConfig({ libraries: ["Gtk"] })).toThrow(/invalid library identifier/);
    });

    it("rejects a library identifier that starts with a digit", () => {
        expect(() => defineConfig({ libraries: ["4Gtk-1.0"] })).toThrow(/invalid library identifier/);
    });

    it("accepts multi-component versions", () => {
        expect(() => defineConfig({ libraries: ["Glib-2.0.1"] })).not.toThrow();
    });

    it("rejects a non-string library entry", () => {
        expect(() => defineUnknown({ libraries: [123] })).toThrow(/invalid library identifier/);
    });

    it("rejects a non-array girPath", () => {
        expect(() => defineUnknown({ libraries: ["Gtk-4.0"], girPath: "/usr/share/gir-1.0" })).toThrow(
            /`girPath` must be an array of strings if provided/,
        );
    });
});

describe("defineConfig (applicationId)", () => {
    it("accepts a valid applicationId", () => {
        expect(defineConfig({ applicationId: "org.gtk.Demo4" }).applicationId).toBe("org.gtk.Demo4");
    });

    it("rejects an invalid applicationId", () => {
        expect(() => defineConfig({ applicationId: "not valid" })).toThrow(/invalid `applicationId`/);
        expect(() => defineConfig({ applicationId: "singletoken" })).toThrow(/invalid `applicationId`/);
    });

    it("rejects a non-string applicationId", () => {
        expect(() => defineUnknown({ applicationId: 123 })).toThrow(/invalid `applicationId`/);
    });

    it("accepts a config that omits applicationId", () => {
        expect(() => defineConfig({ libraries: ["Gtk-4.0"] })).not.toThrow();
        expect(defineConfig({ libraries: ["Gtk-4.0"] }).applicationId).toBeUndefined();
    });
});

describe("defineConfig slot-map validation", () => {
    it("accepts a slots map", () => {
        const config: GtkxConfig = { libraries: ["Gtk-4.0"], slots: { MyAppFooBar: ["content"] } };
        expect(defineConfig(config)).toBe(config);
    });

    it("accepts a containerSlots map", () => {
        const config: GtkxConfig = { libraries: ["Gtk-4.0"], containerSlots: { MyAppHeaderBar: ["packStart"] } };
        expect(defineConfig(config)).toBe(config);
    });

    describe.each(["slots", "containerSlots"] as const)("%s", (option) => {
        it("rejects a value that is not an object", () => {
            expect(() => defineUnknown({ [option]: "nope" })).toThrow(new RegExp(`\`${option}\` must be an object`));
        });

        it("rejects an array value", () => {
            expect(() => defineUnknown({ [option]: [] })).toThrow(new RegExp(`\`${option}\` must be an object`));
        });

        it("rejects a key that is not PascalCase", () => {
            expect(() => defineUnknown({ [option]: { "kebab-name": ["content"] } })).toThrow(
                new RegExp(`invalid \`${option}\` key "kebab-name"`),
            );
        });

        it("rejects an entry with an empty array", () => {
            expect(() => defineUnknown({ [option]: { MyAppFooBar: [] } })).toThrow(
                new RegExp(`\`${option}\\.MyAppFooBar\` must be a non-empty array`),
            );
        });

        it("rejects an entry that is not an array", () => {
            expect(() => defineUnknown({ [option]: { MyAppFooBar: "content" } })).toThrow(
                new RegExp(`\`${option}\\.MyAppFooBar\` must be a non-empty array`),
            );
        });

        it("rejects a name that is not camelCase", () => {
            expect(() => defineUnknown({ [option]: { MyAppFooBar: ["Content"] } })).toThrow(
                new RegExp(`invalid \`${option}\\.MyAppFooBar\` entry "Content"`),
            );
        });
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

describe("defineConfig arrayProps validation", () => {
    it("accepts an arrayProps row with verbs", () => {
        expect(defineConfig(ARRAY_PROP_VERB_CONFIG)).toBe(ARRAY_PROP_VERB_CONFIG);
    });

    it("accepts a construct row", () => {
        expect(defineConfig(ARRAY_PROP_CONSTRUCT_CONFIG)).toBe(ARRAY_PROP_CONSTRUCT_CONFIG);
    });

    it("rejects a value that is not an object", () => {
        expect(() => defineUnknown({ arrayProps: "nope" })).toThrow(/invalid `arrayProps` — must be an object/);
    });

    it("rejects an array value", () => {
        expect(() => defineUnknown({ arrayProps: [] })).toThrow(/invalid `arrayProps` — must be an object/);
    });

    it("rejects a key that is not PascalCase", () => {
        expect(() => defineUnknown({ arrayProps: { "kebab-name": { series: { itemType: "ChartSeries" } } } })).toThrow(
            /invalid `arrayProps key "kebab-name"`/,
        );
    });

    it("rejects an entry with no props", () => {
        expect(() => defineUnknown({ arrayProps: { MyAppChart: {} } })).toThrow(
            /invalid `arrayProps\.MyAppChart` — must declare at least one prop/,
        );
    });

    it("rejects an entry that is not an object", () => {
        expect(() => defineUnknown({ arrayProps: { MyAppChart: ["series"] } })).toThrow(
            /invalid `arrayProps\.MyAppChart` — must be an object/,
        );
    });

    it("rejects a prop name that is not camelCase", () => {
        expect(() => defineUnknown({ arrayProps: { MyAppChart: { Series: { itemType: "ChartSeries" } } } })).toThrow(
            /invalid `arrayProps\.MyAppChart prop "Series"`/,
        );
    });

    it("rejects an item type that is not PascalCase", () => {
        expect(() => defineUnknown({ arrayProps: { MyAppChart: { series: { itemType: "chartSeries" } } } })).toThrow(
            /invalid `arrayProps\.MyAppChart\.series\.itemType`/,
        );
    });

    it("rejects a row without an itemType", () => {
        expect(() => defineUnknown({ arrayProps: { MyAppChart: { series: { clear: "clearSeries" } } } })).toThrow(
            /invalid `arrayProps\.MyAppChart\.series\.itemType`/,
        );
    });
});

describe("defineConfig arrayProps verb validation", () => {
    it("rejects a clear verb that is not camelCase", () => {
        expect(() =>
            defineUnknown({ arrayProps: { MyAppChart: { series: { itemType: "ChartSeries", clear: "Clear" } } } }),
        ).toThrow(/invalid `arrayProps\.MyAppChart\.series\.clear`/);
    });

    it("rejects an add verb that is not an array", () => {
        expect(() =>
            defineUnknown({ arrayProps: { MyAppChart: { series: { itemType: "ChartSeries", add: "addSeries" } } } }),
        ).toThrow(/invalid `arrayProps\.MyAppChart\.series\.add` — must be an array of call steps/);
    });

    it("rejects a call arg with an unknown kind", () => {
        expect(() =>
            defineUnknown({
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
            defineUnknown({
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
            defineUnknown({
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

describe("defineConfig elementMap validation", () => {
    it("accepts a method-verb rule", () => {
        expect(defineConfig(METHOD_RULE_CONFIG)).toBe(METHOD_RULE_CONFIG);
    });

    it("accepts an ordered-insert rule with a parent method", () => {
        expect(defineConfig(ORDERED_INSERT_RULE_CONFIG)).toBe(ORDERED_INSERT_RULE_CONFIG);
    });

    it("rejects a non-array value", () => {
        expect(() => defineUnknown({ elementMap: {} })).toThrow(/invalid `elementMap` — must be an array/);
    });

    it("rejects a rule without a parent", () => {
        expect(() =>
            defineUnknown({
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
            defineUnknown({
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

describe("defineConfig elementMap verb validation", () => {
    it("rejects an unknown verb kind", () => {
        expect(() =>
            defineUnknown({
                elementMap: [{ child: "MyAppGadget", parentType: "MyAppBoard", verb: { kind: "magic" } }],
            }),
        ).toThrow(/invalid `elementMap\[0\]\.verb\.kind` — must be "method" or "orderedInsert"/);
    });

    it("rejects an unknown argument shape", () => {
        expect(() =>
            defineUnknown({
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
            defineUnknown({
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

describe("defineConfig bigintAliases validation", () => {
    it("accepts qualified alias names", () => {
        expect(() => defineConfig({ bigintAliases: ["Gst.ClockTime", "MyLib.DeviceAddress"] })).not.toThrow();
    });

    it("accepts an omitted field", () => {
        expect(() => defineConfig({})).not.toThrow();
    });

    it("rejects a non-array value", () => {
        expect(() => defineUnknown({ bigintAliases: "Gst.ClockTime" })).toThrow(/`bigintAliases` must be an array/);
    });

    it("rejects an unqualified entry", () => {
        expect(() => defineUnknown({ bigintAliases: ["ClockTime"] })).toThrow(/qualified GIR alias name/);
    });

    it("rejects a non-string entry", () => {
        expect(() => defineUnknown({ bigintAliases: [42] })).toThrow(/qualified GIR alias name/);
    });
});

describe("defineConfig reactCompiler validation", () => {
    it("accepts a boolean", () => {
        expect(() => defineConfig({ reactCompiler: false })).not.toThrow();
        expect(() => defineConfig({ reactCompiler: true })).not.toThrow();
    });

    it("accepts an options object", () => {
        const config: GtkxConfig = {
            reactCompiler: { compilationMode: "annotation", panicThreshold: "all_errors" },
        };
        expect(defineConfig(config)).toBe(config);
    });

    it("accepts a config that omits reactCompiler", () => {
        expect(() => defineConfig({ libraries: ["Gtk-4.0"] })).not.toThrow();
    });

    it("rejects a non-boolean, non-object value", () => {
        expect(() => defineUnknown({ reactCompiler: "yes" })).toThrow(
            /`reactCompiler` must be a boolean or an options object/,
        );
    });

    it("rejects an array value", () => {
        expect(() => defineUnknown({ reactCompiler: [] })).toThrow(
            /`reactCompiler` must be a boolean or an options object/,
        );
    });

    it("rejects an invalid compilationMode", () => {
        expect(() => defineUnknown({ reactCompiler: { compilationMode: "eager" } })).toThrow(
            /invalid `reactCompiler\.compilationMode` "eager"/,
        );
    });

    it("rejects an invalid panicThreshold", () => {
        expect(() => defineUnknown({ reactCompiler: { panicThreshold: "warn" } })).toThrow(
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
            slots: {},
            containerSlots: {},
            arrayProps: {},
            objectProps: {},
            virtualProps: {},
            elementMap: [],
            bigintAliases: [],
            reactCompiler: { target: "19" },
        });
    });

    it("carries configured values through unchanged", () => {
        const configured: GtkxConfig = {
            libraries: ["Gtk-4.0", "Adw-1"],
            girPath: ["/opt/gir"],
            applicationId: "org.gtk.Demo4",
            slots: { MyAppFooBar: ["content"] },
            containerSlots: { MyAppHeaderBar: ["packStart"] },
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
            bigintAliases: ["Gst.ClockTime"],
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

describe("isValidApplicationId", () => {
    it("accepts a standard reverse-DNS application ID", () => {
        expect(isValidApplicationId("com.example.MyApp")).toBe(true);
    });

    it("accepts hyphens and underscores within elements", () => {
        expect(isValidApplicationId("com.example.my-app_v2")).toBe(true);
    });

    it("rejects an ID with no dots", () => {
        expect(isValidApplicationId("singletoken")).toBe(false);
    });

    it("rejects an empty string", () => {
        expect(isValidApplicationId("")).toBe(false);
    });

    it("rejects an ID exceeding 255 characters", () => {
        const long = `${"a".repeat(252)}.${"b".repeat(3)}`;
        expect(long.length).toBe(256);
        expect(isValidApplicationId(long)).toBe(false);
    });

    it("rejects an element starting with a digit", () => {
        expect(isValidApplicationId("com.4example.app")).toBe(false);
    });

    it("rejects whitespace and disallowed characters", () => {
        expect(isValidApplicationId("com.example.my app")).toBe(false);
        expect(isValidApplicationId("com.example.my$app")).toBe(false);
    });

    it("rejects trailing or leading dots", () => {
        expect(isValidApplicationId(".com.example")).toBe(false);
        expect(isValidApplicationId("com.example.")).toBe(false);
    });

    it("accepts a two-segment ID", () => {
        expect(isValidApplicationId("org.app")).toBe(true);
    });

    it("accepts single-character segments", () => {
        expect(isValidApplicationId("a.b")).toBe(true);
    });

    it("accepts a deeply nested ID", () => {
        expect(isValidApplicationId("com.example.sub.category.app")).toBe(true);
    });

    it("accepts elements containing digits after the first character", () => {
        expect(isValidApplicationId("org.gtkx123.app456")).toBe(true);
    });

    it("rejects an ID with consecutive dots", () => {
        expect(isValidApplicationId("com..app")).toBe(false);
    });

    it("rejects a segment starting with a hyphen", () => {
        expect(isValidApplicationId("com.-app.test")).toBe(false);
    });
});
