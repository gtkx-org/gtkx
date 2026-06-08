import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { omit } from "@gtkx/utils";
import { collectTypeNameChain } from "../gtype.js";
import { Node } from "../node.js";
import type { BackingInstance, BackingInstanceClass, ContainerInfo, Props } from "../types.js";
import { applyAccessibleProps, isAccessibleProp } from "./internal/accessible.js";
import { applyProps, type PropDescriptorTable } from "./internal/apply-props.js";
import { createContainerWithProperties } from "./internal/construct.js";
import {
    type InsertableWidget,
    isAddable,
    isAppendable,
    isInsertable,
    isRemovable,
    isReorderable,
    isSingleChild,
    isSingleChildContainer,
    type ReorderableWidget,
} from "./internal/predicates.js";
import { CONSTRUCTION_SKIP_PROPS, PROP_DESCRIPTOR_TABLE } from "./internal/prop-descriptor-table.js";
import { disposeTextBufferController, scheduleBufferRebuild } from "./internal/text-buffer-rebuild.js";
import { isBufferContentWrapper } from "./internal/text-wrapper.js";
import { attachChild, detachChild, unparentWidget } from "./internal/widget.js";

/**
 * The single reconciler node backing a real GObject — a widget or a non-widget
 * (event controller, layout manager, shortcut, …).
 *
 * As a parent it owns how each child attaches: a widget child through the GTK
 * attach predicates (append/add/setChild) plus the ListBox/FlowBox autowrap and
 * reorder paths; a non-widget GObject child through the fixed relationship its
 * type implies — an event controller via `addController`, a layout manager via
 * `setLayoutManager`, a shortcut via the shortcut controller's `addShortcut`.
 */
export class ElementNode<
    T extends BackingInstance = Gtk.Widget,
    P extends Props = Props,
    // biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
    TChild extends Node = any,
    TParent extends Node = Node,
