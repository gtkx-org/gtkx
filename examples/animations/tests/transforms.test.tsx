import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { transformsDemo } from "../src/demos/transforms.js";

type Corner = { x: number; y: number; angle: number };

const { component: TransformsDemo } = transformsDemo;
const ANIMATED = { areAnimationsEnabled: true };

const findArea = (): Promise<Gtk.Fixed> => screen.findByName("transforms-area", { as: Gtk.Fixed });

const clickCorner = async (label: string): Promise<void> => {
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: label }));
};

const cornerTransform = ({ x, y, angle }: Corner): Gsk.Transform | null =>
    Gsk.Transform.new().translate(new Graphene.Point({ x, y }))?.rotate(angle) ?? null;

const expectCorner = (area: Gtk.Fixed, child: Gtk.Widget, corner: Corner): Promise<void> =>
    waitFor(() => {
        expect(area.getChildPosition(child)).toEqual([corner.x, corner.y]);
        const expected = cornerTransform(corner);

        if (expected === null) {
            expect(area.getChildTransform(child)).toBeNull();
        } else {
            expect(expected.equal(area.getChildTransform(child))).toBe(true);
        }
    });

describe("transforms demo", () => {
    it("moves the label to a corner when its button is clicked", async () => {
        await render(<TransformsDemo />, ANIMATED);
        const area = await findArea();
        const child = screen.getByText("GTKX");
        expect(area.getChildPosition(child)).toEqual([0, 0]);
        await clickCorner("Bottom right");
        await expectCorner(area, child, { x: 220, y: 110, angle: 0 });
    });

    it("slides and tilts to the latest target when redirected mid-flight", async () => {
        await render(<TransformsDemo />, ANIMATED);
        const area = await findArea();
        const child = screen.getByText("GTKX");
        await clickCorner("Top right");
        await clickCorner("Bottom left");
        await expectCorner(area, child, { x: 0, y: 110, angle: -8 });
    });

    it("returns to the initial corner", async () => {
        await render(<TransformsDemo />, ANIMATED);
        const area = await findArea();
        const child = screen.getByText("GTKX");
        await clickCorner("Top right");
        await expectCorner(area, child, { x: 220, y: 0, angle: 8 });
        await clickCorner("Top left");
        await expectCorner(area, child, { x: 0, y: 0, angle: 0 });
    });
});
