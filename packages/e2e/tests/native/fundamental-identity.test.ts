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
    it("returns the same wrapper every time the same render node pointer comes back", () => {
        const child = colorNode();
        const container = Gsk.ContainerNode.new([child]);
        expect(container.getChild(0)).toBe(child);
        expect(container.getChild(0)).toBe(container.getChild(0));
        expect(container.getChild(0)).toBeInstanceOf(Gsk.ColorNode);
    });

    it("returns the same expression wrapper across methods, properties, and GValues", () => {
        const expression = stringExpression();
        const filter = Gtk.StringFilter.new(expression);
        expect(filter.getExpression()).toBe(expression);
        expect(filter.expression).toBe(expression);
        expect(Gtk.valueGetExpression(expressionValue(expression))).toBe(expression);
    });

    it("keeps wrappers of distinct instances distinct", () => {
        const container = Gsk.ContainerNode.new([colorNode(), colorNode()]);
        expect(container.getChild(0)).not.toBe(container.getChild(1));
        expect(container.getChild(0)).toBe(container.getChild(0));
    });

    it("creates a fresh working wrapper once the previous one is collected", async () => {
        const container = Gsk.ContainerNode.new([colorNode()]);
        const weak = detachChild(container);
        await gcUntil(() => weak.deref() === undefined);
        expect(weak.deref()).toBeUndefined();
        const revived = container.getChild(0);
        expect(revived).toBe(container.getChild(0));
        expect(revived).toBeInstanceOf(Gsk.ColorNode);
        expect(revived.getBounds().getWidth()).toBe(10);
    });

    it("throws for a child that is not a render node", () => {
        expect(() => Gsk.ContainerNode.new([{} as Gsk.RenderNode])).toThrow();
    });

    it("throws when storing a non-expression into an expression GValue", () => {
        const value = new GObject.Value();
        value.init(getClassType(Gtk.Expression));

        expect(() => {
            Gtk.valueSetExpression(value, {} as Gtk.Expression);
        }).toThrow();
    });
});
