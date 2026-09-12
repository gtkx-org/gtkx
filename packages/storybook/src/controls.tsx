import type { ReactNode } from "react";
import { ComboRow } from "@gtkx/components";
import { markupEscapeText } from "@gtkx/gi/glib";
import { AdwActionRow, AdwEntryRow, AdwPreferencesGroup, AdwSpinRow, AdwSwitchRow } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import type { Args, ArgTypes } from "./types.js";

type ControlsProps = { argTypes: ArgTypes; args: Args; onChange: (update: Args) => void };

type ControlProps = {
    argument: string;
    title: string;
    value: unknown;
    type: string;
    settings: Args;
    options: unknown;
    isDisabled: boolean;
    onChange: (update: Args) => void;
};

const isObject = (value: unknown): value is Args =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const isWithinBoundsOrAbsent = (value: unknown, min: number, max: number): boolean =>
    value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);

const controlTitle = (name: unknown, argument: string): string => typeof name === "string" ? name : argument;

const numberDigits = (step: number): number => {
    const [coefficient = "", exponent = "0"] = String(step).split("e", 2);
    const fraction = coefficient.split(".", 2)[1]?.length ?? 0;
    const digits = Math.max(0, fraction - Number(exponent));

    return Math.min(20, digits);
};

const UnsupportedControl = ({ title, description }: { title: string; description: string }): ReactNode => (
    <AdwActionRow title={markupEscapeText(title, -1)} subtitle={markupEscapeText(description, -1)} sensitive={false} />
);

const NumberControl = ({
    argument,
    title,
    value,
    settings,
    isDisabled,
    onChange,
}: Omit<ControlProps, "type" | "options">): ReactNode => {
    const min = settings.min ?? -Number.MAX_SAFE_INTEGER;
    const max = settings.max ?? Number.MAX_SAFE_INTEGER;
    const step = settings.step ?? 1;

    if (
        typeof min !== "number" || typeof max !== "number" || typeof step !== "number" ||
        !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) ||
        step <= 0 || min > max || !isWithinBoundsOrAbsent(value, min, max)
    ) {
        return <UnsupportedControl title={title} description="Provide a finite number and valid bounds." />;
    }

    const currentValue = typeof value === "number" ? value : Math.max(min, Math.min(0, max));

    return (
        <AdwSpinRow
            name={`storybook-control-${argument}`}
            title={markupEscapeText(title, -1)}
            sensitive={!isDisabled}
            value={currentValue}
            digits={numberDigits(step)}
            numeric
            widthChars={8}
            adjustment={(
                <GtkAdjustment
                    lower={min}
                    upper={max}
                    stepIncrement={step}
                    pageIncrement={Math.min(Number.MAX_VALUE, step * 10)}
                    value={currentValue}
                />
            )}
            onNotifyValue={(next) => {
                if (
                    typeof next === "number" && Number.isFinite(next) &&
                    next >= min && next <= max && !Object.is(next, value)
                ) {
                    onChange({ [argument]: next });
                }
            }}
        />
    );
};

const SelectControl = (props: Omit<ControlProps, "type">): ReactNode => {
    const { argument, title, value, options, settings, isDisabled, onChange } = props;
    if (!Array.isArray(options) || options.length === 0 || options.some((option: unknown) =>
        option !== null && typeof option !== "string" && typeof option !== "number" && typeof option !== "boolean")) {
        return <UnsupportedControl title={title} description="Provide a list of text, number, or boolean options." />;
    }

    const values: unknown[] = options;
    const selected = values.findIndex((option) => Object.is(option, value));
    const labels = isObject(settings.labels) ? settings.labels : {};
    const items = values.map((option, index) => {
        const label = labels[String(option)];

        return { id: String(index), value: typeof label === "string" ? label : String(option) };
    });

    return (
        <ComboRow
            name={`storybook-control-${argument}`}
            title={markupEscapeText(title, -1)}
            sensitive={!isDisabled}
            items={items}
            selectedId={selected === -1 ? null : String(selected)}
            onSelectionChanged={(id) => {
                const index = Number(id);

                if (Number.isSafeInteger(index) && index >= 0 && index < values.length) {
                    onChange({ [argument]: values[index] });
                }
            }}
        />
    );
};

const Control = (props: ControlProps): ReactNode => {
    const { argument, title, value, type, isDisabled, onChange } = props;

    switch (type) {
        case "boolean": {
            return (
                <AdwSwitchRow
                    name={`storybook-control-${argument}`}
                    title={markupEscapeText(title, -1)}
                    sensitive={!isDisabled}
                    active={value === true}
                    onNotifyActive={(active) => {
                        if (typeof active === "boolean" && !Object.is(active, value)) {
                            onChange({ [argument]: active });
                        }
                    }}
                />
            );
        }
        case "text": {
            return (
                <AdwEntryRow
                    name={`storybook-control-${argument}`}
                    title={markupEscapeText(title, -1)}
                    sensitive={!isDisabled}
                    text={typeof value === "string" ? value : ""}
                    onNotifyText={(text) => {
                        if (typeof text === "string" && !Object.is(text, value)) {
                            onChange({ [argument]: text });
                        }
                    }}
                />
            );
        }
        case "number":
        case "range": {
            return <NumberControl {...props} />;
        }
        case "select":
        case "radio":
        case "inline-radio": {
            return <SelectControl {...props} />;
        }
        default: {
            return <UnsupportedControl title={title} description={`Unsupported control: ${type}`} />;
        }
    }
};

const Controls = ({ argTypes, args, onChange }: ControlsProps): ReactNode => (
    <AdwPreferencesGroup title="Controls">
        {Object.entries(argTypes).map(([argument, annotation]) => {
            const control: unknown = annotation?.control;
            const table: unknown = annotation?.table;

            if (control === undefined || control === false || (isObject(table) && table.disable === true)) {
                return null;
            }

            const settings = isObject(control) ? control : {};
            const type = typeof control === "string" ? control : settings.type;

            return (
                <Control
                    key={argument}
                    argument={argument}
                    title={controlTitle(annotation?.name, argument)}
                    value={args[argument]}
                    type={typeof type === "string" ? type : "unknown"}
                    settings={settings}
                    options={annotation?.options}
                    isDisabled={settings.disable === true}
                    onChange={onChange}
                />
            );
        })}
    </AdwPreferencesGroup>
);

export { Controls };
