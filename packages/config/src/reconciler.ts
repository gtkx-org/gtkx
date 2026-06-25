import type * as GObject from "@gtkx/gi/gobject";

export const RELATIONSHIP_NODE_ELEMENT = "__GTKX_RELATIONSHIP_NODE__";

export const META_OBJECT_KIND = "meta-object";

export const LAYOUT_CHILD_KIND = "layout-child";

export const OVERLAY_KIND = "overlay";

export const TAB_LABEL_KIND = "tab-label";

export const WIDGET_PROP_KIND = "widget-prop";

export const CONTAINER_SLOT_KIND = "container-slot";

export const TEXT_ANCHOR_KIND = "text-anchor";

export const TEXT_PAINTABLE_KIND = "text-paintable";

export const BUFFER_TEXT_KIND = "buffer-text";

export const LABEL_TEXT_KIND = "label-text";

/**
 * Names of the child-attachment method shapes a GObject type can satisfy. Each
 * shape corresponds to a runtime method whose presence *and* signature (argument
 * arity, parameter types, nullability) `@gtkx/codegen` verifies against the GIR
 * model, so the reconciler can rely on the call shape instead of duck-typing the
 * method name alone.
 */
export type AttachShape =
    | "append"
    | "add"
    | "setContent"
    | "setChild"
    | "getChild"
    | "remove"
    | "reorderChildAfter"
    | "insertChildAfter"
    | "insert"
    | "getFirstChild";

/**
 * Maps a GLib type name to the verified {@link AttachShape}s its own methods
 * introduce. The reconciler resolves an instance's full shape set by unioning
 * the entries across its type-name chain and implemented interfaces.
 */
export type AttachShapeTable = Record<string, AttachShape[]>;

/**
 * Names of the constructor arguments a stack/notebook page add-method consumes,
 * in order, when attaching a meta-object child to its host.
 */
export type AddMethodArg = "widget" | "id" | "title" | "iconName";

/**
 * Describes one candidate add-method for a meta-object host (such as
 * `GtkStack`): the method name, the ordered arguments it receives, and the
 * subset of those arguments that must be present for the method to apply.
 */
export type AddMethodRule = {
    method: string;
    args: AddMethodArg[];
    requires: AddMethodArg[];
};

/**
 * Describes one page-meta setter applied to a host page object after a
 * meta-object child is attached: the setter method, the prop it reads, an
 * optional fallback value, and whether to skip the setter when the prop is
 * absent.
 */
export type PageMetaSetter = {
    setter: string;
    prop: string;
    fallback?: unknown;
    whenPresent?: boolean;
};

/**
 * Reconciler capability describing how a parent type owns an ordered collection
 * of children: the accessor returning the live collection, plus the
 * position-aware attach and detach method names. The reconciler uses these to
 * preserve insertion order and detect moves.
 */
export type OrderedInsertSpec = {
    collection: string;
    attach: string;
    detach: string;
};

/**
 * The reconciler node a rule function receives: the live GObject instance, the
 * React prop bag currently committed for it, and the container-slot routing key
 * a relationship-node child carries (for example `"prefix"`, `"start"`, `"controllers"`).
 */
export interface RuleNode {
    instance: GObject.Object;
    props: Record<string, unknown>;
    slotTag: string | undefined;
}

/**
 * A set of plain-function rules keyed in the {@link RuleRegistry} by GLib type
 * name. `appendChild`/`removeChild` attach or detach a child; `setProps`
 * applies synthetic and collection props after the generic GIR props.
 */
export interface RuleSet {
    appendChild?: (parent: RuleNode, child: RuleNode) => void;
    removeChild?: (parent: RuleNode, child: RuleNode) => void;
    setProps?: (node: RuleNode, newProps: Record<string, unknown>, oldProps: Record<string, unknown> | null) => void;
}

/**
 * Maps a GLib type name to its {@link RuleSet}. The reconciler resolves an
 * instance's rule set by walking the type-name chain and interfaces.
 */
export type RuleRegistry = Record<string, RuleSet>;
