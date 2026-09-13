import type { ReactNode } from "react";
import { ComboRow, useForm } from "@gtkx/forms";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { useState } from "react";
import { describe, expect, it } from "vitest";

type Source = "items" | "sections";
const CHOICES = [{ id: "first", value: "First" }, { id: "second", value: "Second" }];

function ChoiceForm({ source, hasChoices }: { source: Source; hasChoices: boolean }): ReactNode {
    const form = useForm({ defaultValues: { choice: "second" } });
    const [submitted, setSubmitted] = useState("");
    const items = hasChoices ? CHOICES : [];
    const props = { name: "choice", control: form.control, title: "Choice" } as const;
    const row = source === "items"
        ? <ComboRow {...props} items={items} />
        : <ComboRow {...props} sections={[{ id: "group", value: "Choices", data: items }]} />;
    const submit = form.handleSubmit(({ choice }) => {
        setSubmitted(choice);
    });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <AdwPreferencesGroup>{row}</AdwPreferencesGroup>
            <GtkLabel name="choice-value">{form.watch("choice")}</GtkLabel>
            <GtkLabel name="choice-dirty">{String(form.formState.isDirty)}</GtkLabel>
            <GtkLabel name="choice-submitted">{submitted}</GtkLabel>
            <GtkButton
                label="Reset choice"
                onClicked={() => {
                    form.reset({ choice: "first" });
                }}
            />
            <GtkButton
                label="Set choice"
                onClicked={() => {
                    form.setValue("choice", "second", { shouldDirty: true });
                }}
            />
            <GtkButton
                label="Submit choice"
                onClicked={() => {
                    void submit();
                }}
            />
        </GtkBox>
    );
}

const expectChoice = (id: string, text: string, isDirty: boolean): void => {
    expect(screen.getByName("choice-value")).toHaveTextContent(id);
    expect(screen.getByRole(Gtk.AccessibleRole.COMBO_BOX)).toHaveDisplayValue(text);
    expect(screen.getByName("choice-dirty")).toHaveTextContent(String(isDirty));
};

describe.each<Source>(["items", "sections"])("form choice IDs with %s", (source) => {
    it("keeps an explicit default until choices arrive and submits user selection", async () => {
        const { rerender } = await render(<ChoiceForm source={source} hasChoices={false} />);
        expectChoice("second", "", false);
        await rerender(<ChoiceForm source={source} hasChoices />);
        expectChoice("second", "Second", false);
        await userEvent.selectOptions(screen.getByRole(Gtk.AccessibleRole.COMBO_BOX), 0);
        await waitFor(() => {
            expectChoice("first", "First", true);
        });
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit choice" }));
        expect(screen.getByName("choice-submitted")).toHaveTextContent("first");
    });

    it("preserves values and dirty state while choices reload and applies resets", async () => {
        const { rerender } = await render(<ChoiceForm source={source} hasChoices />);
        expectChoice("second", "Second", false);
        await rerender(<ChoiceForm source={source} hasChoices={false} />);
        expectChoice("second", "", false);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Reset choice" }));
        expectChoice("first", "", false);
        await rerender(<ChoiceForm source={source} hasChoices />);
        expectChoice("first", "First", false);
        await rerender(<ChoiceForm source={source} hasChoices={false} />);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Set choice" }));
        expectChoice("second", "", true);
        await rerender(<ChoiceForm source={source} hasChoices />);
        expectChoice("second", "Second", true);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit choice" }));
        expect(screen.getByName("choice-submitted")).toHaveTextContent("second");
    });
});
