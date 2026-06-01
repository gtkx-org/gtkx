import * as Gtk from "@gtkx/gi/gtk";
import { useEffect } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./pagesetup.tsx?raw";

const PageSetupDemo = ({ window, onClose }: DemoProps) => {
    useEffect(() => {
        const parent = window.current;
        if (!parent) return;

        const settings = new Gtk.PrintSettings();
        Gtk.printRunPageSetupDialogAsync(parent, null, settings, () => {
            onClose?.();
        });
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
