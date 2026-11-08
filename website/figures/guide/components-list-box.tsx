import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkListBox } from "@gtkx/jsx/gtk";
import { useState } from "react";

const views = [
    { id: "inbox", title: "Inbox" },
    { id: "today", title: "Today" },
    { id: "upcoming", title: "Upcoming" },
    { id: "done", title: "Done" },
];

export function Sidebar() {
    const [activeId, setActiveId] = useState("today");

    return (
        <GtkListBox
            cssClasses={["navigation-sidebar"]}
            selectedIndex={views.findIndex((view) => view.id === activeId)}
            onRowSelected={(row) => {
                if (!row) return;
                const view = views[row.getIndex()];
                if (view) setActiveId(view.id);
            }}
        >
            {views.map((view) => (
                <AdwActionRow key={view.id} title={view.title} />
            ))}
        </GtkListBox>
    );
}
