import type { DrawerScreenProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import type { RootParamList } from "./params.js";
import { Page } from "./page.js";

const AboutScreen = ({ navigation }: DrawerScreenProps<RootParamList, "About">): ReactNode => (
    <Page>
        <GtkLabel cssClasses={["title-1"]} halign={Gtk.Align.START}>
            GTKX Navigation
        </GtkLabel>
        <GtkLabel halign={Gtk.Align.START} xalign={0} wrap>
            React Navigation routers and hooks rendered with libadwaita: the sidebar is an AdwOverlaySplitView drawer,
            Inbox is a stack on an AdwNavigationView and Settings is a set of tabs on an AdwViewStack.
        </GtkLabel>
        <GtkButton
            label="Open Inbox"
            halign={Gtk.Align.START}
            onClicked={() => {
                navigation.navigate("Inbox", { screen: "Messages" });
            }}
        />
    </Page>
);

export { AboutScreen };
