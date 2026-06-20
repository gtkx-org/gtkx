import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton } from "@gtkx/jsx/gtk";
import { type Mock, vi } from "vitest";
import { render, screen } from "../src/index.js";

export interface RenderedClickButton {
    handleClick: Mock;
    button: Gtk.Widget;
}

export async function renderClickButton(label = "Click me"): Promise<RenderedClickButton> {
    const handleClick = vi.fn();
    await render(<GtkButton label={label} onClicked={handleClick} />);

    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label });
    return { handleClick, button };
}
