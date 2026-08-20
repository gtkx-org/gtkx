import * as Gdk from "@gtkx/gi/gdk";
import { Value } from "@gtkx/gi/gobject";
import {
    fromNative,
    getClassType,
    getHandle,
    read,
    registerWrapperClassResolver,
    t,
    wrapHandle,
} from "@gtkx/runtime";
import { beforeAll, describe, expect, it } from "vitest";

const WIDTH_OFFSET = 8;
const rectangleFfi = t.boxed("GdkRectangle", { ownership: "borrowed" });

class WideRectangle extends Gdk.Rectangle {}

beforeAll(() => {
    registerWrapperClassResolver(Gdk.Rectangle, (handle) =>
        (read(handle, t.int32, WIDTH_OFFSET) as number) > 100 ? WideRectangle : Gdk.Rectangle,
    );
});

describe("registerWrapperClassResolver", () => {
    it("wraps a handle as the subclass the resolver picks", () => {
        const rect = new Gdk.Rectangle({ width: 200 });
        const wrapped = wrapHandle(getHandle(rect), Gdk.Rectangle);
        expect(wrapped).toBeInstanceOf(WideRectangle);
        expect(wrapped.width).toBe(200);
    });

    it("applies the resolver to a boxed value marshalled from native", () => {
        const rect = new Gdk.Rectangle({ width: 300 });
        const wrapped = fromNative(rectangleFfi, getHandle(rect));
        expect(wrapped).toBeInstanceOf(WideRectangle);
    });

    it("applies the resolver to a boxed value read out of a GValue", () => {
        const value = new Value();
        value.init(getClassType(Gdk.Rectangle));
        value.setBoxed(new Gdk.Rectangle({ width: 150 }));
        const extracted = value.getBoxed<Gdk.Rectangle>();
        expect(extracted).toBeInstanceOf(WideRectangle);
        expect(extracted.width).toBe(150);
    });

    it("keeps the registered class when the resolver returns it", () => {
        const rect = new Gdk.Rectangle({ width: 10 });
        const wrapped = wrapHandle(getHandle(rect), Gdk.Rectangle);
        expect(wrapped).toBeInstanceOf(Gdk.Rectangle);
        expect(wrapped).not.toBeInstanceOf(WideRectangle);
    });

    it("uses an explicitly requested subclass as given", () => {
        const rect = new Gdk.Rectangle({ width: 10 });
        const wrapped = wrapHandle(getHandle(rect), WideRectangle);
        expect(wrapped).toBeInstanceOf(WideRectangle);
    });

    it("still returns null for a null handle", () => {
        expect(wrapHandle(null, Gdk.Rectangle)).toBeNull();
    });

    it("rejects a class that is not a registered wrapper class", () => {
        class Plain {
            width = 0;
        }

        expect(() => {
            registerWrapperClassResolver(Plain, () => Plain);
        }).toThrow();
    });
});
