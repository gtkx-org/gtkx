import { GtkButton, GtkGrid, GtkGridChild } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkGrid rowSpacing={8} columnSpacing={8}>
        <GtkGridChild column={0} row={0}>
            <GtkButton label="1 × 1" />
        </GtkGridChild>
        <GtkGridChild column={1} row={0} columnSpan={2}>
            <GtkButton label="2 × 1" hexpand />
        </GtkGridChild>
        <GtkGridChild column={0} row={1} columnSpan={3}>
            <GtkButton label="3 × 1" hexpand />
        </GtkGridChild>
        <GtkGridChild column={0} row={2} rowSpan={2}>
            <GtkButton label="1 × 2" vexpand />
        </GtkGridChild>
        <GtkGridChild column={1} row={2} columnSpan={2} rowSpan={2}>
            <GtkButton label="2 × 2" hexpand vexpand />
        </GtkGridChild>
    </GtkGrid>
);
