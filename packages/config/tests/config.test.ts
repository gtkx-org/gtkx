import { describe, expect, it } from "vitest";
import {
    DEFAULT_APPLICATION_ID,
    defineConfig,
    type GtkxConfig,
    resolveGtkxConfig,
    resolveReactCompilerOptions,
    validateGtkxConfig,
} from "../src/config.js";
import type { ElementProp } from "../src/index.js";

const validateUnknown = (config: unknown): void => validateGtkxConfig(config as GtkxConfig);

describe("defineConfig", () => {
    it("returns the config unchanged", () => {
        const config = { libraries: ["Gtk-4.0", "Adw-1"] };
        expect(defineConfig(config)).toBe(config);
    });

    it("accepts c12 environment-branch keys", () => {
        const config = defineConfig({
            libraries: ["Gtk-4.0"],
            $production: { applicationId: "org.gtk.Prod" },
        });
        expect(config.libraries).toEqual(["Gtk-4.0"]);
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

describe("validateGtkxConfig elementProps validation", () => {
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
        expect(() => validateGtkxConfig({ elementProps })).not.toThrow();
    });

    it("accepts a config that omits elementProps", () => {
        expect(() => validateGtkxConfig({ libraries: ["Gtk-4.0"] })).not.toThrow();
    });

    it("rejects a container prop that defines neither append nor remove", () => {
        expect(() =>
            validateUnknown({
                elementProps: { GtkWidget: [{ kind: "container", prop: "children", child: "GtkWidget" }] },
            }),
        ).toThrow(/must define at least one of `append` or `remove`/);
    });

    it("rejects an element prop with an unknown kind", () => {
        expect(() => validateUnknown({ elementProps: { GtkScale: [{ kind: "bogus", prop: "marks" }] } })).toThrow(
            /must be one of container, value, controlled-text, lazy, list/,
        );
    });

    it("rejects an unrecognized element-prop key", () => {
        const cp = { kind: "container", prop: "children", child: "GtkWidget", append: "append", detach: "remove" };
        expect(() => validateUnknown({ elementProps: { GtkWidget: [cp] } })).toThrow(
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
        expect(() => validateUnknown({ elementProps: { GtkWidget: [cp] } })).toThrow(
            /`elementProps\.GtkWidget\[0\]\.append\.args\[0\]` has unknown reference "kid"/,
        );
    });

    it('rejects the "value" argument reference', () => {
        const cp = { kind: "value", prop: "drawFunc", call: { method: "setDrawFunc", args: ["value"] } };
        expect(() => validateUnknown({ elementProps: { GtkDrawingArea: [cp] } })).toThrow(
            /`elementProps\.GtkDrawingArea\[0\]\.call\.args\[0\]` has unknown reference "value"/,
        );
    });

    it("rejects `or` on a prop argument", () => {
        const cp = {
            kind: "container",
            prop: "children",
            child: "GtkWidget",
            append: { method: "append", args: [{ prop: "name", or: null }] },
        };
        expect(() => validateUnknown({ elementProps: { GtkWidget: [cp] } })).toThrow(
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
        expect(() => validateUnknown({ elementProps: { GtkWidget: [cp] } })).toThrow(
            /`elementProps\.GtkWidget\[0\]\.append\.args\[0\]\.literal` must be a JSON-serializable value/,
        );
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

    it("rejects a non-boolean codegen", () => {
        expect(() => validateUnknown({ codegen: "no" })).toThrow(/`codegen` must be a boolean/);
    });

    it("accepts a boolean codegen", () => {
        expect(() => validateGtkxConfig({ codegen: false })).not.toThrow();
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
            applicationId: DEFAULT_APPLICATION_ID,
            reactCompiler: { target: "19" },
        });
    });

    it("carries configured values through unchanged", () => {
        const configured: GtkxConfig = {
            applicationId: "org.gtk.Demo4",
            reactCompiler: { compilationMode: "annotation" },
        };
        expect(resolveGtkxConfig(configured)).toEqual({
            applicationId: "org.gtk.Demo4",
            reactCompiler: { target: "19", compilationMode: "annotation" },
        });
    });

    it("collapses a disabled reactCompiler to null", () => {
        expect(resolveGtkxConfig({ reactCompiler: false }).reactCompiler).toBeNull();
    });
});
