import { ToastProvider, useToast } from "@gtkx/components";
import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwToastOverlay } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useRef } from "react";

const NotifyButton = () => {
    const toast = useToast();

    return (
        <GtkButton
            label="Show notification"
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            onClicked={() =>
                toast.show({ title: "Task saved", useMarkup: false })
            }
        />
    );
};

export const Notifications = () => {
    const overlayRef = useRef<Adw.ToastOverlay | null>(null);

    return (
        <ToastProvider overlayRef={overlayRef}>
            <AdwToastOverlay ref={overlayRef}>
                <NotifyButton />
            </AdwToastOverlay>
        </ToastProvider>
    );
};
