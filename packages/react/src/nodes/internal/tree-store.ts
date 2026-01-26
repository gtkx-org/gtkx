import * as Gtk from "@gtkx/ffi/gtk";

export type TreeItemUpdatedCallback = (id: string) => void;

export type TreeItemData<T = unknown> = {
    value: T;
    indentForDepth?: boolean;
    indentForIcon?: boolean;
    hideExpander?: boolean;
};

export class TreeStore {
    private rootIds: string[] = [];
    private children: Map<string, string[]> = new Map();
    private rootModel: Gtk.StringList = new Gtk.StringList();
    private childModels: Map<string, Gtk.StringList> = new Map();
    private items: Map<string, TreeItemData> = new Map();
    private onItemUpdated: TreeItemUpdatedCallback | null = null;

    public setOnItemUpdated(callback: TreeItemUpdatedCallback | null): void {
        this.onItemUpdated = callback;
    }

    public updateItem(id: string, item: TreeItemData): void {
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
            const existingIndex = this.rootIds.indexOf(id);
            if (existingIndex >= 0) {
                this.rootModel.remove(existingIndex);
                this.rootIds.splice(existingIndex, 1);
            }

            this.rootIds.push(id);
            this.rootModel.append(id);
        } else {
            let siblings = this.children.get(parentId);
            if (!siblings) {
                siblings = [];
                this.children.set(parentId, siblings);
            }

            const existingIndex = siblings.indexOf(id);
            if (existingIndex >= 0) {
                const model = this.childModels.get(parentId);
                if (model) {
                    model.remove(existingIndex);
                }
                siblings.splice(existingIndex, 1);
            }

            siblings.push(id);

            let model = this.childModels.get(parentId);
            if (!model) {
                model = new Gtk.StringList();
                this.childModels.set(parentId, model);
            }
            model.append(id);
        }
    }

    public removeItem(id: string, parentId?: string): void {
        this.items.delete(id);
        this.children.delete(id);
        this.childModels.delete(id);

        if (parentId === undefined) {
            const index = this.rootIds.indexOf(id);
            if (index >= 0) {
                this.rootIds.splice(index, 1);
                this.rootModel.remove(index);
            }
        } else {
            const siblings = this.children.get(parentId);
            if (siblings) {
                const index = siblings.indexOf(id);
                if (index >= 0) {
                    siblings.splice(index, 1);
                    const model = this.childModels.get(parentId);
                    if (model) {
                        model.remove(index);
                    }
                }
                if (siblings.length === 0) {
                    this.children.delete(parentId);
                }
            }
        }
    }

    public insertItemBefore(id: string, beforeId: string, data: TreeItemData, parentId?: string): void {
        this.items.set(id, data);

        if (parentId === undefined) {
            const existingIndex = this.rootIds.indexOf(id);
            if (existingIndex >= 0) {
                this.rootModel.remove(existingIndex);
                this.rootIds.splice(existingIndex, 1);
            }

            const beforeIndex = this.rootIds.indexOf(beforeId);
            if (beforeIndex < 0) {
                this.rootIds.push(id);
                this.rootModel.append(id);
            } else {
                this.rootIds.splice(beforeIndex, 0, id);
                this.rootModel.splice(beforeIndex, 0, [id]);
            }
        } else {
            let siblings = this.children.get(parentId);
            if (!siblings) {
                siblings = [];
                this.children.set(parentId, siblings);
            }

            let model = this.childModels.get(parentId);
            if (!model) {
                model = new Gtk.StringList();
                this.childModels.set(parentId, model);
            }

            const existingIndex = siblings.indexOf(id);
            if (existingIndex >= 0) {
                model.remove(existingIndex);
                siblings.splice(existingIndex, 1);
            }

            const beforeIndex = siblings.indexOf(beforeId);
            if (beforeIndex < 0) {
                siblings.push(id);
                model.append(id);
            } else {
                siblings.splice(beforeIndex, 0, id);
                model.splice(beforeIndex, 0, [id]);
            }
        }
    }

    public getItem(id: string): TreeItemData | undefined {
        return this.items.get(id);
    }

    public getRootModel(): Gtk.StringList {
        return this.rootModel;
    }

    public getChildrenModel(parentId: string): Gtk.StringList | null {
        const childIds = this.children.get(parentId);
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
}
