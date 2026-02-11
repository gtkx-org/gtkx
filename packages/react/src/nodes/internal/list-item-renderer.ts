import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import { reconciler } from "../../reconciler.js";
import { BaseItemRenderer } from "./base-item-renderer.js";
import type { TreeStore } from "./tree-store.js";

type RenderItemFn<T> = (item: T | null, row: Gtk.TreeListRow | null) => ReactNode;

type PendingBind = {
    treeListRow: Gtk.TreeListRow;
    expander: Gtk.TreeExpander;
    id: string;
};

export class ListItemRenderer extends BaseItemRenderer<TreeStore> {
    private expanders = new Map<Gtk.ListItem, Gtk.TreeExpander>();
    private setupComplete = new Set<Gtk.ListItem>();
    private pendingBinds = new Map<Gtk.ListItem, PendingBind>();
    private renderFn: RenderItemFn<unknown> | null = () => null;
    private boundItems = new Map<string, { listItem: Gtk.ListItem; treeListRow: Gtk.TreeListRow }>();

    public setRenderFn(renderFn: RenderItemFn<unknown> | null): void {
        this.renderFn = renderFn;
        this.rebindAllItems();
    }

    public rebindAllItems(): void {
        for (const id of this.boundItems.keys()) {
            this.rebindItem(id);
        }
    }

    public rebindItem(id: string): void {
        const binding = this.boundItems.get(id);
        if (!binding) return;

        const fiberRoot = this.fiberRoots.get(binding.listItem);
        if (!fiberRoot) return;

        const expander = this.expanders.get(binding.listItem);
        if (!expander) return;

        this.renderBind(binding.listItem, expander, binding.treeListRow, id, fiberRoot);
    }

    public override dispose(): void {
        super.dispose();
        this.expanders.clear();
        this.setupComplete.clear();
        this.pendingBinds.clear();
        this.boundItems.clear();
    }

    protected override renderItem(_listItem: Gtk.ListItem): ReactNode {
        return this.renderFn?.(null, null);
    }

    protected override onSetup(listItem: Gtk.ListItem): Gtk.Widget {
        const expander = new Gtk.TreeExpander();
        const box = this.createBox();
        expander.setChild(box);
        listItem.setChild(expander);
        this.expanders.set(listItem, expander);
        return box;
    }

    protected override onSetupComplete(listItem: Gtk.ListItem): void {
        this.setupComplete.add(listItem);
        this.processPendingBind(listItem);
    }

    protected override onBind(listItem: Gtk.ListItem, fiberRoot: Reconciler.FiberRoot): void {
        const expander = this.expanders.get(listItem);
        if (!expander) return;

        const treeListRow = listItem.getItem();
        if (!(treeListRow instanceof Gtk.TreeListRow)) return;

        expander.setListRow(treeListRow);

        const stringObject = treeListRow.getItem();
        if (!(stringObject instanceof Gtk.StringObject)) return;

        const id = stringObject.getString();
        this.boundItems.set(id, { listItem, treeListRow });

        if (!this.setupComplete.has(listItem)) {
            this.pendingBinds.set(listItem, { treeListRow, expander, id });
            return;
        }

        this.renderBind(listItem, expander, treeListRow, id, fiberRoot);
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

    protected override onTeardown(listItem: Gtk.ListItem): void {
        this.expanders.delete(listItem);
        this.setupComplete.delete(listItem);
        this.pendingBinds.delete(listItem);
    }

    private processPendingBind(listItem: Gtk.ListItem): void {
        const pending = this.pendingBinds.get(listItem);
        if (!pending) return;

        this.pendingBinds.delete(listItem);
        const fiberRoot = this.fiberRoots.get(listItem);
        if (fiberRoot) {
            this.renderBind(listItem, pending.expander, pending.treeListRow, pending.id, fiberRoot);
        }
    }

    private renderBind(
        listItem: Gtk.ListItem,
        expander: Gtk.TreeExpander,
        treeListRow: Gtk.TreeListRow,
        id: string,
        fiberRoot: Reconciler.FiberRoot,
    ): void {
        const itemData = this.getStore().getItem(id);

        if (itemData) {
            expander.setIndentForDepth(itemData.indentForDepth ?? true);
            expander.setHideExpander(itemData.hideExpander ?? false);

            if (itemData.indentForIcon !== undefined) {
                expander.setIndentForIcon(itemData.indentForIcon);
            } else {
                expander.setIndentForIcon(treeListRow.isExpandable());
            }
        } else {
            expander.setIndentForIcon(treeListRow.isExpandable());
        }

        const element = this.renderFn?.(itemData?.value ?? null, treeListRow);

        reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {
            if (this.tornDown.has(listItem)) return;
            if (this.estimatedItemHeight !== null) return;
            const currentExpander = this.expanders.get(listItem);
            if (!currentExpander) return;
            const box = currentExpander.getChild();
            if (box) {
                this.clearBoxSizeRequest(box);
            }
        });
    }
}
