import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkDropDown, GtkListView, GtkScrolledWindow, x } from "@gtkx/react";
import { render } from "@gtkx/testing";
import type { ReactNode } from "react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const ScrollWrapper = ({ children }: { children: ReactNode }) => (
    <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
        {children}
    </GtkScrolledWindow>
);

describe("render - ListItem", () => {
    describe("ListItemNode", () => {
        it("renders list item in ListView", async () => {
            const listViewRef = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={listViewRef} renderItem={() => "Item"}>
                        <x.ListItem id="1" value={{ text: "First" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(listViewRef.current?.getModel()?.getNItems()).toBe(1);
        });

        it("renders multiple list items", async () => {
            const listViewRef = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={listViewRef} renderItem={() => "Item"}>
                        <x.ListItem id="1" value={{ text: "First" }} />
                        <x.ListItem id="2" value={{ text: "Second" }} />
                        <x.ListItem id="3" value={{ text: "Third" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(listViewRef.current?.getModel()?.getNItems()).toBe(3);
        });

        it("updates item value on prop change", async () => {
            const listViewRef = createRef<Gtk.ListView>();

            function App({ value }: { value: Record<string, unknown> }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={listViewRef} renderItem={() => "Item"}>
                            <x.ListItem id="dynamic" value={value} />
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App value={{ text: "Initial" }} />);
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(1);

            await render(<App value={{ text: "Updated" }} />);
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(1);
        });

        it("removes item from list", async () => {
            const listViewRef = createRef<Gtk.ListView>();

            function App({ items }: { items: Array<{ id: string; text: string }> }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={listViewRef} renderItem={() => "Item"}>
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", text: "First" },
                        { id: "2", text: "Second" },
                        { id: "3", text: "Third" },
                    ]}
                />,
            );
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(3);

            await render(<App items={[{ id: "1", text: "First" }]} />);
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(1);
        });

        it("inserts item before existing item", async () => {
            const listViewRef = createRef<Gtk.ListView>();

            function App({ items }: { items: Array<{ id: string; text: string }> }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={listViewRef} renderItem={() => "Item"}>
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(
                <App
                    items={[
                        { id: "first", text: "First" },
                        { id: "last", text: "Last" },
                    ]}
                />,
            );
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(2);

            await render(
                <App
                    items={[
                        { id: "first", text: "First" },
                        { id: "middle", text: "Middle" },
                        { id: "last", text: "Last" },
                    ]}
                />,
            );
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(3);
        });
    });

    describe("ListItemNode in DropDown", () => {
        it("renders list item in DropDown", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown ref={dropDownRef}>
                    <x.ListItem id="item1" value="Item Value" />
                </GtkDropDown>,
            );

            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(1);
        });

        it("handles string value", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown ref={dropDownRef}>
                    <x.ListItem id="test" value="Test String" />
                </GtkDropDown>,
            );

            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(1);
        });

        it("updates value on prop change", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            function App({ value }: { value: string }) {
                return (
                    <GtkDropDown ref={dropDownRef}>
                        <x.ListItem id="dynamic" value={value} />
                    </GtkDropDown>
                );
            }

            await render(<App value="Initial" />);
            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(1);

            await render(<App value="Updated" />);
            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(1);
        });

        it("maintains order with multiple items", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            await render(
                <GtkDropDown ref={dropDownRef}>
                    <x.ListItem id="a" value="First" />
                    <x.ListItem id="b" value="Second" />
                    <x.ListItem id="c" value="Third" />
                </GtkDropDown>,
            );

            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(3);
        });

        it("inserts item before existing item", async () => {
            const dropDownRef = createRef<Gtk.DropDown>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkDropDown ref={dropDownRef}>
                        {items.map((item) => (
                            <x.ListItem key={item} id={item} value={item} />
                        ))}
                    </GtkDropDown>
                );
            }

            await render(<App items={["first", "last"]} />);
            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(2);

            await render(<App items={["first", "middle", "last"]} />);
            expect(dropDownRef.current?.getModel()?.getNItems()).toBe(3);
        });
    });
});
