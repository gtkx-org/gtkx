import * as Gtk from "@gtkx/gi/gtk";
import { Node } from "../node.js";
import type { BackingInstance, Props } from "../types.js";
import { applyAccessibleProps, isAccessibleProp } from "./internal/accessible.js";
import { applyProps } from "./internal/apply-props.js";
import { createContainerWithProperties } from "./internal/construct.js";
import {
    type InsertableWidget,
    isAddable,
    isAppendable,
    isInsertable,
    isRemovable,
    isReorderable,
    isSingleChild,
    type ReorderableWidget,
} from "./internal/predicates.js";
import { attachChild, detachChild, unparentWidget } from "./internal/widget.js";

export class WidgetNode<
    T extends Gtk.Widget = Gtk.Widget,
    P extends Props = Props,
    // biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
    TChild extends Node = any,
    TParent extends Node = Node,
> extends Node<T, P, TParent, TChild> {
    public static override createContainer(
        typeName: string,
        props: Props,
        _containerClass: typeof Gtk.Widget,
        _rootContainer?: BackingInstance,
    ): BackingInstance | null {
        return createContainerWithProperties(typeName, props);
    }

    public override isValidChild(_child: Node): boolean {
        return true;
    }

    protected shouldAttachToParent(): boolean {
        return true;
    }

    public override appendChild(child: TChild): void {
        super.appendChild(child);

        if (child instanceof WidgetNode && child.shouldAttachToParent()) {
            this.appendWidgetChild(child);
        }
    }

    public override removeChild(child: TChild): void {
        if (child instanceof WidgetNode && child.shouldAttachToParent()) {
            if (this.isChildAutowrapped(child)) {
                const wrapper = child.backingInstance.getParent();
                if (wrapper && isSingleChild(wrapper)) {
                    wrapper.setChild(null);
                    if (isRemovable(this.backingInstance)) {
                        this.backingInstance.remove(wrapper);
                    }
                }
            } else {
                detachChild(child.backingInstance, this.backingInstance);
            }
        }

        super.removeChild(child);
    }

    public override insertBefore(child: TChild, before: TChild): void {
        super.insertBefore(child, before);

        if (!(child instanceof WidgetNode) || !child.shouldAttachToParent()) return;

        if (!(before instanceof WidgetNode)) {
            this.appendWidgetChild(child);
            return;
        }

        if (this.backingInstance instanceof Gtk.ListBox || this.backingInstance instanceof Gtk.FlowBox) {
            this.insertBeforeAutowrapping(child, before);
        } else if (isReorderable(this.backingInstance)) {
            this.insertBeforeReorderable(this.backingInstance, child, before);
        } else if (isInsertable(this.backingInstance)) {
            this.insertBeforeInsertable(this.backingInstance, child, before);
        } else {
            this.reinsertAllChildren();
        }
    }

    public override commitUpdate(oldProps: P | null, newProps: P): void {
        super.commitUpdate(oldProps, newProps);
        applyAccessibleProps(this.backingInstance, oldProps, newProps);
        applyProps(this, oldProps, newProps, { table: this.getPropTable(), exclude: isAccessibleProp });
    }

    private appendWidgetChild(child: WidgetNode): void {
        if (isAppendable(this.backingInstance) || isAddable(this.backingInstance)) {
            if (this.isChildAutowrapped(child)) {
                this.detachAutowrappedChild(child);
            } else {
                unparentWidget(child.backingInstance);
            }
        }
        attachChild(child.backingInstance, this.backingInstance);
    }

    private isChildAutowrapped(child: WidgetNode): boolean {
        return (
            (this.backingInstance instanceof Gtk.ListBox || this.backingInstance instanceof Gtk.FlowBox) &&
            !(child.backingInstance instanceof Gtk.ListBoxRow || child.backingInstance instanceof Gtk.FlowBoxChild)
        );
    }

    private detachAutowrappedChild(child: WidgetNode): void {
        const wrapper = child.backingInstance.getParent();
        if (wrapper && isSingleChild(wrapper)) {
            wrapper.setChild(null);
            const wrapperParent = wrapper.getParent();
            if (wrapperParent && isRemovable(wrapperParent)) {
                wrapperParent.remove(wrapper);
            }
        }
    }

    private insertBeforeAutowrapping(child: WidgetNode, before: WidgetNode): void {
        const currentParent = child.backingInstance.getParent();

        if (currentParent !== null) {
            if (child.backingInstance instanceof Gtk.ListBoxRow || child.backingInstance instanceof Gtk.FlowBoxChild) {
                if (isRemovable(currentParent)) {
                    currentParent.remove(child.backingInstance);
                }
            } else {
                this.detachAutowrappedChild(child);
            }
        }

        const container: Gtk.Widget = this.backingInstance;
        if (!(container instanceof Gtk.ListBox) && !(container instanceof Gtk.FlowBox)) return;

        const position = this.findAutowrappedPosition(before);

        if (position === null) {
            container.append(child.backingInstance);
        } else {
            container.insert(child.backingInstance, position);
        }
    }

    private *gtkChildren(): IterableIterator<Gtk.Widget> {
        let child = this.backingInstance.getFirstChild();
        while (child) {
            yield child;
            child = child.getNextSibling();
        }
    }

    private findAutowrappedPosition(before: WidgetNode): number | null {
        const beforeIsRow =
            before.backingInstance instanceof Gtk.ListBoxRow || before.backingInstance instanceof Gtk.FlowBoxChild;
        let position = 0;

        for (const currentChild of this.gtkChildren()) {
            const widgetToCompare = beforeIsRow ? currentChild : this.unwrapGtkChild(currentChild);

            if (widgetToCompare && widgetToCompare === before.backingInstance) {
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

    private reinsertAllChildren(): void {
        const widgetChildren: WidgetNode[] = [];
        for (const child of this.children) {
            if (child instanceof WidgetNode && child.shouldAttachToParent()) {
                widgetChildren.push(child);
            }
        }

        for (const child of widgetChildren) {
            detachChild(child.backingInstance, this.backingInstance);
        }

        for (const child of widgetChildren) {
            attachChild(child.backingInstance, this.backingInstance);
        }
    }

    private insertBeforeReorderable(container: ReorderableWidget, child: WidgetNode, before: WidgetNode): void {
        const previousSibling = this.findPreviousSibling(before);
        const currentParent = child.backingInstance.getParent();
        const isChildOfThisContainer = currentParent && currentParent === container;

        if (isChildOfThisContainer) {
            container.reorderChildAfter(child.backingInstance, previousSibling);
        } else {
            unparentWidget(child.backingInstance);
            container.insertChildAfter(child.backingInstance, previousSibling);
        }
    }

    private insertBeforeInsertable(container: InsertableWidget, child: WidgetNode, before: WidgetNode): void {
        unparentWidget(child.backingInstance);
        const position = this.findInsertPosition(before);
        container.insert(child.backingInstance, position);
    }

    private findPreviousSibling(before: WidgetNode): Gtk.Widget | undefined {
        for (const child of this.gtkChildren()) {
            if (child === before.backingInstance) {
                return child.getPrevSibling() ?? undefined;
            }
        }

        throw new Error(`Cannot find 'before' sibling in '${this.typeName}'`);
    }

    private findInsertPosition(before: WidgetNode): number {
        let position = 0;

        for (const currentChild of this.gtkChildren()) {
            if (currentChild === before.backingInstance) {
                return position;
            }
            position++;
        }

        throw new Error(`Cannot find 'before' child position in '${this.typeName}'`);
    }
}
