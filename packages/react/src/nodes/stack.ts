import type * as Gtk from "@gtkx/ffi/gtk";
import type { StackPageContainer, StackPageProps } from "../containers.js";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import { isStackPageContainer } from "../predicates.js";
import { PagedStackNode } from "./paged-stack.js";
import { applyStackPageProps } from "./stack-page-props.js";
import { VirtualSlotNode } from "./virtual-slot.js";

const STACK_PAGE_PROPS = ["name", "title", "iconName", "needsAttention", "visible", "useUnderline", "badgeNumber"];

export class StackNode extends PagedStackNode<Gtk.Stack> {
    static matches(type: string): boolean {
        return type === "GtkStack" || type === "GtkStack.Root";
    }

    addStackPage(child: Gtk.Widget, props: StackPageProps): void {
        const { name, title } = props;
        let stackPage: Gtk.StackPage;

        if (title !== undefined) {
            stackPage = this.widget.addTitled(child, title, name);
        } else if (name !== undefined) {
            stackPage = this.widget.addNamed(child, name);
        } else {
            stackPage = this.widget.addChild(child);
        }

        applyStackPageProps(stackPage, props);
        this.applyPendingVisibleChild();
    }

    protected override addChildToWidget(child: Gtk.Widget): void {
        this.widget.addChild(child);
    }
}

export class StackPageNode extends VirtualSlotNode<StackPageContainer, StackPageProps> {
    static override consumedPropNames = STACK_PAGE_PROPS;

    static matches(type: string): boolean {
        return type === "GtkStack.Page" || type === "AdwViewStack.Page";
    }

    protected isValidContainer(parent: Node): parent is Node & StackPageContainer {
        return isStackPageContainer(parent);
    }

    protected extractSlotProps(props: Props): StackPageProps {
        return {
            name: props.name as string | undefined,
            title: props.title as string | undefined,
            iconName: props.iconName as string | undefined,
            needsAttention: props.needsAttention as boolean | undefined,
            visible: props.visible as boolean | undefined,
            useUnderline: props.useUnderline as boolean | undefined,
            badgeNumber: props.badgeNumber as number | undefined,
        };
    }

    protected addToContainer(container: StackPageContainer, child: Gtk.Widget, props: StackPageProps): void {
        container.addStackPage(child, props);
    }

    protected insertBeforeInContainer(
        container: StackPageContainer,
        child: Gtk.Widget,
        props: StackPageProps,
        before: Gtk.Widget,
    ): void {
        container.insertStackPageBefore(child, props, before);
    }

    protected removeFromContainer(container: StackPageContainer, child: Gtk.Widget): void {
        container.removeStackPage(child);
    }

    protected updateInContainer(container: StackPageContainer, child: Gtk.Widget, props: StackPageProps): void {
        container.updateStackPageProps(child, props);
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        this.updateSlotPropsIfChanged(oldProps, newProps, STACK_PAGE_PROPS);
        super.updateProps(oldProps, newProps);
    }
}
