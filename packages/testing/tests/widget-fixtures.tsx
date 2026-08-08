import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkBox, GtkButton, GtkEntry, GtkLabel, GtkScale } from "@gtkx/jsx/gtk";
import { expect } from "vitest";
import { render, screen } from "../src/index.js";

const VBox = ({ children }: { children: ReactNode }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>{children}</GtkBox>
);

const expectRejection = (assert: () => void, message: RegExp): void => {
    expect(assert).toThrow(message);
};

const renderLabel = async (text: string, findAs = text): Promise<Gtk.Widget> => {
    await render(<GtkLabel>{text}</GtkLabel>);

    return screen.findByText(findAs);
};

const renderButton = async (label: string): Promise<Gtk.Widget> => {
    await render(<GtkButton label={label} />);

    return screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label });
};

const renderStyledButton = async (cssClasses: string[]): Promise<Gtk.Widget> => {
    await render(<GtkButton label="Styled" cssClasses={cssClasses} />);

    return screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Styled" });
};

const renderNamedBox = async (name: string): Promise<Gtk.Widget> => {
    await render(<GtkBox name={name} />);

    return screen.findByName(name);
};

const renderEntry = async (name: string, text?: string): Promise<Gtk.Entry> => {
    await render(<GtkEntry name={name} text={text} />);

    return screen.findByName(name, { as: Gtk.Entry });
};

const renderSlider = async (value: number, upper: number): Promise<Gtk.Scale> => {
    await render(<GtkScale adjustment={<GtkAdjustment value={value} lower={0} upper={upper} />} />);

    return screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
};

export {
    expectRejection,
    renderButton,
    renderEntry,
    renderLabel,
    renderNamedBox,
    renderSlider,
    renderStyledButton,
    VBox,
};
