import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton } from "@gtkx/jsx/gtk";
import { type Mock, vi } from "vitest";
import { render, screen } from "../src/index.js";

/**
 * The result of rendering a clickable button: the mock attached to its
 * `clicked` signal and the rendered button widget located by accessible role.
 */
export interface RenderedClickButton {
    /** Mock bound to the button's `onClicked` handler. */
    handleClick: Mock;
    /** The rendered button, found by its accessible role and label. */
    button: Gtk.Widget;
}

/**
 * Renders a single labelled button wired to a `vi.fn()` click handler and
 * resolves it by its accessible role, returning both the mock and the widget
 * so event-dispatch tests can drive and assert against the same button.
 *
 * @param label - The button label, also used as the accessible name lookup.
 */
export async function renderClickButton(label = "Click me"): Promise<RenderedClickButton> {
    const handleClick = vi.fn();
    await render(<GtkButton label={label} onClicked={handleClick} />);

    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label });
    return { handleClick, button };
}
