import { AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import { NotesSplitShell } from "../notes-split-shell.js";

export const Chapter6 = () => (
    <NotesSplitShell
        headerEndExtras={
            <AdwToggleGroup activeName="list">
                <AdwToggle name="list" iconName="view-list-symbolic" tooltip="List View" />
                <AdwToggle name="grid" iconName="view-grid-symbolic" tooltip="Grid View" />
            </AdwToggleGroup>
        }
    />
);
