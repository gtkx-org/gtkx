import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import { reconciler } from "../../reconciler.js";
import { BaseItemRenderer } from "./base-item-renderer.js";
import type { TreeStore } from "./tree-store.js";

export type TreeRenderItemFn<T> = (item: T | null, row: Gtk.TreeListRow | null) => ReactNode;

type PendingBind = {
    treeListRow: Gtk.TreeListRow;
    expander: Gtk.TreeExpander;
    id: string;
};

export class TreeListItemRenderer extends BaseItemRenderer<TreeStore> {
    private expanders = new Map<number, Gtk.TreeExpander>();
    private setupComplete = new Set<number>();
    private pendingBinds = new Map<number, PendingBind>();
    private renderFn: TreeRenderItemFn<unknown> | null = () => null;
    private boundItems = new Map<string, { ptr: number; treeListRow: Gtk.TreeListRow }>();

    public setRenderFn(renderFn: TreeRenderItemFn<unknown> | null): void {
        this.renderFn = renderFn;
    }

    public rebindItem(id: string): void {
        const binding = this.boundItems.get(id);
        if (!binding) return;

        const fiberRoot = this.fiberRoots.get(binding.ptr);
        if (!fiberRoot) return;

        const expander = this.expanders.get(binding.ptr);
        if (!expander) return;

        this.renderBind(binding.ptr, expander, binding.treeListRow, id, fiberRoot);
    }

    protected override getStoreTypeName(): string {
        return "tree store";
    }

    public override dispose(): void {
        super.dispose();
        this.expanders.clear();
        this.setupComplete.clear();
        this.pendingBinds.clear();
        this.boundItems.clear();
    }

    protected override renderItem(_ptr: number): ReactNode {
        return this.renderFn?.(null, null);
    }

    protected override getItemFromListItem(listItem: Gtk.ListItem): unknown {
        const treeListRow = listItem.getItem();
        if (!(treeListRow instanceof Gtk.TreeListRow)) return null;
        const stringObject = treeListRow.getItem();
        if (!(stringObject instanceof Gtk.StringObject)) return null;
        return this.getStore().getItem(stringObject.getString());
    }

    protected override onSetup(listItem: Gtk.ListItem, ptr: number): Gtk.Widget {
        const expander = new Gtk.TreeExpander();
        const box = this.createBox();
        expander.setChild(box);
        listItem.setChild(expander);
        this.expanders.set(ptr, expander);
        return box;
    }

    protected override onSetupComplete(ptr: number): void {
        this.setupComplete.add(ptr);
        this.processPendingBind(ptr);
    }

    protected override onBind(listItem: Gtk.ListItem, ptr: number, fiberRoot: Reconciler.FiberRoot): void {
        const expander = this.expanders.get(ptr);
        if (!expander) return;

        const treeListRow = listItem.getItem();
        if (!(treeListRow instanceof Gtk.TreeListRow)) return;

        expander.setListRow(treeListRow);

        const stringObject = treeListRow.getItem();
        if (!(stringObject instanceof Gtk.StringObject)) return;

        const id = stringObject.getString();
        this.boundItems.set(id, { ptr, treeListRow });

        if (!this.setupComplete.has(ptr)) {
            this.pendingBinds.set(ptr, { treeListRow, expander, id });
            return;
        }

        this.renderBind(ptr, expander, treeListRow, id, fiberRoot);
    }

    protected override onUnbind(listItem: Gtk.ListItem): void {
        const expander = listItem.getChild();
        if (expander instanceof Gtk.TreeExpander) {
            expander.setListRow(null);
            const treeListRow = listItem.getItem();
            if (treeListRow instanceof Gtk.TreeListRow) {
                const stringObject = treeListRow.getItem();
                if (stringObject instanceof Gtk.StringObject) {
                    this.boundItems.delete(stringObject.getString());
                }
            }
        }
    }

    protected override onTeardown(_listItem: Gtk.ListItem, ptr: number): void {
        this.expanders.delete(ptr);
        this.setupComplete.delete(ptr);
        this.pendingBinds.delete(ptr);
    }

    private processPendingBind(ptr: number): void {
        const pending = this.pendingBinds.get(ptr);
        if (!pending) return;

        this.pendingBinds.delete(ptr);
        const fiberRoot = this.fiberRoots.get(ptr);
        if (fiberRoot) {
            this.renderBind(ptr, pending.expander, pending.treeListRow, pending.id, fiberRoot);
        }
    }

    private renderBind(
        ptr: number,
        expander: Gtk.TreeExpander,
        treeListRow: Gtk.TreeListRow,
        id: string,
        fiberRoot: Reconciler.FiberRoot,
    ): void {
        const itemData = this.getStore().getItem(id);

        if (itemData) {
            if (itemData.indentForDepth !== undefined) {
                expander.setIndentForDepth(itemData.indentForDepth);
            }
            if (itemData.indentForIcon !== undefined) {
                expander.setIndentForIcon(itemData.indentForIcon);
            }
            if (itemData.hideExpander !== undefined) {
                expander.setHideExpander(itemData.hideExpander);
            }
        }

        const element = this.renderFn?.(itemData?.value ?? null, treeListRow);

        reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {
            if (this.tornDown.has(ptr)) return;
            const currentExpander = this.expanders.get(ptr);
            if (!currentExpander) return;
            const box = currentExpander.getChild();
            if (box) {
                this.clearBoxSizeRequest(box);
            }
        });
    }
}
