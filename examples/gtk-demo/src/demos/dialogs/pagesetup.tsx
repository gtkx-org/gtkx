import * as Gtk from "@gtkx/ffi/gtk";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./pagesetup.tsx?raw";

const PageSetupDemo = ({ window, onClose }: DemoProps) => {
    const dialogRef = useRef<Gtk.PageSetupUnixDialog | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const showDialog = useCallback(() => {
        if (dialogRef.current) {
            if (dialogRef.current.getVisible()) {
                dialogRef.current.destroy();
                dialogRef.current = null;
            } else {
                dialogRef.current.setVisible(true);
            }
            return;
        }

        const dialog = new Gtk.PageSetupUnixDialog("Page Setup", window.current);
        dialogRef.current = dialog;

        dialog.connect("response", () => {
            dialog.destroy();
            dialogRef.current = null;
            onCloseRef.current?.();
        });

        dialog.setVisible(true);
    }, [window]);

    useLayoutEffect(() => {
        showDialog();
        return () => {
            if (dialogRef.current) {
                dialogRef.current.destroy();
                dialogRef.current = null;
            }
        };
    }, [showDialog]);

    return null;
};

export const pageSetupDemo: Demo = {
    id: "pagesetup",
    title: "Printing/Page Setup",
    description: "GtkPageSetupUnixDialog can be used if page setup is needed independent of a full printing dialog.",
    keywords: ["page", "setup", "paper", "size", "orientation", "GtkPageSetup", "GtkPageSetupUnixDialog", "print"],
    component: PageSetupDemo,
    sourceCode,
    dialogOnly: true,
};
