import type { Cancellable, Initable } from "@gtkx/gi/gio";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { Object as GObject } from "@gtkx/gi/gobject";
import { getHandle, registerClass, t } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type InitImpl = (cancellable: Cancellable | null) => boolean;

const GLIB = "libglib-2.0.so.0";
const uniqueName = createTypeNameFactory("_");
const contextT = t.struct("borrowed", { wrapperClass: GLib.OptionContext });
const groupT = t.struct("borrowed", { wrapperClass: GLib.OptionGroup });
const parseHookT = t.callback([contextT, groupT, t.struct("borrowed")], t.boolean, { canThrow: true });
const newOptionContext = t.fn(GLIB, "g_option_context_new", { args: [{ type: t.string() }], returns: contextT });
const freeOptionContext = t.fn(GLIB, "g_option_context_free", { args: [{ type: contextT }], returns: t.void });

const newOptionGroup = t.fn(GLIB, "g_option_group_new", {
    args: [{ type: t.string() }, { type: t.string() }, { type: t.string() }, { type: t.buffer }, { type: t.buffer }],
    returns: groupT,
});

const setMainGroup = t.fn(GLIB, "g_option_context_set_main_group", {
    args: [{ type: contextT }, { type: groupT }],
    returns: t.void,
});

const setParseHooks = t.fn(GLIB, "g_option_group_set_parse_hooks", {
    args: [{ type: groupT }, { type: parseHookT }, { type: parseHookT }],
    returns: t.void,
});

const parseOptionContext = t.fn(GLIB, "g_option_context_parse", {
    args: [{ type: contextT }, { type: t.buffer }, { type: t.buffer }],
    returns: t.boolean,
    canThrow: true,
});

const createInitable = (willInit: InitImpl): Initable => {
    class TestInitable extends GObject implements Gio.InitableImpl {
        vfuncInit(cancellable: Cancellable | null): boolean {
            return willInit(cancellable);
        }
    }

    registerClass(TestInitable, { typeName: uniqueName("GtkxThrownInitable"), implements: [Gio.Initable] });

    return new TestInitable() as TestInitable & Initable;
};

const parseWithPreParseHook = (
    willPreParse: () => boolean,
    parse = parseOptionContext,
): unknown => {
    const context = getHandle(newOptionContext("gtkx-thrown-gerror-test") as GLib.OptionContext);

    try {
        const group = getHandle(newOptionGroup("main", "", "", null, null) as GLib.OptionGroup);
        setParseHooks(group, willPreParse, null);
        setMainGroup(context, group);

        return parse(context, null, null);
    } finally {
        freeOptionContext(context);
    }
};

describe("a vfunc implementation that throws", () => {
    it("leaves a non-throwing implementation returning its own result", () => {
        const instance = createInitable(() => true);
        expect(instance.init(null)).toBe(true);
    });

    it("throws from the caller when the implementation throws", () => {
        const instance = createInitable(() => {
            throw new Error("boom");
        });

        expect(() => instance.init(null)).toThrow();
    });
});

describe("a callback implementation that throws", () => {
    it("leaves a non-throwing callback returning its own result", () => {
        expect(parseWithPreParseHook(() => true)).toBe(true);
    });

    it("throws from the caller when the callback throws", () => {
        expect(() =>
            parseWithPreParseHook(() => {
                throw new Error("boom");
            })).toThrow();
    });
});

const initWithoutError = t.fn("libgio-2.0.so.0", "g_initable_init", {
    args: [{ type: t.object("borrowed") }, { type: t.object("borrowed") }, { type: t.buffer }],
    returns: t.boolean,
});

const errorT = t.boxed("GError", {
    ownership: "full", sharedLibrary: "libgobject-2.0.so.0", getTypeFnName: "g_error_get_type",
});
const initWithErrorResult = t.fn("libgio-2.0.so.0", "g_initable_init", {
    args: [{ type: t.object("borrowed") }, { type: t.object("borrowed") }, { type: errorT, direction: "out" }],
    returns: t.boolean,
});
const parseWithErrorResult = t.fn(GLIB, "g_option_context_parse", {
    args: [{ type: contextT }, { type: t.buffer }, { type: t.buffer }, { type: errorT, direction: "out" }],
    returns: t.boolean,
});
const errorConsumers = [
    {
        name: "registered vfunc",
        invoke: (willInit: () => boolean) => initWithErrorResult(getHandle(createInitable(willInit)), null),
    },
    {
        name: "option callback",
        invoke: (willParse: () => boolean) => parseWithPreParseHook(willParse, parseWithErrorResult),
    },
];

it.each(errorConsumers)("preserves GError status through a $name", ({ invoke }) => {
    const original = GLib.Error.newLiteral(Gio.ioErrorQuark(), Gio.IOErrorEnum.CANCELLED, "cancelled");
    expect(original.matches(Gio.ioErrorQuark(), Gio.IOErrorEnum.CANCELLED)).toBe(true);
    const [status, error] = invoke(() => {
        throw original;
    }) as [boolean, GLib.Error | null];
    expect(status).toBe(false);
    expect(error?.matches(Gio.ioErrorQuark(), Gio.IOErrorEnum.CANCELLED)).toBe(true);
    expect(invoke(() => true)).toEqual([true, null]);
});

const throwValue = (value: unknown): never => {
    throw value;
};

it("converts an ordinary primitive callback exception to a native error status", () => {
    const [status, error] = parseWithPreParseHook(() => throwValue("failed"), parseWithErrorResult) as [
        boolean, GLib.Error | null,
    ];
    expect(status).toBe(false);
    expect(error?.matches(GLib.quarkFromString("gtkx-js-error-quark"), 0)).toBe(true);
    expect(parseWithPreParseHook(() => true, parseWithErrorResult)).toEqual([true, null]);
});

it.each([
    { name: "Error", thrown: new Error("failed") },
    { name: "primitive", thrown: 42 },
])("propagates a thrown $name when the caller omits GError storage", ({ thrown }) => {
    const instance = createInitable(() => throwValue(thrown));
    assert.throws(() => initWithoutError(getHandle(instance), null, null));
    const healthy = createInitable(() => true);
    expect(initWithoutError(getHandle(healthy), null, null)).toBe(true);
});
