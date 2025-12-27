import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkListView, ListItem } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - ListItem", () => {
    describe("ListItemNode", () => {
        it("renders list item in ListView", async () => {
            const listViewRef = createRef<Gtk.ListView>();

            await render(
                <GtkListView ref={listViewRef} renderItem={() => "Item"}>
                    <ListItem id="1" value={{ text: "First" }} />
                </GtkListView>,
                { wrapper: false },
            );

            expect(listViewRef.current?.getModel()?.getNItems()).toBe(1);
        });

        it("renders multiple list items", async () => {
            const listViewRef = createRef<Gtk.ListView>();

            await render(
                <GtkListView ref={listViewRef} renderItem={() => "Item"}>
                    <ListItem id="1" value={{ text: "First" }} />
                    <ListItem id="2" value={{ text: "Second" }} />
                    <ListItem id="3" value={{ text: "Third" }} />
                </GtkListView>,
                { wrapper: false },
            );

            expect(listViewRef.current?.getModel()?.getNItems()).toBe(3);
        });

        it("updates item value on prop change", async () => {
            const listViewRef = createRef<Gtk.ListView>();

            function App({ value }: { value: Record<string, unknown> }) {
                return (
                    <GtkListView ref={listViewRef} renderItem={() => "Item"}>
                        <ListItem id="dynamic" value={value} />
                    </GtkListView>
                );
            }

            await render(<App value={{ text: "Initial" }} />, { wrapper: false });
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(1);

            await render(<App value={{ text: "Updated" }} />, { wrapper: false });
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(1);
        });

        it("removes item from list", async () => {
            const listViewRef = createRef<Gtk.ListView>();

            function App({ items }: { items: Array<{ id: string; text: string }> }) {
                return (
                    <GtkListView ref={listViewRef} renderItem={() => "Item"}>
                        {items.map((item) => (
                            <ListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </GtkListView>
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
                { wrapper: false },
            );
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(3);

            await render(<App items={[{ id: "1", text: "First" }]} />, { wrapper: false });
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(1);
        });

        it("inserts item before existing item", async () => {
            const listViewRef = createRef<Gtk.ListView>();

            function App({ items }: { items: Array<{ id: string; text: string }> }) {
                return (
                    <GtkListView ref={listViewRef} renderItem={() => "Item"}>
                        {items.map((item) => (
                            <ListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </GtkListView>
                );
            }

            await render(
                <App
                    items={[
                        { id: "first", text: "First" },
                        { id: "last", text: "Last" },
                    ]}
                />,
                { wrapper: false },
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
                { wrapper: false },
            );
            expect(listViewRef.current?.getModel()?.getNItems()).toBe(3);
        });
    });
});
