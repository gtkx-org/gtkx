import { batch } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { BaseStore } from "./base-store.js";

export type TreeItemUpdatedCallback = (id: string) => void;

export type TreeItemData<T = unknown> = {
    value: T;
    indentForDepth?: boolean;
    indentForIcon?: boolean;
    hideExpander?: boolean;
};

export class TreeStore extends BaseStore<TreeItemData> {
    private rootIds: string[] = [];
    private newRootIds: string[] = [];
    private children: Map<string, string[]> = new Map();
    private newChildren: Map<string, string[]> = new Map();
    private rootModel: Gtk.StringList;
    private childModels: Map<string, Gtk.StringList> = new Map();
    private onItemUpdated: TreeItemUpdatedCallback | null = null;

    constructor() {
        super();
        this.rootModel = new Gtk.StringList();
    }

    public setOnItemUpdated(callback: TreeItemUpdatedCallback | null): void {
        this.onItemUpdated = callback;
    }

    public override updateItem(id: string, item: TreeItemData): void {
        if (this.items.has(id)) {
            this.items.set(id, item);
            this.onItemUpdated?.(id);
        } else {
            this.addItem(id, item);
        }
    }

    public addItem(id: string, data: TreeItemData, parentId?: string): void {
        this.items.set(id, data);

        if (parentId === undefined) {
            const existingIndex = this.newRootIds.indexOf(id);
            if (existingIndex !== -1) {
                this.newRootIds.splice(existingIndex, 1);
            }
            this.newRootIds.push(id);
        } else {
            let siblings = this.newChildren.get(parentId);
            if (!siblings) {
                siblings = [];
                this.newChildren.set(parentId, siblings);
            }
            const existingIndex = siblings.indexOf(id);
            if (existingIndex !== -1) {
                siblings.splice(existingIndex, 1);
            }
            siblings.push(id);
        }

        this.scheduleSync();
    }

    public removeItem(id: string, parentId?: string): void {
        this.items.delete(id);
        this.newChildren.delete(id);

        if (parentId === undefined) {
            const index = this.newRootIds.indexOf(id);
            if (index !== -1) {
                this.newRootIds.splice(index, 1);
            }
        } else {
            const siblings = this.newChildren.get(parentId);
            if (siblings) {
                const index = siblings.indexOf(id);
                if (index !== -1) {
                    siblings.splice(index, 1);
                }
                if (siblings.length === 0) {
                    this.newChildren.delete(parentId);
                }
            }
        }

        this.scheduleSync();
    }

    public insertItemBefore(id: string, beforeId: string, data: TreeItemData, parentId?: string): void {
        this.items.set(id, data);

        if (parentId === undefined) {
            const existingIndex = this.newRootIds.indexOf(id);
            if (existingIndex !== -1) {
                this.newRootIds.splice(existingIndex, 1);
            }
            const beforeIndex = this.newRootIds.indexOf(beforeId);
            if (beforeIndex === -1) {
                this.newRootIds.push(id);
            } else {
                this.newRootIds.splice(beforeIndex, 0, id);
            }
        } else {
            let siblings = this.newChildren.get(parentId);
            if (!siblings) {
                siblings = [];
                this.newChildren.set(parentId, siblings);
            }
            const existingIndex = siblings.indexOf(id);
            if (existingIndex !== -1) {
                siblings.splice(existingIndex, 1);
            }
            const beforeIndex = siblings.indexOf(beforeId);
            if (beforeIndex === -1) {
                siblings.push(id);
            } else {
                siblings.splice(beforeIndex, 0, id);
            }
        }

        this.scheduleSync();
    }

    public override getItem(id: string): TreeItemData | undefined {
        return this.items.get(id);
    }

    public getRootModel(): Gtk.StringList {
        return this.rootModel;
    }

    public getChildrenModel(parentId: string): Gtk.StringList | null {
        const childIds = this.children.get(parentId) ?? this.newChildren.get(parentId);
        if (!childIds || childIds.length === 0) {
            return null;
        }

        let model = this.childModels.get(parentId);
        if (!model) {
            model = new Gtk.StringList(childIds);
            this.childModels.set(parentId, model);
        }

        return model;
    }

    public hasChildren(parentId: string): boolean {
        const childIds = this.children.get(parentId);
        return childIds !== undefined && childIds.length > 0;
    }

    protected override sync(): void {
        const oldRootLength = this.rootIds.length;
        batch(() => this.rootModel.splice(0, oldRootLength, this.newRootIds.length > 0 ? this.newRootIds : undefined));
        this.rootIds = [...this.newRootIds];

        for (const [parentId, newChildIds] of this.newChildren) {
            const model = this.childModels.get(parentId);
            if (model) {
                const oldLength = model.getNItems();
                batch(() => model.splice(0, oldLength, newChildIds.length > 0 ? newChildIds : undefined));
            }
        }

        for (const [parentId] of this.children) {
            if (!this.newChildren.has(parentId)) {
                this.childModels.delete(parentId);
            }
        }

        this.children = new Map(this.newChildren);
    }
}
