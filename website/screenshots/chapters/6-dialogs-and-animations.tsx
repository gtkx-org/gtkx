import { AdwToggleGroup } from "@gtkx/react";
import { NotesSplitShell } from "../notes-split-shell";

export const Chapter6 = () => (
    <NotesSplitShell
        headerEndExtras={
            <AdwToggleGroup
                toggles={[
                    { id: "list", iconName: "view-list-symbolic" },
                    { id: "grid", iconName: "view-grid-symbolic" },
                ]}
            />
        }
    />
);
