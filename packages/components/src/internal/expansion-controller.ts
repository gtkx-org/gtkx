import type * as Gtk from "@gtkx/gi/gtk";
import type { CollectionSource } from "./collection-source.js";

type ExpansionOptions = {
    source: CollectionSource;
    treeModel: Gtk.TreeListModel;
    isMuted: () => boolean;
    onReport: (ids: string[]) => void;
    onRowsChanged: () => void;
};

export class ExpansionController {
    private options: ExpansionOptions;
    private lastReported = "";
    private handler: () => void;

    constructor(options: ExpansionOptions) {
        this.options = options;
        this.handler = () => {
            options.onRowsChanged();
            if (!options.isMuted()) this.report();
        };
        options.treeModel.on("items-changed", this.handler);
    }

    dispose(): void {
        this.options.treeModel.off("items-changed", this.handler);
    }

    apply(expandedIds: string[] | null | undefined): void {
        if (expandedIds == null) return;
        const wanted = new Set(expandedIds);
        this.eachRow((row, id) => {
            const desired = id !== null && wanted.has(id);
            if (row.isExpandable() && row.getExpanded() !== desired) row.setExpanded(desired);
        });
    }

    report(): void {
        const ids: string[] = [];
        this.eachRow((row, id) => {
            if (id !== null && row.getExpanded()) ids.push(id);
        });
        const key = ids.join(" ");
        if (this.lastReported === key) return;
        this.lastReported = key;
        this.options.onReport(ids);
    }

    private eachRow(visit: (row: Gtk.TreeListRow, id: string | null) => void): void {
        const model = this.options.treeModel;
        for (let position = 0; position < model.getNItems(); position++) {
            const row = model.getRow(position);
            if (row === null) continue;
            const holder = row.getItem();
            const id = holder === null ? null : (this.options.source.entryOfHolder(holder)?.id ?? null);
            visit(row, id);
        }
    }
}
