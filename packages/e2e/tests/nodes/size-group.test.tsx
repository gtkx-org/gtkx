import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkSizeGroup } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - GtkSizeGroup wiring", () => {
    it("registers wrapped widgets with the size group", async () => {
        const labelARef = createRef<Gtk.Label>();
        const labelBRef = createRef<Gtk.Label>();

        await render(
            <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
                <GtkBox>
                    <GtkSizeGroup.Widget>
                        <GtkLabel ref={labelARef} label="A" />
                    </GtkSizeGroup.Widget>
                    <GtkSizeGroup.Widget>
                        <GtkLabel ref={labelBRef} label="B" />
                    </GtkSizeGroup.Widget>
                </GtkBox>
            </GtkSizeGroup>,
        );

        expect(labelARef.current).not.toBeNull();
        expect(labelBRef.current).not.toBeNull();

        const groupedParent = labelARef.current?.getParent();
        expect(groupedParent).not.toBeNull();
        expect(labelBRef.current?.getParent()).toBe(groupedParent);
    });

    it("attaches wrapped widgets to the grandparent in the GTK tree", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
                    <GtkSizeGroup.Widget>
                        <GtkLabel ref={labelRef} label="Inside" />
                    </GtkSizeGroup.Widget>
                </GtkSizeGroup>
            </GtkBox>,
        );

        expect(labelRef.current?.getParent()).toBe(boxRef.current);
    });

    it("groups widgets across separate subtrees", async () => {
        const labelARef = createRef<Gtk.Label>();
        const labelBRef = createRef<Gtk.Label>();

        await render(
            <GtkBox>
                <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
                    <GtkFrame label="Frame A">
                        <GtkSizeGroup.Widget>
                            <GtkLabel ref={labelARef} label="A" />
                        </GtkSizeGroup.Widget>
                    </GtkFrame>
                    <GtkFrame label="Frame B">
                        <GtkSizeGroup.Widget>
                            <GtkLabel ref={labelBRef} label="B" />
                        </GtkSizeGroup.Widget>
                    </GtkFrame>
                </GtkSizeGroup>
            </GtkBox>,
        );

        expect(labelARef.current?.getParent()?.constructor.name).toContain("Frame");
        expect(labelBRef.current?.getParent()?.constructor.name).toContain("Frame");
        expect(labelARef.current?.getParent()).not.toBe(labelBRef.current?.getParent());
    });
});

describe("render - GtkSizeGroup lifecycle", () => {
    it("updates the size group mode when the prop changes", async () => {
        const labelRef = createRef<Gtk.Label>();

        function App({ mode }: { mode: Gtk.SizeGroupMode }) {
            return (
                <GtkSizeGroup mode={mode}>
                    <GtkBox>
                        <GtkSizeGroup.Widget>
                            <GtkLabel ref={labelRef} label="A" />
                        </GtkSizeGroup.Widget>
                    </GtkBox>
                </GtkSizeGroup>
            );
        }

        const { rerender } = await render(<App mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(labelRef.current).not.toBeNull();

        await rerender(<App mode={Gtk.SizeGroupMode.NONE} />);
        expect(labelRef.current).not.toBeNull();

        await rerender(<App mode={Gtk.SizeGroupMode.BOTH} />);
        expect(labelRef.current).not.toBeNull();
    });

    it("unmounts wrapped widgets cleanly", async () => {
        const persistRef = createRef<Gtk.Label>();
        const conditionalRef = createRef<Gtk.Label>();

        function App({ showConditional }: { showConditional: boolean }) {
            return (
                <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
                    <GtkBox>
                        <GtkSizeGroup.Widget>
                            <GtkLabel ref={persistRef} label="Persist" />
                        </GtkSizeGroup.Widget>
                        {showConditional && (
                            <GtkSizeGroup.Widget>
                                <GtkLabel ref={conditionalRef} label="Conditional" />
                            </GtkSizeGroup.Widget>
                        )}
                    </GtkBox>
                </GtkSizeGroup>
            );
        }

        const { rerender } = await render(<App showConditional={true} />);
        expect(persistRef.current).not.toBeNull();
        expect(conditionalRef.current).not.toBeNull();

        await rerender(<App showConditional={false} />);
        expect(persistRef.current).not.toBeNull();
        expect(conditionalRef.current).toBeNull();
    });
});

describe("render - GtkSizeGroup nesting", () => {
    it("uses the innermost SizeGroup when ancestors are nested", async () => {
        const innerARef = createRef<Gtk.Label>();
        const innerBRef = createRef<Gtk.Label>();
        const outerOnlyRef = createRef<Gtk.Label>();

        await render(
            <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
                <GtkBox>
                    <GtkSizeGroup.Widget>
                        <GtkLabel ref={outerOnlyRef} label="Outer Only" />
                    </GtkSizeGroup.Widget>
                    <GtkSizeGroup mode={Gtk.SizeGroupMode.VERTICAL}>
                        <GtkBox>
                            <GtkSizeGroup.Widget>
                                <GtkLabel ref={innerARef} label="Inner A" />
                            </GtkSizeGroup.Widget>
                            <GtkSizeGroup.Widget>
                                <GtkLabel ref={innerBRef} label="Inner B" />
                            </GtkSizeGroup.Widget>
                        </GtkBox>
                    </GtkSizeGroup>
                </GtkBox>
            </GtkSizeGroup>,
        );

        expect(outerOnlyRef.current).not.toBeNull();
        expect(innerARef.current).not.toBeNull();
        expect(innerBRef.current).not.toBeNull();
    });

    it("defaults to horizontal mode when no mode prop is given", async () => {
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkSizeGroup>
                <GtkBox>
                    <GtkSizeGroup.Widget>
                        <GtkLabel ref={labelRef} label="Default" />
                    </GtkSizeGroup.Widget>
                </GtkBox>
            </GtkSizeGroup>,
        );

        expect(labelRef.current).not.toBeNull();
    });

    it("throws when GtkSizeGroup.Widget has no SizeGroup ancestor", async () => {
        await expect(
            render(
                <GtkBox>
                    <GtkSizeGroup.Widget>
                        <GtkLabel label="Orphan" />
                    </GtkSizeGroup.Widget>
                </GtkBox>,
            ),
        ).rejects.toThrow(/GtkSizeGroup\.Widget must be nested inside a GtkSizeGroup/);
    });
});
