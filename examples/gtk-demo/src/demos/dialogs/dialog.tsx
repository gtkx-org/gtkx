import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, useApplication } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./dialog.tsx?raw";

const DialogDemo = () => {
    const [lastResponse, setLastResponse] = useState<string | null>(null);
    const [confirmResult, setConfirmResult] = useState<string | null>(null);
    const app = useApplication();

    const showSimpleDialog = async () => {
        const dialog = new Adw.AlertDialog("Simple Dialog", "This is a basic alert dialog with a single button.");
        dialog.addResponse("ok", "OK");
        dialog.setDefaultResponse("ok");
        dialog.setCloseResponse("ok");

        const response = await dialog.chooseAsync(app.getActiveWindow() ?? undefined);
        setLastResponse(response);
    };

    const showConfirmDialog = async () => {
        const dialog = new Adw.AlertDialog(
            "Confirm Action",
            "Are you sure you want to proceed with this action? This cannot be undone.",
        );
        dialog.addResponse("cancel", "Cancel");
        dialog.addResponse("confirm", "Confirm");
        dialog.setResponseAppearance("confirm", Adw.ResponseAppearance.SUGGESTED);
        dialog.setDefaultResponse("confirm");
        dialog.setCloseResponse("cancel");

        const response = await dialog.chooseAsync(app.getActiveWindow() ?? undefined);
        setConfirmResult(response === "confirm" ? "Confirmed" : "Cancelled");
    };

    const showDestructiveDialog = async () => {
        const dialog = new Adw.AlertDialog(
            "Delete Item?",
            "This will permanently delete the selected item. This action cannot be undone.",
        );
        dialog.addResponse("cancel", "Cancel");
        dialog.addResponse("delete", "Delete");
        dialog.setResponseAppearance("delete", Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.setDefaultResponse("cancel");
        dialog.setCloseResponse("cancel");

        const response = await dialog.chooseAsync(app.getActiveWindow() ?? undefined);
        setLastResponse(response === "delete" ? "Item deleted" : "Delete cancelled");
    };

    const showMultipleChoiceDialog = async () => {
        const dialog = new Adw.AlertDialog("Save Changes?", "You have unsaved changes. What would you like to do?");
        dialog.addResponse("discard", "Discard");
        dialog.addResponse("cancel", "Cancel");
        dialog.addResponse("save", "Save");
        dialog.setResponseAppearance("discard", Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.setResponseAppearance("save", Adw.ResponseAppearance.SUGGESTED);
        dialog.setDefaultResponse("save");
        dialog.setCloseResponse("cancel");

        const response = await dialog.chooseAsync(app.getActiveWindow() ?? undefined);
        const messages: Record<string, string> = {
            save: "Changes saved",
            discard: "Changes discarded",
            cancel: "Action cancelled",
        };
        setLastResponse(messages[response] ?? response);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Modal Dialogs" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="AdwAlertDialog provides a simple way to show modal dialogs with a heading, body text, and response buttons. Dialogs are presented using the async choose() method."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Simple Alert">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="A basic dialog with a single OK button."
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkButton
                        label="Show Simple Dialog"
                        onClicked={() => void showSimpleDialog()}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Confirmation Dialog">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="A dialog asking the user to confirm an action with Cancel and Confirm buttons."
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={12}>
                        <GtkButton label="Show Confirm Dialog" onClicked={() => void showConfirmDialog()} />
                        {confirmResult && <GtkLabel label={`Result: ${confirmResult}`} cssClasses={["dim-label"]} />}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Destructive Action">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="A dialog with a destructive action button (styled in red) for dangerous operations."
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkButton
                        label="Show Delete Dialog"
                        onClicked={() => void showDestructiveDialog()}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Multiple Choices">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="A dialog with three response options: Save, Discard, and Cancel."
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkButton
                        label="Show Save Changes Dialog"
                        onClicked={() => void showMultipleChoiceDialog()}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>

            {lastResponse && (
                <GtkLabel
                    label={`Last response: ${lastResponse}`}
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            )}
        </GtkBox>
    );
};

export const dialogDemo: Demo = {
    id: "dialog",
    title: "Dialog",
    description: "Modal dialogs with response buttons",
    keywords: ["dialog", "modal", "alert", "confirm", "message", "AdwAlertDialog", "response", "button"],
    component: DialogDemo,
    sourceCode,
};
