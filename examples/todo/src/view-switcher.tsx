import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkToggleButton } from "@gtkx/react";
import type { Filter } from "./types.js";

type ViewSwitcherProps = {
    filter: Filter;
    onFilterChange: (filter: Filter) => void;
};

export const ViewSwitcher = ({ filter, onFilterChange }: ViewSwitcherProps) => {
    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={0} cssClasses={["linked"]} halign={Gtk.Align.CENTER}>
            <GtkToggleButton.Root
                label="All"
                active={filter === "all"}
                onToggled={() => onFilterChange("all")}
                name="filter-all"
            />
            <GtkToggleButton.Root
                label="Active"
                active={filter === "active"}
                onToggled={() => onFilterChange("active")}
                name="filter-active"
            />
            <GtkToggleButton.Root
                label="Completed"
                active={filter === "completed"}
                onToggled={() => onFilterChange("completed")}
                name="filter-completed"
            />
        </GtkBox>
    );
};
