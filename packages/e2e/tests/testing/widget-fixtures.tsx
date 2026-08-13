import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkBox, GtkButton, GtkEntry, GtkLabel, GtkScale } from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { expect } from "vitest";

const FOREIGN_WINDOW_WIDTH = 120;
const FOREIGN_WINDOW_HEIGHT = 80;

const VBox = ({ children }: { children: ReactNode }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>{children}</GtkBox>
);

const foreignWindow = (): Gtk.Window =>
    new Gtk.Window({ defaultWidth: FOREIGN_WINDOW_WIDTH, defaultHeight: FOREIGN_WINDOW_HEIGHT });

const untilDestroyed = async (window: Gtk.Window, body: () => Promise<void>): Promise<void> => {
    try {
        await body();
    } finally {
        window.destroy();
    }
};

const withStolenActivation = async (body: () => Promise<void>): Promise<void> => {
    const stealer = foreignWindow();

    await untilDestroyed(stealer, async () => {
        stealer.present();

        await waitFor(() => {
            expect(stealer.isActive()).toBe(true);
        });

        await body();
    });
};

const withHostWindow = async (body: (host: Gtk.Window, content: Gtk.Box) => Promise<void>): Promise<void> => {
    const host = foreignWindow();
    const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    host.setChild(content);
    await untilDestroyed(host, () => body(host, content));
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
    renderButton,
    renderEntry,
    renderLabel,
    renderNamedBox,
    renderSlider,
    renderStyledButton,
    VBox,
    withHostWindow,
    withStolenActivation,
};
