import type { StackScreenProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkLabel, GtkListBox } from "@gtkx/jsx/gtk";
import { createStackNavigator } from "@gtkx/navigation";
import type { InboxParamList } from "./params.js";
import { ComposeScreen } from "./compose.js";
import { MessageScreen } from "./message.js";
import { MESSAGES } from "./messages.js";
import { Page } from "./page.js";
import { SidebarToggle } from "./sidebar-toggle.js";

const Stack = createStackNavigator<InboxParamList>();

const MessagesScreen = ({ navigation }: StackScreenProps<InboxParamList, "Messages">): ReactNode => (
    <Page>
        <GtkLabel cssClasses={["dim-label"]} halign={Gtk.Align.START} wrap>
            Activating a row pushes the message onto an AdwNavigationView with its id as a route param.
        </GtkLabel>
        <GtkListBox cssClasses={["boxed-list"]} selectionMode={Gtk.SelectionMode.NONE}>
            {MESSAGES.map((message) => (
                <AdwActionRow
                    key={message.id}
                    title={message.subject}
                    subtitle={message.sender}
                    activatable
                    onActivated={() => {
                        navigation.navigate("Message", { id: message.id });
                    }}
                />
            ))}
        </GtkListBox>
    </Page>
);

const InboxScreen = (): ReactNode => (
    <Stack.Navigator>
        <Stack.Screen
            name="Messages"
            component={MessagesScreen}
            options={{ title: "Inbox", headerStart: <SidebarToggle /> }}
        />
        <Stack.Screen name="Message" component={MessageScreen} options={{ title: "Message" }} />
        <Stack.Screen name="Compose" component={ComposeScreen} options={{ title: "Reply" }} />
    </Stack.Navigator>
);

export { InboxScreen };
