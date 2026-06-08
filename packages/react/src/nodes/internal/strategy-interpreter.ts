/**
 * Executes {@link AttachStrategy} entries against live GObjects.
 *
 * This is the single runtime that turns the declarative strategy table into GTK
 * calls. Both `ElementNode` (attaching a non-widget GObject to its parent) and
 * `WrapperNode` (attaching a wrapped child to the grandparent and configuring
 * its metadata) drive their attach/detach/update through these functions, so the
 * per-parent attachment knowledge lives here and in the data table, not in node
 * subclasses. Each strategy kind has a small attach/detach/meta-update handler;
 * the exported entry points only dispatch on `strategy.kind`.
 */
import { getNativeClassByName } from "@gtkx/ffi";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { toCamelCase } from "@gtkx/utils";
import { collectTypeNameChain } from "../../gtype.js";
import type { BackingInstance, Props } from "../../types.js";
import type {
    AddAndConfigureMetaObjectStrategy,
    ArgSpec,
    AttachAndConfigureLayoutChildStrategy,
    AttachStrategy,
    MetaSetter,
    MethodArm,
    MethodCallStrategy,
    NotebookPageStrategy,
    OverlayChildStrategy,
    PropertySetStrategy,
    WrapThenAddStrategy,
} from "./attach-strategy.js";
import { attachChild, detachChild, getFocusWidget, isAttachedTo, isDescendantOf, unparentWidget } from "./widget.js";

/** The live context one attach/detach/update operates on. */
export interface AttachContext {
    /** The props carrying the attachment metadata (wrapper props or element props). */
    readonly props: Props;
    /** The GTK parent the child attaches to (the grandparent for wrappers). */
    readonly parentInstance: BackingInstance;
    /** The GObject being attached (the wrapped child for wrappers). */
    readonly childInstance?: BackingInstance;
    /** Tab label widget for the notebook-page strategy, or `null` to synthesize one. */
    readonly tabLabel?: Gtk.Widget | null;
    /** Insert position for the notebook-page strategy, or `null` to append. */
    readonly position?: number | null;
}

/** Opaque per-attachment state returned by {@link executeAttach}. */
export type AttachState =
    | { readonly kind: "property-set"; readonly prop: string }
    | { readonly kind: "meta-object"; readonly meta: object }
    | { readonly kind: "wrap"; readonly wrapper: object; readonly slotMode: boolean; readonly slotName: string | null }
    | null;

const invoke = (target: object, method: string, args: readonly unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    if (typeof fn !== "function") {
        throw new TypeError(`Method '${method}' not found on '${target.constructor.name}'`);
    }
    return Reflect.apply(fn as (...callArgs: unknown[]) => unknown, target, args);
};

const requireChild = (ctx: AttachContext): BackingInstance => {
    if (!ctx.childInstance) throw new Error("Strategy requires a child instance but none was attached");
    return ctx.childInstance;
};

const resolveArg = (spec: ArgSpec, props: Props, child: BackingInstance): unknown => {
    switch (spec.from) {
        case "child":
            return child;
        case "literal":
            return spec.value;
        case "prop":
            return props[spec.name] ?? spec.fallback;
    }
};

const matchArm = (arm: MethodArm, props: Props): boolean =>
    !arm.conditions || arm.conditions.every((name) => props[name] != null);

const applyMetaSetters = (meta: object, setters: readonly MetaSetter[], props: Props): void => {
    for (const { setter, prop, fallback, whenPresent } of setters) {
        if (typeof Reflect.get(meta, setter) !== "function") continue;
        if (whenPresent && props[prop] === undefined) continue;
        invoke(meta, setter, [props[prop] ?? fallback]);
    }
};

const isRooted = (instance: BackingInstance): boolean =>
    instance instanceof Gtk.Widget ? instance.getRoot() !== null : true;

const rescueFocus = (parent: BackingInstance, child: BackingInstance | undefined): void => {
    if (!(parent instanceof Gtk.Widget) || !(child instanceof Gtk.Widget)) return;
    const focus = getFocusWidget(child);
    if (focus && isDescendantOf(focus, child)) parent.grabFocus();
};

const buildTransform = (
    transform: NonNullable<AttachAndConfigureLayoutChildStrategy["transform"]>,
    props: Props,
): Gsk.Transform | null => {
    const point = new Graphene.Point();
    point.init((props[transform.xProp] as number) ?? 0, (props[transform.yProp] as number) ?? 0);
    let value: Gsk.Transform | null = Gsk.Transform.new().translate(point);
    const userTransform = props[transform.userProp];
    if (userTransform instanceof Gsk.Transform && value) value = value.transform(userTransform);
    return value;
};

