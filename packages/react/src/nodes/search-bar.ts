import type * as Gtk from "@gtkx/ffi/gtk";
import type { GtkSearchBarProps } from "../jsx.js";
import { type PropDescriptorTable, signal } from "./internal/apply-props.js";
import { WidgetNode } from "./widget.js";

type SearchBarProps = Pick<GtkSearchBarProps, "onSearchModeChanged">;

export class SearchBarNode extends WidgetNode<Gtk.SearchBar, SearchBarProps> {
    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            onSearchModeChanged: signal("notify::search-mode-enabled", {
                getArgs: () => [this.container.getSearchMode()],
            }),
        };
    }
}
