/**
 * Declarative description of how a child GObject attaches to a parent GObject.
 *
 * The reconciler collapses every metadata/virtual node and every non-widget
 * GObject node into two generic classes (`ElementNode`, `WrapperNode`). The
 * per-parent attachment knowledge that used to live in those node subclasses
 * (Stack→addTitled, Grid→GridLayoutChild, Notebook→appendPage, …) is expressed
 * here as pure data, interpreted at runtime by the strategy interpreter.
 *
 * Every shape in this module is JSON-serializable: it holds method names,
 * property names, and prop-key references — never functions — so the same table
 * can be hand-written today and codegen-emitted from GIR later without changing
 * the runtime interpreter.
 */

/** Resolves a single call argument from the attachment context. */
export type ArgSpec =
    | { readonly from: "child" }
    | { readonly from: "prop"; readonly name: string; readonly fallback?: unknown }
    | { readonly from: "literal"; readonly value: unknown };

/**
 * One candidate add-method, chosen at attach time by the first arm whose
 * `conditions` props are all present (non-nullish). An arm with no `conditions`
 * always matches and acts as the default.
 */
export type MethodArm = {
    readonly method: string;
    readonly args: readonly ArgSpec[];
    readonly conditions?: readonly string[];
};

/**
 * A property applied to a per-child meta object (e.g. `Gtk.StackPage`) or to a
 * wrapper GObject, via the named setter method and the wrapper prop it reads.
 */
export type MetaSetter = {
    readonly setter: string;
    readonly prop: string;
    readonly fallback?: unknown;
    /** When true, the setter runs only if the prop is defined (skipped otherwise). */
    readonly whenPresent?: boolean;
};

/**
 * Sets a property on the parent that points at the child, clearing it to a reset
 * value on detach. Backs `<Slot>` (property name from the `id` prop) and
 * non-widget GObjects attached through a property setter (e.g. layout managers).
 */
export interface PropertySetStrategy {
    readonly kind: "property-set";
    /** Fixed camelCase property name on the parent. */
    readonly prop?: string;
    /** Property name taken from this wrapper prop (the `<Slot id>` case). */
    readonly propFromProp?: string;
    /** Value written on detach; defaults to `null`. */
    readonly resetValue?: unknown;
    /** Skip the detach write when the node is deleted with its parent subtree. */
    readonly skipDetachOnDelete?: boolean;
    /** Move keyboard focus to the parent before clearing a focused child. */
    readonly rescueFocus?: boolean;
    /**
     * Getter method on the parent (e.g. `getLayoutManager`) read on detach: the
     * property is cleared only when it still holds this child, so replacing the
     * value before the old node detaches does not clobber the replacement.
     */
    readonly guardGetter?: string;
}

/**
 * Calls a named method on the parent with the child as its argument. Backs
 * `<ContainerSlot>` (method name from the `id` prop), event controllers
 * (`addController`/`removeController`), and shortcuts.
 */
export interface MethodCallStrategy {
    readonly kind: "method-call";
    /** Fixed method name to add the child. */
    readonly addMethod?: string;
    /** Add-method name taken from this wrapper prop (the `<ContainerSlot id>` case). */
    readonly addMethodFromProp?: string;
    /** Method to remove the child; when absent, the child is unparented. */
    readonly removeMethod?: string;
    /** Only call `removeMethod` when the child is still parented to this parent. */
    readonly checkAttached?: boolean;
    /** Skip the remove call when the child has been re-parented elsewhere. */
    readonly skipDetachIfReparented?: boolean;
}

/**
 * Calls an add method that returns a per-child meta object, applies metadata
 * props through that object, and detaches via a remove method taking the child.
 * Backs `<GtkStack.Page>` / `<AdwViewStack.Page>` (the returned `Gtk.StackPage`
 * / `Adw.ViewStackPage` carries title/icon/badge metadata).
 */
