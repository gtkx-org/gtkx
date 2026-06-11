import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkSizeGroup } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type RefObject, useState } from "react";
import { describe, expect, it } from "vitest";

const definedWidgets = (widgets: readonly (Gtk.Widget | null)[]): Gtk.Widget[] =>
    widgets.filter((widget): widget is Gtk.Widget => widget !== null);

const GroupedLabels = ({
    groupRef,
    count,
    mode,
}: {
    groupRef: RefObject<Gtk.SizeGroup | null>;
    count: 0 | 1 | 2;
    mode?: Gtk.SizeGroupMode;
}) => {
    const [labelA, setLabelA] = useState<Gtk.Label | null>(null);
    const [labelB, setLabelB] = useState<Gtk.Label | null>(null);
    const widgets = definedWidgets([count >= 1 ? labelA : null, count >= 2 ? labelB : null]);
    return (
        <GtkBox>
            <GtkSizeGroup ref={groupRef} mode={mode} widgets={widgets} />
            <GtkLabel ref={setLabelA} label="A" />
            <GtkLabel ref={setLabelB} label="B" />
        </GtkBox>
    );
};

const renderGroupOfTwo = async () => {
    const groupRef = createRef<Gtk.SizeGroup>();
    const { rerender } = await render(<GroupedLabels groupRef={groupRef} count={2} />);
    expect(groupRef.current?.getWidgets()).toHaveLength(2);
    return { groupRef, rerender };
};

describe("GtkSizeGroup widgets prop", () => {
    it("adds the widgets passed in the array", async () => {
        await renderGroupOfTwo();
    });

    it("removes a widget when it leaves the array", async () => {
        const { groupRef, rerender } = await renderGroupOfTwo();

        await rerender(<GroupedLabels groupRef={groupRef} count={1} />);
        expect(groupRef.current?.getWidgets()).toHaveLength(1);
    });

    it("clears membership when the array empties", async () => {
        const { groupRef, rerender } = await renderGroupOfTwo();

        await rerender(<GroupedLabels groupRef={groupRef} count={0} />);
        expect(groupRef.current?.getWidgets()).toHaveLength(0);
    });
});

describe("GtkSizeGroup mode", () => {
    it("applies and updates the mode prop", async () => {
        const groupRef = createRef<Gtk.SizeGroup>();

        const { rerender } = await render(
            <GroupedLabels groupRef={groupRef} count={2} mode={Gtk.SizeGroupMode.HORIZONTAL} />,
        );
        expect(groupRef.current?.getMode()).toBe(Gtk.SizeGroupMode.HORIZONTAL);

        await rerender(<GroupedLabels groupRef={groupRef} count={2} mode={Gtk.SizeGroupMode.BOTH} />);
        expect(groupRef.current?.getMode()).toBe(Gtk.SizeGroupMode.BOTH);
    });
});

describe("GtkSizeGroup across subtrees", () => {
    it("groups widgets living in separate containers", async () => {
        const groupRef = createRef<Gtk.SizeGroup>();
        const labelARef = createRef<Gtk.Label>();
        const labelBRef = createRef<Gtk.Label>();

        const App = () => {
            const [labelA, setLabelA] = useState<Gtk.Label | null>(null);
            const [labelB, setLabelB] = useState<Gtk.Label | null>(null);
            const captureA = (label: Gtk.Label | null): void => {
                labelARef.current = label;
                setLabelA(label);
            };
            const captureB = (label: Gtk.Label | null): void => {
                labelBRef.current = label;
                setLabelB(label);
            };
            return (
                <GtkBox>
                    <GtkSizeGroup
                        ref={groupRef}
                        mode={Gtk.SizeGroupMode.HORIZONTAL}
                        widgets={definedWidgets([labelA, labelB])}
                    />
                    <GtkFrame label="Frame A">
                        <GtkLabel ref={captureA} label="A" />
                    </GtkFrame>
                    <GtkFrame label="Frame B">
                        <GtkLabel ref={captureB} label="B" />
                    </GtkFrame>
                </GtkBox>
            );
        };

        await render(<App />);

        const widgets = groupRef.current?.getWidgets() ?? [];
        expect(widgets).toHaveLength(2);
        expect(widgets).toContain(labelARef.current);
        expect(widgets).toContain(labelBRef.current);
        expect(labelARef.current?.getParent()).not.toBe(labelBRef.current?.getParent());
    });
});
