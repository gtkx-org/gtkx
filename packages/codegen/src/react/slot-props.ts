/**
 * Built-in widget-typed properties that should be exposed as JSX child
 * slots (typed as `ReactNode`) rather than as raw widget refs.
 *
 * The keys are JSX element names (i.e. GLib type names such as
 * `"AdwWindow"`, `"GtkHeaderBar"`); the values are the camelCase property
 * names that should be promoted. User-supplied `slotProps` from
 * `gtkx.config.ts` merge into this map.
 */
const BUILT_IN_SLOT_PROPS: Readonly<Record<string, readonly string[]>> = Object.freeze({
    GtkWindow: ["titlebar"],
    AdwWindow: ["content"],
    AdwApplicationWindow: ["content"],
    AdwAlertDialog: ["extraChild"],
    AdwBottomSheet: ["bottomBar", "content", "sheet"],
    GtkCenterBox: ["centerWidget", "endWidget", "startWidget"],
    GtkExpander: ["labelWidget"],
    AdwFlap: ["content", "flap", "separator"],
    GtkFrame: ["labelWidget"],
    GtkHeaderBar: ["titleWidget"],
    AdwHeaderBar: ["titleWidget"],
    GtkMenuButton: ["popover"],
    AdwMessageDialog: ["extraChild"],
    AdwNavigationSplitView: ["content", "sidebar"],
    AdwOverlaySplitView: ["content", "sidebar"],
    GtkPaned: ["endChild", "startChild"],
    AdwPreferencesGroup: ["headerSuffix"],
    AdwPreferencesPage: ["banner"],
    AdwSplitButton: ["popover"],
    AdwTabBar: ["endActionWidget", "startActionWidget"],
    AdwToolbarView: ["content"],
});

/**
 * Merges built-in slot props with the user-supplied `slotProps` map.
 *
 * Per JSX element name, the resulting list is the union of both sources
 * with duplicates removed and a stable alphabetical sort.
 *
 * @param userSlotProps - The user-provided `slotProps` map, or `undefined`
 */
export const mergeSlotProps = (
    userSlotProps: Readonly<Record<string, readonly string[]>> | undefined,
): Readonly<Record<string, readonly string[]>> => {
    const result: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(BUILT_IN_SLOT_PROPS)) {
        result[key] = [...values];
    }
    if (userSlotProps !== undefined) {
        for (const [key, values] of Object.entries(userSlotProps)) {
            const merged = new Set<string>(result[key] ?? []);
            for (const value of values) merged.add(value);
            result[key] = [...merged].sort((a, b) => a.localeCompare(b));
        }
    }
    return result;
};
