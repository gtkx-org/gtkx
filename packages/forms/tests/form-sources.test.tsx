import type { ComboRowProps } from "@gtkx/forms";
import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode, RefObject } from "react";
import { ComboRow, useForm } from "@gtkx/forms";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";

type FormValues = { sort: string };
type FormSourceProps = ComboRowProps<FormValues, "sort", FormValues, string, string>;
type SourceFormProps = {
    comboRef: RefObject<Adw.ComboRow | null>;
    source: "empty" | "items" | "sections";
};

const ITEMS = [{ id: "name", value: "By name" }, { id: "date", value: "By date" }];

function SourceForm({ comboRef, source }: SourceFormProps): ReactNode {
    const form = useForm<FormValues>({ defaultValues: { sort: "name" } });
    const shared = { ref: comboRef, control: form.control, name: "sort", title: "Sort" } as const;
    let row: ReactNode;

    if (source === "empty") {
        row = <ComboRow {...shared} renderHeader={null} />;
    } else if (source === "items") {
        row = <ComboRow {...shared} items={ITEMS} />;
    } else {
        row = (
            <ComboRow
                {...shared}
                sections={[{ id: "sort", value: { title: "Sort order" }, data: ITEMS }]}
                renderItem={({ item }) => <GtkLabel>{item.toUpperCase()}</GtkLabel>}
                renderHeader={({ section }) => <GtkLabel>{section.title}</GtkLabel>}
            />
        );
    }

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <AdwPreferencesGroup>{row}</AdwPreferencesGroup>
            <GtkLabel name="chosen-sort">{form.watch("sort")}</GtkLabel>
        </GtkBox>
    );
}

describe("form collection sources", () => {
    it("preserves source choices and inferred renderers through the form control", async () => {
        expectTypeOf<{ name: "sort"; items: []; sections: [] }>().not.toExtend<FormSourceProps>();
        expectTypeOf<{ name: "sort"; items: []; renderHeader: () => null }>().not.toExtend<FormSourceProps>();
        expectTypeOf<{ name: "sort"; renderHeader: () => null }>().not.toExtend<FormSourceProps>();

        const comboRef = createRef<Adw.ComboRow>();
        const { rerender } = await render(<SourceForm comboRef={comboRef} source="empty" />);
        expect(comboRef.current?.getModel()).toHaveObjectProperty("nItems", 0);
        await rerender(<SourceForm comboRef={comboRef} source="sections" />);

        if (comboRef.current === null) {
            throw new Error("Expected the combo row to mount");
        }

        await userEvent.click(comboRef.current);
        expect(await screen.findByText("Sort order")).toBeVisible();
        await userEvent.click(screen.getByText("BY DATE"));

        await waitFor(() => {
            expect(screen.getByName("chosen-sort")).toHaveTextContent("date");
            expect(screen.getByText("BY DATE")).toBeVisible();
        });

        await rerender(<SourceForm comboRef={comboRef} source="items" />);
        expect(await screen.findByText("By date")).toBeVisible();
    });
});
