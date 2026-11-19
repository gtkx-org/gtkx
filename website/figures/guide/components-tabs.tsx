import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwTabBar, AdwTabPage, AdwTabView } from "@gtkx/jsx/adw";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { useState } from "react";

export const Documents = () => {
    const [titles, setTitles] = useState(["Notes", "Ideas"]);
    const [view, setView] = useState<Adw.TabView | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <AdwTabBar view={view} />
            <AdwTabView
                ref={setView}
                vexpand
                onClosePage={(page, tabView) => {
                    setTitles((current) =>
                        current.filter((title) => title !== page.getTitle()),
                    );
                    tabView.closePageFinish(page, true);
                    return true;
                }}
            >
                {titles.map((title) => (
                    <AdwTabPage key={title} title={title}>
                        <GtkLabel>{title}</GtkLabel>
                    </AdwTabPage>
                ))}
            </AdwTabView>
        </GtkBox>
    );
};
