import type { ObjectClass, ParamSpec } from "@gtkx/gi/gobject";
import { ParamFlags, ParamSpec as ParamSpecClass, paramSpecInt, typeFromName } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass, TYPE_INVALID } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";

const uniqueName = createTypeNameFactory("NativeTest");

const registerAndListProperties = (typeName: string, properties: Record<string, ParamSpec>): ParamSpec[] => {
    const specs: ParamSpec[] = [];
    class Inspected extends Gtk.Label {}

    registerClass(Inspected, {
        typeName,
        properties,
        classInit: (typeStruct: ObjectClass) => {
            specs.push(...typeStruct.listProperties());
        },
    });

    return specs;
};

const findSpec = (specs: ParamSpec[], name: string): ParamSpec => {
    const spec = specs.find((candidate) => candidate.name === name);

    if (spec === undefined) {
        throw new Error(`expected listProperties to yield a spec named '${name}'`);
    }

    return spec;
};

describe("ParamSpec getters — happy path", () => {
    it("describes a known Gtk.Label property from listProperties", () => {
        const specs = registerAndListProperties(uniqueName("GtkxPspecLabel"), {});
        const spec = findSpec(specs, "label");
        expect(spec.flags & ParamFlags.READABLE).toBe(ParamFlags.READABLE);
        expect(spec.flags & ParamFlags.WRITABLE).toBe(ParamFlags.WRITABLE);
        expect(spec.valueType).toBe(typeFromName("gchararray"));
        expect(spec.ownerType).toBe(typeFromName("GtkLabel"));
    });

    it("describes a registerClass-defined property, including nick and blurb", () => {
        const typeName = uniqueName("GtkxPspecTinted");

        const specs = registerAndListProperties(typeName, {
            tintLevel: paramSpecInt("tint-level", "Tint", "How tinted", 0, 255, 0, ParamFlags.READWRITE),
        });

        const spec = findSpec(specs, "tint-level");
        expect(spec.flags).toBe(ParamFlags.READWRITE);
        expect(spec.valueType).toBe(typeFromName("gint"));
        expect(spec.ownerType).toBe(typeFromName(typeName));
        expect(spec.name).toBe("tint-level");
        expect(spec.nick).toBe("Tint");
        expect(spec.blurb).toBe("How tinted");
    });

    it("describes the spec a notify handler receives", () => {
        const label = new Gtk.Label();
        let captured: ParamSpec | undefined;

        label.connect("notify::label", (pspec: ParamSpec) => {
            captured = pspec;
        });

        label.setLabel("changed");

        if (captured === undefined) {
            throw new Error("expected the notify handler to capture a ParamSpec");
        }

        expect(captured.name).toBe("label");
        expect(captured.valueType).toBe(typeFromName("gchararray"));
        expect(captured.ownerType).toBe(typeFromName("GtkLabel"));
    });
});

describe("ParamSpec getters — edge cases", () => {
    it("shows the construct-only flag on a construct-only property", () => {
        const typeName = uniqueName("GtkxPspecConstructOnly");

        const specs = registerAndListProperties(typeName, {
            seed: paramSpecInt("seed", null, null, 0, 255, 0, ParamFlags.READWRITE | ParamFlags.CONSTRUCT_ONLY),
        });

        const spec = findSpec(specs, "seed");
        expect(spec.flags & ParamFlags.CONSTRUCT_ONLY).toBe(ParamFlags.CONSTRUCT_ONLY);
    });

    it("reports no owner and a null blurb on a spec not installed on any type", () => {
        const spec = paramSpecInt("loose", null, null, 0, 255, 0, ParamFlags.READWRITE);
        expect(spec.ownerType).toBe(TYPE_INVALID);
        expect(spec.name).toBe("loose");
        expect(spec.blurb).toBeNull();
    });
});

describe("ParamSpec getters — error paths", () => {
    it("throws when read on an instance without a native handle", () => {
        const detached: ParamSpec = Object.create(ParamSpecClass.prototype) as ParamSpec;
        expect(() => detached.flags).toThrow();
        expect(() => detached.valueType).toThrow();
        expect(() => detached.ownerType).toThrow();
    });
});
