import * as Gtk from "@gtkx/gi/gtk";
import { GtkCheckButton, GtkEntry, GtkSwitch } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";

const portalTarget = new Gtk.Box();
const handlePortalToggled = vi.fn();

const PortalHost = ({ isActive }: { isActive: boolean }) =>
    createPortal(<GtkCheckButton active={isActive} onToggled={handlePortalToggled} />, portalTarget);

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

    it("suppresses a blockable signal inside a portal while the owning root commits", async () => {
        const { rerender } = await render(<PortalHost isActive={false} />);
        handlePortalToggled.mockClear();
        await rerender(<PortalHost isActive />);
        expect(handlePortalToggled).not.toHaveBeenCalled();
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
