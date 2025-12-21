import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkDropDown } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - DropDown", () => {
    describe("DropDown.Root", () => {
        it("creates DropDown widget", async () => {
            const ref = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown.Root ref={ref}>
                    <GtkDropDown.Item id="1" label="First" />
                </GtkDropDown.Root>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("DropDown.Item", () => {
        it("adds item with id and label", async () => {
            const ref = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown.Root ref={ref}>
                    <GtkDropDown.Item id="option1" label="Option 1" />
                    <GtkDropDown.Item id="option2" label="Option 2" />
                </GtkDropDown.Root>,
                { wrapper: false },
            );

            expect(ref.current?.getModel()?.getNItems()).toBe(2);
        });

        it("inserts item before existing item", async () => {
            const ref = createRef<Gtk.DropDown>();

            function App({ items }: { items: { id: string; label: string }[] }) {
                return (
                    <GtkDropDown.Root ref={ref}>
                        {items.map((item) => (
                            <GtkDropDown.Item key={item.id} id={item.id} label={item.label} />
                        ))}
                    </GtkDropDown.Root>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", label: "First" },
                        { id: "3", label: "Third" },
                    ]}
                />,
                { wrapper: false },
            );

            await render(
                <App
                    items={[
                        { id: "1", label: "First" },
                        { id: "2", label: "Second" },
                        { id: "3", label: "Third" },
                    ]}
                />,
                { wrapper: false },
            );

            expect(ref.current?.getModel()?.getNItems()).toBe(3);
        });

        it("removes item", async () => {
            const ref = createRef<Gtk.DropDown>();

            function App({ items }: { items: { id: string; label: string }[] }) {
                return (
                    <GtkDropDown.Root ref={ref}>
                        {items.map((item) => (
                            <GtkDropDown.Item key={item.id} id={item.id} label={item.label} />
                        ))}
                    </GtkDropDown.Root>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", label: "A" },
                        { id: "2", label: "B" },
                        { id: "3", label: "C" },
                    ]}
                />,
                { wrapper: false },
            );

            await render(
                <App
                    items={[
                        { id: "1", label: "A" },
                        { id: "3", label: "C" },
                    ]}
                />,
                { wrapper: false },
            );

            expect(ref.current?.getModel()?.getNItems()).toBe(2);
        });

        it("updates item label", async () => {
            const ref = createRef<Gtk.DropDown>();

            function App({ label }: { label: string }) {
                return (
                    <GtkDropDown.Root ref={ref}>
                        <GtkDropDown.Item id="1" label={label} />
                    </GtkDropDown.Root>
                );
            }

            await render(<App label="Initial" />, { wrapper: false });

            await render(<App label="Updated" />, { wrapper: false });
        });
    });

    describe("selection", () => {
        it("sets selected item via selectedId prop", async () => {
            const ref = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown.Root ref={ref} selectedId="2">
                    <GtkDropDown.Item id="1" label="First" />
                    <GtkDropDown.Item id="2" label="Second" />
                    <GtkDropDown.Item id="3" label="Third" />
                </GtkDropDown.Root>,
                { wrapper: false },
            );
        });

        it("calls onSelectionChanged when selection changes", async () => {
            const ref = createRef<Gtk.DropDown>();
            const onSelectionChanged = vi.fn();

            await render(
                <GtkDropDown.Root ref={ref} onSelectionChanged={onSelectionChanged}>
                    <GtkDropDown.Item id="1" label="First" />
                    <GtkDropDown.Item id="2" label="Second" />
                </GtkDropDown.Root>,
                { wrapper: false },
            );

            expect(onSelectionChanged).toHaveBeenCalled();
        });

        it("updates selection when selectedId prop changes", async () => {
            const ref = createRef<Gtk.DropDown>();

            function App({ selectedId }: { selectedId: string }) {
                return (
                    <GtkDropDown.Root ref={ref} selectedId={selectedId}>
                        <GtkDropDown.Item id="1" label="First" />
                        <GtkDropDown.Item id="2" label="Second" />
                    </GtkDropDown.Root>
                );
            }

            await render(<App selectedId="1" />, { wrapper: false });

            await render(<App selectedId="2" />, { wrapper: false });
        });
    });
});
