import * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";
import type { Container, Props } from "../types.js";
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
        _rootContainer?: Container,
    ): Container | null {
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
                const wrapper = child.container.getParent();
                if (wrapper && isSingleChild(wrapper)) {
                    wrapper.setChild(null);
                    if (isRemovable(this.container)) {
                        this.container.remove(wrapper);
                    }
                }
            } else {
                detachChild(child.container, this.container);
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

        if (this.container instanceof Gtk.ListBox || this.container instanceof Gtk.FlowBox) {
            this.insertBeforeAutowrapping(child, before);
        } else if (isReorderable(this.container)) {
            this.insertBeforeReorderable(this.container, child, before);
        } else if (isInsertable(this.container)) {
            this.insertBeforeInsertable(this.container, child, before);
        } else {
            this.reinsertAllChildren();
        }
    }

    public override commitUpdate(oldProps: P | null, newProps: P): void {
        super.commitUpdate(oldProps, newProps);
        applyAccessibleProps(this.container, oldProps, newProps);
        applyProps(this, oldProps, newProps, { table: this.getPropTable(), exclude: isAccessibleProp });
    }

    private appendWidgetChild(child: WidgetNode): void {
        if (isAppendable(this.container) || isAddable(this.container)) {
            if (this.isChildAutowrapped(child)) {
                this.detachAutowrappedChild(child);
            } else {
                unparentWidget(child.container);
            }
        }
        attachChild(child.container, this.container);
    }

    private isChildAutowrapped(child: WidgetNode): boolean {
        return (
            (this.container instanceof Gtk.ListBox || this.container instanceof Gtk.FlowBox) &&
            !(child.container instanceof Gtk.ListBoxRow || child.container instanceof Gtk.FlowBoxChild)
        );
    }

    private detachAutowrappedChild(child: WidgetNode): void {
        const wrapper = child.container.getParent();
        if (wrapper && isSingleChild(wrapper)) {
            wrapper.setChild(null);
            const wrapperParent = wrapper.getParent();
            if (wrapperParent && isRemovable(wrapperParent)) {
                wrapperParent.remove(wrapper);
            }
        }
    }

    private insertBeforeAutowrapping(child: WidgetNode, before: WidgetNode): void {
        const currentParent = child.container.getParent();

        if (currentParent !== null) {
            if (child.container instanceof Gtk.ListBoxRow || child.container instanceof Gtk.FlowBoxChild) {
                if (isRemovable(currentParent)) {
                    currentParent.remove(child.container);
                }
            } else {
                this.detachAutowrappedChild(child);
            }
        } else if (!(child.container instanceof Gtk.ListBoxRow || child.container instanceof Gtk.FlowBoxChild)) {
            this.detachAutowrappedChild(child);
        }

        const container: Gtk.Widget = this.container;
        if (!(container instanceof Gtk.ListBox) && !(container instanceof Gtk.FlowBox)) return;

        const position = this.findAutowrappedPosition(before);

        if (position === null) {
            container.append(child.container);
        } else {
            container.insert(child.container, position);
        }
    }

    private findAutowrappedPosition(before: WidgetNode): number | null {
        let position = 0;
        let currentChild = this.container.getFirstChild();
        const beforeIsRow = before.container instanceof Gtk.ListBoxRow || before.container instanceof Gtk.FlowBoxChild;

        while (currentChild) {
            const widgetToCompare = beforeIsRow ? currentChild : this.unwrapGtkChild(currentChild);

            if (widgetToCompare && widgetToCompare === before.container) {
                return position;
            }

            position++;
            currentChild = currentChild.getNextSibling();
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
            detachChild(child.container, this.container);
        }

        for (const child of widgetChildren) {
            attachChild(child.container, this.container);
        }
    }

    private insertBeforeReorderable(container: ReorderableWidget, child: WidgetNode, before: WidgetNode): void {
        const previousSibling = this.findPreviousSibling(before);
        const currentParent = child.container.getParent();
        const isChildOfThisContainer = currentParent && currentParent === container;

        if (isChildOfThisContainer) {
            container.reorderChildAfter(child.container, previousSibling);
        } else {
            unparentWidget(child.container);
            container.insertChildAfter(child.container, previousSibling);
        }
    }

    private insertBeforeInsertable(container: InsertableWidget, child: WidgetNode, before: WidgetNode): void {
        unparentWidget(child.container);
        const position = this.findInsertPosition(before);
        container.insert(child.container, position);
    }

    private findPreviousSibling(before: WidgetNode): Gtk.Widget | undefined {
        let beforeChild = this.container.getFirstChild();

        while (beforeChild) {
            if (beforeChild === before.container) {
                return beforeChild.getPrevSibling() ?? undefined;
            }
            beforeChild = beforeChild.getNextSibling();
        }

        throw new Error(`Cannot find 'before' sibling in '${this.typeName}'`);
    }

    private findInsertPosition(before: WidgetNode): number {
        let position = 0;
        let currentChild = this.container.getFirstChild();

        while (currentChild) {
            if (currentChild === before.container) {
                return position;
            }
            position++;
            currentChild = currentChild.getNextSibling();
        }

        throw new Error(`Cannot find 'before' child position in '${this.typeName}'`);
    }
}
