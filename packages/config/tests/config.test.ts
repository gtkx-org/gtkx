import { describe, expect, it } from "vitest";
import {
    type Config,
    defineConfig,
    isValidApplicationId,
    resolveConfig,
    resolveReactCompilerOptions,
    validateConfig,
} from "../src/config.js";
import { DEFAULT_USER_EVENT_SIGNALS } from "../src/user-event-signals.js";

const validateUnknown = (config: unknown): void => {
    validateConfig(config as Config);
};

const validateWithAppId = (config: Partial<Config>): void => {
    validateConfig({ applicationId: "org.gtk.Test", ...config });
};

describe("defineConfig", () => {
    it("returns the config unchanged", () => {
        const config = { applicationId: "org.gtk.Demo4", libraries: ["Gtk-4.0", "Adw-1"] };
        expect(defineConfig(config)).toBe(config);
    });

    it("accepts c12 environment-branch keys", () => {
        const config = defineConfig({
            applicationId: "org.gtk.Demo4",
            libraries: ["Gtk-4.0"],
            $production: { applicationId: "org.gtk.Prod" },
        });

        expect(config.libraries).toEqual(["Gtk-4.0"]);
    });
});

describe("validateConfig (libraries) — accepted shapes", () => {
    it("accepts a girPath array", () => {
        expect(() => {
            validateWithAppId({ libraries: ["Gtk-4.0"], girPath: ["/usr/share/gir-1.0"] });
        }).not.toThrow();
    });

    it("rejects an empty libraries array", () => {
        expect(() => {
            validateWithAppId({ libraries: [] });
        }).toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it("rejects a non-array, non-wildcard libraries field", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", libraries: "Gtk-4.0" });
        }).toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it('accepts the "*" wildcard', () => {
        expect(() => {
            validateWithAppId({ libraries: "*" });
        }).not.toThrow();
    });

    it("accepts a config that omits libraries", () => {
        expect(() => {
            validateWithAppId({});
        }).not.toThrow();

        expect(() => {
            validateWithAppId({ girPath: ["/usr/share/gir-1.0"] });
        }).not.toThrow();
    });
});

describe("validateConfig (libraries) — identifier and girPath validation", () => {
    it('rejects "*" used as an array entry and hints at the bare-string form', () => {
        expect(() => {
            validateWithAppId({ libraries: ["*"] });
        }).toThrow(
            'set `libraries: "*"` as a bare string, not an array entry',
        );
    });

    it("rejects a library identifier without a version suffix", () => {
        expect(() => {
            validateWithAppId({ libraries: ["Gtk"] });
        }).toThrow(/invalid library identifier/);
    });

    it("rejects a library identifier that starts with a digit", () => {
        expect(() => {
            validateWithAppId({ libraries: ["4Gtk-1.0"] });
        }).toThrow(/invalid library identifier/);
    });

    it("accepts multi-component versions", () => {
        expect(() => {
            validateWithAppId({ libraries: ["Glib-2.0.1"] });
        }).not.toThrow();
    });

    it("rejects a non-string library entry", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", libraries: [123] });
        }).toThrow(
            /invalid library identifier/,
        );
    });

    it("rejects a non-array girPath", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", libraries: ["Gtk-4.0"], girPath: "/usr/share/gir-1.0" });
        },
        ).toThrow(/`girPath` must be an array of strings if provided/);
    });
});

describe("validateConfig (applicationId)", () => {
    it("accepts a valid applicationId", () => {
        expect(() => {
            validateConfig({ applicationId: "org.gtk.Demo4" });
        }).not.toThrow();
    });

    it("rejects an invalid applicationId", () => {
        expect(() => {
            validateConfig({ applicationId: "not valid" });
        }).toThrow(/invalid `applicationId`/);

        expect(() => {
            validateConfig({ applicationId: "singletoken" });
        }).toThrow(/invalid `applicationId`/);
    });

    it("rejects a non-string applicationId", () => {
        expect(() => {
            validateUnknown({ applicationId: 123 });
        }).toThrow(/invalid `applicationId`/);
    });

    it("rejects a config that omits applicationId", () => {
        expect(() => {
            validateUnknown({ libraries: ["Gtk-4.0"] });
        }).toThrow(/invalid `applicationId`/);
    });
});

describe("validateConfig reactCompiler validation", () => {
    it("accepts a boolean", () => {
        expect(() => {
            validateWithAppId({ reactCompiler: false });
        }).not.toThrow();

        expect(() => {
            validateWithAppId({ reactCompiler: true });
        }).not.toThrow();
    });

    it("accepts an options object", () => {
        expect(() => {
            validateWithAppId({ reactCompiler: { compilationMode: "annotation", panicThreshold: "all_errors" } });
        },
        ).not.toThrow();
    });

    it("accepts a config that omits reactCompiler", () => {
        expect(() => {
            validateWithAppId({ libraries: ["Gtk-4.0"] });
        }).not.toThrow();
    });

    it("rejects a non-boolean, non-object value", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", reactCompiler: "yes" });
        }).toThrow(
            /`reactCompiler` must be a boolean or an options object/,
        );
    });

    it("rejects an array value", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", reactCompiler: [] });
        }).toThrow(
            /`reactCompiler` must be a boolean or an options object/,
        );
    });
});

