import type { ParamSpec } from "@gtkx/gi/gobject";
import { Object as GObject, ParamFlags, paramSpecInt } from "@gtkx/gi/gobject";
import * as WebKit from "@gtkx/gi/webkit";
import { coerceObjectProperty, getClassType, isReadableProperty, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

const makeGaugeClass = () => {
    class Gauge extends GObject {
        declare level2Depth: number;
    }

    return registerClass(Gauge, {
        typeName: uniqueName("GtkxDigitWordProp"),
        properties: { level2Depth: paramSpecInt("level-2-depth", null, null, 0, 10, 0, ParamFlags.READWRITE) },
    });
};

describe("property names — a word starting with a digit", () => {
    it("installs a property whose ParamSpec spells the digit word on its own", () => {
        const Gauge = makeGaugeClass();
        const gauge = new Gauge();
        gauge.level2Depth = 4;
        expect(gauge.level2Depth).toBe(4);
    });

    it("notifies under the ParamSpec's own name", () => {
        const Gauge = makeGaugeClass();
        const gauge = new Gauge();
        const seen: string[] = [];

        gauge.connect("notify::level-2-depth", (pspec: ParamSpec) => {
            seen.push(pspec.getName());
        });

        gauge.level2Depth = 6;
        expect(seen).toEqual(["level-2-depth"]);
    });

    it("takes the property at construction under the accessor name", () => {
        const Gauge = makeGaugeClass();
        expect(new Gauge({ level2Depth: 3 }).level2Depth).toBe(3);
    });
});

describe("property names — a word starting with a digit, edge cases", () => {
    it("fits a value written to the property the accessor names", () => {
        const Gauge = makeGaugeClass();
        const gauge = new Gauge();
        expect(coerceObjectProperty(gauge, "level2Depth", 12.7)).toBe(10);
        expect(coerceObjectProperty(gauge, "level-2-depth", 4.8)).toBe(4);
    });

    it("answers for a generated property whose accessor drops the dash", () => {
        const gtype = getClassType(WebKit.Settings);
        expect(isReadableProperty(gtype, "enable2dCanvasAcceleration")).toBe(true);
        expect(isReadableProperty(gtype, "enable-2d-canvas-acceleration")).toBe(true);
    });

    it("leaves a name no property answers to alone", () => {
        const gtype = getClassType(WebKit.Settings);
        expect(isReadableProperty(gtype, "enable3dCanvasAcceleration")).toBe(false);
    });
});

describe("property names — error paths", () => {
    it("throws when the ParamSpec's name spells a different member", () => {
        class Mismatched extends GObject {
            declare dewPoint: number;
        }

        expect(() =>
            registerClass(Mismatched, {
                typeName: uniqueName("GtkxMismatchedProp"),
                properties: { dewPoint: paramSpecInt("humidity", null, null, 0, 10, 0, ParamFlags.READWRITE) },
            }),
        ).toThrow();
    });

    it("throws when the ParamSpec doubles a separator the accessor cannot spell", () => {
        class Doubled extends GObject {
            declare dewPoint: number;
        }

        expect(() =>
            registerClass(Doubled, {
                typeName: uniqueName("GtkxDoubledProp"),
                properties: { dewPoint: paramSpecInt("dew--point", null, null, 0, 10, 0, ParamFlags.READWRITE) },
            }),
        ).toThrow();
    });

    it("throws when the ParamSpec trails a separator the accessor cannot spell", () => {
        class Trailing extends GObject {
            declare dewPoint: number;
        }

        expect(() =>
            registerClass(Trailing, {
                typeName: uniqueName("GtkxTrailingProp"),
                properties: { dewPoint: paramSpecInt("dew-point-", null, null, 0, 10, 0, ParamFlags.READWRITE) },
            }),
        ).toThrow();
    });

    it("throws when the ParamSpec splits the digit word the accessor joins", () => {
        class Skewed extends GObject {
            declare level2Depth: number;
        }

        expect(() =>
            registerClass(Skewed, {
                typeName: uniqueName("GtkxSkewedProp"),
                properties: { level2Depth: paramSpecInt("level-2depth", null, null, 0, 10, 0, ParamFlags.READWRITE) },
            }),
        ).toThrow();
    });
});

describe("property names — every spelling of one property", () => {
    it("answers for the dashed, underscored and camelCased spellings alike", () => {
        const type = getClassType(makeGaugeClass());
        const spellings = ["level-2-depth", "level_2_depth", "level2Depth", "level2_depth"];
        expect(spellings.map((spelling) => isReadableProperty(type, spelling))).toEqual([true, true, true, true]);
    });
});
