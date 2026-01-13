import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkColumnView, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { render } from "@gtkx/testing";
import type { ReactNode } from "react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const ScrollWrapper = ({ children }: { children: ReactNode }) => (
    <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
        {children}
    </GtkScrolledWindow>
);

describe("render - ColumnViewColumn", () => {
    describe("ColumnViewColumnNode", () => {
        it("adds column to ColumnView", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(1);
        });

        it("sets column title", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="col" title="My Column" expand renderCell={() => "Cell"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("My Column");
        });

        it("sets column expand property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="expand" title="Expandable" expand={true} renderCell={() => "Cell"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getExpand()).toBe(true);
        });

        it("sets column property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="resize" title="Resizable" expand resizable renderCell={() => "Cell"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getResizable()).toBe(true);
        });

        it("adds multiple columns", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="col1" title="Column 1" expand renderCell={() => "Cell 1"} />
                        <x.ColumnViewColumn id="col2" title="Column 2" expand renderCell={() => "Cell 2"} />
                        <x.ColumnViewColumn id="col3" title="Column 3" expand renderCell={() => "Cell 3"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(3);
        });

        it("updates column title on prop change", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ title }: { title: string }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            <x.ColumnViewColumn id="col" title={title} expand renderCell={() => "Cell"} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App title="Initial" />);
            let column = columnViewRef.current?.getColumns()?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("Initial");

            await render(<App title="Updated" />);
            column = columnViewRef.current?.getColumns()?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("Updated");
        });

        it("removes column from ColumnView", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            {columns.map((title) => (
                                <x.ColumnViewColumn
                                    key={title}
                                    id={title}
                                    title={title}
                                    expand
                                    renderCell={() => <GtkLabel label={title} />}
                                />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App columns={["A", "B", "C"]} />);
            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(3);

            await render(<App columns={["A", "C"]} />);
            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(2);
        });
    });
});
