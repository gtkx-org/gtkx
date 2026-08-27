import type * as Adw from "@gtkx/gi/adw";
import type { RefObject } from "react";
import {
    ComboRow,
    type Control,
    EntryRow,
    FormProvider,
    PasswordEntryRow,
    SpinRow,
    SwitchRow,
    useForm,
} from "@gtkx/forms";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
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

type ResetFieldsProps = FormRefs & { control: Control<FormValues> };

const SORT_ITEMS = [
    { id: "name", value: "By name" },
    { id: "date", value: "By date" },
];

const DEFAULT_VALUES: FormValues = { count: 0, isEnabled: false, name: "", password: "", sort: "name" };
const SET_VALUES: FormValues = { count: 4, isEnabled: true, name: "Grace", password: "compiler", sort: "date" };

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

const ResetFields = ({ comboRef, control, entryRef, passwordRef, spinRef, switchRef }: ResetFieldsProps) => (
    <AdwPreferencesGroup>
        <EntryRow ref={entryRef} control={control} name="name" title="Name" />
        <PasswordEntryRow ref={passwordRef} name="password" title="Password" />
        <SwitchRow ref={switchRef} name="isEnabled" title="Enabled" />
        <SpinRow
            ref={spinRef}
            name="count"
            title="Count"
            adjustment={<GtkAdjustment lower={0} upper={10} stepIncrement={1} pageIncrement={1} />}
        />
        <ComboRow
            ref={comboRef}
            control={control}
            name="sort"
            title="Sort"
            items={SORT_ITEMS}
            renderItem={({ item }) => <GtkLabel>{item.toUpperCase()}</GtkLabel>}
        />
    </AdwPreferencesGroup>
);

const ResetForm = (refs: FormRefs): ReactNode => {
    const form = useForm<FormValues>({ defaultValues: DEFAULT_VALUES });

    const applyValues = (): void => {
        form.setValue("count", SET_VALUES.count);
        form.setValue("isEnabled", SET_VALUES.isEnabled);
        form.setValue("name", SET_VALUES.name);
        form.setValue("password", SET_VALUES.password);
        form.setValue("sort", SET_VALUES.sort);
    };

    return (
        <FormProvider {...form}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <ResetFields {...refs} control={form.control} />
                <GtkButton label="Set values" onClicked={applyValues} />
                <GtkButton
                    label="Reset"
                    onClicked={() => {
                        form.reset();
                    }}
                />
            </GtkBox>
        </FormProvider>
    );
};

const ValidationForm = ({ entryRef }: { entryRef: RefObject<Adw.EntryRow | null> }): ReactNode => {
    const form = useForm<{ name: string }>({ defaultValues: { name: "" } });
    const [submitted, setSubmitted] = useState("Not submitted");

    const submit = form.handleSubmit(({ name }) => {
        setSubmitted(name);
    });

    const handleSubmit = (): void => {
        void submit();
    };

    return (
        <FormProvider {...form}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <AdwPreferencesGroup>
                    <EntryRow
                        ref={entryRef}
                        name="name"
                        title="Name"
                        cssClasses={["custom"]}
                        tooltipText="Original tooltip"
                        rules={{ required: "Name is required" }}
                    />
                </AdwPreferencesGroup>
                <GtkButton label="Submit" onClicked={handleSubmit} />
                <GtkLabel name="submitted-name">{submitted}</GtkLabel>
            </GtkBox>
        </FormProvider>
    );
};

const DisabledForm = ({ disabledRef }: { disabledRef: RefObject<Adw.EntryRow | null> }): ReactNode => {
    const form = useForm<{ disabled: string; insensitive: string }>({
        defaultValues: { disabled: "omit me", insensitive: "keep me" },
    });

    const [submitted, setSubmitted] = useState("Not submitted");

    const submit = form.handleSubmit((values) => {
        setSubmitted(JSON.stringify(values));
    });

    return (
        <FormProvider {...form}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <AdwPreferencesGroup>
                    <EntryRow ref={disabledRef} name="disabled" title="Disabled" disabled />
                    <EntryRow name="insensitive" title="Insensitive" sensitive={false} />
                </AdwPreferencesGroup>
                <GtkButton
                    label="Submit disabled"
                    onClicked={() => {
                        void submit();
                    }}
                />
                <GtkLabel name="disabled-values">{submitted}</GtkLabel>
            </GtkBox>
        </FormProvider>
    );
};

