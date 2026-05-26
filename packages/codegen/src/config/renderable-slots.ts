/**
 * Slots that represent renderable child content (typed as ReactNode).
 *
 * Slot props NOT in this map stay as raw GTK widget types (for widget
 * references like group, stack, view, keyCaptureWidget, etc.).
 *
 * Keys are JSX names (e.g., "GtkWindow"), values are camelCase slot prop names.
 */
const BUILTIN_RENDERABLE_SLOTS: Readonly<Record<string, readonly string[]>> = {
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
};

const EMPTY: ReadonlySet<string> = new Set();

/**
 * User-supplied renderable slot overrides keyed by JSX element name and
 * mapped to the camelCase property names that should be exposed as JSX
 * child slots.
 */
export type SlotPropsOverrides = Readonly<Record<string, readonly string[]>>;

/**
 * Resolved lookup over the built-in renderable slot map plus any user
 * overrides. Generators query this instead of calling a module-level
 * function so consumer-provided JSX elements can opt their widget-typed
 * properties into the slot-mounting pipeline.
 */
export class RenderableSlotsRegistry {
    private readonly lookup: ReadonlyMap<string, ReadonlySet<string>>;

    constructor(overrides: SlotPropsOverrides = {}) {
        const merged = new Map<string, Set<string>>();
        for (const [jsxName, slots] of Object.entries(BUILTIN_RENDERABLE_SLOTS)) {
            merged.set(jsxName, new Set(slots));
        }
        for (const [jsxName, slots] of Object.entries(overrides)) {
            const existing = merged.get(jsxName) ?? new Set<string>();
            for (const slot of slots) existing.add(slot);
            merged.set(jsxName, existing);
        }
        this.lookup = merged;
    }

    get(jsxName: string): ReadonlySet<string> {
        return this.lookup.get(jsxName) ?? EMPTY;
    }
}
