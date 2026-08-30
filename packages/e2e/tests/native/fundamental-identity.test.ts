import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { gcUntil } from "../helpers/native-utils.js";

const unitRect = (): Graphene.Rect => {
    const rect = new Graphene.Rect();
    rect.init(0, 0, 10, 10);

    return rect;
};

const opaqueRed = (): Gdk.RGBA => Object.assign(new Gdk.RGBA(), { red: 1, green: 0, blue: 0, alpha: 1 });
const colorNode = (): Gsk.RenderNode => Gsk.ColorNode.new(opaqueRed(), unitRect());

const stringExpression = (): Gtk.Expression =>
    Gtk.PropertyExpression.new(getClassType(Gtk.StringObject), null, "string");

const expressionValue = (expression: Gtk.Expression): GObject.Value => {
    const value = new GObject.Value();
    value.init(getClassType(Gtk.Expression));
    Gtk.valueSetExpression(value, expression);

    return value;
};

const detachChild = (container: Gsk.ContainerNode): WeakRef<object> => new WeakRef(container.getChild(0));

describe("fundamental wrapper identity", () => {
    it("happy path", () => {
        const child = colorNode();
        const container = Gsk.ContainerNode.new([child]);
        expect(container.getChild(0)).toBe(child);

        const expression = stringExpression();
        const filter = Gtk.StringFilter.new(expression);
        expect(filter.getExpression()).toBe(expression);
        expect(filter.expression).toBe(expression);
        expect(Gtk.valueGetExpression(expressionValue(expression))).toBe(expression);
    });

    it("edge cases", async () => {
        const container = Gsk.ContainerNode.new([colorNode(), colorNode()]);
        expect(container.getChild(0)).not.toBe(container.getChild(1));

        const collectedContainer = Gsk.ContainerNode.new([colorNode()]);
        const weak = detachChild(collectedContainer);
        await gcUntil(() => weak.deref() === undefined);
        expect(weak.deref()).toBeUndefined();

        const revived = collectedContainer.getChild(0);
        expect(revived).toBe(collectedContainer.getChild(0));
        expect(revived.getBounds().getWidth()).toBe(10);
    });

    it("error paths", () => {
        expect(() => Gsk.ContainerNode.new([{} as Gsk.RenderNode])).toThrow();

        const value = new GObject.Value();
        value.init(getClassType(Gtk.Expression));

        expect(() => {
            Gtk.valueSetExpression(value, {} as Gtk.Expression);
        }).toThrow();
    });
});
