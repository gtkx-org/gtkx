import { SectionedListStore } from "./base-sectioned-store.js";

export class SimpleListStore extends SectionedListStore {
    private batchMode = false;

    public override beginBatch(): void {
        this.batchMode = true;
        super.beginBatch();
    }

    public override flushBatch(): void {
        this.batchMode = false;
        super.flushBatch();
    }

    protected override getInitialPendingBatch(): string[] | null {
        return this.batchMode ? [] : null;
    }

    protected override getModelString(_itemId: string, item: unknown): string {
        return item as string;
    }

    public getHeaderValueByLabel(label: string): unknown {
        for (const section of this.sections) {
            if (section.model.getNItems() > 0) {
                const firstLabel = section.model.getString(0);
                if (firstLabel === label) {
                    return this.headerValues.get(section.id);
                }
            }
        }
        return undefined;
    }

    public addItem(id: string, label: string): void {
        if (this.sectioned) {
            return;
        }

        this.idToIndex.set(id, this.ids.length);
        this.ids.push(id);

        if (this.pendingBatch) {
            this.pendingBatch.push(label);
        } else {
            this.model.append(label);
        }
    }

    public appendItem(id: string, label: string): void {
        const existingIndex = this.idToIndex.get(id);

        if (existingIndex !== undefined) {
            this.model.remove(existingIndex);
            this.ids.splice(existingIndex, 1);
            this.rebuildIndices(existingIndex);
        }

        this.idToIndex.set(id, this.ids.length);
        this.ids.push(id);
        this.model.append(label);
    }

    public insertItemBefore(id: string, beforeId: string, label: string): void {
        const beforeIndex = this.idToIndex.get(beforeId);
        if (beforeIndex === undefined) {
            this.addItem(id, label);
        } else {
            this.ids.splice(beforeIndex, 0, id);
            this.rebuildIndices(beforeIndex);
            this.model.splice(beforeIndex, 0, [label]);
        }
    }

    public updateItem(id: string, item: unknown): void {
        const label = item as string;
        if (this.sectioned) {
            const sectionId = this.itemToSection.get(id);
            if (!sectionId) return;
            const section = this.sectionById.get(sectionId);
            if (!section) return;
            const indexInSection = section.itemIds.indexOf(id);
            if (indexInSection >= 0) {
                section.model.splice(indexInSection, 1, [label]);
            }
            return;
        }
        const index = this.idToIndex.get(id);
        if (index === undefined) {
            this.addItem(id, label);
            return;
        }
        this.model.splice(index, 1, [label]);
    }

    public getItem(id: string): string | null {
        if (this.sectioned) {
            const sectionId = this.itemToSection.get(id);
            if (!sectionId) return null;
            const section = this.sectionById.get(sectionId);
            if (!section) return null;
            const indexInSection = section.itemIds.indexOf(id);
            if (indexInSection < 0) return null;
            return section.model.getString(indexInSection);
        }
        const index = this.idToIndex.get(id);
        if (index === undefined) return null;
        return this.model.getString(index);
    }
}