const applyLayoutChild = (
    parent: Gtk.Widget,
    child: Gtk.Widget,
    strategy: AttachAndConfigureLayoutChildStrategy,
    props: Props,
): void => {
    const layout = parent.getLayoutManager();
    if (!layout) return;
    const layoutChild = layout.getLayoutChild(child);

    for (const { prop, fallback } of strategy.layoutChildProps ?? []) {
        if (prop in layoutChild) Reflect.set(layoutChild, prop, props[prop] ?? fallback);
    }

    if (strategy.transform && typeof Reflect.get(layoutChild, "setTransform") === "function") {
        const value = buildTransform(strategy.transform, props);
        if (value) invoke(layoutChild, "setTransform", [value]);
    }
};

const resolveTabLabel = (ctx: AttachContext, labelProp: string): Gtk.Widget => {
    if (ctx.tabLabel) return ctx.tabLabel;
    const label = new Gtk.Label();
    label.setLabel(String(ctx.props[labelProp] ?? ""));
    return label;
};

const applyNotebookMeta = (
    notebook: Gtk.Notebook,
    child: Gtk.Widget,
    strategy: NotebookPageStrategy,
    props: Props,
): void => {
    const page = notebook.getPage(child);
    if (!page) return;
    for (const { prop } of strategy.metaProps) {
        if (props[prop] !== undefined) Reflect.set(page, prop, props[prop]);
    }
};

const attachPropertySet = (ctx: AttachContext, strategy: PropertySetStrategy): AttachState => {
    const prop = strategy.prop ?? (strategy.propFromProp ? ctx.props[strategy.propFromProp] : undefined);
    if (typeof prop !== "string") throw new Error("property-set strategy resolved no property name");
    Reflect.set(ctx.parentInstance, prop, requireChild(ctx));
    return { kind: "property-set", prop };
};

const attachMethodCall = (ctx: AttachContext, strategy: MethodCallStrategy): AttachState => {
    const method =
        strategy.addMethod ?? (strategy.addMethodFromProp ? ctx.props[strategy.addMethodFromProp] : undefined);
    if (typeof method !== "string") throw new Error("method-call strategy resolved no method name");
    const child = requireChild(ctx);
    invoke(ctx.parentInstance, method, [child]);
    return null;
};

const attachMetaObject = (ctx: AttachContext, strategy: AddAndConfigureMetaObjectStrategy): AttachState => {
    const arm = strategy.arms.find((candidate) => matchArm(candidate, ctx.props));
    if (!arm) throw new Error("add-and-configure-meta-object strategy matched no method arm");
    const child = requireChild(ctx);
    const meta = invoke(
        ctx.parentInstance,
        arm.method,
        arm.args.map((spec) => resolveArg(spec, ctx.props, child)),
    );
    if (!meta || typeof meta !== "object") return null;
    applyMetaSetters(meta, strategy.metaSetters, ctx.props);
    return { kind: "meta-object", meta };
};

const attachLayoutChild = (ctx: AttachContext, strategy: AttachAndConfigureLayoutChildStrategy): AttachState => {
    if (ctx.childInstance instanceof Gtk.Widget && ctx.parentInstance instanceof Gtk.Widget) {
        attachChild(ctx.childInstance, ctx.parentInstance);
        applyLayoutChild(ctx.parentInstance, ctx.childInstance, strategy, ctx.props);
    }
    return null;
};

const attachOverlay = (ctx: AttachContext, strategy: OverlayChildStrategy): AttachState => {
    const child = requireChild(ctx);
    invoke(ctx.parentInstance, strategy.addMethod, [child]);
    for (const { setter, prop, fallback } of strategy.perChildSetters) {
        invoke(ctx.parentInstance, setter, [child, ctx.props[prop] ?? fallback]);
    }
    return null;
};

const attachWrap = (ctx: AttachContext, strategy: WrapThenAddStrategy): AttachState => {
    const cls = getNativeClassByName(strategy.wrapperType);
    if (!cls) throw new Error(`wrap-then-add strategy could not resolve class '${strategy.wrapperType}'`);
    const child = requireChild(ctx);
    const title = ctx.props[strategy.titleProp] ?? "";
    const tag = ctx.props[strategy.tagProp];
    const wrapper =
        tag != null
            ? invoke(cls, strategy.taggedConstructor, [child, title, tag])
            : invoke(cls, strategy.plainConstructor, [child, title]);
    if (!wrapper || typeof wrapper !== "object") throw new Error("wrap-then-add produced no wrapper");
    applyMetaSetters(wrapper, strategy.metaSetters, ctx.props);

    if (collectTypeNameChain(ctx.parentInstance.__gtype__).includes(strategy.containerType)) {
        invoke(ctx.parentInstance, strategy.addMethod, [wrapper]);
        return { kind: "wrap", wrapper, slotMode: false, slotName: null };
    }
    const slotName = toCamelCase(String(ctx.props[strategy.slotFromProp] ?? ""));
    Reflect.set(ctx.parentInstance, slotName, wrapper);
    return { kind: "wrap", wrapper, slotMode: true, slotName };
};

