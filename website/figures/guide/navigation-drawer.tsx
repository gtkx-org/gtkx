import { AdwStatusPage } from "@gtkx/jsx/adw";
import { createDrawerNavigator } from "@gtkx/navigation";

type AppParams = { Inbox: undefined; Settings: undefined };

const Drawer = createDrawerNavigator<AppParams>();

const Inbox = () => (
    <AdwStatusPage iconName="mail-unread-symbolic" title="No New Mail" />
);

const Settings = () => (
    <AdwStatusPage iconName="emblem-system-symbolic" title="Preferences" />
);

export const App = ({ isNarrow }: { isNarrow: boolean }) => (
    <Drawer.Navigator collapsed={isNarrow} sidebarPosition="start">
        <Drawer.Screen
            name="Inbox"
            component={Inbox}
            options={{ drawerIcon: "mail-unread-symbolic" }}
        />
        <Drawer.Screen
            name="Settings"
            component={Settings}
            options={{
                drawerLabel: "Preferences",
                drawerIcon: "emblem-system-symbolic",
            }}
        />
    </Drawer.Navigator>
);
