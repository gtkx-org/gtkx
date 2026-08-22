import type { NavigationAction, StackScreenProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkButton, GtkEntry, GtkLabel } from "@gtkx/jsx/gtk";
import { usePreventRemove } from "@gtkx/navigation";
import { useEffect, useState } from "react";
import type { InboxParamList } from "./params.js";
import { findMessage } from "./messages.js";
import { Page } from "./page.js";

type DiscardDialogProps = {
    onDiscard: () => void;
    onKeep: () => void;
};

const DiscardDialog = ({ onDiscard, onKeep }: DiscardDialogProps): ReactNode => (
    <AdwAlertDialog
        heading="Discard Reply?"
        body="Your reply has not been sent. Leaving this page discards it."
        defaultResponse="keep"
        closeResponse="keep"
        responses={[
            { id: "keep", label: "Keep Editing" },
            { id: "discard", label: "Discard", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
        ]}
        onResponse={(id) => {
            if (id === "discard") {
                onDiscard();
            } else {
                onKeep();
            }
        }}
    />
);

const ComposeScreen = ({ route, navigation }: StackScreenProps<InboxParamList, "Compose">): ReactNode => {
    const message = findMessage(route.params.id);
    const [draft, setDraft] = useState("");
    const [isSent, setIsSent] = useState(false);
    const [pendingAction, setPendingAction] = useState<NavigationAction | null>(null);
    const hasDraft = draft.length > 0 && !isSent;

    usePreventRemove(hasDraft, ({ data }) => {
        setPendingAction(data.action);
    });

    useEffect(() => {
        if (isSent) {
            navigation.goBack();
        }
    }, [isSent, navigation]);

    return (
        <Page>
            <GtkLabel cssClasses={["dim-label"]} halign={Gtk.Align.START}>
                {`Replying to ${message.sender}`}
            </GtkLabel>
            <GtkEntry
                placeholderText="Write your reply"
                onChanged={(entry) => {
                    setDraft(entry.getText());
                }}
            />
            <GtkButton
                label="Send"
                cssClasses={["suggested-action", "pill"]}
                halign={Gtk.Align.START}
                sensitive={hasDraft}
                onClicked={() => {
                    setIsSent(true);
                }}
            />
            {pendingAction !== null && (
                <DiscardDialog
                    onDiscard={() => {
                        navigation.dispatch(pendingAction);
                    }}
                    onKeep={() => {
                        setPendingAction(null);
                    }}
                />
            )}
        </Page>
    );
};

export { ComposeScreen };