const BlurForm = ({ entryRef }: { entryRef: RefObject<Adw.EntryRow | null> }): ReactNode => {
    const form = useForm<{ name: string }>({ defaultValues: { name: "" }, mode: "onBlur" });

    return (
        <FormProvider {...form}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <AdwPreferencesGroup>
                    <EntryRow ref={entryRef} name="name" title="Name" rules={{ required: "Name is required" }} />
                </AdwPreferencesGroup>
                <GtkButton label="Leave field" />
                <GtkLabel name="touched-state">
                    {form.formState.touchedFields.name === true ? "Touched" : "Untouched"}
                </GtkLabel>
            </GtkBox>
        </FormProvider>
    );
};

describe("forms - edge cases (1)", () => {
    it("applies programmatic values and resets every row to falsy defaults", async () => {
        const refs = createFormRefs();
        await render(<ResetForm {...refs} />);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Set values" }));

        await waitFor(() => {
            expect(requireRef(refs.entryRef).getText()).toBe("Grace");
            expect(requireRef(refs.passwordRef).getText()).toBe("compiler");
            expect(requireRef(refs.switchRef)).toBeChecked();
            expect(requireRef(refs.spinRef).getValue()).toBe(4);
            expect(requireRef(refs.comboRef)).toHaveObjectProperty("selected", 1);
            expect(screen.getByText("BY DATE")).toBeVisible();
        });

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Reset" }));

        await waitFor(() => {
            expect(requireRef(refs.entryRef).getText()).toBe("");
            expect(requireRef(refs.passwordRef).getText()).toBe("");
            expect(requireRef(refs.switchRef)).not.toBeChecked();
            expect(requireRef(refs.spinRef).getValue()).toBe(0);
            expect(requireRef(refs.comboRef)).toHaveObjectProperty("selected", 0);
        });
    });

    it("focuses and marks an invalid row, then restores native presentation after correction", async () => {
        const entryRef = createRef<Adw.EntryRow>();
        await render(<ValidationForm entryRef={entryRef} />);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit" }));
        const entry = requireRef(entryRef);
        expect(entry).toHaveClass("custom", "error");
        expect(entry).toBeInvalid();
        expect(entry.getDelegate()?.isFocus()).toBe(true);
        expect(entry.getTooltipText()).toBe("Name is required");
        expect(screen.getByName("submitted-name")).toHaveTextContent("Not submitted");
        await userEvent.type(entry, "Ada");

        await waitFor(() => {
            expect(entry).toHaveClass("custom");
            expect(entry).not.toHaveClass("error");
            expect(entry).toBeValid();
            expect(entry.getTooltipText()).toBe("Original tooltip");
        });

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit" }));
        expect(await screen.findByName("submitted-name")).toHaveTextContent("Ada");
    });
});

describe("forms - edge cases (2)", () => {
    it("omits disabled fields while preserving insensitive field values", async () => {
        const disabledRef = createRef<Adw.EntryRow>();
        await render(<DisabledForm disabledRef={disabledRef} />);
        expect(requireRef(disabledRef)).toBeDisabled();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit disabled" }));
        expect(await screen.findByName("disabled-values")).toHaveTextContent('{"insensitive":"keep me"}');
    });

    it("marks a field touched and validates when focus leaves its native subtree", async () => {
        const entryRef = createRef<Adw.EntryRow>();
        await render(<BlurForm entryRef={entryRef} />);
        await userEvent.click(requireRef(entryRef));
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Leave field" }));

        await waitFor(() => {
            expect(screen.getByName("touched-state")).toHaveTextContent("Touched");
            expect(requireRef(entryRef)).toBeInvalid();
        });
    });
});
