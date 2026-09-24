import type * as Gtk from "@gtkx/gi/gtk";
import type { RefObject } from "react";

type SelectableChild = { isSelected: () => boolean };

const getSelection = <T extends Gtk.Widget & SelectableChild>(refs: RefObject<T | null>[]): boolean[] =>
    refs.map((ref) => {
        if (ref.current === null) {
            throw new Error("Selection fixture did not mount");
        }

        return ref.current.isSelected();
    });

export { getSelection };
