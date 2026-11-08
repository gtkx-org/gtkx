import {
    GtkButton,
    GtkGrid,
    GtkGridLayoutChild,
    GtkLabel,
} from "@gtkx/jsx/gtk";

export function NameGrid() {
    return (
        <GtkGrid
            columnSpacing={6}
            rowSpacing={6}
            marginStart={12}
            marginEnd={12}
            marginTop={12}
            marginBottom={12}
        >
            <GtkGridLayoutChild column={0} row={0}>
                <GtkLabel label="Name" xalign={0} hexpand />
            </GtkGridLayoutChild>
            <GtkGridLayoutChild column={1} row={0}>
                <GtkButton label="Edit" />
            </GtkGridLayoutChild>
            <GtkGridLayoutChild column={0} row={1} columnSpan={2}>
                <GtkButton label="Save" />
            </GtkGridLayoutChild>
        </GtkGrid>
    );
}
