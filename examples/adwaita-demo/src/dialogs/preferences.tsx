import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwActionRow,
    AdwBanner,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwPreferencesDialog,
    AdwPreferencesGroup,
    AdwPreferencesPage,
    AdwPreferencesRow,
    AdwShortcutLabel,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkButton, GtkImage, GtkLabel } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { useState } from "react";

const PreferencesDialog = ({ onClose }: { onClose: () => void }) => {
    const [dialog, setDialog] = useState<Adw.PreferencesDialog | null>(null);
    const [first, setFirst] = useState<Adw.NavigationPage | null>(null);
    const [second, setSecond] = useState<Adw.NavigationPage | null>(null);
    const push = (page: Adw.NavigationPage | null) => {
        if (dialog && page) {
            dialog.pushSubpage(page);
        }
    };
    return (
        <>
            <AdwPreferencesDialog ref={setDialog} contentHeight={1000} searchEnabled onClosed={onClose}>
                <AdwPreferencesPage
                    title="L_ayout"
                    useUnderline
                    iconName="preferences-window-layout-symbolic"
                    description="Preferences pages can have a description"
                    banner={<AdwBanner title="Preferences pages can have a banner" revealed />}
                >
                    <AdwPreferencesGroup
                        title="Pages"
                        description="Preferences are organized in pages, this example has the following pages:"
                    >
                        <AdwActionRow title="L_ayout" useUnderline />
                        <AdwActionRow title="S_earch" useUnderline />
                    </AdwPreferencesGroup>
                    <AdwPreferencesGroup
                        title="Groups"
                        description="Preferences are grouped together, a group can have a title and a description. Descriptions will be wrapped if they are too long. This page has the following groups:"
                    >
                        {["An Untitled Group", "Pages", "Groups", "Preferences"].map((title) => (
                            <AdwActionRow key={title} title={title} />
                        ))}
                    </AdwPreferencesGroup>
                    <AdwPreferencesGroup title="Preferences">
                        <AdwActionRow title="Preferences rows are appended to the list box" />
                        <GtkLabel
                            label="Other widgets are appended after the list box"
                            marginTop={12}
                            marginBottom={12}
                            xalign={0}
                            cssClasses={["dimmed"]}
                        />
                    </AdwPreferencesGroup>
                    <AdwPreferencesGroup title="Toasts">
                        <AdwActionRow
                            title="Show a Toast"
                            suffix={
                                <>
                                    <GtkButton
                                        label="Show"
                                        valign={Gtk.Align.CENTER}
                                        onClicked={() => dialog?.addToast(Adw.Toast.new("Example Toast"))}
                                    />
                                </>
                            }
                        />
                    </AdwPreferencesGroup>
                    <AdwPreferencesGroup title="Subpages" description="Preferences dialogs can have subpages">
                        <AdwActionRow
                            title="Open Subpage"
                            activatable
                            onActivated={() => push(first)}
                            suffix={
                                <>
                                    <GtkImage iconName="go-next-symbolic" />
                                </>
                            }
                        />
                        <AdwActionRow
                            title="Open Another Subpage"
                            activatable
                            onActivated={() => push(second)}
                            suffix={
                                <>
                                    <GtkImage iconName="go-next-symbolic" />
                                </>
                            }
                        />
                    </AdwPreferencesGroup>
                </AdwPreferencesPage>
                <AdwPreferencesPage title="_Search" useUnderline iconName="preferences-window-search-symbolic">
                    <AdwPreferencesGroup
                        title="Searching"
                        description="Preferences can be searched, do so using one of the following ways:"
                    >
                        <AdwActionRow title="Activate the Search Button" />
                        <AdwPreferencesRow title="Ctrl + F">
                            <AdwShortcutLabel
                                accelerator="<Control>f"
                                marginTop={12}
                                marginBottom={12}
                                marginStart={12}
                                marginEnd={12}
                            />
                        </AdwPreferencesRow>
                        <AdwActionRow title="Directly Type Your Search" />
                    </AdwPreferencesGroup>
                </AdwPreferencesPage>
            </AdwPreferencesDialog>
            {createPortal(
                <>
                    <AdwNavigationPage ref={setFirst} title="Subpage">
                        <AdwToolbarView top={<AdwHeaderBar />}>
                            <AdwStatusPage title="This Is a Subpage">
                                <GtkButton
                                    label="Open Another Subpage"
                                    canShrink
                                    halign={Gtk.Align.CENTER}
                                    cssClasses={["pill"]}
                                    onClicked={() => push(second)}
                                />
                            </AdwStatusPage>
                        </AdwToolbarView>
                    </AdwNavigationPage>
                    <AdwNavigationPage ref={setSecond} title="Another Subpage">
                        <AdwToolbarView top={<AdwHeaderBar />}>
                            <AdwStatusPage title="This Is Another Subpage" />
                        </AdwToolbarView>
                    </AdwNavigationPage>
                </>,
                rootElement,
            )}
        </>
    );
};

export { PreferencesDialog };
