import type * as Gtk from "@gtkx/ffi/gtk";
import { NOTEBOOK_CLASSES } from "../generated/internal.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { matchesAnyClass } from "./internal/utils.js";
import { NotebookPageNode } from "./notebook-page.js";
import { WidgetNode } from "./widget.js";

class NotebookNode extends WidgetNode<Gtk.Notebook> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesAnyClass(NOTEBOOK_CLASSES, containerOrClass);
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof NotebookPageNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'Notebook': expected Notebook.Page`);
        }

        child.setNotebook(this.container);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof NotebookPageNode) || !(before instanceof NotebookPageNode)) {
            throw new Error(`Cannot insert '${child.typeName}' to 'Notebook': expected Notebook.Page`);
        }

        const beforePosition = this.container.pageNum(before.getChild());
        child.setPosition(beforePosition);
        child.setNotebook(this.container);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof NotebookPageNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'Notebook': expected Notebook.Page`);
        }

        child.setPosition(null);
    }
}

registerNodeClass(NotebookNode);
