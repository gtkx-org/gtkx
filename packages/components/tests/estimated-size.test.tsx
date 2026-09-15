import type { ReactNode } from "react";
import { ColumnView, GridView, ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox } from "@gtkx/jsx/gtk";
import { render, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

type SizeProps = { estimatedItemHeight?: number; estimatedItemWidth?: number };
type ViewCase = {
    name: string;
    draw: (size: SizeProps, renderItem?: () => ReactNode) => ReactNode;
    role: Gtk.AccessibleRole;
};

const ITEMS = [{ id: "first", value: "First" }];
const emptyItem = (): ReactNode => null;
const sizedItem = (): ReactNode => <GtkBox widthRequest={50} heightRequest={40} />;
const VIEWS: ViewCase[] = [
    {
        name: "ListView",
        draw: (size, renderItem = emptyItem) => <ListView items={ITEMS} renderItem={renderItem} {...size} />,
        role: Gtk.AccessibleRole.LIST_ITEM,
    },
    {
        name: "GridView",
        draw: (size, renderItem = emptyItem) => <GridView items={ITEMS} renderItem={renderItem} {...size} />,
        role: Gtk.AccessibleRole.GRID_CELL,
    },
    {
        name: "ColumnView",
        draw: ({ estimatedItemHeight }, renderItem = emptyItem) => (
            <ColumnView
                items={ITEMS}
                columns={[{ id: "name", title: "Name", renderCell: renderItem }]}
                estimatedItemHeight={estimatedItemHeight}
            />
        ),
        role: Gtk.AccessibleRole.GRID_CELL,
    },
];

describe.each(VIEWS)("$name estimated sizing", ({ draw, role }) => {
    it("updates and removes the estimate on an existing empty row", async () => {
        const { container, rerender } = await render(draw({ estimatedItemHeight: 40 }));
        const row = await within(container).findByRole(role);
        const [initialHeight] = row.measure(Gtk.Orientation.VERTICAL, -1);
        expect(initialHeight).toBeGreaterThanOrEqual(40);

        await rerender(draw({ estimatedItemHeight: 100 }));
        expect(within(container).getByRole(role)).toBe(row);
        expect(row.measure(Gtk.Orientation.VERTICAL, -1)[0]).toBe(initialHeight + 60);

        await rerender(draw({}));
        expect(row.measure(Gtk.Orientation.VERTICAL, -1)[0]).toBeLessThan(initialHeight);
    });

    it("preserves the size of rendered content when estimates change", async () => {
        const { container, rerender } = await render(
            draw({ estimatedItemHeight: 10, estimatedItemWidth: 10 }, sizedItem),
        );
        const row = await within(container).findByRole(role);
        const height = row.measure(Gtk.Orientation.VERTICAL, -1)[0];
        const width = row.measure(Gtk.Orientation.HORIZONTAL, -1)[0];

        await rerender(draw({ estimatedItemHeight: 200, estimatedItemWidth: 200 }, sizedItem));
        expect(row.measure(Gtk.Orientation.VERTICAL, -1)[0]).toBe(height);
        expect(row.measure(Gtk.Orientation.HORIZONTAL, -1)[0]).toBe(width);
    });
});

describe.each(VIEWS.filter(({ name }) => name !== "ColumnView"))("$name estimated width", ({ draw, role }) => {
    it("updates and removes the estimate on an existing empty cell", async () => {
        const { container, rerender } = await render(draw({ estimatedItemWidth: 40 }));
        const row = await within(container).findByRole(role);
        const initialWidth = row.measure(Gtk.Orientation.HORIZONTAL, -1)[0];
        expect(initialWidth).toBeGreaterThanOrEqual(40);

        await rerender(draw({ estimatedItemWidth: 100 }));
        expect(within(container).getByRole(role)).toBe(row);
        expect(row.measure(Gtk.Orientation.HORIZONTAL, -1)[0]).toBe(initialWidth + 60);

        await rerender(draw({}));
        expect(row.measure(Gtk.Orientation.HORIZONTAL, -1)[0]).toBeLessThan(initialWidth);
    });
});