> extends Node<T, P, TParent, TChild> {
    public static override createContainer(
        typeName: string,
        props: Props,
        _containerClass: BackingInstanceClass,
        _rootContainer?: ContainerInfo,
    ): BackingInstance | null {
        const skip = CONSTRUCTION_SKIP_PROPS[typeName];
        return createContainerWithProperties(typeName, skip ? omit(props, skip) : props);
    }

    /** Whether the backing GObject is a `Gtk.Widget` (vs. a non-widget object). */
    public readonly isWidget: boolean;

    private readonly teardownCallbacks = new Set<() => void>();

    constructor(typeName: string, props: P, backingInstance: T, rootContainer: ContainerInfo) {
        super(typeName, props, backingInstance, rootContainer);
        this.isWidget = backingInstance instanceof Gtk.Widget;
    }

    /**
     * Registers a callback to run once when this node's backing GObject is torn
     * down. Prop descriptors that allocate GTK resources beyond plain property
     * sets (registered actions, inserted action groups) use this to release them
     * on unmount, sparing the reconciler a bespoke node subclass.
     *
     * @param callback - The teardown callback to run on detach.
     */
    public registerTeardown(callback: () => void): void {
        this.teardownCallbacks.add(callback);
    }

    public override isValidChild(_child: Node): boolean {
        return true;
    }

    protected shouldAttachToParent(): boolean {
        return true;
    }

    public override commitUpdate(oldProps: P | null, newProps: P): void {
        super.commitUpdate(oldProps, newProps);
        const container = this.backingInstance;
        if (container instanceof Gtk.Widget) {
            applyAccessibleProps(container, oldProps, newProps);
            applyProps(this, oldProps, newProps, { table: this.getPropTable(), exclude: isAccessibleProp });
        } else {
            applyProps(this, oldProps, newProps, { table: this.getPropTable(), defaultBlockable: false });
        }
        if (container instanceof Gtk.TextTag) {
            scheduleBufferRebuild(this);
        }
    }

    /**
     * Whether this node hosts a text buffer's content: a `Gtk.TextView` (the
     * buffer host itself) or a `Gtk.TextTag` (a styling span whose children are
     * buffered content). Such a node accepts buffered content children — raw
     * text, inline paintables, anchored widgets, and nested tags — that the
     * text-buffer controller linearizes rather than attaching as GTK children.
     */
    private isTextBufferHost(): boolean {
        return this.backingInstance instanceof Gtk.TextView || this.backingInstance instanceof Gtk.TextTag;
    }

    private isBufferContentChild(child: TChild): boolean {
        return (
            isBufferContentWrapper(child) ||
            (child instanceof ElementNode && child.backingInstance instanceof Gtk.TextTag)
        );
    }

    private maybeScheduleBufferRebuild(child: TChild): void {
        if (this.isTextBufferHost() && this.isBufferContentChild(child)) {
            scheduleBufferRebuild(this);
        }
    }

    public override finalizeInitialChildren(props: P): boolean {
        this.commitUpdate(null, props);
        return this.backingInstance instanceof Gtk.Window || this.backingInstance instanceof Adw.Dialog;
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        let table = super.ownPropDescriptors();
        for (const typeName of collectTypeNameChain(this.backingInstance.__gtype__)) {
            const factory = PROP_DESCRIPTOR_TABLE[typeName];
            if (factory) table = { ...factory(this), ...table };
        }
        return table;
    }

    // --- Top-level surface lifecycle (windows and dialogs) ---

    /**
     * Presents a top-level surface once mounted. A `Gtk.Window` is shown with
     * `present()`; an `Adw.Dialog` is presented against its parent window when it
     * has one, mirroring the modal-dialog-over-window flow.
     */
    public override commitMount(): void {
        const instance = this.backingInstance;
        if (instance instanceof Gtk.Window) {
            instance.present();
        } else if (instance instanceof Adw.Dialog) {
            instance.present(this.parentWindow());
        }
    }

    private parentWindow(): Gtk.Window | null {
        const parentInstance = this.parent instanceof ElementNode ? this.parent.backingInstance : null;
        return parentInstance instanceof Gtk.Window ? parentInstance : null;
    }

    // --- Parent-driven attachment of non-widget GObject children ---

    /**
     * Tears down the node's backing GObject. Non-widget children detach from
     * their parent's GTK relationship. A top-level surface is closed: an
     * `Adw.Dialog` via `forceClose()`, a `Gtk.Window` via `destroy()` after
     * clearing its default widget.
     */
    public override detachDeletedInstance(): void {
        for (const callback of this.teardownCallbacks) callback();
        this.teardownCallbacks.clear();
        if (this.backingInstance instanceof Gtk.TextView) {
            disposeTextBufferController(this.backingInstance);
        }
        if (!this.isWidget && this.parent instanceof ElementNode) {
            this.parent.detachNonWidgetChild(this);
        }
        super.detachDeletedInstance();
        this.closeTopLevel();
    }

    /**
     * Closes a top-level surface during teardown.
     *
     * A `Gtk.Window` holds its default widget as a borrowed (`transfer none`)
     * back-pointer that GTK never references. Because GObject finalization is
     * deferred to an idle, the default widget can be finalized on its own idle
     * before the window's deferred dispose runs `gtk_window_set_default_widget`,
     * which would then dereference a freed widget. Resetting the pointer to
     * `null` here — synchronously, while the default widget is still alive —
     * leaves the later dispose nothing dangling to read.
     */
    private closeTopLevel(): void {
        const instance = this.backingInstance;
        if (instance instanceof Adw.Dialog) {
            instance.forceClose();
        } else if (instance instanceof Gtk.Window) {
            instance.setDefaultWidget(null);
            instance.destroy();
        }
    }

    /**
     * Attaches a non-widget GObject child to this node's backing instance through
     * the fixed GTK relationship its type implies: an event controller via
     * `addController`, a layout manager via `setLayoutManager`, a shortcut via the
     * parent shortcut controller's `addShortcut`. Widget children and metadata
     * wrappers are handled elsewhere, so this is a no-op for them.
     *
     * @param child - The child node whose backing GObject is being attached.
     */
    private attachNonWidgetChild(child: TChild): void {
        if (!(child instanceof ElementNode)) return;
        const parentInstance = this.backingInstance;
        const childInstance = child.backingInstance;
        if (childInstance instanceof Gtk.EventController && parentInstance instanceof Gtk.Widget) {
            parentInstance.addController(childInstance);
        } else if (childInstance instanceof Gtk.LayoutManager && parentInstance instanceof Gtk.Widget) {
            parentInstance.setLayoutManager(childInstance);
        } else if (childInstance instanceof Gtk.Shortcut && parentInstance instanceof Gtk.ShortcutController) {
            parentInstance.addShortcut(childInstance);
        }
    }

    /**
     * Reverses {@link attachNonWidgetChild}. Each branch guards on the live GTK
     * relationship so a detach that races a re-parent or an already-torn-down
     * parent is a no-op.
     *
     * @param child - The child node whose backing GObject is being detached.
     */
    private detachNonWidgetChild(child: TChild): void {
        if (!(child instanceof ElementNode)) return;
        const parentInstance = this.backingInstance;
        const childInstance = child.backingInstance;
        if (childInstance instanceof Gtk.EventController && parentInstance instanceof Gtk.Widget) {
            if (childInstance.getWidget() === parentInstance) parentInstance.removeController(childInstance);
        } else if (childInstance instanceof Gtk.LayoutManager && parentInstance instanceof Gtk.Widget) {
            if (parentInstance.getLayoutManager() === childInstance) parentInstance.setLayoutManager(null);
        } else if (childInstance instanceof Gtk.Shortcut && parentInstance instanceof Gtk.ShortcutController) {
            parentInstance.removeShortcut(childInstance);
        }
    }

    // --- Widget child management ---

    public override appendChild(child: TChild): void {
        super.appendChild(child);
        this.maybeScheduleBufferRebuild(child);
        const container = this.backingInstance;
        const childWidget = this.attachableChildWidget(child);
        if (container instanceof Gtk.Widget && childWidget) {
            this.appendWidgetChild(container, childWidget);
            return;
        }
        if (childWidget && this.setNonWidgetChild(childWidget)) return;
        this.attachTransientWindow(child);
        this.attachNonWidgetChild(child);
    }

    public override removeChild(child: TChild): void {
        this.maybeScheduleBufferRebuild(child);
        const container = this.backingInstance;
        const childWidget = this.attachableChildWidget(child);
        if (container instanceof Gtk.Widget && childWidget) {
            this.removeWidgetChild(container, childWidget);
        } else if (!(childWidget && this.clearNonWidgetChild(childWidget))) {
            this.detachTransientWindow(child);
            this.detachNonWidgetChild(child);
        }
        super.removeChild(child);
    }

    /**
     * Removes a widget child from a widget container, unwrapping the autowrap
     * helper when one was inserted, otherwise detaching the child directly.
     *
     * @param container - The widget container the child was attached to.
     * @param childWidget - The widget child to remove.
     */
    private removeWidgetChild(container: Gtk.Widget, childWidget: Gtk.Widget): void {
        if (!this.isChildAutowrapped(container, childWidget)) {
            detachChild(childWidget, container);
            return;
        }
        const wrapper = childWidget.getParent();
        if (wrapper && isSingleChild(wrapper)) {
            wrapper.setChild(null);
            if (isRemovable(container)) container.remove(wrapper);
        }
    }

    /**
     * Sets a widget child on a non-widget single-child container, such as the
     * `Gtk.ListItem`/`Gtk.ListHeader` a list factory hands to a portal. Returns
     * `false` when the backing instance is not such a container so the caller can
     * fall through to the other attachment paths.
     *
     * @param childWidget - The widget to set as the container's single child.
     */
    private setNonWidgetChild(childWidget: Gtk.Widget): boolean {
        const container = this.backingInstance;
        if (container instanceof Gtk.Widget || !isSingleChildContainer(container)) return false;
        unparentWidget(childWidget);
        container.setChild(childWidget);
        return true;
    }

    /**
     * Reverses {@link setNonWidgetChild}, clearing the container's single child.
     *
     * @param childWidget - The widget that was set as the container's child.
     */
    private clearNonWidgetChild(childWidget: Gtk.Widget): boolean {
        const container = this.backingInstance;
        if (container instanceof Gtk.Widget || !isSingleChildContainer(container)) return false;
        if (container.getChild() === childWidget) container.setChild(null);
        return true;
    }

    /**
     * Makes a child window transient for this node's window when both are
     * windows, so the child stacks above and centers over its parent.
     *
     * @param child - The candidate child node.
     */
    private attachTransientWindow(child: TChild): void {
        const parentInstance = this.backingInstance;
        const childInstance = child instanceof ElementNode ? child.backingInstance : null;
        if (parentInstance instanceof Gtk.Window && childInstance instanceof Gtk.Window) {
            childInstance.setTransientFor(parentInstance);
        }
    }

    /**
     * Reverses {@link attachTransientWindow}, hiding the child window and
     * clearing its transient-for relationship.
     *
     * @param child - The candidate child node.
     */
    private detachTransientWindow(child: TChild): void {
        const parentInstance = this.backingInstance;
        const childInstance = child instanceof ElementNode ? child.backingInstance : null;
        if (parentInstance instanceof Gtk.Window && childInstance instanceof Gtk.Window) {
            childInstance.setVisible(false);
            childInstance.setTransientFor(null);
        }
    }

    public override insertBefore(child: TChild, before: TChild): void {
        super.insertBefore(child, before);
        this.maybeScheduleBufferRebuild(child);
        const container = this.backingInstance;
        const childWidget = this.attachableChildWidget(child);
        if (!(container instanceof Gtk.Widget) || !childWidget) {
            if (childWidget && this.setNonWidgetChild(childWidget)) return;
            this.attachTransientWindow(child);
            this.attachNonWidgetChild(child);
            return;
        }

        const beforeWidget = this.attachableChildWidget(before);
        if (!beforeWidget) {
            this.appendWidgetChild(container, childWidget);
            return;
        }

        if (container instanceof Gtk.ListBox || container instanceof Gtk.FlowBox) {
            this.insertBeforeAutowrapping(container, childWidget, beforeWidget);
        } else if (isReorderable(container)) {
            this.insertBeforeReorderable(container, childWidget, beforeWidget);
        } else if (isInsertable(container)) {
            this.insertBeforeInsertable(container, childWidget, beforeWidget);
        } else {
            this.reinsertAllChildren(container);
        }
    }

    private attachableChildWidget(child: TChild): Gtk.Widget | null {
        if (!(child instanceof ElementNode) || !child.shouldAttachToParent()) return null;
        const widget = child.backingInstance;
        if (!(widget instanceof Gtk.Widget)) return null;
        if (widget instanceof Gtk.Window || widget instanceof Adw.Dialog) return null;
        return widget;
    }

    private appendWidgetChild(container: Gtk.Widget, child: Gtk.Widget): void {
        if (isAppendable(container) || isAddable(container)) {
            if (this.isChildAutowrapped(container, child)) {
                this.detachAutowrappedChild(child);
            } else {
                unparentWidget(child);
            }
        }
        attachChild(child, container);
    }

    private isChildAutowrapped(container: Gtk.Widget, child: Gtk.Widget): boolean {
        return (
            (container instanceof Gtk.ListBox || container instanceof Gtk.FlowBox) &&
            !(child instanceof Gtk.ListBoxRow || child instanceof Gtk.FlowBoxChild)
        );
    }

    private detachAutowrappedChild(child: Gtk.Widget): void {
        const wrapper = child.getParent();
        if (wrapper && isSingleChild(wrapper)) {
            wrapper.setChild(null);
            const wrapperParent = wrapper.getParent();
            if (wrapperParent && isRemovable(wrapperParent)) {
                wrapperParent.remove(wrapper);
            }
        }
    }

    private insertBeforeAutowrapping(
        container: Gtk.ListBox | Gtk.FlowBox,
        child: Gtk.Widget,
        before: Gtk.Widget,
    ): void {
        const currentParent = child.getParent();

        if (currentParent !== null) {
            if (child instanceof Gtk.ListBoxRow || child instanceof Gtk.FlowBoxChild) {
                if (isRemovable(currentParent)) currentParent.remove(child);
            } else {
                this.detachAutowrappedChild(child);
            }
        }

        const position = this.findAutowrappedPosition(container, before);

        if (position === null) {
            container.append(child);
        } else {
            container.insert(child, position);
        }
    }

    private *gtkChildren(container: Gtk.Widget): IterableIterator<Gtk.Widget> {
        let child = container.getFirstChild();
        while (child) {
            yield child;
            child = child.getNextSibling();
        }
    }

    private findAutowrappedPosition(container: Gtk.Widget, before: Gtk.Widget): number | null {
        const beforeIsRow = before instanceof Gtk.ListBoxRow || before instanceof Gtk.FlowBoxChild;
        let position = 0;

        for (const currentChild of this.gtkChildren(container)) {
            const widgetToCompare = beforeIsRow ? currentChild : this.unwrapGtkChild(currentChild);

            if (widgetToCompare && widgetToCompare === before) {
                return position;
            }

            position++;
        }

        return null;
    }

    private unwrapGtkChild(child: Gtk.Widget): Gtk.Widget | null {
        if ("getChild" in child && typeof child.getChild === "function") {
            const inner: unknown = child.getChild();
            return inner instanceof Gtk.Widget ? inner : null;
        }
        return child;
    }

    private reinsertAllChildren(container: Gtk.Widget): void {
        const widgetChildren: Gtk.Widget[] = [];
        for (const child of this.children) {
            const widget = this.attachableChildWidget(child);
            if (widget) widgetChildren.push(widget);
        }

        for (const child of widgetChildren) detachChild(child, container);
        for (const child of widgetChildren) attachChild(child, container);
    }

    private insertBeforeReorderable(container: ReorderableWidget, child: Gtk.Widget, before: Gtk.Widget): void {
        const previousSibling = this.findPreviousSibling(container, before);
        const currentParent = child.getParent();

        if (currentParent && currentParent === container) {
            container.reorderChildAfter(child, previousSibling);
        } else {
            unparentWidget(child);
            container.insertChildAfter(child, previousSibling);
        }
    }

    private insertBeforeInsertable(container: InsertableWidget, child: Gtk.Widget, before: Gtk.Widget): void {
        unparentWidget(child);
        const position = this.findInsertPosition(container, before);
        container.insert(child, position);
    }

    private findPreviousSibling(container: Gtk.Widget, before: Gtk.Widget): Gtk.Widget | undefined {
        for (const child of this.gtkChildren(container)) {
            if (child === before) {
                return child.getPrevSibling() ?? undefined;
            }
        }

        throw new Error(`Cannot find 'before' sibling in '${this.typeName}'`);
    }

    private findInsertPosition(container: Gtk.Widget, before: Gtk.Widget): number {
        let position = 0;

        for (const currentChild of this.gtkChildren(container)) {
            if (currentChild === before) {
                return position;
            }
            position++;
        }

        throw new Error(`Cannot find 'before' child position in '${this.typeName}'`);
    }
}
