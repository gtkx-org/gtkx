import type { ReactNode } from "react";
import { markupEscapeText } from "@gtkx/gi/glib";
import { AdwActionRow, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useSyncExternalStore } from "react";
import type { ActionStore } from "./actions.js";

const ActionsPanel = ({ store }: { store: ActionStore }): ReactNode => {
    const entries = useSyncExternalStore(store.subscribe, store.getSnapshot);

    return (
        <AdwPreferencesGroup
            title="Actions"
            description={entries.length === 0 ? "Interact with the story to record events." : ""}
            headerSuffix={<GtkButton label="Clear actions" sensitive={entries.length > 0} onClicked={store.clear} />}
        >
            {entries.toReversed().map((entry) => (
                <AdwActionRow
                    key={entry.id}
                    name={`storybook-action-${String(entry.id)}`}
                    title={markupEscapeText(entry.name, -1)}
                    subtitle={markupEscapeText(entry.error ?? entry.args.join(", "), -1)}
                    subtitleSelectable
                    subtitleLines={3}
                    cssClasses={entry.error === undefined ? [] : ["error"]}
                />
            ))}
        </AdwPreferencesGroup>
    );
};

export { ActionsPanel };
