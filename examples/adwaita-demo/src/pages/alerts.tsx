import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog, AdwHeaderBar, AdwStatusPage, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useRef, useState } from "react";
import { useDemo } from "../context.js";

export const AlertsPage = () => {
    const { showToast } = useDemo();
    const lastToast = useRef<Adw.Toast | null>(null);
    const [open, setOpen] = useState(false);

    return (
        <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
            <AdwStatusPage iconName="widget-dialog-symbolic" title="Alert Dialog" description="Adaptive alert dialog">
                <GtkButton
                    label="Alert Dialog"
                    halign={Gtk.Align.CENTER}
                    cssClasses={["pill"]}
                    onClicked={() => setOpen(true)}
                />
            </AdwStatusPage>
            {open && (
                <AdwAlertDialog
                    heading="Save Changes?"
                    body="Open document contains unsaved changes. Changes which are not saved will be permanently lost."
                    responses={[
                        { id: "cancel", label: "_Cancel" },
                        { id: "discard", label: "_Discard", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
                        { id: "save", label: "_Save", appearance: Adw.ResponseAppearance.SUGGESTED },
                    ]}
                    defaultResponse="save"
                    closeResponse="cancel"
                    onClosed={() => setOpen(false)}
                    onResponse={(value) => {
                        setOpen(false);
                        lastToast.current?.dismiss();
                        lastToast.current = showToast({
                            title: `Dialog response: ${value}`,
                            onDismissed: (toast) => {
                                if (lastToast.current === toast) lastToast.current = null;
                            },
                        });
                    }}
                />
            )}
        </AdwToolbarView>
    );
};
