import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { useParentWindow } from "@gtkx/react";
import { useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import { PrintOperation } from "./print-operation.js";
import sourceCode from "./print-operation.tsx?raw";

const printingDemo: Demo = {
    id: "printing",
    title: "Printing/Printing",
    description: "GtkPrintOperation offers a simple API to support printing in a cross-platform way.",
    keywords: [],
    component: PrintingDemo,
    sourceCode,
    isDialogOnly: true,
};

const operationError = (operation: Gtk.PrintOperation): string => {
    try {
        operation.getError();
    } catch (error) {
        return String(error);
    }

    return "Printing failed";
};

function PrintingDemo({ onClose }: DemoProps) {
    const parentWindow = useParentWindow();
    const [error, setError] = useState<string | null>(null);

    return (
        <>
            {parentWindow !== null && (
                <PrintOperation
                    source={sourceCode}
                    action={Gtk.PrintOperationAction.PRINT_DIALOG}
                    parent={parentWindow}
                    onError={(failure) => {
                        setError(String(failure));
                    }}
                    onDone={(result, current) => {
                        if (result === Gtk.PrintOperationResult.ERROR) {
                            setError(operationError(current));
                        } else {
                            onClose?.();
                        }
                    }}
                />
            )}
            {error !== null && (
                <AdwAlertDialog
                    heading={error}
                    responses={[{ id: "ok", label: "_OK" }]}
                    defaultResponse="ok"
                    closeResponse="ok"
                    onClosed={onClose}
                />
            )}
        </>
    );
}

export { printingDemo };
