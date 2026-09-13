import { Object as GObject, ParamFlags, paramSpecInt, TYPE_INVALID, TYPE_PARAM, TYPE_STRING } from "@gtkx/gi/gobject";
import { newObjectWithProperties, registerClass, registerConstructProperties, t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

const constructionProbe = (propertyName: string) => {
    const constructed: number[] = [];

    class Probe extends GObject {
        declare count: number;

        override vfuncConstructed(): void {
            super.vfuncConstructed();
            constructed.push(this.count);
        }
    }

    const Registered = registerClass(Probe, {
        typeName: uniqueName("GtkxConstructBindingProbe"),
        properties: {
            count: paramSpecInt("count", null, null, 0, 10, 3, ParamFlags.READWRITE | ParamFlags.CONSTRUCT),
        },
    });
    registerConstructProperties(Registered, { count: [propertyName, t.int32] });

    return { Probe: Registered, constructed };
};

describe("declared object construct bindings", () => {
    it("sets the declared property before the constructed override runs", () => {
        const { Probe, constructed } = constructionProbe("count");
        const probe = new Probe({ count: 7 });

        expect(probe.count).toBe(7);
        expect(constructed).toEqual([7]);
    });

    it("coerces a declared numeric property into its native range", () => {
        const { Probe } = constructionProbe("count");

        expect(new Probe({ count: 17.6 }).count).toBe(10);
    });

    it("skips an undefined property and preserves its default", () => {
        const { Probe, constructed } = constructionProbe("count");

        expect(new Probe({ count: undefined }).count).toBe(3);
        expect(constructed).toEqual([3]);
    });

    it("rejects a declared property that the native class does not install before construction", () => {
        const { Probe, constructed } = constructionProbe("absent");

        expect(() => new Probe({ count: 7 })).toThrow();
        expect(constructed).toEqual([]);
    });

    it.each([TYPE_INVALID, TYPE_PARAM, TYPE_STRING])("rejects non-GObject type %s before property lookup", (type) => {
        expect(() => newObjectWithProperties(type, { name: "unsafe" }, {})).toThrow();
    });
});
