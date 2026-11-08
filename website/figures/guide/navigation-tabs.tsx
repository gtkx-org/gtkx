import { AdwStatusPage } from "@gtkx/jsx/adw";
import { createTabNavigator } from "@gtkx/navigation";

type MailParams = { Inbox: undefined; Archive: undefined };

const Tabs = createTabNavigator<MailParams>();

const Inbox = () => (
    <AdwStatusPage iconName="mail-unread-symbolic" title="Inbox" />
);

const Archive = () => (
    <AdwStatusPage iconName="folder-symbolic" title="Archive" />
);

export const Mail = ({ unread }: { unread: number }) => (
    <Tabs.Navigator
        tabBarPosition="bottom"
        screenOptions={{ animation: "fade" }}
    >
        <Tabs.Screen
            name="Inbox"
            component={Inbox}
            options={{
                tabBarIcon: "mail-unread-symbolic",
                tabBarBadge: unread,
                needsAttention: unread > 0,
            }}
        />
        <Tabs.Screen
            name="Archive"
            component={Archive}
            options={{
                tabBarLabel: "Archived",
                tabBarIcon: "folder-symbolic",
                lazy: false,
            }}
        />
    </Tabs.Navigator>
);