describe("validateConfig (reactCompiler options and codegen)", () => {
    it("rejects an invalid compilationMode", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", reactCompiler: { compilationMode: "eager" } });
        },
        ).toThrow(/invalid `reactCompiler\.compilationMode` "eager"/);
    });

    it("rejects an invalid panicThreshold", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", reactCompiler: { panicThreshold: "warn" } });
        },
        ).toThrow(/invalid `reactCompiler\.panicThreshold` "warn"/);
    });

    it("rejects a non-boolean codegen", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", codegen: "no" });
        }).toThrow(
            /`codegen` must be a boolean/,
        );
    });

    it("accepts a boolean codegen", () => {
        expect(() => {
            validateWithAppId({ codegen: false });
        }).not.toThrow();
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

describe("validateConfig (userEventSignals)", () => {
    it("accepts a record of type names to signal name arrays", () => {
        expect(() => {
            validateWithAppId({ userEventSignals: { MyWidget: ["changed", "toggled"] } });
        }).not.toThrow();
    });

    it("accepts an empty record", () => {
        expect(() => {
            validateWithAppId({ userEventSignals: {} });
        }).not.toThrow();
    });

    it("rejects a non-record value", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", userEventSignals: ["changed"] });
        }).toThrow(
            "`userEventSignals` must be a record of GLib type names to signal name arrays",
        );
    });

    it("rejects a non-array entry", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", userEventSignals: { MyWidget: "changed" } });
        },
        ).toThrow("`userEventSignals.MyWidget` must be an array of signal names");
    });

    it("rejects an empty signal name", () => {
        expect(() => {
            validateUnknown({ applicationId: "org.gtk.Test", userEventSignals: { MyWidget: [""] } });
        }).toThrow(
            "`userEventSignals.MyWidget[0]` must be a non-empty signal name",
        );
    });
});

describe("resolveConfig", () => {
    it("defaults the react compiler while passing applicationId through", () => {
        expect(resolveConfig({ applicationId: "org.example.App" })).toEqual({
            applicationId: "org.example.App",
            reactCompiler: { target: "19" },
            userEventSignals: DEFAULT_USER_EVENT_SIGNALS,
            elements: null,
            lazyElements: [],
        });
    });

    it("carries configured values through unchanged", () => {
        const configured: Config = {
            applicationId: "org.gtk.Demo4",
            reactCompiler: { compilationMode: "annotation" },
        };

        expect(resolveConfig(configured)).toEqual({
            applicationId: "org.gtk.Demo4",
            reactCompiler: { target: "19", compilationMode: "annotation" },
            userEventSignals: DEFAULT_USER_EVENT_SIGNALS,
            elements: null,
            lazyElements: [],
        });
    });

    it("resolves a configured element behaviors module against the project root", () => {
        const resolved = resolveConfig(
            { applicationId: "org.example.App", elements: { behaviors: "./elements.ts" } },
            "/project",
        );

        expect(resolved.elements).toBe("/project/elements.ts");
    });

    it("rejects an empty element behaviors module path", () => {
        expect(() => {
            validateConfig({ applicationId: "org.example.App", elements: { behaviors: "" } });
        }).toThrow(
            /must be a path to a module exporting element behaviors/,
        );
    });
});

describe("resolveConfig — compiler collapse and signal unions", () => {
    it("collapses a disabled reactCompiler to null", () => {
        expect(resolveConfig({ applicationId: "org.example.App", reactCompiler: false }).reactCompiler).toBeNull();
    });

    it("unions configured user event signals with the defaults", () => {
        const resolved = resolveConfig({
            applicationId: "org.example.App",
            userEventSignals: { GObject: ["notify", "custom-changed"], MyWidget: ["changed"] },
        });

        expect(resolved.userEventSignals.GObject).toEqual(["notify", "custom-changed"]);
        expect(resolved.userEventSignals.MyWidget).toEqual(["changed"]);
        expect(resolved.userEventSignals.GtkEditable).toEqual(DEFAULT_USER_EVENT_SIGNALS.GtkEditable);
    });

    it("does not mutate the default table when merging overrides", () => {
        const before = structuredClone(DEFAULT_USER_EVENT_SIGNALS);
        resolveConfig({ applicationId: "org.example.App", userEventSignals: { GObject: ["extra"] } });
        expect(DEFAULT_USER_EVENT_SIGNALS).toEqual(before);
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
        expect(long).toHaveLength(256);
        expect(isValidApplicationId(long)).toBe(false);
    });

    it("accepts an ID at the 255-character maximum", () => {
        const maxLength = `${"a".repeat(251)}.${"b".repeat(3)}`;
        expect(maxLength).toHaveLength(255);
        expect(isValidApplicationId(maxLength)).toBe(true);
    });
});

describe("isValidApplicationId — character, dot, and segment rules", () => {
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

describe("validateConfig (elements.config)", () => {
    it("accepts per-element component and lazy config", () => {
        expect(() => {
            validateWithAppId({
                elements: {
                    config: {
                        GtkButton: { component: { module: "@example/wrappers", export: "withButton" }, lazy: true },
                    },
                },
            });
        },
        ).not.toThrow();
    });

    it("accepts a config that omits elements", () => {
        expect(() => {
            validateWithAppId({});
        }).not.toThrow();
    });

    it("rejects a component entry missing its export", () => {
        expect(() => {
            validateUnknown({
                applicationId: "org.gtk.Test",
                elements: { config: { GtkButton: { component: { module: "m" } } } },
            });
        },
        ).toThrow();
    });

    it("rejects an empty component module specifier", () => {
        expect(() => {
            validateWithAppId({
                elements: { config: { GtkButton: { component: { module: "", export: "withButton" } } } },
            });
        },
        ).toThrow(/must be a module specifier/);
    });
});
