import type { Meta, StoryObj } from "@gtkx/storybook";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { Storybook, StoryCatalog } from "@gtkx/storybook/explorer";
import { render, screen, userEvent, within } from "@gtkx/testing";
import { useState } from "react";

type ControlValues = {
    text?: string;
    enabled?: boolean;
    quantity?: number;
    choice?: unknown;
};

type EventValues = {
    onEvent?: (...values: unknown[]) => unknown;
    onConfigured?: (...values: unknown[]) => unknown;
};

const ControlFixture = ({ text, enabled, quantity, choice }: ControlValues): ReactNode => {
    const [clicks, setClicks] = useState(0);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel name="inspector-text">{text ?? "unset"}</GtkLabel>
            <GtkLabel name="inspector-enabled">{enabled === undefined ? "unset" : String(enabled)}</GtkLabel>
            <GtkLabel name="inspector-quantity">{quantity === undefined ? "unset" : String(quantity)}</GtkLabel>
            <GtkLabel name="inspector-choice">{choice === undefined ? "unset" : JSON.stringify(choice)}</GtkLabel>
            <GtkLabel name="inspector-clicks">{String(clicks)}</GtkLabel>
            <GtkButton
                label="Increment local state"
                onClicked={() => {
                    setClicks((value) => value + 1);
                }}
            />
        </GtkBox>
    );
};

const controlMeta = {
    title: "Inspector",
    component: ControlFixture,
    args: { text: "Initial", enabled: false, quantity: 2, choice: "green" },
    argTypes: {
        text: { control: "text" },
        enabled: { control: "boolean" },
        quantity: { control: { type: "number", min: 0, max: 10, step: 1 } },
        choice: { control: "select", options: ["green", "blue", "red"] },
    },
} satisfies Meta<typeof ControlFixture>;

const controlStories = {
    default: controlMeta,
    Default: {},
    Alternate: { args: { text: "Alternate", enabled: true, quantity: 8, choice: "blue" } },
} satisfies {
    default: typeof controlMeta;
    Default: StoryObj<typeof controlMeta>;
    Alternate: StoryObj<typeof controlMeta>;
};

const EventFixture = ({ onEvent, onConfigured }: EventValues): ReactNode => {
    const [result, setResult] = useState("Ready");

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel name="inspector-result">{result}</GtkLabel>
            <GtkButton
                label="Trigger event"
                onClicked={(button) => {
                    const value = onEvent?.(button, "payload");

                    if (typeof value === "string") {
                        setResult(value);
                    }
                }}
            />
            <GtkButton
                label="Trigger configured event"
                onClicked={() => {
                    onConfigured?.("configured");
                }}
            />
            <GtkButton
                label="Send complex payload"
                onClicked={(button) => {
                    const circular: { self?: object } = {};
                    circular.self = circular;
                    onEvent?.(button, circular);
                }}
            />
            <GtkButton
                label="Send event burst"
                onClicked={(button) => {
                    for (let index = 0; index < 105; index++) {
                        onEvent?.(button, index);
                    }
                }}
            />
        </GtkBox>
    );
};

const showInspector = async (module: unknown) => {
    const catalog = new StoryCatalog();
    await catalog.load([{ id: "inspector.stories.tsx", title: "Inspector", load: () => Promise.resolve(module) }]);

    return render(<Storybook catalog={catalog} />, { container: rootElement });
};

const replaceControl = async (argument: string, value: string): Promise<void> => {
    const row = screen.getByName(`storybook-control-${argument}`);
    const control = argument === "quantity" ? within(row).getByRole(Gtk.AccessibleRole.SPIN_BUTTON) : row;
    await userEvent.clear(control);
    await userEvent.type(control, value);

    if (argument === "quantity") {
        await userEvent.keyboard(control, "{Enter}");
    }
};

export { ControlFixture, controlMeta, controlStories, EventFixture, replaceControl, showInspector };
