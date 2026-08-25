import type { RefObject } from "react";
import { ComboRow, EntryRow, FormProvider, PasswordEntryRow, SpinRow, SwitchRow, useForm } from "@gtkx/forms";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { createRef, type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";

type FormValues = {
    count: number;
    isEnabled: boolean;
    name: string;
    password: string;
    sort: string;
};

type FormRefs = {
    comboRef: RefObject<Adw.ComboRow | null>;
    entryRef: RefObject<Adw.EntryRow | null>;
    passwordRef: RefObject<Adw.PasswordEntryRow | null>;
    spinRef: RefObject<Adw.SpinRow | null>;
    switchRef: RefObject<Adw.SwitchRow | null>;
};

type FieldsProps = FormRefs & {
    entryChanged: (value: string) => void;
};

const SORT_ITEMS = [
    { id: "name", value: "By name" },
    { id: "date", value: "By date" },
];

const createFormRefs = (): FormRefs => ({
    comboRef: createRef<Adw.ComboRow>(),
    entryRef: createRef<Adw.EntryRow>(),
    passwordRef: createRef<Adw.PasswordEntryRow>(),
    spinRef: createRef<Adw.SpinRow>(),
    switchRef: createRef<Adw.SwitchRow>(),
});

const requireRef = <T,>(ref: RefObject<T | null>): T => {
    if (ref.current === null) {
        throw new Error("Expected the form row to be mounted");
    }

    return ref.current;
};

const Fields = ({ comboRef, entryChanged, entryRef, passwordRef, spinRef, switchRef }: FieldsProps): ReactNode => (
    <AdwPreferencesGroup title="Account">
        <EntryRow
            ref={entryRef}
            name="name"
            title="Name"
            onNotifyText={(value) => {
                entryChanged(value ?? "");
            }}
        />
        <PasswordEntryRow ref={passwordRef} name="password" title="Password" />
        <SwitchRow ref={switchRef} name="isEnabled" title="Enabled" />
        <SpinRow
            ref={spinRef}
            name="count"
            title="Count"
            adjustment={<GtkAdjustment lower={0} upper={10} stepIncrement={1} pageIncrement={1} />}
        />
        <ComboRow ref={comboRef} name="sort" title="Sort" items={SORT_ITEMS} />
    </AdwPreferencesGroup>
);

const HappyForm = (refs: FormRefs): ReactNode => {
    const form = useForm<FormValues>({
        defaultValues: { count: 1, isEnabled: false, name: "", password: "", sort: "name" },
    });

    const [entryText, setEntryText] = useState("");
    const [submitted, setSubmitted] = useState("Not submitted");

    const submit = form.handleSubmit((values) => {
        setSubmitted(
            `${values.name}|${values.password}|${String(values.isEnabled)}|${String(values.count)}|${values.sort}`,
        );
    });

    const handleSubmit = (): void => {
        void submit();
    };

    return (
        <FormProvider {...form}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <Fields {...refs} entryChanged={setEntryText} />
                <GtkButton label="Submit" onClicked={handleSubmit} />
                <GtkLabel name="native-entry-value">{entryText}</GtkLabel>
                <GtkLabel name="submitted-values">{submitted}</GtkLabel>
            </GtkBox>
        </FormProvider>
    );
};

describe("forms - happy path", () => {
    it("submits values edited through every Adwaita form row", async () => {
        const refs = createFormRefs();
        await render(<HappyForm {...refs} />);
        await userEvent.type(requireRef(refs.entryRef), "Ada");
        await userEvent.type(requireRef(refs.passwordRef), "secret");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.SWITCH, { checked: false, as: Gtk.Switch }));
        const spin = requireRef(refs.spinRef);
        await userEvent.clear(spin);
        await userEvent.type(spin, "7");

        await act(() => {
            spin.update();
        });

        await userEvent.selectOptions(requireRef(refs.comboRef), 1);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit" }));
        expect(await screen.findByName("submitted-values")).toHaveTextContent("Ada|secret|true|7|date");
        expect(screen.getByName("native-entry-value")).toHaveTextContent("Ada");
        expect(refs.entryRef.current).toBeInstanceOf(Adw.EntryRow);
        expect(refs.passwordRef.current).toBeInstanceOf(Adw.PasswordEntryRow);
        expect(refs.switchRef.current).toBeInstanceOf(Adw.SwitchRow);
        expect(refs.spinRef.current).toBeInstanceOf(Adw.SpinRow);
        expect(refs.comboRef.current).toBeInstanceOf(Adw.ComboRow);
    });
});
