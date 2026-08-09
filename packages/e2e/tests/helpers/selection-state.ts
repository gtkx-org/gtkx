import type * as Gtk from "@gtkx/gi/gtk";
import type { RefObject } from "react";

type SelectableChild = { isSelected: () => boolean };

const getSelection = <T extends Gtk.Widget & SelectableChild>(refs: RefObject<T | null>[]): boolean[] =>
    refs.map((ref) => ref.current?.isSelected() ?? false);

export { getSelection };
