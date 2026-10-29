import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwActionRow,
    AdwClamp,
    AdwHeaderBar,
    AdwPreferencesGroup,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useRef, useState } from "react";
import { useDemo } from "../context.js";

export const ToastsPage = () => {
    const { toastOverlay, showToast, dismissToasts } = useDemo();
    const undo = useRef<{ toast: Adw.Toast; items: number } | null>(null);
    const [canDismiss, setCanDismiss] = useState(false);

    const showUndo = () => {
        if (undo.current !== null) {
            undo.current.items += 1;
            undo.current.toast.setTitle(`<span font_features='tnum=1'>${undo.current.items}</span> items deleted`);
            toastOverlay?.addToast(undo.current.toast);
            return;
        }

        const toast = showToast({
            title: "‘Lorem Ipsum’ deleted",
            priority: Adw.ToastPriority.HIGH,
            buttonLabel: "_Undo",
            onButtonClicked: () => {
                const items = undo.current?.items ?? 0;
                showToast({
                    title: `Undoing deleting <span font_features='tnum=1'>${items}</span> ${items === 1 ? "item" : "items"}…`,
                    priority: Adw.ToastPriority.HIGH,
                });
            },
            onDismissed: (dismissed) => {
                if (undo.current?.toast === dismissed) {
                    undo.current = null;
                    setCanDismiss(false);
                }
            },
        });
        undo.current = { toast, items: 1 };
        setCanDismiss(true);
    };

    return (
        <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
            <AdwStatusPage iconName="widget-toast-symbolic" title="Toasts" description="Transient in-app notifications">
                <AdwClamp maximumSize={400} tighteningThreshold={300}>
                    <AdwPreferencesGroup>
                        <AdwActionRow
                            title="Simple Toast"
                            suffix={
                                <GtkButton
                                    valign={Gtk.Align.CENTER}
                                    label="Show"
                                    onClicked={() => showToast({ title: "Simple Toast" })}
                                />
                            }
                        />
                        <AdwActionRow
                            title="Toast With an Action"
                            suffix={
                                <>
                                    <GtkButton
                                        valign={Gtk.Align.CENTER}
                                        iconName="user-trash-symbolic"
                                        accessibleLabel="Dismiss action toast"
                                        cssClasses={["flat"]}
                                        sensitive={canDismiss}
                                        onClicked={() => undo.current?.toast.dismiss()}
                                    />
                                    <GtkButton valign={Gtk.Align.CENTER} label="Show" onClicked={showUndo} />
                                </>
                            }
                        />
                        <AdwActionRow
                            title="Toast With a Long Title"
                            suffix={
                                <GtkButton
                                    valign={Gtk.Align.CENTER}
                                    label="Show"
                                    onClicked={() =>
                                        showToast({
                                            title: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magnam aliquam quaerat voluptatem.",
                                        })
                                    }
                                />
                            }
                        />
                        <AdwActionRow
                            title="Dismiss all Toasts"
                            suffix={<GtkButton valign={Gtk.Align.CENTER} label="Dismiss" onClicked={dismissToasts} />}
                        />
                    </AdwPreferencesGroup>
                </AdwClamp>
            </AdwStatusPage>
        </AdwToolbarView>
    );
};
