import type { ComboRowProps } from "@gtkx/components/adw";
import type * as Adw from "@gtkx/gi/adw";
import { ComboRow } from "@gtkx/components/adw";
import { GtkLabel, GtkListBox } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type ReactNode, type Ref } from "react";
import { describe, expect, it } from "vitest";

type ProbeProps = {
    comboRef: Ref<Adw.ComboRow>;
};

type ComboShellProps = Omit<ComboRowProps<string, string>, "ref" | "title"> & ProbeProps;

const items = [
    { id: "title", value: "By title" },
    { id: "date", value: "By date" },
    { id: "size", value: "By size" },
];

const ComboShell = ({ comboRef, ...props }: ComboShellProps): ReactNode => (
    <GtkListBox>
        <ComboRow ref={comboRef} title="Sort Order" {...props} />
    </GtkListBox>
);

const ComboProbe = ({ selectedId, comboRef }: ProbeProps & { selectedId: string }): ReactNode => (
    <ComboShell comboRef={comboRef} items={items} selectedId={selectedId} />
);

const SectionedComboProbe = ({ comboRef }: ProbeProps): ReactNode => (
    <ComboShell
        comboRef={comboRef}
        sections={[
            {
                id: "ascending",
                value: "Ascending",
                data: [
                    { id: "title", value: "By title" },
                    { id: "date", value: "By date" },
                ],
            },
        ]}
        selectedId="title"
        renderHeader={({ section: value }) => <GtkLabel>{value}</GtkLabel>}
    />
);

const TemplatedComboProbe = ({ comboRef }: ProbeProps): ReactNode => (
    <ComboShell
        comboRef={comboRef}
        items={items}
        selectedId="date"
        renderItem={({ item: value }) => <GtkLabel>{`Sorted ${value.toLowerCase()}`}</GtkLabel>}
    />
);

const openComboList = async (combo: Adw.ComboRow | null): Promise<void> => {
    if (!combo) {
        throw new Error("Expected a ComboRow");
    }

    await userEvent.click(combo);
};

describe("render - ComboRow", () => {
    it("applies selectedId to the model selection", async () => {
        const ref = createRef<Adw.ComboRow>();
        await render(<ComboProbe selectedId="date" comboRef={ref} />);
        expect(ref.current).toHaveObjectProperty("selected", 1);
    });

    it("renders the selected item in the row display", async () => {
        const ref = createRef<Adw.ComboRow>();
        await render(<ComboProbe selectedId="date" comboRef={ref} />);
        expect(await screen.findAllByText("By date")).toHaveLength(1);
        expect(screen.queryAllByText("By size")).toHaveLength(0);
        await openComboList(ref.current);

        await waitFor(() => {
            expect(screen.getAllByText("By date").length).toBeGreaterThanOrEqual(2);
            expect(screen.getAllByText("By size")).toHaveLength(1);
        });
    });

    it("updates the row display when selectedId changes", async () => {
        const ref = createRef<Adw.ComboRow>();
        const { rerender } = await render(<ComboProbe selectedId="title" comboRef={ref} />);
        await rerender(<ComboProbe selectedId="size" comboRef={ref} />);
        expect(ref.current).toHaveObjectProperty("selected", 2);
        expect(await screen.findAllByText("By size")).toHaveLength(1);
        expect(screen.queryAllByText("By title")).toHaveLength(0);
        await openComboList(ref.current);

        await waitFor(() => {
            expect(screen.getAllByText("By size").length).toBeGreaterThanOrEqual(2);
            expect(screen.getAllByText("By title")).toHaveLength(1);
        });
    });

    it("renders a section header through the header factory, not as a popup item", async () => {
        const ref = createRef<Adw.ComboRow>();
        await render(<SectionedComboProbe comboRef={ref} />);
        await screen.findAllByText("By title");
        expect(screen.queryAllByText("Ascending")).toHaveLength(0);
        await openComboList(ref.current);

        await waitFor(() => {
            expect(screen.getAllByText("Ascending")).toHaveLength(1);
        });
    });

    it("renders custom item templates", async () => {
        const ref = createRef<Adw.ComboRow>();
        await render(<TemplatedComboProbe comboRef={ref} />);
        const matches = await screen.findAllByText("Sorted by date");
        expect(matches.length).toBeGreaterThanOrEqual(1);
    });
});
