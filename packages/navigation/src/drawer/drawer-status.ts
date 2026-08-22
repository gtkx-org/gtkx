import type { DrawerStatus, NavigationState } from "@react-navigation/core";

type DrawerHistoryEntry = { type: "drawer"; status: DrawerStatus };

const isDrawerEntry = (entry: unknown): entry is DrawerHistoryEntry =>
    typeof entry === "object" && entry !== null && "type" in entry && entry.type === "drawer";

const getDrawerStatus = (state: NavigationState): DrawerStatus => {
    const history: readonly unknown[] = state.history ?? [];
    const entry = history.findLast(isDrawerEntry);

    if (entry !== undefined) {
        return entry.status;
    }

    return "default" in state && state.default === "open" ? "open" : "closed";
};

export { getDrawerStatus };
