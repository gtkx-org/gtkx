import * as Graphene from "@gtkx/gi/graphene";
import * as Pango from "@gtkx/gi/pango";
import { describe, expect, it } from "vitest";

const unitRect = (): Graphene.Rect => {
    const rect = new Graphene.Rect();
    rect.init(1, 2, 3, 4);

    return rect;
};

describe("inline struct fields", () => {
    it("writes a nested boxed field through its owner", () => {
        const rect = unitRect();
        rect.origin.x = 99;
        rect.size.width = 77;
        expect(rect.origin.x).toBe(99);
        expect(rect.size.width).toBe(77);
    });

    it("keeps a nested boxed field aliased to its owner", () => {
        const rect = unitRect();
        const origin = rect.origin;
        origin.y = 42;
        expect(rect.origin.y).toBe(42);
        expect(rect.getY()).toBe(42);
    });

    it("writes a nested struct field through its owner", () => {
        const info = new Pango.GlyphInfo();
        info.geometry.width = 1234;
        info.geometry.xOffset = -8;
        expect(info.geometry.width).toBe(1234);
        expect(info.geometry.xOffset).toBe(-8);
    });

    it("leaves a nested field intact when it is written back from its own alias", () => {
        const rect = unitRect();
        const alias = rect.origin;
        rect.origin = alias;
        expect(rect.origin.x).toBe(1);
        expect(rect.origin.y).toBe(2);
    });

    it("still replaces a nested field wholesale", () => {
        const rect = unitRect();
        const point = new Graphene.Point();
        point.init(50, 60);
        rect.origin = point;
        expect(rect.origin.x).toBe(50);
        expect(rect.origin.y).toBe(60);
        point.init(0, 0);
        expect(rect.origin.x).toBe(50);
    });
});
