import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkDropDown, SimpleListItem } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - DropDown", () => {
    describe("GtkDropDown", () => {
        it("creates DropDown widget", async () => {
            const ref = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown ref={ref}>
                    <SimpleListItem id="1" value="First" />
                </GtkDropDown>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("SimpleListItem", () => {
        it("adds item with id and value", async () => {
            const ref = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown ref={ref}>
                    <SimpleListItem id="option1" value="Option 1" />
                    <SimpleListItem id="option2" value="Option 2" />
                </GtkDropDown>,
                { wrapper: false },
            );

            expect(ref.current?.getModel()?.getNItems()).toBe(2);
        });

        it("inserts item before existing item", async () => {
            const ref = createRef<Gtk.DropDown>();

            function App({ items }: { items: { id: string; value: string }[] }) {
                return (
                    <GtkDropDown ref={ref}>
                        {items.map((item) => (
                            <SimpleListItem key={item.id} id={item.id} value={item.value} />
                        ))}
                    </GtkDropDown>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", value: "First" },
                        { id: "3", value: "Third" },
                    ]}
                />,
                { wrapper: false },
            );

            await render(
                <App
                    items={[
                        { id: "1", value: "First" },
                        { id: "2", value: "Second" },
                        { id: "3", value: "Third" },
                    ]}
                />,
                { wrapper: false },
            );

            expect(ref.current?.getModel()?.getNItems()).toBe(3);
        });

        it("removes item", async () => {
            const ref = createRef<Gtk.DropDown>();

            function App({ items }: { items: { id: string; value: string }[] }) {
                return (
                    <GtkDropDown ref={ref}>
                        {items.map((item) => (
                            <SimpleListItem key={item.id} id={item.id} value={item.value} />
                        ))}
                    </GtkDropDown>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", value: "A" },
                        { id: "2", value: "B" },
                        { id: "3", value: "C" },
                    ]}
                />,
                { wrapper: false },
            );

            await render(
                <App
                    items={[
                        { id: "1", value: "A" },
                        { id: "3", value: "C" },
                    ]}
                />,
                { wrapper: false },
            );

            expect(ref.current?.getModel()?.getNItems()).toBe(2);
        });

        it("updates item value", async () => {
            const ref = createRef<Gtk.DropDown>();

            function App({ value }: { value: string }) {
                return (
                    <GtkDropDown ref={ref}>
                        <SimpleListItem id="1" value={value} />
                    </GtkDropDown>
                );
            }

            await render(<App value="Initial" />, { wrapper: false });

            await render(<App value="Updated" />, { wrapper: false });
        });
    });

    describe("selection", () => {
        it("sets selected item via selectedId prop", async () => {
            const ref = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown ref={ref} selectedId="2">
                    <SimpleListItem id="1" value="First" />
                    <SimpleListItem id="2" value="Second" />
                    <SimpleListItem id="3" value="Third" />
                </GtkDropDown>,
                { wrapper: false },
            );
        });

        it("updates selection when selectedId prop changes", async () => {
            const ref = createRef<Gtk.DropDown>();

            function App({ selectedId }: { selectedId: string }) {
                return (
                    <GtkDropDown ref={ref} selectedId={selectedId}>
                        <SimpleListItem id="1" value="First" />
                        <SimpleListItem id="2" value="Second" />
                    </GtkDropDown>
                );
            }

            await render(<App selectedId="1" />, { wrapper: false });

            await render(<App selectedId="2" />, { wrapper: false });
        });
    });
});
