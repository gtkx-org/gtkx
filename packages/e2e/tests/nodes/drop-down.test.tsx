import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkDropDown, x } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - DropDown", () => {
    describe("DropDownNode", () => {
        it("creates DropDown widget", async () => {
            const ref = createRef<Gtk.DropDown>();

            await render(<GtkDropDown ref={ref} />);

            expect(ref.current).not.toBeNull();
        });

        it("populates with items", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown ref={dropDownRef}>
                    <x.ListItem id="1" value="Option 1" />
                    <x.ListItem id="2" value="Option 2" />
                    <x.ListItem id="3" value="Option 3" />
                </GtkDropDown>,
            );

            const model = dropDownRef.current?.getModel();
            expect(model?.getNItems()).toBe(3);
        });

        it("sets selected item by id", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown ref={dropDownRef} selectedId="2">
                    <x.ListItem id="1" value="Option 1" />
                    <x.ListItem id="2" value="Option 2" />
                    <x.ListItem id="3" value="Option 3" />
                </GtkDropDown>,
            );

            expect(dropDownRef.current?.getSelected()).toBe(1);
        });

        it("calls onSelectionChanged when selection changes", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();
            const onSelectionChanged = vi.fn();

            await render(
                <GtkDropDown ref={dropDownRef} onSelectionChanged={onSelectionChanged}>
                    <x.ListItem id="1" value="Option 1" />
                    <x.ListItem id="2" value="Option 2" />
                </GtkDropDown>,
            );

            dropDownRef.current?.setSelected(1);

            expect(onSelectionChanged).toHaveBeenCalledWith("2");
        });

        it("updates items dynamically", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            function App({ items }: { items: Array<{ id: string; value: string }> }) {
                return (
                    <GtkDropDown ref={dropDownRef}>
                        {items.map((item) => (
                            <x.ListItem key={item.id} id={item.id} value={item.value} />
                        ))}
                    </GtkDropDown>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", value: "First" },
                        { id: "2", value: "Second" },
                    ]}
                />,
            );
            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(2);

            await render(
                <App
                    items={[
                        { id: "1", value: "First" },
                        { id: "2", value: "Second" },
                        { id: "3", value: "Third" },
                    ]}
                />,
            );
            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(3);
        });

        it("removes items", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            function App({ items }: { items: Array<{ id: string; value: string }> }) {
                return (
                    <GtkDropDown ref={dropDownRef}>
                        {items.map((item) => (
                            <x.ListItem key={item.id} id={item.id} value={item.value} />
                        ))}
                    </GtkDropDown>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", value: "First" },
                        { id: "2", value: "Second" },
                        { id: "3", value: "Third" },
                    ]}
                />,
            );
            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(3);

            await render(<App items={[{ id: "1", value: "First" }]} />);
            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(1);
        });
    });
});
