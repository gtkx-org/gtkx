import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";

interface SectionData {
    id: string;
    model: Gtk.StringList;
    itemIds: string[];
    pendingBatch: string[] | null;
}

export abstract class SectionedListStore {
    protected ids: string[] = [];
    protected idToIndex = new Map<string, number>();
    protected model = new Gtk.StringList();
    protected pendingBatch: string[] | null = null;

    protected sectioned = false;
    protected sections: SectionData[] = [];
    protected sectionById = new Map<string, SectionData>();
    protected itemToSection = new Map<string, string>();
    protected headerValues = new Map<string, unknown>();
    protected sectionContainer: Gio.ListStore | null = null;
    protected flatModel: Gtk.FlattenListModel | null = null;

    public enableSections(): void {
        if (this.sectioned) return;
        this.sectioned = true;
        this.sectionContainer = new Gio.ListStore(GObject.typeFromName("GtkStringList"));
        this.flatModel = new Gtk.FlattenListModel(this.sectionContainer);
    }

    public beginBatch(): void {
        if (this.sectioned) {
            for (const section of this.sections) {
                section.pendingBatch = [];
            }
        } else {
            this.pendingBatch = [];
        }
    }

    public flushBatch(): void {
        if (this.sectioned) {
            for (const section of this.sections) {
                const batch = section.pendingBatch;
                section.pendingBatch = null;
                if (batch && batch.length > 0) {
                    section.model.splice(0, 0, batch);
                }
            }
        } else {
            const batch = this.pendingBatch;
            this.pendingBatch = null;
            if (batch && batch.length > 0) {
                this.model.splice(0, 0, batch);
            }
        }
    }

    public addSection(id: string, value: unknown): void {
        if (!this.sectioned) this.enableSections();

        this.headerValues.set(id, value);
        if (this.sectionById.has(id)) return;

        const sectionModel = new Gtk.StringList();
        const section: SectionData = {
            id,
            model: sectionModel,
            itemIds: [],
            pendingBatch: this.getInitialPendingBatch(),
        };
        this.sections.push(section);
        this.sectionById.set(id, section);
        this.sectionContainer?.append(sectionModel);
    }

    public removeSection(id: string): void {
        const section = this.sectionById.get(id);
        if (!section) return;

        for (const itemId of [...section.itemIds]) {
            this.removeItemFromSection(itemId);
        }

        const sectionIndex = this.sections.indexOf(section);
        if (sectionIndex >= 0) {
            this.sections.splice(sectionIndex, 1);
            this.sectionContainer?.remove(sectionIndex);
        }
        this.sectionById.delete(id);
        this.headerValues.delete(id);
    }

    public removeItemFromSection(itemId: string): void {
        const sectionId = this.itemToSection.get(itemId);
        if (!sectionId) return;

        const section = this.sectionById.get(sectionId);
        if (!section) return;

        const indexInSection = section.itemIds.indexOf(itemId);
        if (indexInSection >= 0) {
            section.itemIds.splice(indexInSection, 1);
            section.model.remove(indexInSection);
        }

        this.itemToSection.delete(itemId);
        this.onItemRemoved(itemId);
        this.rebuildGlobalIndices();
    }

    public removeItem(id: string): void {
        if (this.sectioned) {
            this.removeItemFromSection(id);
            return;
        }

        const index = this.idToIndex.get(id);
        if (index === undefined) return;

        this.model.remove(index);
        this.ids.splice(index, 1);
        this.idToIndex.delete(id);
        this.rebuildIndices(index);
        this.onItemRemoved(id);
    }

    public addItemToSection(sectionId: string, itemId: string, item: unknown): void {
        const section = this.sectionById.get(sectionId);
        if (!section) return;

        this.onItemAdded(itemId, item);
        this.itemToSection.set(itemId, sectionId);
        section.itemIds.push(itemId);
        this.rebuildGlobalIndices();

        const modelString = this.getModelString(itemId, item);
        if (section.pendingBatch) {
            section.pendingBatch.push(modelString);
        } else {
            section.model.append(modelString);
        }
    }

    public addItemsToSection(sectionId: string, items: { itemId: string; item: unknown }[]): void {
        const section = this.sectionById.get(sectionId);
        if (!section) return;
        if (items.length === 0) return;

        const modelStrings: string[] = [];
        for (const { itemId, item } of items) {
            this.onItemAdded(itemId, item);
            this.itemToSection.set(itemId, sectionId);
            section.itemIds.push(itemId);
            modelStrings.push(this.getModelString(itemId, item));
        }

        this.rebuildGlobalIndices();

        if (section.pendingBatch) {
            for (const s of modelStrings) {
                section.pendingBatch.push(s);
            }
        } else {
            section.model.splice(section.model.getNItems(), 0, modelStrings);
        }
    }

    public insertItemToSectionBefore(sectionId: string, itemId: string, beforeId: string, item: unknown): void {
        const section = this.sectionById.get(sectionId);
        if (!section) return;

        this.onItemAdded(itemId, item);
        this.itemToSection.set(itemId, sectionId);

        const modelString = this.getModelString(itemId, item);
        const beforeIndex = section.itemIds.indexOf(beforeId);
        if (beforeIndex >= 0) {
            section.itemIds.splice(beforeIndex, 0, itemId);
            this.rebuildGlobalIndices();
            section.model.splice(beforeIndex, 0, [modelString]);
        } else {
            section.itemIds.push(itemId);
            this.rebuildGlobalIndices();
            section.model.append(modelString);
        }
    }

    public updateHeaderValue(sectionId: string, value: unknown): void {
        this.headerValues.set(sectionId, value);
    }

    public isSectioned(): boolean {
        return this.sectioned;
    }

    public getModel(): Gio.ListModel {
        if (this.sectioned && this.flatModel) return this.flatModel;
        return this.model;
    }

    public getIdAtIndex(index: number): string | null {
        return this.ids[index] ?? null;
    }

    public getIndexById(id: string): number | null {
        return this.idToIndex.get(id) ?? null;
    }

    protected rebuildGlobalIndices(): void {
        this.ids = [];
        this.idToIndex.clear();
        for (const section of this.sections) {
            for (const itemId of section.itemIds) {
                this.idToIndex.set(itemId, this.ids.length);
                this.ids.push(itemId);
            }
        }
    }

    protected rebuildIndices(fromIndex: number): void {
        for (let i = fromIndex; i < this.ids.length; i++) {
            this.idToIndex.set(this.ids[i] as string, i);
        }
    }

    protected abstract getInitialPendingBatch(): string[] | null;

    protected abstract getModelString(itemId: string, item: unknown): string;

    protected onItemAdded(_itemId: string, _item: unknown): void {}

    protected onItemRemoved(_itemId: string): void {}
}
