import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ItemResolver } from "../utils/item-resolver.js";
import { useSelectionModel } from "./use-selection-model.js";

interface ControlledSelectionInput<T, S> {
    base: Gio.ListModel;
    resolver: ItemResolver<T, S>;
    selectionMode: Gtk.SelectionMode | null | undefined;
    selectedIds: string[] | null | undefined;
    onSelectionChanged: ((ids: string[]) => void) | null | undefined;
}

export const useControlledSelectionModel = <T, S>(
    externalModel: Gio.ListModel | undefined,
    input: ControlledSelectionInput<T, S>,
): Gtk.SelectionModel => {
    const controlledSelection = useSelectionModel<T, S>({
        base: input.base,
        selectionMode: input.selectionMode,
        selectedIds: input.selectedIds,
        onSelectionChanged: input.onSelectionChanged,
        resolver: input.resolver,
    });
    return externalModel === undefined ? controlledSelection : (externalModel as Gtk.SelectionModel);
};
