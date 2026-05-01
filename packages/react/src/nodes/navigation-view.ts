import * as Adw from "@gtkx/ffi/adw";
import type { AdwNavigationViewProps } from "../jsx.js";
import type { Node } from "../node.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import { filterProps, hasChanged, primitiveArrayEqual } from "./internal/props.js";
import { NavigationPageNode } from "./navigation-page.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["history", "onHistoryChanged"] as const;

type NavigationViewProps = Pick<AdwNavigationViewProps, (typeof OWN_PROPS)[number]>;
type NavigationViewChild = NavigationPageNode | SlotNode | ContainerSlotNode | EventControllerNode | WidgetNode;

export class NavigationViewNode extends WidgetNode<Adw.NavigationView, NavigationViewProps, NavigationViewChild> {
    public override isValidChild(child: Node): boolean {
        return (
            child instanceof NavigationPageNode ||
            child instanceof SlotNode ||
            child instanceof EventControllerNode ||
            child instanceof ContainerSlotNode ||
            child instanceof WidgetNode
        );
    }

    public override commitUpdate(oldProps: NavigationViewProps | null, newProps: NavigationViewProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: NavigationViewProps | null, newProps: NavigationViewProps): void {
        const oldHistory = oldProps?.history;
        const newHistory = newProps.history;

        if (newHistory && !primitiveArrayEqual(oldHistory, newHistory)) {
            this.container.replaceWithTags(newHistory);
        }

        if (hasChanged(oldProps, newProps, "onHistoryChanged")) {
            const { onHistoryChanged } = newProps;
            const handler = onHistoryChanged ? () => onHistoryChanged(this.getCurrentHistory()) : undefined;

            this.signalStore.set(this, this.container, "popped", handler);
            this.signalStore.set(this, this.container, "pushed", handler);
            this.signalStore.set(this, this.container, "replaced", handler);
        }
    }

    private getCurrentHistory(): string[] {
        const stack = this.container.getNavigationStack();
        const history: string[] = [];
        const nItems = stack.getNItems();

        for (let i = 0; i < nItems; i++) {
            const page = stack.getObject(i);
            if (!(page instanceof Adw.NavigationPage)) continue;
            const tag = page.getTag();
            if (tag) {
                history.push(tag);
            }
        }

        return history;
    }
}
