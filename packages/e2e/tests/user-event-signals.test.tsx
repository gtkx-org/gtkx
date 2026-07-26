import * as Gtk from "@gtkx/gi/gtk";
import { GtkEntry, GtkSwitch } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";

describe("user event signals", () => {
    it("suppresses onChanged while a commit writes text, then delivers user edits", async () => {
        const handleChanged = vi.fn();
        const { rerender } = await render(<GtkEntry text="first" onChanged={handleChanged} />);
        await rerender(<GtkEntry text="second" onChanged={handleChanged} />);
        expect(handleChanged).not.toHaveBeenCalled();
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "!");

        await waitFor(() => {
            expect(handleChanged).toHaveBeenCalled();
        });
    });

    it("suppresses onNotify handlers while a commit writes the property, then delivers user changes", async () => {
        const handleNotifyActive = vi.fn();
        const { rerender } = await render(<GtkSwitch active={false} onNotifyActive={handleNotifyActive} />);
        await rerender(<GtkSwitch active onNotifyActive={handleNotifyActive} />);
        expect(handleNotifyActive).not.toHaveBeenCalled();
        const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
        await userEvent.click(switchWidget);

        await waitFor(() => {
            expect(handleNotifyActive).toHaveBeenCalledWith(false, expect.any(Gtk.Switch));
        });
    });

    it("delivers lifecycle signals emitted by the commit itself", async () => {
        const handleMap = vi.fn();
        const handleRealize = vi.fn();
        await render(<GtkEntry onMap={handleMap} onRealize={handleRealize} />);

        await waitFor(() => {
            expect(handleMap).toHaveBeenCalled();
            expect(handleRealize).toHaveBeenCalled();
        });
    });
});
