import type { DrawerNavigationProp, TabScreenProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createTabNavigator } from "@gtkx/navigation";
import type { RootParamList, SettingsParamList } from "./params.js";
import { AppearanceScreen } from "./appearance.js";
import { Page } from "./page.js";
import { SidebarToggle } from "./sidebar-toggle.js";

const Tabs = createTabNavigator<SettingsParamList>();

const GeneralScreen = ({ navigation }: TabScreenProps<SettingsParamList, "General">): ReactNode => (
    <Page>
        <GtkLabel cssClasses={["title-2"]} halign={Gtk.Align.START}>
            General
        </GtkLabel>
        <GtkLabel cssClasses={["dim-label"]} halign={Gtk.Align.START} xalign={0} wrap>
            Tabs are an AdwViewStack driven by the AdwViewSwitcher in the header bar. Each tab mounts the first time
            it is shown.
        </GtkLabel>
        <GtkButton
            label="About this app"
            halign={Gtk.Align.START}
            onClicked={() => {
                navigation.getParent<DrawerNavigationProp<RootParamList> | undefined>()?.navigate("About");
            }}
        />
    </Page>
);

const SettingsScreen = (): ReactNode => (
    <Tabs.Navigator screenOptions={{ headerStart: <SidebarToggle /> }}>
        <Tabs.Screen name="General" component={GeneralScreen} options={{ tabBarIcon: "emblem-system-symbolic" }} />
        <Tabs.Screen
            name="Appearance"
            component={AppearanceScreen}
            options={{ tabBarIcon: "preferences-color-symbolic" }}
        />
    </Tabs.Navigator>
);

export { SettingsScreen };
