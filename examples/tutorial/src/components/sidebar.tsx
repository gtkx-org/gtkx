import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkImage, GtkLabel, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { Category } from "../types.js";

const categories: Category[] = [
    { id: "all", title: "All Notes", icon: "document-edit-symbolic" },
    { id: "favorites", title: "Favorites", icon: "starred-symbolic" },
    { id: "recent", title: "Recent", icon: "document-open-recent-symbolic" },
    { id: "trash", title: "Trash", icon: "user-trash-symbolic" },
];

export const Sidebar = ({
    noteCounts,
    onCategoryChanged,
}: {
    noteCounts: Record<string, number>;
    onCategoryChanged: (id: string) => void;
}) => (
    <GtkScrolledWindow vexpand>
        <GtkListBox
            cssClasses={["navigation-sidebar"]}
            onRowSelected={(row) => {
                if (!row) return;
                const category = categories[row.getIndex()];
                if (category) onCategoryChanged(category.id);
            }}
        >
            {categories.map((cat) => (
                <AdwActionRow
                    key={cat.id}
                    title={cat.title}
                    prefix={<GtkImage iconName={cat.icon} />}
                    suffix={<GtkLabel label={String(noteCounts[cat.id] ?? 0)} cssClasses={["dim-label"]} />}
                />
            ))}
        </GtkListBox>
    </GtkScrolledWindow>
);
