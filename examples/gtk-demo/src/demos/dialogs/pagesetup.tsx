import * as Gtk from "@gtkx/gi/gtk";
import { GtkPrintSettings } from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useParentWindow } from "@gtkx/react";
import { useEffect, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./pagesetup.tsx?raw";

const pageSetupDemo: Demo = {
    id: "pagesetup",
    title: "Printing/Page Setup",
    description: "GtkPageSetupUnixDialog can be used if page setup is needed independent of a full printing dialog.",
    keywords: ["GtkPageSetup"],
    component: PageSetupDemo,
    sourceCode,
    isDialogOnly: true,
};

function PageSetupDemo({ onClose }: DemoProps) {
    const parentWindow = useParentWindow();
    const [settings, setSettings] = useState<Gtk.PrintSettings | null>(null);

    useEffect(() => {
        if (parentWindow === null || settings === null) {
            return;
        }

        Gtk.printRunPageSetupDialogAsync(parentWindow, null, settings, () => {
            onClose?.();
        });
    }, [parentWindow, settings, onClose]);

    return createPortal(<GtkPrintSettings ref={setSettings} />, rootElement);
}

export { pageSetupDemo };
