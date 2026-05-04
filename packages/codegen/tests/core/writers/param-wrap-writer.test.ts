import { describe, expect, it } from "vitest";
import { Writer } from "../../../src/builders/writer.js";
import type { MappedType } from "../../../src/core/type-system/ffi-types.js";
import {
    buildCallbackWrapperExpression,
    needsParamWrap,
    needsReturnUnwrap,
    type ParamWrapInfo,
    writeWrapExpression,
} from "../../../src/core/writers/param-wrap-writer.js";

const mapped = (overrides: Partial<MappedType> = {}): MappedType => ({
    ts: "Gtk.Widget",
    ffi: { type: "gobject", ownership: "borrowed" },
    imports: [],
    ...overrides,
});

const render = (fn: (writer: Writer) => void): string => {
    const writer = new Writer();
    fn(writer);
    return writer.toString();
};

describe("needsReturnUnwrap", () => {
    it("returns false for null mappings", () => {
        expect(needsReturnUnwrap(null)).toEqual({ needsUnwrap: false });
    });

    it.each(["gobject", "boxed", "struct"] as const)("requires unwrap for %s ffi type", (type) => {
        expect(needsReturnUnwrap(mapped({ ffi: { type } }))).toEqual({ needsUnwrap: true });
    });

    it.each([
        "int32",
        "string",
        "boolean",
        "fundamental",
    ] as const)("does not require unwrap for %s ffi type", (type) => {
        expect(needsReturnUnwrap(mapped({ ffi: { type } }))).toEqual({ needsUnwrap: false });
    });
});

describe("needsParamWrap", () => {
    it("wraps a non-interface gobject without a target class", () => {
        const info = needsParamWrap(mapped({ ts: "Gtk.Widget", ffi: { type: "gobject" } }));
        expect(info).toEqual({
            needsWrap: true,
            needsTargetClass: false,
            targetClass: undefined,
            tsType: "Gtk.Widget",
        });
    });

    it("wraps an interface-kind gobject using its TS type as the target class", () => {
        const info = needsParamWrap(mapped({ ts: "Gtk.Editable", ffi: { type: "gobject" }, kind: "interface" }));
        expect(info).toEqual({
            needsWrap: true,
            needsTargetClass: true,
            targetClass: "Gtk.Editable",
            tsType: "Gtk.Editable",
        });
    });

    it.each([
        ["boxed", "GError"],
        ["struct", "GValue"],
        ["fundamental", "GParamSpec"],
    ] as const)("wraps %s types with their TS class as target", (type, ts) => {
        const info = needsParamWrap(mapped({ ts, ffi: { type } }));
        expect(info).toEqual({
            needsWrap: true,
            needsTargetClass: true,
            targetClass: ts,
            tsType: ts,
        });
    });

    it("does not wrap primitive ffi types", () => {
        const info = needsParamWrap(mapped({ ts: "number", ffi: { type: "int32" } }));
        expect(info).toEqual({
            needsWrap: false,
            needsTargetClass: false,
            targetClass: undefined,
            tsType: "number",
        });
    });
});

describe("writeWrapExpression", () => {
    it("emits an as-cast when no wrap is needed", () => {
        const info: ParamWrapInfo = {
            needsWrap: false,
            needsTargetClass: false,
            targetClass: undefined,
            tsType: "number",
        };
        expect(writeWrapExpression("args[0]", info)).toBe("args[0] as number");
    });

    it("calls getNativeObject with the target class when one is supplied", () => {
        const info: ParamWrapInfo = {
            needsWrap: true,
            needsTargetClass: true,
            targetClass: "Gtk.Editable",
            tsType: "Gtk.Editable",
        };
        expect(writeWrapExpression("args[1]", info)).toBe("getNativeObject(args[1] as NativeHandle, Gtk.Editable)");
    });

    it("falls back to a single-argument getNativeObject cast when no target class is supplied", () => {
        const info: ParamWrapInfo = {
            needsWrap: true,
            needsTargetClass: false,
            targetClass: undefined,
            tsType: "Gtk.Widget",
        };
        expect(writeWrapExpression("args[0]", info)).toBe("getNativeObject(args[0] as NativeHandle) as Gtk.Widget");
    });
});

describe("buildCallbackWrapperExpression", () => {
    const wrapInfos = [
        {
            wrapInfo: {
                needsWrap: true,
                needsTargetClass: false,
                targetClass: undefined,
                tsType: "Gtk.Widget",
            } as ParamWrapInfo,
        },
        {
            wrapInfo: {
                needsWrap: false,
                needsTargetClass: false,
                targetClass: undefined,
                tsType: "number",
            } as ParamWrapInfo,
        },
    ];

    it("emits a direct callback body when the return value does not need unwrapping", () => {
        const out = render(buildCallbackWrapperExpression("handler", wrapInfos));
        expect(out).toContain("handler");
        expect(out).toContain("? (...args: unknown[]) =>");
        expect(out).toContain("getNativeObject(args[0] as NativeHandle) as Gtk.Widget,");
        expect(out).toContain("args[1] as number");
        expect(out).toContain(": null");
        expect(out).not.toContain("const _result");
    });

    it("emits an unwrapped callback body that captures and rewraps the return value", () => {
        const out = render(buildCallbackWrapperExpression("handler", wrapInfos, { needsUnwrap: true }));
        expect(out).toContain("const _result = handler(");
        expect(out).toContain("return _result?.handle ?? null;");
    });

    it("emits a single-arg list with no trailing comma between entries", () => {
        const single = [wrapInfos[0]] as Array<{ wrapInfo: ParamWrapInfo }>;
        const out = render(buildCallbackWrapperExpression("h", single));
        const argLines = out
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.startsWith("getNativeObject"));
        expect(argLines).toHaveLength(1);
        expect(argLines[0]).not.toMatch(/,$/);
    });

    it("emits a no-arg callback body when wrapInfos is empty", () => {
        const out = render(buildCallbackWrapperExpression("h", []));
        expect(out).toContain("h\n");
        expect(out).toContain("? (...args: unknown[]) =>");
        expect(out).toContain(": null");
    });
});
