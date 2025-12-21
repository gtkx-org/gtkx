import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkGrid, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const GridDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Grid Layout" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Basic Grid" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Grid arranges widgets in rows and columns. Use <GtkGrid.Child to specify position and span."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <GtkGrid.Root
                        rowSpacing={8}
                        columnSpacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkGrid.Child column={0} row={0}>
                            <GtkButton label="(0,0)" />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={1} row={0}>
                            <GtkButton label="(1,0)" />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={2} row={0}>
                            <GtkButton label="(2,0)" />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={0} row={1}>
                            <GtkButton label="(0,1)" />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={1} row={1}>
                            <GtkButton label="(1,1)" />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={2} row={1}>
                            <GtkButton label="(2,1)" />
                        </GtkGrid.Child>
                    </GtkGrid.Root>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Column and Row Spanning" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Widgets can span multiple columns or rows using columnSpan and rowSpan props."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <GtkGrid.Root
                        rowSpacing={8}
                        columnSpacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkGrid.Child column={0} row={0} columnSpan={2}>
                            <GtkButton label="Spans 2 columns" hexpand />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={2} row={0} rowSpan={2}>
                            <GtkButton label="Spans 2 rows" vexpand />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={0} row={1}>
                            <GtkButton label="(0,1)" />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={1} row={1}>
                            <GtkButton label="(1,1)" />
                        </GtkGrid.Child>
                    </GtkGrid.Root>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Form Layout" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Grid is great for form layouts with labels and inputs aligned."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <GtkGrid.Root
                        rowSpacing={8}
                        columnSpacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkGrid.Child column={0} row={0}>
                            <GtkLabel label="Name:" halign={Gtk.Align.END} />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={1} row={0}>
                            <GtkButton label="Text <GtkEntry Here" hexpand />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={0} row={1}>
                            <GtkLabel label="Email:" halign={Gtk.Align.END} />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={1} row={1}>
                            <GtkButton label="Email <GtkEntry Here" hexpand />
                        </GtkGrid.Child>
                        <GtkGrid.Child column={0} row={2} columnSpan={2}>
                            <GtkButton label="Submit" halign={Gtk.Align.END} marginTop={8} />
                        </GtkGrid.Child>
                    </GtkGrid.Root>
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const gridDemo: Demo = {
    id: "grid",
    title: "Grid",
    description: "Two-dimensional layout container for arranging widgets in rows and columns.",
    keywords: ["grid", "layout", "container", "rows", "columns", "table", "GtkGrid"],
    component: GridDemo,
    sourcePath: getSourcePath(import.meta.url, "grid.tsx"),
};
