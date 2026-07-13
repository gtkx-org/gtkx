import { AlertDialog, Dialog } from "@gtkx/components/adw";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkEntry, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useState } from "react";
import { listDot } from "../styles.js";

const PALETTE = ["#3584e4", "#2ec27e", "#e66100", "#9141ac", "#e01b24", "#f5c211"];

export const NewListDialog = ({
    onAdd,
    onCancel,
}: {
    onAdd: (name: string, color: string) => void;
    onCancel: () => void;
}) => {
    const [name, setName] = useState("");
    const [color, setColor] = useState(PALETTE[0]);

    return (
        <Dialog>
            <AlertDialog
                heading="New List"
                defaultResponse="add"
                closeResponse="cancel"
                onResponse={(id) => {
                    if (id === "add") onAdd(name, color);
                    else onCancel();
                }}
            >
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16} marginTop={8}>
                    <GtkEntry placeholderText="List name" activatesDefault onChanged={(self) => setName(self.text)} />
                    <GtkBox spacing={6} halign={Gtk.Align.CENTER}>
                        {PALETTE.map((swatch) => (
                            <GtkToggleButton
                                key={swatch}
                                active={color === swatch}
                                cssClasses={["flat"]}
                                accessibleLabel={`Color ${swatch}`}
                                onClicked={() => setColor(swatch)}
                            >
                                <GtkBox
                                    widthRequest={22}
                                    heightRequest={22}
                                    cssClasses={[listDot(swatch)]}
                                    accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                                />
                            </GtkToggleButton>
                        ))}
                    </GtkBox>
                </GtkBox>
                <AlertDialog.Response id="cancel" label="Cancel" />
                <AlertDialog.Response id="add" label="Add" appearance={Adw.ResponseAppearance.SUGGESTED} />
            </AlertDialog>
        </Dialog>
    );
};