const attachNotebook = (ctx: AttachContext, strategy: NotebookPageStrategy): AttachState => {
    if (ctx.childInstance instanceof Gtk.Widget && ctx.parentInstance instanceof Gtk.Notebook) {
        const tabLabel = resolveTabLabel(ctx, strategy.labelProp);
        if (ctx.position == null) ctx.parentInstance.appendPage(ctx.childInstance, tabLabel);
        else ctx.parentInstance.insertPage(ctx.childInstance, tabLabel, ctx.position);
        applyNotebookMeta(ctx.parentInstance, ctx.childInstance, strategy, ctx.props);
    }
    return null;
};

const attachTransparent = (ctx: AttachContext): AttachState => {
    if (ctx.childInstance instanceof Gtk.Widget && ctx.parentInstance instanceof Gtk.Widget) {
        attachChild(ctx.childInstance, ctx.parentInstance);
    }
    return null;
};

/**
 * Attaches `ctx.childInstance` to `ctx.parentInstance` per `strategy`, returning
 * the per-attachment state needed to later detach or re-configure it.
 *
 * @param ctx - The live attachment context.
 * @param strategy - The resolved attachment strategy.
 */
export function executeAttach(ctx: AttachContext, strategy: AttachStrategy): AttachState {
    switch (strategy.kind) {
        case "property-set":
            return attachPropertySet(ctx, strategy);
        case "method-call":
            return attachMethodCall(ctx, strategy);
        case "add-and-configure-meta-object":
            return attachMetaObject(ctx, strategy);
        case "attach-and-configure-layout-child":
            return attachLayoutChild(ctx, strategy);
        case "overlay-child":
            return attachOverlay(ctx, strategy);
        case "wrap-then-add":
            return attachWrap(ctx, strategy);
        case "notebook-page":
            return attachNotebook(ctx, strategy);
        case "transparent-passthrough":
            return attachTransparent(ctx);
    }
}

const detachPropertySet = (
    ctx: AttachContext,
    strategy: PropertySetStrategy,
    state: AttachState,
    replacement: boolean,
): void => {
    if (replacement) return;
    const prop = state?.kind === "property-set" ? state.prop : strategy.prop;
    if (!prop || !isRooted(ctx.parentInstance)) return;
    if (strategy.guardGetter && invoke(ctx.parentInstance, strategy.guardGetter, []) !== ctx.childInstance) return;
    rescueFocus(ctx.parentInstance, ctx.childInstance);
    Reflect.set(ctx.parentInstance, prop, strategy.resetValue ?? null);
};

const detachMethodCall = (ctx: AttachContext, strategy: MethodCallStrategy): void => {
    const { parentInstance } = ctx;
    const childInstance = requireChild(ctx);
    if (strategy.skipDetachIfReparented && childInstance instanceof Gtk.EventController) {
        if (childInstance.getWidget() !== parentInstance) return;
    }
    if (!strategy.removeMethod) {
        if (childInstance instanceof Gtk.Widget) unparentWidget(childInstance);
        return;
    }
    if (
        strategy.checkAttached &&
        childInstance instanceof Gtk.Widget &&
        parentInstance instanceof Gtk.Widget &&
        !isAttachedTo(childInstance, parentInstance)
    ) {
        return;
    }
    invoke(parentInstance, strategy.removeMethod, [childInstance]);
};

const detachMetaObject = (ctx: AttachContext, strategy: AddAndConfigureMetaObjectStrategy): void => {
    const { parentInstance } = ctx;
    const childInstance = requireChild(ctx);
    if (
        childInstance instanceof Gtk.Widget &&
        parentInstance instanceof Gtk.Widget &&
        !isAttachedTo(childInstance, parentInstance)
    ) {
        return;
    }
    invoke(parentInstance, strategy.removeMethod, [childInstance]);
};

const detachWidgetChild = (ctx: AttachContext): void => {
    if (ctx.childInstance instanceof Gtk.Widget && ctx.parentInstance instanceof Gtk.Widget) {
        detachChild(ctx.childInstance, ctx.parentInstance);
    }
};

