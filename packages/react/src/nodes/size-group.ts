import * as Gtk from "@gtkx/gi/gtk";
import type { SizeGroupProps, SizeGroupWidgetProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { BackingInstance } from "../types.js";
import { hasChanged } from "./internal/props.js";
import { attachChild, unparentWidget } from "./internal/widget.js";
import { WidgetRegistrationController } from "./internal/widget-registration.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

function findAncestor<T extends Node>(start: Node | null, is: (node: Node) => node is T): T | null {
    let current: Node | null = start;
    while (current) {
        if (is(current)) return current;
        current = current.parent;
    }
    return null;
}

const isWidgetNode = (node: Node): node is WidgetNode => node instanceof WidgetNode;

abstract class TransparentVirtualNode<TProps, TChild extends Node> extends VirtualNode<TProps, Node, TChild> {
    private readonly attachedWidgets = new Set<Gtk.Widget>();

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(_parent: Node): boolean {
        return true;
    }

    public override appendChild(child: TChild): void {
        super.appendChild(child);
        if (this.parent) {
            this.attachDescendant(child);
        }
    }

    public override removeChild(child: TChild): void {
        if (this.parent) {
            this.detachDescendant(child);
        }
        super.removeChild(child);
    }

    public override insertBefore(child: TChild, before: TChild): void {
        super.insertBefore(child, before);
        if (this.parent) {
            this.reattachAllDescendants();
        }
    }

    public override setParent(parent: Node | null): void {
        if (!parent && this.parent) {
            for (const child of this.children) {
                this.detachDescendant(child);
            }
        }
        super.setParent(parent);
        if (parent) {
            for (const child of this.children) {
                this.attachDescendant(child);
            }
        }
    }

    public override detachDeletedInstance(): void {
        for (const widget of this.attachedWidgets) {
            unparentWidget(widget);
        }
        this.attachedWidgets.clear();
        super.detachDeletedInstance();
    }

    protected propagateAncestorChange(): void {
        for (const child of this.children) {
            this.attachDescendant(child);
        }
    }

    private attachDescendant(child: Node): void {
        if (child instanceof WidgetNode) {
            const ancestor = findAncestor(this.parent, isWidgetNode);
            if (!ancestor) return;
            attachChild(child.backingInstance, ancestor.backingInstance);
            this.attachedWidgets.add(child.backingInstance);
            return;
        }
        if (child instanceof TransparentVirtualNode) {
            child.propagateAncestorChange();
        }
    }

    private detachDescendant(child: Node): void {
        if (child instanceof WidgetNode) {
            unparentWidget(child.backingInstance);
            this.attachedWidgets.delete(child.backingInstance);
            return;
        }
        if (child instanceof TransparentVirtualNode) {
            child.detachAllWidgetDescendants();
        }
    }

    protected detachAllWidgetDescendants(): void {
        for (const child of this.children) {
            this.detachDescendant(child);
        }
    }

    private reattachAllDescendants(): void {
        for (const child of this.children) {
            this.detachDescendant(child);
        }
        for (const child of this.children) {
            this.attachDescendant(child);
        }
    }
}

/**
 * Reconciler node backing the `<GtkSizeGroup>` JSX intrinsic.
 *
 * Owns a `Gtk.SizeGroup` instance and acts as a transparent wrapper in the
 * GTK tree: every widget descendant attaches to the nearest enclosing real
 * widget ancestor, so the SizeGroup itself contributes no widget to the
 * layout. Descendant {@link SizeGroupWidgetNode}s discover this node by
 * walking up the React parent chain and call {@link addMember} /
 * {@link removeMember} to opt their wrapped widget into the group.
 *
 */
export class SizeGroupNode extends TransparentVirtualNode<SizeGroupProps, WidgetNode> {
    public readonly sizeGroup: Gtk.SizeGroup;
    private readonly members = new Set<Gtk.Widget>();

    constructor(typeName: string, props: SizeGroupProps, container: undefined, rootContainer: BackingInstance) {
        super(typeName, props, container, rootContainer);
        this.sizeGroup = Gtk.SizeGroup.new(props.mode ?? Gtk.SizeGroupMode.HORIZONTAL);
    }

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode || child instanceof SizeGroupWidgetNode;
    }

    public override commitUpdate(oldProps: SizeGroupProps | null, newProps: SizeGroupProps): void {
        super.commitUpdate(oldProps, newProps);
        if (oldProps && hasChanged(oldProps, newProps, "mode")) {
            this.sizeGroup.setMode(newProps.mode ?? Gtk.SizeGroupMode.HORIZONTAL);
        }
    }

    public override detachDeletedInstance(): void {
        for (const widget of this.members) {
            this.sizeGroup.removeWidget(widget);
        }
        this.members.clear();
        super.detachDeletedInstance();
    }

    public addMember(widget: Gtk.Widget): void {
        if (this.members.has(widget)) return;
        this.members.add(widget);
        this.sizeGroup.addWidget(widget);
    }

    public removeMember(widget: Gtk.Widget): void {
        if (!this.members.delete(widget)) return;
        this.sizeGroup.removeWidget(widget);
    }
}

/**
 * Reconciler node backing the `<GtkSizeGroup.Widget>` JSX intrinsic.
 *
 * Wraps a single widget child transparently (the widget attaches to the
 * nearest enclosing real widget ancestor, not to the marker itself) and
 * registers that widget with the nearest ancestor {@link SizeGroupNode} in
 * the React parent chain. The registration itself runs via
 * {@link scheduleAfterCommit} so the full ancestor chain is wired by the
 * time the lookup runs; the ancestor-exists invariant is asserted later
 * from {@link commitMount}, where React wraps the call in a try/catch that
 * routes throws through its commit-phase error pipeline (so test harnesses
 * see a rejected `render` instead of an uncaught microtask exception).
 *
 */
export class SizeGroupWidgetNode extends TransparentVirtualNode<SizeGroupWidgetProps, WidgetNode> {
    private readonly registration = new WidgetRegistrationController<{ group: SizeGroupNode; widget: Gtk.Widget }>({
        resolveWidget: () => (this.parent ? (this.children[0]?.backingInstance ?? null) : null),
        register: (widget) => {
            const group = this.findSizeGroupAncestor();
            if (!group) return null;
            group.addMember(widget);
            return { group, widget };
        },
        unregister: ({ group, widget }) => group.removeMember(widget),
    });

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode && this.children.length === 0;
    }

    public override finalizeInitialChildren(props: SizeGroupWidgetProps): boolean {
        super.finalizeInitialChildren(props);
        return true;
    }

    public override commitMount(): void {
        if (this.children.length === 0) return;
        if (!this.findSizeGroupAncestor()) {
            throw new Error("GtkSizeGroup.Widget must be nested inside a GtkSizeGroup");
        }
    }

    public override appendChild(child: WidgetNode): void {
        super.appendChild(child);
        this.registration.scheduleSync();
    }

    public override removeChild(child: WidgetNode): void {
        super.removeChild(child);
        this.registration.scheduleSync();
    }

    public override setParent(parent: Node | null): void {
        if (!parent) {
            this.registration.unregister();
        }
        super.setParent(parent);
        if (parent) {
            this.registration.scheduleSync();
        }
    }

    public override detachDeletedInstance(): void {
        this.registration.unregister();
        super.detachDeletedInstance();
    }

    private findSizeGroupAncestor(): SizeGroupNode | null {
        return findAncestor(this.parent, (node): node is SizeGroupNode => node instanceof SizeGroupNode);
    }
}
