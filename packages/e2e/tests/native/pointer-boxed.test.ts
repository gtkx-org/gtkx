import * as Gdk from "@gtkx/gi/gdk";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import { describe, expect, it } from "vitest";
import { gcUntil } from "../helpers/native-utils.js";

const unitRect = (): Graphene.Rect => {
    const rect = new Graphene.Rect();
    rect.init(0, 0, 10, 10);

    return rect;
};

const color = (red: number): Gdk.RGBA => Object.assign(new Gdk.RGBA(), { red, green: 0, blue: 0, alpha: 1 });
const colorNode = (red: number): Gsk.ColorNode => Gsk.ColorNode.new(color(red), unitRect());
const collectedReplay = (): WeakRef<object> => new WeakRef(Gsk.RenderReplay.new());

describe("a boxed type registered as a plain pointer", () => {
    it("happy path", () => {
        const replay = Gsk.RenderReplay.new();
        const source = colorNode(1);
        const replacement = colorNode(0.5);
        let seen: Gsk.RenderReplay | undefined;

        replay.setNodeFilter((filtered) => {
            seen = filtered;

            return replacement;
        });

        expect(Gsk.RenderReplay.new().filterNode(source)).toBe(source);
        expect(replay.filterNode(source)).toBe(replacement);
        expect(seen).toBeInstanceOf(Gsk.RenderReplay);
    });

    it("edge cases", async () => {
        const replay = Gsk.RenderReplay.new();
        replay.setNodeFilter(() => null);
        expect(replay.filterNode(colorNode(1))).toBeNull();

        const weak = collectedReplay();
        await gcUntil(() => weak.deref() === undefined);
        expect(weak.deref()).toBeUndefined();
    });

    it("error paths", () => {
        expect(() => {
            Reflect.construct(Gsk.RenderReplay, []);
        }).toThrow();
        expect(() => Gsk.RenderReplay.new().filterNode({} as Gsk.RenderNode)).toThrow();
    });
});
