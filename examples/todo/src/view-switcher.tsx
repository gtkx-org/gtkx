import { Align, Orientation } from "@gtkx/ffi/gtk";
import { Box, ToggleButton } from "@gtkx/react";
import type { Filter } from "./types.js";

type ViewSwitcherProps = {
    filter: Filter;
    onFilterChange: (filter: Filter) => void;
};

export const ViewSwitcher = ({ filter, onFilterChange }: ViewSwitcherProps) => {
    return (
        <Box orientation={Orientation.HORIZONTAL} spacing={0} cssClasses={["linked"]} halign={Align.CENTER}>
            <ToggleButton.Root
                label="All"
                active={filter === "all"}
                onToggled={() => onFilterChange("all")}
                name="filter-all"
            />
            <ToggleButton.Root
                label="Active"
                active={filter === "active"}
                onToggled={() => onFilterChange("active")}
                name="filter-active"
            />
            <ToggleButton.Root
                label="Completed"
                active={filter === "completed"}
                onToggled={() => onFilterChange("completed")}
                name="filter-completed"
            />
        </Box>
    );
};
