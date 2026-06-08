/**
 * Built-in slot maps and the merge helper shared by the React codegen
 * pipeline. Both maps are keyed by JSX element name (i.e. GLib type name such
 * as `"AdwWindow"`, `"GtkHeaderBar"`) with camelCase string values:
 *
 * - **Widget slots** ({@link mergeWidgetSlots}) — widget-typed *properties*
 *   surfaced as `ReactNode` children with setter semantics (the value replaces
 *   the slot's single child), rendered as `<Slot>`. Users extend them through
 *   `widgetSlots` in `gtkx.config.ts`.
 * - **Container slots** ({@link mergeContainerSlots}) — camelCase *method*
 *   names that append a child onto the widget (e.g. `packStart`), rendered as
 *   `<ContainerSlot>` and dispatched by the reconciler as
 *   `parent[method](child)`. Users extend them through `containerSlots` in
 *   `gtkx.config.ts`.
 *
 * Alongside the slot maps, {@link mergeArrayProps} owns the array-prop surface:
 * per JSX element name, a map of camelCase prop name to the item-type name the
 * generated `Props` interface declares as `prop?: ItemType[] | null;`. Unlike
 * the slot maps its values are objects rather than string arrays, so each
 * user-supplied prop object is spread over the built-in one. The runtime
 * add/remove/clear behavior lives in `@gtkx/react`'s `ARRAY_PROPS`, keyed by the
 * same element and prop names. Users extend it through `arrayProps` in
 * `gtkx.config.ts`.
 */

/**
 * Built-in widget-typed properties that should be exposed as JSX child slots
 * (typed as `ReactNode`, setter semantics) rather than as raw widget refs.
 * The values are the camelCase property names that should be promoted.
 * User-supplied `widgetSlots` from `gtkx.config.ts` merge into this map.
 */
const BUILT_IN_WIDGET_SLOTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
    GtkWindow: ["titlebar"],
    AdwWindow: ["content"],
    AdwApplicationWindow: ["content"],
    AdwAlertDialog: ["extraChild"],
    AdwBottomSheet: ["bottomBar", "content", "sheet"],
    GtkCenterBox: ["centerWidget", "endWidget", "startWidget"],
    GtkColumnViewColumn: ["headerMenu"],
    GtkExpander: ["labelWidget"],
    AdwFlap: ["content", "flap", "separator"],
    GtkFrame: ["labelWidget"],
    GtkHeaderBar: ["titleWidget"],
    AdwHeaderBar: ["titleWidget"],
    GtkMenuButton: ["menuModel", "popover"],
    AdwMessageDialog: ["extraChild"],
    AdwNavigationSplitView: ["content", "sidebar"],
    AdwOverlaySplitView: ["content", "sidebar"],
    GtkPaned: ["endChild", "startChild"],
    GtkPopoverMenu: ["menuModel"],
    GtkPopoverMenuBar: ["menuModel"],
    AdwPreferencesGroup: ["headerSuffix"],
    AdwPreferencesPage: ["banner"],
    AdwSplitButton: ["popover"],
    AdwTabBar: ["endActionWidget", "startActionWidget"],
    AdwToolbarView: ["content"],
});

/**
 * Built-in container-slot method names — the camelCase GTK methods that append
 * a child onto the widget. Each method name doubles as a `ReactNode` prop on
 * the compound and as the `<ContainerSlot id="…">` identifier the reconciler
 * dispatches to. For example `packStart` on `AdwHeaderBar` maps to
 * `adw_header_bar_pack_start(…)`; `<AdwHeaderBar packStart={…} />` packs the
 * value at the start.
 *
 * Unlike widget slots, a container slot accepts multiple children and appends
 * rather than replaces. User-supplied `containerSlots` from `gtkx.config.ts`
 * merge into this map.
 */
