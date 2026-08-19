import type { Cancellable, Initable } from "@gtkx/gi/gio";
import * as Gio from "@gtkx/gi/gio";
import { Error as GError, quarkFromString } from "@gtkx/gi/glib";
import { Object as GObject } from "@gtkx/gi/gobject";
import { registerClass, t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type ErrorParts = { domain: number; code: number; message: string };
type InitImpl = (cancellable: Cancellable | null) => boolean;

const GLIB = "libglib-2.0.so.0";
const uniqueName = createTypeNameFactory("_");
const pointer = t.biguint64;
const parseHookT = t.callback([pointer, pointer, pointer], t.boolean, { canThrow: true });
const newOptionContext = t.fn(GLIB, "g_option_context_new", { args: [{ type: t.string() }], returns: pointer });
const freeOptionContext = t.fn(GLIB, "g_option_context_free", { args: [{ type: pointer }], returns: t.void });

const newOptionGroup = t.fn(GLIB, "g_option_group_new", {
    args: [{ type: t.string() }, { type: t.string() }, { type: t.string() }, { type: pointer }, { type: pointer }],
    returns: pointer,
});

const setMainGroup = t.fn(GLIB, "g_option_context_set_main_group", {
    args: [{ type: pointer }, { type: pointer }],
    returns: t.void,
});

const setParseHooks = t.fn(GLIB, "g_option_group_set_parse_hooks", {
    args: [{ type: pointer }, { type: parseHookT }, { type: parseHookT }],
    returns: t.void,
});

const parseOptionContext = t.fn(GLIB, "g_option_context_parse", {
    args: [{ type: pointer }, { type: pointer }, { type: pointer }],
    returns: t.boolean,
    canThrow: true,
});

const jsErrorDomain = (): number => quarkFromString("gtkx-js-error-quark");

const createInitable = (willInit: InitImpl): Initable => {
    class TestInitable extends GObject implements Gio.InitableImpl {
        vfuncInit(cancellable: Cancellable | null): boolean {
            return willInit(cancellable);
        }
    }

    registerClass(TestInitable, { typeName: uniqueName("GtkxThrownInitable"), implements: [Gio.Initable] });

    return new TestInitable() as TestInitable & Initable;
};

const captureError = (run: () => unknown): ErrorParts => {
    try {
        run();
    } catch (error) {
        return error as ErrorParts;
    }

    throw new Error("expected the call to throw");
};

const parseWithPreParseHook = (willPreParse: () => boolean): unknown => {
    const context = newOptionContext("gtkx-thrown-gerror-test");

    try {
        const group = newOptionGroup("main", "", "", null, null);
        setParseHooks(group, willPreParse, null);
        setMainGroup(context, group);

        return parseOptionContext(context, null, null);
    } finally {
        freeOptionContext(context);
    }
};

describe("a vfunc implementation that throws", () => {
    it("propagates a thrown GLib.Error with its domain, code and message", () => {
        const domain = quarkFromString("gtkx-vfunc-test-domain");

        const instance = createInitable(() => {
            throw new GError({ domain, code: 42, message: "init exploded" });
        });

        const thrown = captureError(() => instance.init(null));
        expect(thrown.domain).toBe(domain);
        expect(thrown.code).toBe(42);
        expect(thrown.message).toBe("init exploded");
    });

    it("converts a plain thrown Error into a GLib error in the gtkx domain", () => {
        const instance = createInitable(() => {
            throw new Error("plain init failure");
        });

        const thrown = captureError(() => instance.init(null));
        expect(thrown.domain).toBe(jsErrorDomain());
        expect(thrown.code).toBe(0);
        expect(thrown.message).toBe("plain init failure");
    });

    it("converts a thrown non-Error value into a GLib error in the gtkx domain", () => {
        const instance = createInitable(() => {
            /* eslint-disable-next-line @typescript-eslint/only-throw-error -- exercises non-Error throws */
            throw "string init failure";
        });

        const thrown = captureError(() => instance.init(null));
        expect(thrown.domain).toBe(jsErrorDomain());
    });

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
    it("propagates a thrown GLib.Error with its domain, code and message", () => {
        const domain = quarkFromString("gtkx-callback-test-domain");

        const thrown = captureError(() =>
            parseWithPreParseHook(() => {
                throw new GError({ domain, code: 7, message: "pre-parse exploded" });
            }));

        expect(thrown.domain).toBe(domain);
        expect(thrown.code).toBe(7);
        expect(thrown.message).toBe("pre-parse exploded");
    });

    it("converts a plain thrown Error into a GLib error in the gtkx domain", () => {
        const thrown = captureError(() =>
            parseWithPreParseHook(() => {
                throw new Error("plain hook failure");
            }));

        expect(thrown.domain).toBe(jsErrorDomain());
        expect(thrown.code).toBe(0);
        expect(thrown.message).toBe("plain hook failure");
    });

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
