import type * as Gtk from "@gtkx/ffi/gtk";
import { ColumnViewColumn, GtkColumnView, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - ColumnViewColumn", () => {
    describe("ColumnViewColumnNode", () => {
        it("adds column to ColumnView", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={columnViewRef}>
                    <ColumnViewColumn id="name" title="Name" renderCell={() => "Cell"} />
                </GtkColumnView>,
                { wrapper: false },
            );

            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(1);
        });

        it("sets column title", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={columnViewRef}>
                    <ColumnViewColumn id="col" title="My Column" renderCell={() => "Cell"} />
                </GtkColumnView>,
                { wrapper: false },
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("My Column");
        });

        it("sets column expand property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={columnViewRef}>
                    <ColumnViewColumn id="expand" title="Expandable" expand={true} renderCell={() => "Cell"} />
                </GtkColumnView>,
                { wrapper: false },
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getExpand()).toBe(true);
        });

        it("sets column resizable property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={columnViewRef}>
                    <ColumnViewColumn id="resize" title="Resizable" resizable={true} renderCell={() => "Cell"} />
                </GtkColumnView>,
                { wrapper: false },
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getResizable()).toBe(true);
        });

        it("adds multiple columns", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={columnViewRef}>
                    <ColumnViewColumn id="col1" title="Column 1" renderCell={() => "Cell 1"} />
                    <ColumnViewColumn id="col2" title="Column 2" renderCell={() => "Cell 2"} />
                    <ColumnViewColumn id="col3" title="Column 3" renderCell={() => "Cell 3"} />
                </GtkColumnView>,
                { wrapper: false },
            );

            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(3);
        });

        it("updates column title on prop change", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ title }: { title: string }) {
                return (
                    <GtkColumnView ref={columnViewRef}>
                        <ColumnViewColumn id="col" title={title} renderCell={() => "Cell"} />
                    </GtkColumnView>
                );
            }

            await render(<App title="Initial" />, { wrapper: false });
            let column = columnViewRef.current?.getColumns()?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("Initial");

            await render(<App title="Updated" />, { wrapper: false });
            column = columnViewRef.current?.getColumns()?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("Updated");
        });

        it("removes column from ColumnView", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <GtkColumnView ref={columnViewRef}>
                        {columns.map((title) => (
                            <ColumnViewColumn
                                key={title}
                                id={title}
                                title={title}
                                renderCell={() => <GtkLabel label={title} />}
                            />
                        ))}
                    </GtkColumnView>
                );
            }

            await render(<App columns={["A", "B", "C"]} />, { wrapper: false });
            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(3);

            await render(<App columns={["A", "C"]} />, { wrapper: false });
            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(2);
        });
    });
});
