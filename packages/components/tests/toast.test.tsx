import { type ToastController, ToastProvider, useToast } from "@gtkx/components";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwToastOverlay } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, renderHook, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type ReactNode, useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";

const Probe = ({ onController }: { onController: (controller: ToastController) => void }): ReactNode => {
    const controller = useToast();

    useLayoutEffect(() => {
        onController(controller);
    });

    return <GtkLabel>probe</GtkLabel>;
};

const renderToastHost = async (): Promise<ToastController> => {
    const overlayRef = createRef<Adw.ToastOverlay>();
    const captured: { controller: ToastController | null } = { controller: null };

    await render(
        <ToastProvider overlayRef={overlayRef}>
            <AdwToastOverlay ref={overlayRef}>
                <Probe
                    onController={(controller) => {
                        captured.controller = controller;
                    }}
                />
            </AdwToastOverlay>
        </ToastProvider>,
    );

    if (captured.controller === null) {
        throw new Error("probe did not capture the toast controller");
    }

    return captured.controller;
};

describe("render - toast", () => {
    it("shows a toast with the given options and returns it", async () => {
        const controller = await renderToastHost();

        const toast = controller.show({
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
        const controller = await renderToastHost();
        let clickCount = 0;
        const onButtonClicked = (): void => {
            clickCount += 1;
        };
        controller.show({ title: "Undoable", buttonLabel: "Undo", onButtonClicked });
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Undo" }));
        expect(clickCount).toBe(1);
    });

    it("dismisses a single toast and reports it through onDismissed", async () => {
        const controller = await renderToastHost();
        let dismissCount = 0;
        const onDismissed = (): void => {
            dismissCount += 1;
        };
        const toast = controller.show({ title: "Bye", onDismissed });
        toast.dismiss();

        await waitFor(() => {
            expect(dismissCount).toBe(1);
        });
    });

    it("dismisses every toast through dismissAll", async () => {
        const controller = await renderToastHost();
        let firstCount = 0;
        let secondCount = 0;
        const onFirst = (): void => {
            firstCount += 1;
        };
        const onSecond = (): void => {
            secondCount += 1;
        };
        controller.show({ title: "First", onDismissed: onFirst });
        controller.show({ title: "Second", onDismissed: onSecond });
        controller.dismissAll();

        await waitFor(() => {
            expect(firstCount).toBe(1);
            expect(secondCount).toBe(1);
        });
    });

    it("returns an unattached toast and permits dismissal without a mounted overlay", async () => {
        const overlayRef = createRef<Adw.ToastOverlay>();
        const { result } = await renderHook(() => useToast(), {
            wrapper: ({ children }) => <ToastProvider overlayRef={overlayRef}>{children}</ToastProvider>,
        });

        const toast = result.current.show({ title: "Unattached" });
        expect(toast).toHaveObjectProperty("title", "Unattached");
        expect(screen.queryByText("Unattached")).toBeNull();
        result.current.dismissAll();
    });

    it("throws when useToast is used outside a ToastProvider", async () => {
        await expect(renderHook(() => useToast())).rejects.toThrow();
    });
});
