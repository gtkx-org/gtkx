import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode, Ref, RefCallback } from "react";
import { ComboRow, EntryRow, FormProvider, PasswordEntryRow, SpinRow, SwitchRow, useForm } from "@gtkx/forms";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

type Row = Adw.EntryRow | Adw.PasswordEntryRow | Adw.SwitchRow | Adw.SpinRow | Adw.ComboRow;

type RowCase = {
    name: string;
    value: string | number | boolean;
    draw: (ref: RefCallback<Row>) => ReactNode;
};

const ROWS: RowCase[] = [
    { name: "EntryRow", value: "Name", draw: (ref) => <EntryRow ref={ref} name="value" title="Value" /> },
    {
        name: "PasswordEntryRow",
        value: "Password",
        draw: (ref) => <PasswordEntryRow ref={ref} name="value" title="Value" />,
    },
    { name: "SwitchRow", value: true, draw: (ref) => <SwitchRow ref={ref} name="value" title="Value" /> },
    {
        name: "SpinRow",
        value: 5,
        draw: (ref) => (
            <SpinRow
                ref={ref}
                name="value"
                title="Value"
                adjustment={<GtkAdjustment lower={0} upper={10} stepIncrement={1} />}
            />
        ),
    },
    {
        name: "ComboRow",
        value: "one",
        draw: (ref) => <ComboRow ref={ref} name="value" title="Value" items={[{ id: "one", value: "One" }]} />,
    },
];

const throwOnCleanup = (): never => {
    throw new Error("Cleanup failed");
};

const failingCleanupRef: RefCallback<Adw.EntryRow> = (row) => row === null ? undefined : throwOnCleanup;

function RowForm({ row, rowRef }: { row: RowCase; rowRef: RefCallback<Row> }): ReactNode {
    const form = useForm({ defaultValues: { value: row.value } });

    return <FormProvider {...form}><AdwPreferencesGroup>{row.draw(rowRef)}</AdwPreferencesGroup></FormProvider>;
}

function FocusForm({ rowRef }: { rowRef: Ref<Adw.EntryRow> }): ReactNode {
    const form = useForm({ defaultValues: { value: "Selected text" } });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <AdwPreferencesGroup>
                <EntryRow ref={rowRef} control={form.control} name="value" title="Value" />
            </AdwPreferencesGroup>
            <GtkButton
                label="Focus field"
                onClicked={() => {
                    form.setFocus("value", { shouldSelect: true });
                }}
            />
        </GtkBox>
    );
}

describe.each(ROWS)("$name forwarded refs", (row) => {
    it("cleans up callback refs when replaced and unmounted", async () => {
        const attached: Row[] = [];
        const detached: Row[] = [];
        const nullCalls: null[] = [];
        const firstRef: RefCallback<Row> = (widget) => {
            if (widget === null) {
                nullCalls.push(widget);

                return;
            }

            attached.push(widget);

            return () => {
                detached.push(widget);
            };
        };
        const secondRef: RefCallback<Row> = (widget) => firstRef(widget);
        const { rerender, unmount } = await render(<RowForm row={row} rowRef={firstRef} />);
        expect(attached).toHaveLength(1);
        expect(detached).toHaveLength(0);
        await rerender(<RowForm row={row} rowRef={firstRef} />);
        expect(attached).toHaveLength(1);
        await rerender(<RowForm row={row} rowRef={secondRef} />);
        expect(attached).toHaveLength(2);
        expect(attached[1]).toBe(attached[0]);
        expect(detached).toEqual([attached[0]]);
        await unmount();
        expect(detached).toEqual(attached);
        expect(nullCalls).toHaveLength(0);
    });
});

describe("form focus refs", () => {
    it("updates object refs while keeping programmatic focus and text selection", async () => {
        const firstRef = createRef<Adw.EntryRow>();
        const secondRef = createRef<Adw.EntryRow>();
        const { rerender, unmount } = await render(<FocusForm rowRef={firstRef} />);
        const original = firstRef.current;
        expect(original).not.toBeNull();
        await rerender(<FocusForm rowRef={secondRef} />);
        expect(firstRef.current).toBeNull();
        expect(secondRef.current).toBe(original);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Focus field" }));

        await waitFor(() => {
            expect(secondRef.current?.getDelegate()?.isFocus()).toBe(true);
            expect(secondRef.current?.getSelectionBounds()).toEqual([true, 0, 13]);
        });

        await unmount();
        expect(secondRef.current).toBeNull();
    });

    it("propagates callback cleanup failures during unmount", async () => {
        const { unmount } = await render(<FocusForm rowRef={failingCleanupRef} />);
        await expect(unmount()).rejects.toThrow();
    });
});
