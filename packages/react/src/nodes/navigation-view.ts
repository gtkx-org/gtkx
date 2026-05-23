import * as Adw from "@gtkx/ffi/adw";
import type { AdwNavigationViewProps } from "../jsx.js";
import type { Node } from "../node.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import { imperative, type PropDescriptorTable, signal } from "./internal/apply-props.js";
import { primitiveArrayEqual } from "./internal/props.js";
import { NavigationPageNode } from "./navigation-page.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type NavigationViewProps = Pick<AdwNavigationViewProps, "history" | "onHistoryChanged">;
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

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            history: imperative((oldProps) => {
                const newHistory = this.props.history;
                const oldHistory = (oldProps as NavigationViewProps | null)?.history;
                if (newHistory && !primitiveArrayEqual(oldHistory, newHistory)) {
                    this.container.replaceWithTags(newHistory);
                }
            }),
            onHistoryChanged: signal(["popped", "pushed", "replaced"], {
                getArgs: () => [this.getCurrentHistory()],
            }),
        };
    }

    private getCurrentHistory(): string[] {
        const stack = this.container.getNavigationStack();
        const history: string[] = [];
        const nItems = stack.getNItems();

        for (let i = 0; i < nItems; i++) {
            const page = stack.getItem(i);
            if (!(page instanceof Adw.NavigationPage)) continue;
            const tag = page.getTag();
            if (tag) {
                history.push(tag);
            }
        }

        return history;
    }
}
