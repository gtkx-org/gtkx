import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, useApplication } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const DialogDemo = () => {
    const app = useApplication();
    const [result, setResult] = useState<string | null>(null);

    const showAlertDialog = async () => {
        const dialog = new Gtk.AlertDialog();
        dialog.setMessage("Confirm Action");
        dialog.setDetail("Are you sure you want to proceed with this action?");
        dialog.setButtons(["Cancel", "OK"]);
        dialog.setCancelButton(0);
        dialog.setDefaultButton(1);

        try {
            const response = await dialog.choose(app.getActiveWindow() ?? undefined);
            setResult(response === 1 ? "Confirmed" : "Cancelled");
        } catch {
            setResult("Dismissed");
        }
    };

    const showDestructiveDialog = async () => {
        const dialog = new Gtk.AlertDialog();
        dialog.setMessage("Delete Item?");
        dialog.setDetail("This action cannot be undone. The item will be permanently deleted.");
        dialog.setButtons(["Cancel", "Delete"]);
        dialog.setCancelButton(0);
        dialog.setDefaultButton(0);

        try {
            const response = await dialog.choose(app.getActiveWindow() ?? undefined);
            setResult(response === 1 ? "Deleted" : "Cancelled");
        } catch {
            setResult("Dismissed");
        }
    };

    const showInfoDialog = async () => {
        const dialog = new Gtk.AlertDialog();
        dialog.setMessage("Information");
        dialog.setDetail("This is an informational message to the user.");
        dialog.setButtons(["OK"]);
        dialog.setDefaultButton(0);

        try {
            await dialog.choose(app.getActiveWindow() ?? undefined);
            setResult("Acknowledged");
        } catch {
            setResult("Dismissed");
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Dialogs" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Alert Dialogs" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="AlertDialog provides a simple way to show messages and get user confirmation."
                    wrap
                    cssClasses={["dim-label"]}
                />

                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkButton label="Confirmation" onClicked={showAlertDialog} />
                    <GtkButton
                        label="Destructive"
                        cssClasses={["destructive-action"]}
                        onClicked={showDestructiveDialog}
                    />
                    <GtkButton label="Information" onClicked={showInfoDialog} />
                </GtkBox>

                {result && <GtkLabel label={`Last result: ${result}`} cssClasses={["dim-label"]} />}
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="How It Works" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Use AlertDialog.dialogNew(message) to create the dialog, then configure with setDetail(), setButtons(), etc. Call dialog.choose() and await the response index."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const dialogDemo: Demo = {
    id: "dialog",
    title: "Dialog",
    description: "Modal dialogs for user interaction and confirmations.",
    keywords: ["dialog", "alert", "modal", "confirm", "GtkAlertDialog"],
    component: DialogDemo,
    sourcePath: getSourcePath(import.meta.url, "dialog.tsx"),
};
