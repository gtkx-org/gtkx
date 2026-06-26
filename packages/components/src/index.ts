/**
 * Higher-level GTKX components: declarative, opinionated abstractions layered on
 * top of the generated `@gtkx/jsx` element bindings and the `@gtkx/react`
 * runtime. Each component pairs a GObject widget with a gtkx-authored prop
 * surface (item models, render callbacks, selection, sorting) and is exported
 * under an unprefixed name to distinguish it from the raw `Gtk*`/`Adw*`/`G*`
 * intrinsic element it builds upon.
 *
 * @packageDocumentation
 */

export { ColumnView, type ColumnViewProps } from "./column-view.js";
export { type ColumnRenderItemInfo, ColumnViewColumn, type ColumnViewColumnProps } from "./column-view-column.js";
export { ConstraintLayout, type ConstraintLayoutProps } from "./constraint-layout.js";
export type { ConstraintGuideProps, ConstraintProps, ConstraintVflProps } from "./constraint-layout-apply.js";
export {
    ComboRow,
    type ComboRowProps,
    DropDown,
    type DropDownProps,
    type DropDownRenderItemInfo,
} from "./drop-down.js";
export { type GridRenderItemInfo, GridView, type GridViewProps } from "./grid-view.js";
export { type ListRenderItemInfo, ListView, type ListViewProps } from "./list-view.js";
export { Menu, type MenuProps } from "./menu.js";
export type { ItemNode, MenuEntry, SectionNode } from "./types.js";