export interface AddAndConfigureMetaObjectStrategy {
    readonly kind: "add-and-configure-meta-object";
    /** Candidate add methods; first matching arm wins. */
    readonly arms: readonly MethodArm[];
    /** Method on the parent that removes the child. */
    readonly removeMethod: string;
    /** Metadata setters applied to the returned meta object. */
    readonly metaSetters: readonly MetaSetter[];
}

/**
 * Attaches the child through generic widget attachment, then configures the
 * `Gtk.LayoutChild` the parent's layout manager exposes for it. Backs
 * `<GtkGrid.Child>` (column/row spans) and `<GtkFixed.Child>` (x/y + transform).
 */
export interface AttachAndConfigureLayoutChildStrategy {
    readonly kind: "attach-and-configure-layout-child";
    /** Layout-child properties assigned directly from same-named wrapper props. */
    readonly layoutChildProps?: readonly { readonly prop: string; readonly fallback: unknown }[];
    /**
     * When set, builds a `Gsk.Transform` from `x`/`y` props composed with an
     * optional user transform, and applies it via `Gtk.FixedLayoutChild.setTransform`.
     */
    readonly transform?: { readonly xProp: string; readonly yProp: string; readonly userProp: string };
}

/**
 * Adds the child as an overlay and configures per-child flags by calling setter
 * methods on the parent with `(child, value)`. Backs `<GtkOverlay.Child>`.
 */
export interface OverlayChildStrategy {
    readonly kind: "overlay-child";
    readonly addMethod: string;
    readonly removeMethod: string;
    readonly perChildSetters: readonly MetaSetter[];
}

/**
 * Wraps the child in a freshly constructed GObject, applies metadata to that
 * wrapper, then either adds it to the parent (container mode) or assigns it to a
 * parent property (slot mode, chosen by parent type). Backs
 * `<AdwNavigationView.Page>` and navigation pages used as split-view slots.
 */
export interface WrapThenAddStrategy {
    readonly kind: "wrap-then-add";
    /** GLib type name of the wrapper to construct (e.g. `"AdwNavigationPage"`). */
    readonly wrapperType: string;
    /** Constructor used when the tag prop is present, called `(child, title, tag)`. */
    readonly taggedConstructor: string;
    /** Constructor used otherwise, called `(child, title)`. */
    readonly plainConstructor: string;
    readonly titleProp: string;
    readonly tagProp: string;
    /** GLib type name of the parent that uses container mode (`add`/`remove`). */
    readonly containerType: string;
    readonly addMethod: string;
    readonly removeMethod: string;
    /** Metadata setters applied to the wrapper GObject. */
    readonly metaSetters: readonly MetaSetter[];
    /** In slot mode, the parent property the wrapper is assigned to (from this prop). */
    readonly slotFromProp: string;
    readonly rescueFocus?: boolean;
}

/**
 * Adds the child to a notebook with a tab label, tracking its position among
 * sibling pages and configuring the `Gtk.NotebookPage` meta object. The tab
 * label is taken from an ancillary `NotebookPageTab` child when present,
 * otherwise a `Gtk.Label` is synthesized from the `label` prop. Backs
 * `<GtkNotebook.Page>`.
 */
export interface NotebookPageStrategy {
    readonly kind: "notebook-page";
    /** Wrapper kind name of the ancillary tab child (excluded from the content slot). */
    readonly tabChildKind: string;
    readonly labelProp: string;
    /** Metadata properties assigned on the `Gtk.NotebookPage` meta object. */
    readonly metaProps: readonly { readonly prop: string }[];
}

/**
 * The child belongs to the wrapper purely for logical grouping; the wrapper
 * attaches it to the nearest widget ancestor through generic widget attachment.
 * Backs `<GtkSizeGroup.Widget>`.
 */
export interface TransparentPassthroughStrategy {
    readonly kind: "transparent-passthrough";
}

/** A single attachment strategy entry. */
export type AttachStrategy =
    | PropertySetStrategy
    | MethodCallStrategy
    | AddAndConfigureMetaObjectStrategy
    | AttachAndConfigureLayoutChildStrategy
    | OverlayChildStrategy
    | WrapThenAddStrategy
    | NotebookPageStrategy
    | TransparentPassthroughStrategy;
