import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    AdwDialog,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationView,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";

const OpenPageButton = ({ page }: { page: number }): ReactNode => (
    <GtkButton
        label={`Open Page ${page}`}
        canShrink
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        cssClasses={["pill"]}
        actionName="navigation.push"
        actionTarget={GLib.Variant.newString(`page-${page}`)}
    />
);

const NavigationViewDialog = ({ onClosed }: { onClosed: () => void }): ReactNode => (
    <AdwDialog
        title="AdwNavigationView Demo"
        widthRequest={360}
        contentWidth={360}
        contentHeight={360}
        onClosed={onClosed}
    >
        <AdwNavigationView>
            <AdwNavigationPage title="Page 1" tag="page-1">
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={18}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                    >
                        <OpenPageButton page={2} />
                        <OpenPageButton page={3} />
                    </GtkBox>
                </AdwToolbarView>
            </AdwNavigationPage>
            <AdwNavigationPage title="Page 2" tag="page-2">
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <OpenPageButton page={4} />
                </AdwToolbarView>
            </AdwNavigationPage>
            <AdwNavigationPage title="Page 3" tag="page-3">
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <GtkLabel
                        label="Page 3"
                        valign={Gtk.Align.CENTER}
                        ellipsize={Pango.EllipsizeMode.END}
                        cssClasses={["title-1"]}
                    />
                </AdwToolbarView>
            </AdwNavigationPage>
            <AdwNavigationPage title="Page 4" tag="page-4">
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <OpenPageButton page={3} />
                </AdwToolbarView>
            </AdwNavigationPage>
        </AdwNavigationView>
    </AdwDialog>
);

export const NavigationViewPage = (): ReactNode => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                <AdwStatusPage
                    iconName="widget-navigation-view-symbolic"
                    title="Navigation View"
                    description="A page-based navigation container"
                >
                    <GtkButton
                        label="Run the Demo"
                        halign={Gtk.Align.CENTER}
                        cssClasses={["pill"]}
                        onClicked={() => setOpen(true)}
                    />
                </AdwStatusPage>
            </AdwToolbarView>
            {open && <NavigationViewDialog onClosed={() => setOpen(false)} />}
        </>
    );
};
