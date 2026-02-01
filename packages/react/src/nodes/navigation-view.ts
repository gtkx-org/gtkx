import type * as Adw from "@gtkx/ffi/adw";
import type { AdwNavigationViewProps } from "../jsx.js";
import { filterProps, hasChanged, primitiveArrayEqual } from "./internal/props.js";
import type { NavigationPageNode } from "./navigation-page.js";
import type { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["history", "onHistoryChanged"] as const;

type NavigationViewProps = Pick<AdwNavigationViewProps, (typeof OWN_PROPS)[number]>;
type NavigationViewChild = NavigationPageNode | SlotNode | WidgetNode;

export class NavigationViewNode extends WidgetNode<Adw.NavigationView, NavigationViewProps, NavigationViewChild> {
    public override appendChild(child: NavigationViewChild): void {
        super.appendChild(child);
    }

    public override insertBefore(child: NavigationViewChild, before: NavigationViewChild): void {
        super.insertBefore(child, before);
    }

    public override removeChild(child: NavigationViewChild): void {
        super.removeChild(child);
    }

    public override commitUpdate(oldProps: NavigationViewProps | null, newProps: NavigationViewProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: NavigationViewProps | null, newProps: NavigationViewProps): void {
        const oldHistory = oldProps?.history;
        const newHistory = newProps.history;

        if (newHistory && !primitiveArrayEqual(oldHistory, newHistory)) {
            this.container.replaceWithTags(newHistory, newHistory.length);
        }

        if (hasChanged(oldProps, newProps, "onHistoryChanged")) {
            const onHistoryChanged = newProps.onHistoryChanged;

            if (onHistoryChanged) {
                const handleHistoryChanged = () => {
                    const history = this.getCurrentHistory();
                    onHistoryChanged(history);
                };

                this.signalStore.set(this, this.container, "popped", handleHistoryChanged);
                this.signalStore.set(this, this.container, "pushed", handleHistoryChanged);
                this.signalStore.set(this, this.container, "replaced", handleHistoryChanged);
            } else {
                this.signalStore.set(this, this.container, "popped", undefined);
                this.signalStore.set(this, this.container, "pushed", undefined);
                this.signalStore.set(this, this.container, "replaced", undefined);
            }
        }
    }

    private getCurrentHistory(): string[] {
        const stack = this.container.getNavigationStack();
        const history: string[] = [];
        const nItems = stack.getNItems();

        for (let i = 0; i < nItems; i++) {
            const page = stack.getObject(i) as Adw.NavigationPage | null;
            const tag = page?.getTag();
            if (tag) {
                history.push(tag);
            }
        }

        return history;
    }
}
