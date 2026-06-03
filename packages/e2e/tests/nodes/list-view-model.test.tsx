import { registerClass } from "@gtkx/ffi";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, GtkDropDown, GtkGridView, GtkLabel, GtkListView } from "@gtkx/react";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";

class NameObject extends GObject.Object {
    name = "";
}
registerClass(NameObject, { gtypeName: "GtkxTestModelNameObject" });

const namedStore = (names: string[]): Gio.ListStore => {
    const store = Gio.ListStore.new(NameObject.prototype.__gtype__);
    for (const name of names) {
        const item = new NameObject();
        item.name = name;
        store.append(item);
    }
    return store;
};

const noSelection = (store: Gio.ListStore): Gtk.NoSelection => new Gtk.NoSelection({ model: store });

const renderListWithModel = async (
    names: string[],
    refSlot?: RefObject<Gtk.ListView | null>,
): Promise<{ store: Gio.ListStore; rerender: (model: Gtk.SelectionModel) => Promise<void> }> => {
    const store = namedStore(names);
    const selection = noSelection(store);
    const draw = (model: Gtk.SelectionModel) => (
        <ScrollWrapper>
            <GtkListView<NameObject>
                ref={refSlot}
                model={model}
                renderItem={(item) => <GtkLabel label={item.name} />}
            />
        </ScrollWrapper>
    );
    const { rerender } = await render(draw(selection));
    return {
        store,
        rerender: async (nextModel) => {
            await rerender(draw(nextModel));
        },
    };
};

describe("ListView model prop", () => {
    it("renders items from a user-supplied selection model", async () => {
        const ref = createRef<Gtk.ListView>();
        await renderListWithModel(["Alpha", "Beta", "Gamma"], ref);

        expect(ref.current).not.toBeNull();
        await screen.findAllByText("Alpha");
        await screen.findAllByText("Beta");
        await screen.findAllByText("Gamma");
    });

    it("reflects items appended to the model after first render", async () => {
        const { store } = await renderListWithModel(["First"]);

        await screen.findAllByText("First");
        expect(screen.queryAllByText("Second")).toHaveLength(0);

        const next = new NameObject();
        next.name = "Second";
        store.append(next);

        await screen.findAllByText("Second");
        await screen.findAllByText("First");
    });

    it("reflects items removed from the model", async () => {
        const { store } = await renderListWithModel(["Keep", "Drop"]);

        await screen.findAllByText("Drop");

        store.remove(1);

        await waitFor(() => {
            expect(screen.queryAllByText("Drop")).toHaveLength(0);
            expect(screen.queryAllByText("Keep").length).toBeGreaterThan(0);
        });
    });

    it("swaps to a different model when the prop changes", async () => {
        const { rerender } = await renderListWithModel(["Old A", "Old B"]);

        await screen.findAllByText("Old A");

        const nextStore = namedStore(["New X", "New Y"]);
        await rerender(noSelection(nextStore));

        await waitFor(() => {
            expect(screen.queryAllByText("Old A")).toHaveLength(0);
            expect(screen.queryAllByText("New X").length).toBeGreaterThan(0);
            expect(screen.queryAllByText("New Y").length).toBeGreaterThan(0);
        });
    });
});

describe("GridView model prop", () => {
    it("renders items from a user-supplied selection model", async () => {
        const store = namedStore(["One", "Two", "Three"]);
        const ref = createRef<Gtk.GridView>();
        await render(
            <ScrollWrapper>
                <GtkGridView<NameObject>
                    ref={ref}
                    model={noSelection(store)}
                    renderItem={(item) => <GtkLabel label={item.name} />}
                />
            </ScrollWrapper>,
        );

        expect(ref.current).not.toBeNull();
        await screen.findAllByText("One");
        await screen.findAllByText("Two");
        await screen.findAllByText("Three");
    });
});

describe("DropDown model prop", () => {
    it("renders items from a user-supplied list model", async () => {
        const store = namedStore(["Choice A", "Choice B"]);
        const ref = createRef<Gtk.DropDown>();
        await render(
            <GtkDropDown<NameObject> ref={ref} model={store} renderItem={(item) => <GtkLabel label={item.name} />} />,
        );

        expect(ref.current).not.toBeNull();
        await screen.findAllByText("Choice A");
    });
});

describe("ColumnView model prop", () => {
    it("renders cells driven by a user-supplied selection model", async () => {
        const store = namedStore(["Row 1", "Row 2"]);
        const ref = createRef<Gtk.ColumnView>();
        await render(
            <ScrollWrapper minContentHeight={300}>
                <GtkColumnView<NameObject> ref={ref} model={noSelection(store)}>
                    <GtkColumnView.Column<NameObject>
                        id="name"
                        title="Name"
                        renderCell={(item) => <GtkLabel label={item.name} />}
                    />
                </GtkColumnView>
            </ScrollWrapper>,
        );

        expect(ref.current).not.toBeNull();
        await screen.findAllByText("Row 1");
        await screen.findAllByText("Row 2");
    });
});

describe("wrapper identity", () => {
    it("returns the same wrapper instance for an item held by a store", () => {
        const item = new NameObject();
        item.name = "Persisted";
        const store = Gio.ListStore.new(NameObject.prototype.__gtype__);
        store.append(item);

        expect(store.getItem(0)).toBe(item);
        expect((store.getItem(0) as NameObject).name).toBe("Persisted");
    });
});
