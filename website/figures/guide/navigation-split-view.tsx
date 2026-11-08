import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwSidebar,
    AdwSidebarItem,
    AdwSidebarSection,
    AdwStatusPage,
} from "@gtkx/jsx/adw";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    createSplitViewNavigator,
    type SplitViewScreenProps,
} from "@gtkx/navigation";

type MailParams = {
    Folders: undefined;
    Messages: { folder: string };
    Message: { id: string };
};

const Split = createSplitViewNavigator<MailParams>();

const Folders = ({
    navigation,
}: SplitViewScreenProps<MailParams, "Folders">) => (
    <AdwSidebar
        onActivated={() => navigation.navigate("Messages", { folder: "Inbox" })}
    >
        <AdwSidebarSection>
            <AdwSidebarItem title="Inbox" />
        </AdwSidebarSection>
    </AdwSidebar>
);

const Messages = ({
    navigation,
}: SplitViewScreenProps<MailParams, "Messages">) => (
    <GtkButton
        label="Open message 1"
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        onClicked={() => navigation.navigate("Message", { id: "1" })}
    />
);

const Message = ({ route }: SplitViewScreenProps<MailParams, "Message">) => (
    <GtkLabel label={`Message ${route.params.id}`} />
);

export const Mail = () => (
    <Split.Navigator
        initialRouteName="Messages"
        collapseCondition="max-width: 500sp"
        minSidebarWidth={220}
        maxSidebarWidth={300}
        sidebarWidthFraction={0.25}
        contentPlaceholder={
            <AdwStatusPage
                iconName="mail-unread-symbolic"
                title="No Folder Selected"
                description="Pick a folder to read what is in it."
            />
        }
    >
        <Split.Screen
            name="Folders"
            component={Folders}
            options={{ title: "Mail" }}
        />
        <Split.Screen
            name="Messages"
            component={Messages}
            initialParams={{ folder: "Inbox" }}
            options={({ route }) => ({ title: route.params.folder })}
        />
        <Split.Screen
            name="Message"
            component={Message}
            options={{ headerEnd: <GtkButton label="Reply" /> }}
        />
    </Split.Navigator>
);
