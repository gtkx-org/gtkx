import { describe, expect, it } from "vitest";
import {
    type Config,
    defineConfig,
    isValidApplicationId,
    resolveConfig,
    resolveReactCompilerOptions,
    validateConfig,
} from "../src/config.js";
import type { ElementProp } from "../src/index.js";

const validateUnknown = (config: unknown): void => validateConfig(config as Config);

const validateWithAppId = (config: Partial<Config>): void =>
    validateConfig({ applicationId: "org.gtk.Test", ...config } as Config);

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

describe("validateConfig (libraries)", () => {
    it("accepts a girPath array", () => {
        expect(() => validateWithAppId({ libraries: ["Gtk-4.0"], girPath: ["/usr/share/gir-1.0"] })).not.toThrow();
    });

    it("rejects an empty libraries array", () => {
        expect(() => validateWithAppId({ libraries: [] })).toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it("rejects a non-array, non-wildcard libraries field", () => {
        expect(() => validateUnknown({ applicationId: "org.gtk.Test", libraries: "Gtk-4.0" })).toThrow(
            '`libraries` must be "*", a non-empty string array, or omitted',
        );
    });

    it('accepts the "*" wildcard', () => {
        expect(() => validateWithAppId({ libraries: "*" })).not.toThrow();
    });

    it("accepts a config that omits libraries", () => {
        expect(() => validateWithAppId({})).not.toThrow();
        expect(() => validateWithAppId({ girPath: ["/usr/share/gir-1.0"] })).not.toThrow();
    });

    it('rejects "*" used as an array entry and hints at the bare-string form', () => {
        expect(() => validateWithAppId({ libraries: ["*"] })).toThrow(
            'set `libraries: "*"` as a bare string, not an array entry',
        );
    });

    it("rejects a library identifier without a version suffix", () => {
        expect(() => validateWithAppId({ libraries: ["Gtk"] })).toThrow(/invalid library identifier/);
    });

    it("rejects a library identifier that starts with a digit", () => {
        expect(() => validateWithAppId({ libraries: ["4Gtk-1.0"] })).toThrow(/invalid library identifier/);
    });

    it("accepts multi-component versions", () => {
        expect(() => validateWithAppId({ libraries: ["Glib-2.0.1"] })).not.toThrow();
    });

    it("rejects a non-string library entry", () => {
        expect(() => validateUnknown({ applicationId: "org.gtk.Test", libraries: [123] })).toThrow(
            /invalid library identifier/,
        );
    });

    it("rejects a non-array girPath", () => {
        expect(() =>
            validateUnknown({ applicationId: "org.gtk.Test", libraries: ["Gtk-4.0"], girPath: "/usr/share/gir-1.0" }),
        ).toThrow(/`girPath` must be an array of strings if provided/);
    });
});

describe("validateConfig (applicationId)", () => {
    it("accepts a valid applicationId", () => {
        expect(() => validateConfig({ applicationId: "org.gtk.Demo4" })).not.toThrow();
    });

    it("rejects an invalid applicationId", () => {
        expect(() => validateConfig({ applicationId: "not valid" })).toThrow(/invalid `applicationId`/);
        expect(() => validateConfig({ applicationId: "singletoken" })).toThrow(/invalid `applicationId`/);
    });

    it("rejects a non-string applicationId", () => {
        expect(() => validateUnknown({ applicationId: 123 })).toThrow(/invalid `applicationId`/);
    });

    it("rejects a config that omits applicationId", () => {
        expect(() => validateUnknown({ libraries: ["Gtk-4.0"] })).toThrow(/invalid `applicationId`/);
    });
});

describe("validateConfig elementProps validation", () => {
    it("accepts inline element props of every kind", () => {
        const elementProps: Record<string, ElementProp[]> = {
            GtkWidget: [
                {
                    kind: "container",
                    prop: "controllers",
                    child: "GtkEventController",
                    append: "addController",
                    remove: "removeController",
                },
                {
                    kind: "container",
                    prop: "actionGroups",
                    child: "GActionGroup",
                    append: { method: "insertActionGroup", args: [{ prop: "prefix" }, "child"] },
                    remove: { method: "insertActionGroup", args: [{ prop: "prefix" }, { literal: null }] },
                },
            ],
            GtkStack: [
                {
                    kind: "container",
                    prop: "children",
                    child: "GtkWidget",
                    append: "addChild",
                    remove: "remove",
                    adopt: true,
                },
                { kind: "lazy", prop: "visibleChildName", lookup: "getChildByName" },
            ],
            GtkNotebook: [
                {
                    kind: "container",
                    prop: "children",
                    child: "GtkWidget",
                    append: { method: "appendPage", args: ["child", { literal: null }] },
                    insert: { method: "insertPage", args: ["child", { literal: null }, "index"] },
                    remove: "detachTab",
                    adopt: "getPage",
                },
            ],
            GtkDrawingArea: [{ kind: "value", prop: "drawFunc", call: "setDrawFunc", after: "queueDraw" }],
            GtkEditable: [{ kind: "controlled-text", prop: "text" }],
        };
        expect(() => validateWithAppId({ elementProps })).not.toThrow();
    });

    it("accepts a config that omits elementProps", () => {
        expect(() => validateWithAppId({ libraries: ["Gtk-4.0"] })).not.toThrow();
    });

    it("rejects a container prop that defines neither append nor remove", () => {
        expect(() =>
            validateUnknown({
                applicationId: "org.gtk.Test",
                elementProps: { GtkWidget: [{ kind: "container", prop: "children", child: "GtkWidget" }] },
            }),
        ).toThrow(/must define at least one of `append` or `remove`/);
    });

    it("rejects an element prop with an unknown kind", () => {
        expect(() =>
            validateUnknown({
                applicationId: "org.gtk.Test",
                elementProps: { GtkScale: [{ kind: "bogus", prop: "marks" }] },
            }),
        ).toThrow(/must be one of container, value, controlled-text, lazy, list/);
    });

    it("rejects an unrecognized element-prop key", () => {
        const cp = { kind: "container", prop: "children", child: "GtkWidget", append: "append", detach: "remove" };
        expect(() => validateUnknown({ applicationId: "org.gtk.Test", elementProps: { GtkWidget: [cp] } })).toThrow(
            /`elementProps\.GtkWidget\[0\]\.detach` is not a recognized key/,
        );
    });

    it("rejects an unknown argument reference", () => {
        const cp = {
            kind: "container",
            prop: "children",
            child: "GtkWidget",
            append: { method: "append", args: ["kid"] },
        };
        expect(() => validateUnknown({ applicationId: "org.gtk.Test", elementProps: { GtkWidget: [cp] } })).toThrow(
            /`elementProps\.GtkWidget\[0\]\.append\.args\[0\]` has unknown reference "kid"/,
        );
    });

    it('rejects the "value" argument reference', () => {
        const cp = { kind: "value", prop: "drawFunc", call: { method: "setDrawFunc", args: ["value"] } };
        expect(() =>
            validateUnknown({ applicationId: "org.gtk.Test", elementProps: { GtkDrawingArea: [cp] } }),
        ).toThrow(/`elementProps\.GtkDrawingArea\[0\]\.call\.args\[0\]` has unknown reference "value"/);
    });

    it("rejects `or` on a prop argument", () => {
        const cp = {
            kind: "container",
            prop: "children",
            child: "GtkWidget",
            append: { method: "append", args: [{ prop: "name", or: null }] },
        };
        expect(() => validateUnknown({ applicationId: "org.gtk.Test", elementProps: { GtkWidget: [cp] } })).toThrow(
            /`elementProps\.GtkWidget\[0\]\.append\.args\[0\]\.or` is not a recognized key/,
        );
    });

    it("rejects a non-serializable literal", () => {
        const cp = {
            kind: "container",
            prop: "children",
            child: "GtkWidget",
            append: { method: "append", args: [{ literal: () => null }] },
        };
        expect(() => validateUnknown({ applicationId: "org.gtk.Test", elementProps: { GtkWidget: [cp] } })).toThrow(
            /`elementProps\.GtkWidget\[0\]\.append\.args\[0\]\.literal` must be a JSON-serializable value/,
        );
    });
});

describe("validateConfig reactCompiler validation", () => {
    it("accepts a boolean", () => {
        expect(() => validateWithAppId({ reactCompiler: false })).not.toThrow();
        expect(() => validateWithAppId({ reactCompiler: true })).not.toThrow();
    });

    it("accepts an options object", () => {
        expect(() =>
            validateWithAppId({ reactCompiler: { compilationMode: "annotation", panicThreshold: "all_errors" } }),
        ).not.toThrow();
    });

    it("accepts a config that omits reactCompiler", () => {
        expect(() => validateWithAppId({ libraries: ["Gtk-4.0"] })).not.toThrow();
    });

    it("rejects a non-boolean, non-object value", () => {
        expect(() => validateUnknown({ applicationId: "org.gtk.Test", reactCompiler: "yes" })).toThrow(
            /`reactCompiler` must be a boolean or an options object/,
        );
    });

    it("rejects an array value", () => {
        expect(() => validateUnknown({ applicationId: "org.gtk.Test", reactCompiler: [] })).toThrow(
            /`reactCompiler` must be a boolean or an options object/,
        );
    });

    it("rejects an invalid compilationMode", () => {
        expect(() =>
            validateUnknown({ applicationId: "org.gtk.Test", reactCompiler: { compilationMode: "eager" } }),
        ).toThrow(/invalid `reactCompiler\.compilationMode` "eager"/);
    });

    it("rejects an invalid panicThreshold", () => {
        expect(() =>
            validateUnknown({ applicationId: "org.gtk.Test", reactCompiler: { panicThreshold: "warn" } }),
        ).toThrow(/invalid `reactCompiler\.panicThreshold` "warn"/);
    });

    it("rejects a non-boolean codegen", () => {
        expect(() => validateUnknown({ applicationId: "org.gtk.Test", codegen: "no" })).toThrow(
            /`codegen` must be a boolean/,
        );
    });

    it("accepts a boolean codegen", () => {
        expect(() => validateWithAppId({ codegen: false })).not.toThrow();
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

describe("resolveConfig", () => {
    it("defaults the react compiler while passing applicationId through", () => {
        expect(resolveConfig({ applicationId: "org.example.App" })).toEqual({
            applicationId: "org.example.App",
            reactCompiler: { target: "19" },
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
        });
    });

    it("collapses a disabled reactCompiler to null", () => {
        expect(resolveConfig({ applicationId: "org.example.App", reactCompiler: false }).reactCompiler).toBeNull();
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

    it("accepts an ID at the 255-character maximum", () => {
        const maxLength = `${"a".repeat(251)}.${"b".repeat(3)}`;
        expect(maxLength.length).toBe(255);
        expect(isValidApplicationId(maxLength)).toBe(true);
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
