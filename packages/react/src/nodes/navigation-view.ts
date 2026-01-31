import type * as Adw from "@gtkx/ffi/adw";
import type { Node } from "../node.js";
import type { Props } from "../types.js";
import { filterProps, hasChanged, primitiveArrayEqual } from "./internal/utils.js";
import { NavigationPageNode } from "./navigation-page.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["history", "onHistoryChanged"] as const;

type NavigationViewProps = Props & {
    history?: string[] | null;
    onHistoryChanged?: (history: string[]) => void;
};

export class NavigationViewNode extends WidgetNode<Adw.NavigationView, NavigationViewProps> {
    public override appendChild(child: Node): void {
        if (child instanceof NavigationPageNode || child instanceof SlotNode || child instanceof WidgetNode) {
            super.appendChild(child);
            return;
        }

        throw new Error(`Cannot append '${child.typeName}' to 'NavigationView': expected x.NavigationPage or Widget`);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof NavigationPageNode || child instanceof SlotNode || child instanceof WidgetNode) {
            super.insertBefore(child, before);
            return;
        }

        throw new Error(`Cannot insert '${child.typeName}' into 'NavigationView': expected x.NavigationPage or Widget`);
    }

    public override removeChild(child: Node): void {
        if (child instanceof NavigationPageNode || child instanceof SlotNode || child instanceof WidgetNode) {
            super.removeChild(child);
            return;
        }

        throw new Error(`Cannot remove '${child.typeName}' from 'NavigationView': expected x.NavigationPage or Widget`);
    }

    public override commitUpdate(oldProps: NavigationViewProps | null, newProps: NavigationViewProps): void {
        super.commitUpdate(
            oldProps ? (filterProps(oldProps, OWN_PROPS) as NavigationViewProps) : null,
            filterProps(newProps, OWN_PROPS) as NavigationViewProps,
        );
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
                this.signalStore.set(this, this.container, "popped", null);
                this.signalStore.set(this, this.container, "pushed", null);
                this.signalStore.set(this, this.container, "replaced", null);
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
