import type { StackScreenProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import type { InboxParamList } from "./params.js";
import { findMessage } from "./messages.js";
import { Page } from "./page.js";

const MessageScreen = ({ route, navigation }: StackScreenProps<InboxParamList, "Message">): ReactNode => {
    const message = findMessage(route.params.id);

    return (
        <Page>
            <GtkLabel cssClasses={["title-2"]} halign={Gtk.Align.START} xalign={0} wrap>
                {message.subject}
            </GtkLabel>
            <GtkLabel cssClasses={["dim-label"]} halign={Gtk.Align.START}>
                {`From ${message.sender}`}
            </GtkLabel>
            <GtkLabel halign={Gtk.Align.START} xalign={0} wrap>
                {message.body}
            </GtkLabel>
            <GtkButton
                label="Reply"
                cssClasses={["suggested-action", "pill"]}
                halign={Gtk.Align.START}
                onClicked={() => {
                    navigation.navigate("Compose", { id: message.id });
                }}
            />
        </Page>
    );
};

export { MessageScreen };
