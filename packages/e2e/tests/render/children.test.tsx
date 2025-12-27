import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkWindow } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const getChildWidgets = (parent: Gtk.Widget): Gtk.Widget[] => {
    const children: Gtk.Widget[] = [];
    let child = parent.getFirstChild();
    while (child) {
        children.push(child);
        child = child.getNextSibling();
    }
    return children;
};

const getChildLabels = (parent: Gtk.Widget): string[] => {
    return getChildWidgets(parent)
        .filter((w): w is Gtk.Label => "getLabel" in w && typeof w.getLabel === "function")
        .map((l) => l.getLabel() ?? "");
};

describe("render - children", () => {
    describe("adding children", () => {
        it("appends child to appendable widget (Box)", async () => {
            const boxRef = createRef<Gtk.Box>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel ref={labelRef} label="Child" />
                </GtkBox>,
                { wrapper: false },
            );

            expect(labelRef.current?.getParent()?.id).toEqual(boxRef.current?.id);
        });

        it("sets child on single-child widget", async () => {
            const frameRef = createRef<Gtk.Frame>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkFrame ref={frameRef}>
                    <GtkLabel ref={labelRef} label="Single Child" />
                </GtkFrame>,
                { wrapper: false },
            );

            expect(frameRef.current?.getChild()?.id).toEqual(labelRef.current?.id);
        });
    });

    describe("removing children", () => {
        it("removes child from parent", async () => {
            const boxRef = createRef<Gtk.Box>();

            function App({ showChild }: { showChild: boolean }) {
                return (
                    <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                        {showChild && "Removable"}
                    </GtkBox>
                );
            }

            await render(<App showChild={true} />, { wrapper: false });

            expect(getChildWidgets(boxRef.current as Gtk.Box).length).toBe(1);

            await render(<App showChild={false} />, { wrapper: false });

            expect(getChildWidgets(boxRef.current as Gtk.Box).length).toBe(0);
        });

        it("clears child on single-child widget", async () => {
            const frameRef = createRef<Gtk.Frame>();

            function App({ showChild }: { showChild: boolean }) {
                return <GtkFrame ref={frameRef}>{showChild && "Child"}</GtkFrame>;
            }

            await render(<App showChild={true} />, { wrapper: false });

            expect(frameRef.current?.getChild()).not.toBeNull();

            await render(<App showChild={false} />, { wrapper: false });

            expect(frameRef.current?.getChild()).toBeNull();
        });
    });

    describe("inserting children", () => {
        it("inserts child before sibling", async () => {
            const boxRef = createRef<Gtk.Box>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                        {items.map((item) => (
                            <GtkLabel key={item} label={item} />
                        ))}
                    </GtkBox>
                );
            }

            await render(<App items={["A", "C"]} />, { wrapper: false });

            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "C"]);

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });

            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "B", "C"]);
        });

        it("falls back to append when before not found", async () => {
            const boxRef = createRef<Gtk.Box>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                        {items.map((item) => (
                            <GtkLabel key={item} label={item} />
                        ))}
                    </GtkBox>
                );
            }

            await render(<App items={["A", "B"]} />, { wrapper: false });

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });

            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "B", "C"]);
        });
    });

    describe("root level widgets", () => {
        it("renders root level window", async () => {
            const windowRef = createRef<Gtk.Window>();

            await render(<GtkWindow ref={windowRef} title="Root Container" />, { wrapper: false });

            expect(windowRef.current).not.toBeNull();
        });

        it("removes root level window", async () => {
            const windowRef = createRef<Gtk.Window>();

            function App({ showWindow }: { showWindow: boolean }) {
                return showWindow ? <GtkWindow ref={windowRef} title="Window" /> : null;
            }

            await render(<App showWindow={true} />, { wrapper: false });

            expect(windowRef.current).not.toBeNull();

            await render(<App showWindow={false} />, { wrapper: false });
        });

        it("inserts root level window before sibling", async () => {
            const window1Ref = createRef<Gtk.Window>();
            const window2Ref = createRef<Gtk.Window>();

            function App({ windows }: { windows: string[] }) {
                return (
                    <>
                        {windows.map((title, i) => (
                            <GtkWindow key={title} ref={i === 0 ? window1Ref : window2Ref} title={title} />
                        ))}
                    </>
                );
            }

            await render(<App windows={["First"]} />, { wrapper: false });

            await render(<App windows={["Second", "First"]} />, { wrapper: false });
        });
    });

    describe("child ordering", () => {
        it("maintains correct order after multiple operations", async () => {
            const boxRef = createRef<Gtk.Box>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                        {items.map((item) => (
                            <GtkLabel key={item} label={item} />
                        ))}
                    </GtkBox>
                );
            }

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "B", "C"]);

            await render(<App items={["A", "D", "B", "C"]} />, { wrapper: false });
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "D", "B", "C"]);

            await render(<App items={["D", "C"]} />, { wrapper: false });
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["D", "C"]);
        });

        it("handles reordering via key changes", async () => {
            const boxRef = createRef<Gtk.Box>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                        {items.map((item) => (
                            <GtkLabel key={item} label={item} />
                        ))}
                    </GtkBox>
                );
            }

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "B", "C"]);

            await render(<App items={["C", "B", "A"]} />, { wrapper: false });
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["C", "B", "A"]);
        });
    });
});
