import * as Gtk from "@gtkx/gi/gtk";
import { AdwDialog, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";

type ConfirmationProps = {
    onDiscard?: () => void;
};

type ConfirmationDialogProps = {
    onCancel: () => void;
    onConfirm: () => void;
};

const ConfirmationDialog = ({ onCancel, onConfirm }: ConfirmationDialogProps): ReactNode => (
    <AdwDialog title="Discard draft?" contentWidth={360} onClosed={onCancel}>
        <AdwToolbarView topBar={<AdwHeaderBar />}>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={12}
                marginTop={12}
                marginBottom={24}
                marginStart={24}
                marginEnd={24}
            >
                <GtkLabel label="The unsaved draft will be removed." wrap />
                <GtkButton label="Keep draft" onClicked={onCancel} />
                <GtkButton label="Discard" cssClasses={["destructive-action"]} onClicked={onConfirm} />
            </GtkBox>
        </AdwToolbarView>
    </AdwDialog>
);

const Confirmation = ({ onDiscard }: ConfirmationProps): ReactNode => {
    const [isOpen, setIsOpen] = useState(false);
    const [isDiscarded, setIsDiscarded] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkLabel label={isDiscarded ? "Draft discarded" : "An unsaved draft is ready"} />
            <GtkButton
                label="Discard draft"
                halign={Gtk.Align.CENTER}
                onClicked={() => {
                    setIsOpen(true);
                }}
            />
            {isOpen && (
                <ConfirmationDialog
                    onCancel={() => {
                        setIsOpen(false);
                    }}
                    onConfirm={() => {
                        onDiscard?.();
                        setIsDiscarded(true);
                        setIsOpen(false);
                    }}
                />
            )}
        </GtkBox>
    );
};

export { Confirmation };