const detachOverlay = (ctx: AttachContext, strategy: OverlayChildStrategy): void => {
    const { childInstance, parentInstance } = ctx;
    if (childInstance instanceof Gtk.Widget && childInstance.getParent() === parentInstance) {
        invoke(parentInstance, strategy.removeMethod, [childInstance]);
    } else if (childInstance instanceof Gtk.Widget) {
        unparentWidget(childInstance);
    }
};

const detachWrap = (ctx: AttachContext, strategy: WrapThenAddStrategy, state: AttachState): void => {
    if (state?.kind !== "wrap") return;
    if (state.slotMode && state.slotName) {
        if (!isRooted(ctx.parentInstance)) return;
        rescueFocus(ctx.parentInstance, ctx.childInstance);
        Reflect.set(ctx.parentInstance, state.slotName, null);
        return;
    }
    invoke(ctx.parentInstance, strategy.removeMethod, [state.wrapper]);
};

const detachNotebook = (ctx: AttachContext): void => {
    if (ctx.childInstance instanceof Gtk.Widget && ctx.parentInstance instanceof Gtk.Notebook) {
        const pageNum = ctx.parentInstance.pageNum(ctx.childInstance);
        if (pageNum !== -1) ctx.parentInstance.removePage(pageNum);
    }
};

/**
 * Reverses {@link executeAttach}, removing `ctx.childInstance` from
 * `ctx.parentInstance`.
 *
 * @param ctx - The live attachment context.
 * @param strategy - The resolved attachment strategy.
 * @param state - The value returned by {@link executeAttach}.
 * @param replacement - True when a new child is being attached in the same
 *   change, so property/slot clears are skipped (the attach overwrites them).
 */
export function executeDetach(
    ctx: AttachContext,
    strategy: AttachStrategy,
    state: AttachState,
    replacement = false,
): void {
    switch (strategy.kind) {
        case "property-set":
            detachPropertySet(ctx, strategy, state, replacement);
            return;
        case "method-call":
            detachMethodCall(ctx, strategy);
            return;
        case "add-and-configure-meta-object":
            detachMetaObject(ctx, strategy);
            return;
        case "attach-and-configure-layout-child":
        case "transparent-passthrough":
            detachWidgetChild(ctx);
            return;
        case "overlay-child":
            detachOverlay(ctx, strategy);
            return;
        case "wrap-then-add":
            detachWrap(ctx, strategy, state);
            return;
        case "notebook-page":
            detachNotebook(ctx);
            return;
    }
}

const metaUpdateNotebook = (ctx: AttachContext, strategy: NotebookPageStrategy): void => {
    if (!(ctx.childInstance instanceof Gtk.Widget) || !(ctx.parentInstance instanceof Gtk.Notebook)) return;
    if (ctx.tabLabel == null) {
        const current = ctx.parentInstance.getTabLabel(ctx.childInstance);
        if (current instanceof Gtk.Label) current.setLabel(String(ctx.props[strategy.labelProp] ?? ""));
    }
    applyNotebookMeta(ctx.parentInstance, ctx.childInstance, strategy, ctx.props);
};

/**
 * Re-applies metadata to an existing attachment when wrapper props change but
 * the child is unchanged.
 *
 * @param ctx - The live attachment context with the latest props.
 * @param strategy - The resolved attachment strategy.
 * @param state - The value returned by {@link executeAttach}.
 * @returns The attachment state after the update (possibly a new value).
 */
export function executeMetaUpdate(ctx: AttachContext, strategy: AttachStrategy, state: AttachState): AttachState {
    switch (strategy.kind) {
        case "add-and-configure-meta-object":
            if (state?.kind === "meta-object") applyMetaSetters(state.meta, strategy.metaSetters, ctx.props);
            return state;
        case "wrap-then-add":
            if (state?.kind === "wrap") applyMetaSetters(state.wrapper, strategy.metaSetters, ctx.props);
            return state;
        case "attach-and-configure-layout-child":
            if (ctx.childInstance instanceof Gtk.Widget && ctx.parentInstance instanceof Gtk.Widget) {
                applyLayoutChild(ctx.parentInstance, ctx.childInstance, strategy, ctx.props);
            }
            return state;
        case "overlay-child":
            for (const { setter, prop, fallback } of strategy.perChildSetters) {
                invoke(ctx.parentInstance, setter, [requireChild(ctx), ctx.props[prop] ?? fallback]);
            }
            return state;
        case "notebook-page":
            metaUpdateNotebook(ctx, strategy);
            return state;
        default:
            return state;
    }
}
