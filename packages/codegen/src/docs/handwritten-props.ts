type HandwrittenProp = {
    name: string;
    type: string;
    doc: string;
};

const CHILDREN_PROP: HandwrittenProp = {
    name: "children",
    type: "ReactNode",
    doc: "Elements attached to the element's default child slot, or its text for elements that hold text.",
};

const HANDWRITTEN_PROPS: Record<string, HandwrittenProp[]> = {
    ChildrenProps: [CHILDREN_PROP],
    ActionGroupProps: [
        {
            name: "prefix",
            type: "string | null",
            doc: "Prefix the group's actions are addressed by, such as `win`; defaults to the empty string.",
        },
    ],
    ActionMapProps: [
        {
            name: "actions",
            type: "ReactNode | null",
            doc: "`Gio.Action` elements added to the map, removed again by their `name`.",
        },
    ],
    MenuProps: [
        {
            name: "items",
            type: "MenuItem[] | null",
            doc: "Entries the menu is rebuilt from whenever they change.",
        },
    ],
    GtkAboutDialogProps: [
        {
            name: "creditSections",
            type: "CreditSection[] | null",
            doc:
                "Extra sections appended to the dialog's credits. GTK offers no way to remove one, so the " +
                "list cannot change once it has been applied.",
        },
    ],
    GtkApplicationProps: [
        {
            name: "actionAccels",
            type: "ActionAccel[] | null",
            doc: "Accelerators bound to the application's actions.",
        },
        {
            name: "mainOptions",
            type: "MainOption[] | null",
            doc:
                "Command-line options the application parses, registered before it starts. GLib offers no " +
                "way to unregister one, so the list cannot change once it has been applied.",
        },
        CHILDREN_PROP,
    ],
    GtkCalendarProps: [
        {
            name: "markedDays",
            type: "number[] | null",
            doc: "Days of the shown month drawn as marked, cleared and re-marked whenever the list changes.",
        },
    ],
    GtkConstraintLayoutProps: [
        {
            name: "constraints",
            type: "ReactNode | null",
            doc: "`Gtk.Constraint` elements added to the layout.",
        },
        {
            name: "guides",
            type: "ReactNode | null",
            doc: "`Gtk.ConstraintGuide` elements added to the layout as invisible spacers.",
        },
        {
            name: "vfl",
            type: "VflConstraints[] | null",
            doc: "Visual Format Language blocks whose constraints are added alongside `constraints`.",
        },
    ],
    GtkDragSourceProps: [
        {
            name: "icon",
            type: "DragSourceIcon | null",
            doc: "Icon shown under the pointer while a drag started from this source is in flight.",
        },
    ],
    GtkDrawingAreaProps: [
        {
            name: "drawFunc",
            type: "Gtk.DrawingAreaDrawFunc | null",
            doc: "Callback that draws the area's contents; setting it queues a redraw.",
        },
    ],
    GtkDropTargetProps: [
        {
            name: "types",
            type: "GObject.Type[] | null",
            doc: "GTypes the target accepts a drop of.",
        },
    ],
    GtkHeaderBarProps: [
        { name: "start", type: "ReactNode | null", doc: "Widgets packed at the start of the bar." },
        { name: "end", type: "ReactNode | null", doc: "Widgets packed at the end of the bar." },
    ],
    GtkLevelBarProps: [
        {
            name: "offsets",
            type: "LevelBarOffset[] | null",
            doc: "Offsets that split the bar's range into differently styled intervals.",
        },
    ],
    GtkOverlayProps: [
        { name: "overlays", type: "ReactNode | null", doc: "Widgets stacked over the main child." },
        CHILDREN_PROP,
    ],
    GtkScaleProps: [
        {
            name: "marks",
            type: "ScaleMark[] | null",
            doc: "Marks drawn along the scale, cleared and re-added whenever the list changes.",
        },
    ],
    GtkShortcutControllerProps: [
        {
            name: "shortcuts",
            type: "ReactNode | null",
            doc: "`Gtk.Shortcut` elements the controller watches for.",
        },
    ],
    GtkSizeGroupProps: [
        { name: "widgets", type: "Gtk.Widget[] | null", doc: "Widgets the group keeps at a common size." },
    ],
    GtkTextChildAnchorProps: [
        {
            name: "paintable",
            type: "Gdk.Paintable | null",
            doc: "Image inserted into the buffer instead of an anchored widget; giving both is an error.",
        },
        CHILDREN_PROP,
    ],
    GtkWidgetProps: [
        {
            name: "controllers",
            type: "ReactNode | null",
            doc: "`Gtk.EventController` elements added to the widget.",
        },
        {
            name: "actionGroups",
            type: "ReactNode | null",
            doc: "`Gio.ActionGroup` elements inserted into the widget, each under its own `prefix`.",
        },
        CHILDREN_PROP,
    ],
};

const handwrittenPropsFor = (exportName: string): HandwrittenProp[] => HANDWRITTEN_PROPS[exportName] ?? [];

export { handwrittenPropsFor, type HandwrittenProp };
