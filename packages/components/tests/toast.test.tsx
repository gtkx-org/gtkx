import {
    type ToastController,
    type ToastOverlayController,
    ToastProvider,
    useToast,
    useToastOverlay,
} from "@gtkx/components";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwToastOverlay } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, renderHook, screen, waitFor } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject, useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";

type Handles = { toast: ToastController; overlay: ToastOverlayController };

const Probe = ({ onHandles }: { onHandles: (handles: Handles) => void }): ReactNode => {
    const toast = useToast();
    const overlay = useToastOverlay();

    useLayoutEffect(() => {
        onHandles({ toast, overlay });
    });

    return <GtkLabel>probe</GtkLabel>;
};

const renderToastHost = async (): Promise<{ handles: Handles; overlayRef: RefObject<Adw.ToastOverlay | null> }> => {
    const overlayRef = createRef<Adw.ToastOverlay>();
    const captured: { handles: Handles | null } = { handles: null };

    await render(
        <ToastProvider overlayRef={overlayRef}>
            <AdwToastOverlay ref={overlayRef}>
                <Probe
                    onHandles={(handles) => {
                        captured.handles = handles;
                    }}
                />
            </AdwToastOverlay>
        </ToastProvider>,
    );

    if (captured.handles === null) {
        throw new Error("probe did not capture the toast controllers");
    }

    return { handles: captured.handles, overlayRef };
};

describe("render - toast (useToast / useToastOverlay)", () => {
    it("shows a toast with the given options and returns it", async () => {
        const { handles } = await renderToastHost();

        const toast = handles.toast.show({
            title: "Moved to Trash",
            buttonLabel: "Undo",
            timeout: 3,
            priority: Adw.ToastPriority.HIGH,
            useMarkup: true,
        });

        expect(toast).toHaveObjectProperty("title", "Moved to Trash");
        expect(toast).toHaveObjectProperty("buttonLabel", "Undo");
        expect(toast).toHaveObjectProperty("timeout", 3);
        expect(toast).toHaveObjectProperty("priority", Adw.ToastPriority.HIGH);
        expect(toast).toHaveObjectProperty("useMarkup", true);
        await screen.findByText("Moved to Trash");
        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Undo" })).toBeEnabled();
    });

    it("invokes onButtonClicked when the toast button is activated", async () => {
        const { handles } = await renderToastHost();
        const onButtonClicked = vi.fn();
        const toast = handles.toast.show({ title: "Undoable", buttonLabel: "Undo", onButtonClicked });
        toast.emit("button-clicked");
        expect(onButtonClicked).toHaveBeenCalledTimes(1);
    });

    it("dismisses a single toast and reports it through onDismissed", async () => {
        const { handles } = await renderToastHost();
        const onDismissed = vi.fn();
        const toast = handles.toast.show({ title: "Bye", onDismissed });
        handles.toast.dismiss(toast);

        await waitFor(() => {
            expect(onDismissed).toHaveBeenCalledTimes(1);
        });
    });

    it("dismisses every toast through dismissAll", async () => {
        const { handles } = await renderToastHost();
        const onFirst = vi.fn();
        const onSecond = vi.fn();
        handles.toast.show({ title: "First", onDismissed: onFirst });
        handles.toast.show({ title: "Second", onDismissed: onSecond });
        handles.overlay.dismissAll();

        await waitFor(() => {
            expect(onFirst).toHaveBeenCalledTimes(1);
            expect(onSecond).toHaveBeenCalledTimes(1);
        });
    });

    it("throws when the hooks are used outside a ToastProvider", async () => {
        await expect(renderHook(() => useToast())).rejects.toThrow();
    });
});
