import {
    type ToastController,
    type ToastOverlayController,
    ToastProvider,
    useToast,
    useToastOverlay,
} from "@gtkx/components/adw";
import * as Adw from "@gtkx/gi/adw";
import { AdwToastOverlay } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, renderHook, screen, waitFor } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

type Handles = { toast: ToastController; overlay: ToastOverlayController };

const Probe = ({ handles }: { handles: { current: Handles | null } }): ReactNode => {
    handles.current = { toast: useToast(), overlay: useToastOverlay() };
    return <GtkLabel>probe</GtkLabel>;
};

const renderToastHost = async (): Promise<{ handles: Handles; overlayRef: RefObject<Adw.ToastOverlay | null> }> => {
    const overlayRef = createRef<Adw.ToastOverlay>();
    const handles: { current: Handles | null } = { current: null };

    await render(
        <ToastProvider overlayRef={overlayRef}>
            <AdwToastOverlay ref={overlayRef}>
                <Probe handles={handles} />
            </AdwToastOverlay>
        </ToastProvider>,
    );

    if (handles.current === null) throw new Error("probe did not capture the toast controllers");
    return { handles: handles.current, overlayRef };
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

        expect(toast.title).toBe("Moved to Trash");
        expect(toast.buttonLabel).toBe("Undo");
        expect(toast.timeout).toBe(3);
        expect(toast.priority).toBe(Adw.ToastPriority.HIGH);
        expect(toast.useMarkup).toBe(true);
        expect(await screen.findByText("Moved to Trash")).toBeDefined();
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

        await waitFor(() => expect(onDismissed).toHaveBeenCalledTimes(1));
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
        await expect(renderHook(() => useToast())).rejects.toThrow(/must be used within a ToastProvider/);
    });
});
