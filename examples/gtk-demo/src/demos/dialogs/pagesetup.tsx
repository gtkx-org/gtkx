import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { useEffect } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./pagesetup.tsx?raw";

const PageSetupDemo = ({ window, onClose }: DemoProps) => {
    useEffect(() => {
        const parent = window.current;
        if (!parent) return;

        const dialog = Gtk.PrintDialog.new();
        dialog.setTitle("Page Setup");
        const cancellable = new Gio.Cancellable();

        dialog
            .setup(parent, cancellable)
            .catch(() => undefined)
            .finally(() => onClose?.());

        return () => {
            cancellable.cancel();
        };
    }, [window, onClose]);

    return null;
};

export const pageSetupDemo: Demo = {
    id: "pagesetup",
    title: "Printing/Page Setup",
    description: "GtkPageSetupUnixDialog can be used if page setup is needed independent of a full printing dialog.",
    keywords: ["GtkPageSetup"],
    component: PageSetupDemo,
    sourceCode,
    dialogOnly: true,
};
