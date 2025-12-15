import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Grid, Label } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const GridDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Grid Layout" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Basic Grid" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="Grid arranges widgets in rows and columns. Use Grid.Child to specify position and span."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Grid.Root
                        rowSpacing={8}
                        columnSpacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <Grid.Child column={0} row={0}>
                            <Button label="(0,0)" />
                        </Grid.Child>
                        <Grid.Child column={1} row={0}>
                            <Button label="(1,0)" />
                        </Grid.Child>
                        <Grid.Child column={2} row={0}>
                            <Button label="(2,0)" />
                        </Grid.Child>
                        <Grid.Child column={0} row={1}>
                            <Button label="(0,1)" />
                        </Grid.Child>
                        <Grid.Child column={1} row={1}>
                            <Button label="(1,1)" />
                        </Grid.Child>
                        <Grid.Child column={2} row={1}>
                            <Button label="(2,1)" />
                        </Grid.Child>
                    </Grid.Root>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Column and Row Spanning" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="Widgets can span multiple columns or rows using columnSpan and rowSpan props."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Grid.Root
                        rowSpacing={8}
                        columnSpacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <Grid.Child column={0} row={0} columnSpan={2}>
                            <Button label="Spans 2 columns" hexpand />
                        </Grid.Child>
                        <Grid.Child column={2} row={0} rowSpan={2}>
                            <Button label="Spans 2 rows" vexpand />
                        </Grid.Child>
                        <Grid.Child column={0} row={1}>
                            <Button label="(0,1)" />
                        </Grid.Child>
                        <Grid.Child column={1} row={1}>
                            <Button label="(1,1)" />
                        </Grid.Child>
                    </Grid.Root>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Form Layout" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="Grid is great for form layouts with labels and inputs aligned."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Grid.Root
                        rowSpacing={8}
                        columnSpacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <Grid.Child column={0} row={0}>
                            <Label label="Name:" halign={Gtk.Align.END} />
                        </Grid.Child>
                        <Grid.Child column={1} row={0}>
                            <Button label="Text Entry Here" hexpand />
                        </Grid.Child>
                        <Grid.Child column={0} row={1}>
                            <Label label="Email:" halign={Gtk.Align.END} />
                        </Grid.Child>
                        <Grid.Child column={1} row={1}>
                            <Button label="Email Entry Here" hexpand />
                        </Grid.Child>
                        <Grid.Child column={0} row={2} columnSpan={2}>
                            <Button label="Submit" halign={Gtk.Align.END} marginTop={8} />
                        </Grid.Child>
                    </Grid.Root>
                </Box>
            </Box>
        </Box>
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
