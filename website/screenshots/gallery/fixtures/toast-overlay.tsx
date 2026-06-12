import * as Adw from "@gtkx/gi/adw";
import { AdwToastOverlay } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { useEffect, useRef } from "react";

export const Demo = () => {
    const overlayRef = useRef<Adw.ToastOverlay | null>(null);

    useEffect(() => {
        const toast = Adw.Toast.new("Note moved to Trash");
        toast.buttonLabel = "Undo";
        overlayRef.current?.addToast(toast);
    }, []);

    return (
        <AdwToastOverlay ref={overlayRef}>
            <GtkLabel label="Application content" vexpand cssClasses={["dim-label", "title-3"]} />
        </AdwToastOverlay>
    );
};
