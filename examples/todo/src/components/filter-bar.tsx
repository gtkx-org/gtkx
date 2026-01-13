import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkToggleButton } from "@gtkx/react";
import type { Filter } from "../types.js";

interface FilterBarProps {
    filter: Filter;
    onFilterChange: (filter: Filter) => void;
}

export const FilterBar = ({ filter, onFilterChange }: FilterBarProps) => {
    return (
        <GtkBox halign={Gtk.Align.CENTER} cssClasses={["linked"]}>
            <GtkToggleButton
                label="All"
                active={filter === "all"}
                onToggled={() => onFilterChange("all")}
                name="filter-all"
            />
            <GtkToggleButton
                label="Active"
                active={filter === "active"}
                onToggled={() => onFilterChange("active")}
                name="filter-active"
            />
            <GtkToggleButton
                label="Completed"
                active={filter === "completed"}
                onToggled={() => onFilterChange("completed")}
                name="filter-completed"
            />
        </GtkBox>
    );
};
