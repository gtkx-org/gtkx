import type { ListItemRenderArgs, ListSection } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { DropDown, ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { expect, test } from "vitest";
import { expectRowTexts } from "./helpers/row-texts.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";
import { getSelectionModel } from "./helpers/selection-model.js";

const sections: ListSection<string, string>[] = [
    {
        id: "first",
        value: "First",
        data: [{ id: "parent", value: "Parent", children: [{ id: "child", value: "Child" }] }],
    },
    { id: "second", value: "Second", data: [{ id: "last", value: "Last" }] },
];

const renderItem = ({ item }: ListItemRenderArgs<string>): ReactNode => <GtkLabel>{item}</GtkLabel>;

const drawList = (
    ref: RefObject<Gtk.ListView | null>,
    selectionMode = Gtk.SelectionMode.SINGLE,
    hasError = false,
): ReactNode => (
    <ScrollWrapper>
        <ListView
            ref={ref}
            sections={sections}
            selectionMode={selectionMode}
            selectedIds={["child"]}
            expandedIds={["parent"]}
            renderItem={(args) => {
                if (hasError) {
                    throw new Error("Row rendering failed");
                }

                return renderItem(args);
            }}
        />
    </ScrollWrapper>
);

const flattenModel = (view: RefObject<Gtk.ListView | null>): Gtk.FlattenListModel => {
    const selection = getSelectionModel(view);

    if (!(selection instanceof Gtk.SingleSelection || selection instanceof Gtk.MultiSelection)) {
        throw new TypeError("Expected a selectable collection");
    }

    const model = selection.getModel();

    if (!(model instanceof Gtk.FlattenListModel)) {
        throw new TypeError("Expected a flattened collection");
    }

    return model;
};

test("unmounting a collection detaches its retained native model graph", async () => {
    const ref = createRef<Gtk.ListView>();
    const { unmount } = await render(drawList(ref));
    await expectRowTexts(ref, ["Parent", "Child", "Last"]);
    const model = flattenModel(ref);
    const groups = model.getModel();
    expect(groups?.getNItems()).toBe(2);
    expect(getSelectionModel(ref).isSelected(1)).toBe(true);

    await unmount();

    expect(ref.current).toBeNull();
    expect(model.getModel()).toBeNull();
    expect(model.getNItems()).toBe(0);
    expect(groups?.getNItems()).toBe(0);
});

test("dropdown model ownership ends with the component", async () => {
    const ref = createRef<Gtk.DropDown>();
    const { unmount } = await render(<DropDown ref={ref} sections={sections} selectedId="last" />);
    const model = ref.current?.getModel();

    if (!(model instanceof Gtk.FlattenListModel)) {
        throw new TypeError("Expected a flattened dropdown");
    }

    expect(ref.current?.getSelected()).toBe(1);
    const groups = model.getModel();
    expect(groups?.getNItems()).toBe(2);

    await unmount();

    expect(ref.current).toBeNull();
    expect(model.getModel()).toBeNull();
    expect(model.getNItems()).toBe(0);
    expect(groups?.getNItems()).toBe(0);
});

test("selection mode changes retain controlled sectioned expansion and selection", async () => {
    const ref = createRef<Gtk.ListView>();
    const { rerender } = await render(drawList(ref));
    let previous = flattenModel(ref);

    for (const mode of [Gtk.SelectionMode.MULTIPLE, Gtk.SelectionMode.SINGLE]) {
        await rerender(drawList(ref, mode));
        await expectRowTexts(ref, ["Parent", "Child", "Last"]);
        expect(getSelectionModel(ref).isSelected(1)).toBe(true);
        expect(previous.getModel()).toBeNull();
        expect(previous.getNItems()).toBe(0);
        previous = flattenModel(ref);
    }
});

test("tree and flat transitions keep one model coherent while groups are removed", async () => {
    const ref = createRef<Gtk.ListView>();
    const draw = (isFlat: boolean, groups = sections): ReactNode => (
        <ScrollWrapper>
            <ListView
                ref={ref}
                sections={groups}
                isFlat={isFlat}
                selectedIds={["last"]}
                expandedIds={["parent"]}
                renderItem={renderItem}
            />
        </ScrollWrapper>
    );
    const { rerender } = await render(draw(false));
    const model = flattenModel(ref);
    await expectRowTexts(ref, ["Parent", "Child", "Last"]);
    expect(getSelectionModel(ref).isSelected(2)).toBe(true);

    await rerender(draw(true));
    await expectRowTexts(ref, ["Parent", "Last"]);
    expect(getSelectionModel(ref).isSelected(1)).toBe(true);
    await rerender(draw(false, sections.toReversed()));
    await expectRowTexts(ref, ["Last", "Parent", "Child"]);
    expect(getSelectionModel(ref).isSelected(0)).toBe(true);
    await rerender(draw(false, sections.slice(1)));
    await expectRowTexts(ref, ["Last"]);
    expect(getSelectionModel(ref).isSelected(0)).toBe(true);
    expect(flattenModel(ref)).toBe(model);
    expect(model.getNItems()).toBe(1);
    expect(model.getModel()?.getNItems()).toBe(1);
});

test("a failed row render releases the model and permits a fresh collection", async () => {
    const ref = createRef<Gtk.ListView>();
    const { rerender } = await render(drawList(ref));
    await expectRowTexts(ref, ["Parent", "Child", "Last"]);
    const previous = flattenModel(ref);

    await expect(rerender(drawList(ref, Gtk.SelectionMode.SINGLE, true))).rejects.toThrow();
    expect(previous.getModel()).toBeNull();
    expect(previous.getNItems()).toBe(0);
    await rerender(drawList(ref));
    await expectRowTexts(ref, ["Parent", "Child", "Last"]);
    expect(getSelectionModel(ref).isSelected(1)).toBe(true);
});
