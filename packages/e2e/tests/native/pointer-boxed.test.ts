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
    it("constructs through its transfer-full constructor", () => {
        expect(Gsk.RenderReplay.new()).toBeInstanceOf(Gsk.RenderReplay);
    });

    it("replays a node through the default filter", () => {
        const node = colorNode(1);
        expect(Gsk.RenderReplay.new().filterNode(node)).toBe(node);
    });

    it("replays a node through the filter the caller installs", () => {
        const replay = Gsk.RenderReplay.new();
        const replacement = colorNode(0.5);
        replay.setNodeFilter(() => replacement);
        expect(replay.filterNode(colorNode(1))).toBe(replacement);
    });

    it("hands the replay itself to the filter it runs", () => {
        const replay = Gsk.RenderReplay.new();
        const seen: unknown[] = [];

        replay.setNodeFilter((filtered, node) => {
            seen.push(filtered);

            return node;
        });

        replay.filterNode(colorNode(1));
        expect(seen).toEqual([expect.any(Gsk.RenderReplay)]);
    });

    it("discards a node the filter drops", () => {
        const replay = Gsk.RenderReplay.new();
        replay.setNodeFilter(() => null);
        expect(replay.filterNode(colorNode(1))).toBeNull();
    });

    it("releases the replay once nothing refers to it", async () => {
        const weak = collectedReplay();
        await gcUntil(() => weak.deref() === undefined);
        expect(weak.deref()).toBeUndefined();
    });

    it("throws when constructed with new", () => {
        expect(() => {
            Reflect.construct(Gsk.RenderReplay, []);
        }).toThrow();
    });

    it("throws when replaying something that is not a render node", () => {
        expect(() => Gsk.RenderReplay.new().filterNode({} as Gsk.RenderNode)).toThrow();
    });
});
