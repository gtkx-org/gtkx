import type { ColumnViewColumn, ListItem } from "@gtkx/components";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode, Ref } from "react";
import { ListView } from "@gtkx/components";
import { GtkInscription, GtkLabel } from "@gtkx/jsx/gtk";
import { ScrollWrapper } from "./scroll-wrapper.js";

type Row = { name: string };

const ROW_COUNT = 5000;

const largeRows: ListItem<Row>[] = Array.from({ length: ROW_COUNT }, (_, index) => ({
    id: `r${String(index)}`,
    value: { name: `row ${String(index)}` },
}));

const inscriptionColumns = (count: number, onRenderCell?: () => void): ColumnViewColumn<Row>[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `c${String(index)}`,
        title: `Col ${String(index)}`,
        renderCell: ({ item }) => {
            onRenderCell?.();

            return <GtkInscription text={`${item.name}/${String(index)}`} />;
        },
    }));

const largeListView = (ref: Ref<Gtk.ListView>): ReactNode => (
    <ScrollWrapper minContentHeight={400} minContentWidth={800}>
        <ListView<Row>
            ref={ref}
            items={largeRows}
            estimatedItemHeight={32}
            renderItem={({ item }) => <GtkLabel>{item.name}</GtkLabel>}
        />
    </ScrollWrapper>
);

export { largeRows, inscriptionColumns, largeListView, type Row };
