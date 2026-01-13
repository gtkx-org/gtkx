import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkWindow } from "@gtkx/react";
import { render, screen, within } from "@gtkx/testing";
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
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel label="Child" />
                </GtkBox>,
            );

            const label = await screen.findByText("Child");
            expect(label).toBeDefined();
        });

        it("sets child on single-child widget", async () => {
            await render(
                <GtkFrame>
                    <GtkLabel label="Single Child" />
                </GtkFrame>,
            );

            const label = await screen.findByText("Single Child");
            expect(label).toBeDefined();
        });
    });

    describe("removing children", () => {
        it("removes child from parent", async () => {
            function App({ showChild }: { showChild: boolean }) {
                return <GtkBox orientation={Gtk.Orientation.VERTICAL}>{showChild && "Removable"}</GtkBox>;
            }

            const { rerender } = await render(<App showChild={true} />);

            await screen.findByText("Removable");

            await rerender(<App showChild={false} />);

            expect(screen.queryByText("Removable")).toBeNull();
        });

        it("clears child on single-child widget", async () => {
            function App({ showChild }: { showChild: boolean }) {
                return <GtkFrame>{showChild && "Child"}</GtkFrame>;
            }

            const { rerender } = await render(<App showChild={true} />);

            await screen.findByText("Child");

            await rerender(<App showChild={false} />);

            expect(screen.queryByText("Child")).toBeNull();
        });
    });

    describe("inserting children", () => {
        it("inserts child before sibling", async () => {
            const boxRef = createRef<Gtk.Box>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkBox ref={boxRef} orientation={Gtk.Orientation.VERTICAL}>
                        {items.map((item) => (
                            <GtkLabel key={item} label={item} />
                        ))}
                    </GtkBox>
                );
            }

            const { rerender } = await render(<App items={["A", "C"]} />);

            await screen.findByText("A");
            await screen.findByText("C");
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "C"]);

            await rerender(<App items={["A", "B", "C"]} />);

            await screen.findByText("B");
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "B", "C"]);
        });

        it("falls back to append when before not found", async () => {
            const boxRef = createRef<Gtk.Box>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkBox ref={boxRef} orientation={Gtk.Orientation.VERTICAL}>
                        {items.map((item) => (
                            <GtkLabel key={item} label={item} />
                        ))}
                    </GtkBox>
                );
            }

            const { rerender } = await render(<App items={["A", "B"]} />);

            await rerender(<App items={["A", "B", "C"]} />);

            const labels = await screen.findAllByText(/A|B|C/);
            expect(labels).toHaveLength(3);
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

            const { rerender } = await render(<App showWindow={true} />, { wrapper: false });

            expect(windowRef.current).not.toBeNull();

            await rerender(<App showWindow={false} />);
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

            const { rerender } = await render(<App windows={["First"]} />, { wrapper: false });

            await rerender(<App windows={["Second", "First"]} />);
        });
    });

    describe("child ordering", () => {
        it("maintains correct order after multiple operations", async () => {
            const boxRef = createRef<Gtk.Box>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkBox ref={boxRef} orientation={Gtk.Orientation.VERTICAL}>
                        {items.map((item) => (
                            <GtkLabel key={item} label={item} />
                        ))}
                    </GtkBox>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "B", "C"]);

            await render(<App items={["A", "D", "B", "C"]} />);
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "D", "B", "C"]);

            await render(<App items={["D", "C"]} />);
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["D", "C"]);
        });

        it("handles reordering via key changes", async () => {
            const boxRef = createRef<Gtk.Box>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkBox ref={boxRef} orientation={Gtk.Orientation.VERTICAL}>
                        {items.map((item) => (
                            <GtkLabel key={item} label={item} />
                        ))}
                    </GtkBox>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["A", "B", "C"]);

            await render(<App items={["C", "B", "A"]} />);
            expect(getChildLabels(boxRef.current as Gtk.Box)).toEqual(["C", "B", "A"]);
        });
    });

    describe("scoped queries with within", () => {
        it("queries within a specific container", async () => {
            const containerRef = createRef<Gtk.Box>();

            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkBox ref={containerRef}>
                        <GtkButton label="Inner Button" />
                        <GtkLabel label="Inner Label" />
                    </GtkBox>
                    <GtkButton label="Outer Button" />
                </GtkBox>,
            );

            const container = containerRef.current as Gtk.Box;
            const withinContainer = within(container);

            const innerButton = await withinContainer.findByRole(Gtk.AccessibleRole.BUTTON);
            expect(innerButton).toBeDefined();

            const buttons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON);
            expect(buttons).toHaveLength(2);

            const innerButtons = await withinContainer.findAllByRole(Gtk.AccessibleRole.BUTTON);
            expect(innerButtons).toHaveLength(1);
        });

        it("finds text within specific parent", async () => {
            const section1Ref = createRef<Gtk.Box>();
            const section2Ref = createRef<Gtk.Box>();

            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkBox ref={section1Ref} orientation={Gtk.Orientation.VERTICAL}>
                        <GtkLabel label="Title" />
                        <GtkLabel label="Section 1 Content" />
                    </GtkBox>
                    <GtkBox ref={section2Ref} orientation={Gtk.Orientation.VERTICAL}>
                        <GtkLabel label="Title" />
                        <GtkLabel label="Section 2 Content" />
                    </GtkBox>
                </GtkBox>,
            );

            const section1 = within(section1Ref.current as Gtk.Box);
            const section2 = within(section2Ref.current as Gtk.Box);

            const s1Content = await section1.findByText("Section 1 Content");
            expect(s1Content).toBeDefined();

            const s2Content = await section2.findByText("Section 2 Content");
            expect(s2Content).toBeDefined();

            const allTitles = await screen.findAllByText("Title");
            expect(allTitles).toHaveLength(2);
        });
    });
});
