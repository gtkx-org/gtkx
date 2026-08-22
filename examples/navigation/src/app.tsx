import type { ReactNode } from "react";
import * as Gio from "@gtkx/gi/gio";
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { createDrawerNavigator, NavigationContainer } from "@gtkx/navigation";
import { quit } from "@gtkx/react";
import type { RootParamList } from "./screens/params.js";
import { AboutScreen } from "./screens/about.js";
import { InboxScreen } from "./screens/inbox.js";
import { SettingsScreen } from "./screens/settings.js";

type AppProps = {
    applicationId?: string;
};

const Drawer = createDrawerNavigator<RootParamList>();

const Shell = (): ReactNode => (
    <AdwApplicationWindow title="GTKX Navigation" defaultWidth={960} defaultHeight={640} onCloseRequest={quit}>
        <NavigationContainer>
            <Drawer.Navigator collapsed={false}>
                <Drawer.Screen
                    name="Inbox"
                    component={InboxScreen}
                    options={{ headerShown: false, drawerIcon: "mail-unread-symbolic" }}
                />
                <Drawer.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{ headerShown: false, drawerIcon: "emblem-system-symbolic" }}
                />
                <Drawer.Screen name="About" component={AboutScreen} options={{ drawerIcon: "help-about-symbolic" }} />
            </Drawer.Navigator>
        </NavigationContainer>
    </AdwApplicationWindow>
);

const App = ({ applicationId }: AppProps): ReactNode => (
    <AdwApplication applicationId={applicationId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
        <Shell />
    </AdwApplication>
);

export { App };
