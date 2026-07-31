import * as Gtk from "@gtkx/gi/gtk";
import { useParentWindow } from "@gtkx/react";
import { useEffect } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./pagesetup.tsx?raw";

const pageSetupDemo: Demo = {
    id: "pagesetup",
    title: "Printing/Page Setup",
    description: "GtkPageSetupUnixDialog can be used if page setup is needed independent of a full printing dialog.",
    keywords: ["GtkPageSetup"],
    component: PageSetupDemo,
    sourceCode,
    dialogOnly: true,
};

function PageSetupDemo({ onClose }: DemoProps) {
    const parentWindow = useParentWindow();

    useEffect(() => {
        const settings = new Gtk.PrintSettings();

        Gtk.printRunPageSetupDialogAsync(parentWindow, null, settings, () => {
            onClose?.();
        });
    }, [parentWindow, onClose]);

    return null;
}

export { pageSetupDemo };
