import { AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import { useState } from "react";

export const Demo = () => {
    const [view, setView] = useState("list");

    return (
        <AdwToggleGroup activeName={view} onNotifyActiveName={(name) => setView(name ?? "list")}>
            <AdwToggle name="list" iconName="view-list-symbolic" tooltip="List View" />
            <AdwToggle name="grid" iconName="view-grid-symbolic" tooltip="Grid View" />
            <AdwToggle name="columns" iconName="view-columns-symbolic" tooltip="Column View" />
        </AdwToggleGroup>
    );
};
