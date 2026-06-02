/**
 * Reconciler node for stack navigation widgets that bind to a `GtkStack` or
 * `AdwViewStack` via a `stack` property.
 *
 * Backs `GtkStackSidebar`, `GtkStackSwitcher`, `AdwViewSwitcher`,
 * `AdwViewSwitcherBar`, `AdwViewSwitcherTitle`, and `AdwViewSwitcherSidebar`.
 * When the user provides no `stack` prop, the node walks its React parent's
 * children for a single sibling {@link StackNode} of the matching family
 * (`GtkStack` for the Gtk widgets, `AdwViewStack` for the Adw widgets) and
 * calls the navigation widget's `setStack` after every commit. The work runs
 * through {@link scheduleAfterCommit}, so the bind lands inside the same FFI
 * freeze window that holds the rest of the commit — GTK never sees an
 * intermediate state.
 *
 * Sibling replacement (e.g. a React `key` swap on the stack) is picked up by
 * listening for `notify::parent` on the wired stack: when the wired stack is
 * detached from the shared parent, a fresh sync runs and rebinds against the
 * new sibling.
 *
 * The explicit `stack` prop short-circuits the sibling scan; passing
 * `stack={null}` (where the widget allows it) explicitly disconnects.
 *
 * Auto-wire ambiguity (no sibling stack, multiple sibling stacks of the
 * matching family) is asserted from {@link StackNavigationNode.commitMount},
 * which routes the throw through React's commit-phase error pipeline.
 */

import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import type { Node } from "../node.js";
import { createAfterCommitDebounce } from "../post-commit-queue.js";
import type { Props } from "../types.js";
import { hasChanged } from "./internal/props.js";
import { StackNode, type StackWidget } from "./stack.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

/** Navigation widgets handled by {@link StackNavigationNode}. */
export type StackNavigationWidget =
    | Gtk.StackSidebar
    | Gtk.StackSwitcher
    | Adw.ViewSwitcher
    | Adw.ViewSwitcherBar
    | Adw.ViewSwitcherTitle
    | Adw.ViewSwitcherSidebar;

/** Prop shape accepted by {@link StackNavigationNode}. */
export type StackNavigationProps = Props & {
    stack?: StackWidget | null;
};

const GTK_STACK_TYPE_NAME = "GtkStack";
const ADW_VIEW_STACK_TYPE_NAME = "AdwViewStack";
const STACK_PARENT_SIGNAL = "notify::parent";

type StackBindable = {
    setStack(stack: StackWidget | null): void;
};

/**
 * Reconciler node backing every navigation widget that binds to a stack via a
 * `stack` property. See the module documentation for the auto-wire contract.
 *
 */
export class StackNavigationNode extends WidgetNode<StackNavigationWidget, StackNavigationProps> {
    private readonly scheduleSync = createAfterCommitDebounce(() => this.applyWiring());
    private wiredStack: StackWidget | null = null;
    private initialMountValidated = false;

    public override finalizeInitialChildren(props: StackNavigationProps): boolean {
        super.finalizeInitialChildren(props);
        return true;
    }

    public override commitMount(): void {
        if (this.hasExplicitStackProp()) {
            this.initialMountValidated = true;
            return;
        }
        this.assertSingleSiblingStack();
        this.initialMountValidated = true;
    }

    public override detachDeletedInstance(): void {
        this.wiredStack = null;
        super.detachDeletedInstance();
    }

    public override commitUpdate(oldProps: StackNavigationProps | null, newProps: StackNavigationProps): void {
        super.commitUpdate(oldProps, newProps);
        if (hasChanged(oldProps, newProps, "stack")) {
            this.scheduleSync();
        }
    }

    public override setParent(parent: Node | null): void {
        super.setParent(parent);
        if (parent) this.scheduleSync();
    }

    private applyWiring(): void {
        if (!this.parent) return;

        if (this.hasExplicitStackProp()) {
            this.bindStack(this.props.stack ?? null);
            return;
        }

        if (!this.initialMountValidated) {
            const matches = this.findSiblingStackNodes();
            if (matches.length !== 1) return;
            const target = matches[0];
            if (!target) return;
            this.bindStack(target.backingInstance);
            return;
        }

        this.bindStack(this.assertSingleSiblingStack()[0].backingInstance);
    }

    private assertSingleSiblingStack(): [StackNode] {
        const matches = this.findSiblingStackNodes();
        if (matches.length === 1) return matches as [StackNode];

        const stackType = this.expectedStackTypeName();
        if (matches.length === 0) {
            throw new Error(
                `'${this.typeName}' has no sibling '${stackType}' to bind to. ` +
                    `Place a '${stackType}' alongside it, or pass an explicit 'stack' prop.`,
            );
        }
        throw new Error(
            `'${this.typeName}' has ${matches.length} sibling '${stackType}' candidates. ` +
                `Pass an explicit 'stack' prop to disambiguate.`,
        );
    }

    private hasExplicitStackProp(): boolean {
        return this.props.stack !== undefined;
    }

    private bindStack(stack: StackWidget | null): void {
        if (this.wiredStack === stack) return;
        if (stack === null && !this.supportsNullStack()) return;

        this.unsubscribeFromWiredStack();
        const bindable: StackBindable = this.backingInstance;
        bindable.setStack(stack);
        this.wiredStack = stack;
        if (stack !== null) this.subscribeToStackParent(stack);
    }

    private subscribeToStackParent(stack: StackWidget): void {
        this.signalStore.set({
            owner: this,
            obj: stack,
            signal: STACK_PARENT_SIGNAL,
            handler: () => this.scheduleSync(),
            blockable: false,
        });
    }

    private unsubscribeFromWiredStack(): void {
        if (!this.wiredStack) return;
        this.signalStore.set({
            owner: this,
            obj: this.wiredStack,
            signal: STACK_PARENT_SIGNAL,
            handler: null,
        });
    }

    private supportsNullStack(): boolean {
        return !(this.backingInstance instanceof Gtk.StackSidebar);
    }

    private findSiblingStackNodes(): StackNode[] {
        const anchor = this.findScanAnchor();
        if (!anchor) return [];

        const expectedTypeName = this.expectedStackTypeName();
        const matches: StackNode[] = [];
        this.collectStackNodes(anchor, expectedTypeName, matches);
        return matches;
    }

    private findScanAnchor(): Node | null {
        let cursor: Node | null = this.parent;
        while (cursor instanceof VirtualNode) {
            cursor = cursor.parent;
        }
        return cursor;
    }

    private collectStackNodes(node: Node, expectedTypeName: string, out: StackNode[]): void {
        for (const child of node.children) {
            if (child === this) continue;
            if (child instanceof StackNode) {
                if (child.typeName === expectedTypeName) out.push(child);
                continue;
            }
            if (child instanceof VirtualNode) {
                this.collectStackNodes(child, expectedTypeName, out);
            }
        }
    }

    private expectedStackTypeName(): string {
        const widget = this.backingInstance;
        const isGtkFamily = widget instanceof Gtk.StackSidebar || widget instanceof Gtk.StackSwitcher;
        return isGtkFamily ? GTK_STACK_TYPE_NAME : ADW_VIEW_STACK_TYPE_NAME;
    }
}