const BUILT_IN_CONTAINER_SLOTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
    AdwActionRow: ["addPrefix", "addSuffix"],
    AdwEntryRow: ["addPrefix", "addSuffix"],
    AdwExpanderRow: ["addPrefix", "addSuffix", "addRow", "addAction"],
    AdwHeaderBar: ["packStart", "packEnd"],
    AdwToolbarView: ["addTopBar", "addBottomBar"],
    GtkActionBar: ["packStart", "packEnd"],
    GtkHeaderBar: ["packStart", "packEnd"],
});

/**
 * Merges a built-in slot map with a user-supplied override map.
 *
 * Per JSX element name, an overridden entry becomes the union of both sources
 * with duplicates removed and a stable alphabetical sort; entries the user does
 * not touch keep their built-in declaration order.
 *
 * @param builtIn - The built-in slot map
 * @param userSlots - The user-provided override map, or `undefined`
 */
const mergeSlotMap = (
    builtIn: Readonly<Record<string, readonly string[]>>,
    userSlots: Readonly<Record<string, readonly string[]>> | undefined,
): Readonly<Record<string, readonly string[]>> => {
    const result: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(builtIn)) {
        result[key] = [...values];
    }
    if (userSlots !== undefined) {
        for (const [key, values] of Object.entries(userSlots)) {
            const merged = new Set<string>(result[key] ?? []);
            for (const value of values) merged.add(value);
            result[key] = [...merged].sort((a, b) => a.localeCompare(b));
        }
    }
    return result;
};

/**
 * Merges the built-in widget slots with the user-supplied `widgetSlots` map.
 *
 * @param userWidgetSlots - The user-provided `widgetSlots` map, or `undefined`
 */
export const mergeWidgetSlots = (
    userWidgetSlots: Readonly<Record<string, readonly string[]>> | undefined,
): Readonly<Record<string, readonly string[]>> => mergeSlotMap(BUILT_IN_WIDGET_SLOTS, userWidgetSlots);

/**
 * Merges the built-in container slots with the user-supplied `containerSlots`
 * map.
 *
 * @param userContainerSlots - The user-provided `containerSlots` map, or
 * `undefined`
 */
export const mergeContainerSlots = (
    userContainerSlots: Readonly<Record<string, readonly string[]>> | undefined,
): Readonly<Record<string, readonly string[]>> => mergeSlotMap(BUILT_IN_CONTAINER_SLOTS, userContainerSlots);

/**
 * Built-in array props keyed by JSX element name, then by camelCase prop name,
 * with the item-type name the generated `Props` interface declares for that
 * prop (an exported member of `@gtkx/react`). Each entry's runtime
 * add/remove/clear behavior lives in `@gtkx/react`'s `ARRAY_PROPS`, keyed by the
 * same element and prop names. User-supplied `arrayProps` from `gtkx.config.ts`
 * merge into this map.
 */
const BUILT_IN_ARRAY_PROPS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
    GtkScale: { marks: "ScaleMark" },
    GtkLevelBar: { offsets: "LevelBarOffset" },
    GtkCalendar: { markedDays: "CalendarMark" },
    AdwToggleGroup: { toggles: "ToggleProps" },
    AdwAlertDialog: { responses: "AlertDialogResponseProps" },
    GtkDropTarget: { types: "DropTargetType" },
    GtkAboutDialog: { creditSections: "CreditSection" },
});

/**
 * Merges the built-in array props with the user-supplied `arrayProps` map.
 *
 * Per JSX element name, the user's prop-to-item-type object is spread over the
 * built-in one, so user entries add new props or override an existing prop's
 * item type; elements the user does not touch keep their built-in object.
 *
 * @param userArrayProps - The user-provided `arrayProps` map, or `undefined`
 */
export const mergeArrayProps = (
    userArrayProps: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined,
): Readonly<Record<string, Readonly<Record<string, string>>>> => {
    const result: Record<string, Record<string, string>> = {};
    for (const [key, props] of Object.entries(BUILT_IN_ARRAY_PROPS)) {
        result[key] = { ...props };
    }
    if (userArrayProps !== undefined) {
        for (const [key, props] of Object.entries(userArrayProps)) {
            result[key] = { ...result[key], ...props };
        }
    }
    return result;
};
