import * as Gtk from "@gtkx/gi/gtk";
import { ancestorFor } from "../traversal.js";

type NotebookTab = { notebook: Gtk.Notebook; index: number };

const tabLabelsFor = (notebook: Gtk.Notebook): (Gtk.Widget | null)[] => {
    const labels: (Gtk.Widget | null)[] = [];

    for (let index = 0; index < notebook.getNPages(); index++) {
        const child = notebook.getNthPage(index);
        labels.push(child === null ? null : notebook.getPage(child).tab);
    }

    return labels;
};

const isNested = (outer: Gtk.Widget, inner: Gtk.Widget): boolean => outer === inner || inner.isAncestor(outer);

const isSameTab = (tab: Gtk.Widget, label: Gtk.Widget | null): boolean =>
    label !== null && (isNested(tab, label) || isNested(label, tab));

const tabIndexFor = (notebook: Gtk.Notebook, tab: Gtk.Widget): number => {
    const matches = tabLabelsFor(notebook)
        .map((label, index) => (isSameTab(tab, label) ? index : -1))
        .filter((index) => index >= 0);

    return matches.length === 1 ? matches[0] ?? -1 : -1;
};

const notebookTabFor = (widget: Gtk.Widget): NotebookTab | null => {
    if (widget.getAccessibleRole() !== Gtk.AccessibleRole.TAB) {
        return null;
    }

    const notebook = ancestorFor(widget, Gtk.Notebook);
    const index = notebook === null ? -1 : tabIndexFor(notebook, widget);

    return notebook === null || index < 0 ? null : { notebook, index };
};

const isNotebookTab = (widget: Gtk.Widget): boolean => notebookTabFor(widget) !== null;

const applyTabClick = (widget: Gtk.Widget): void => {
    const tab = notebookTabFor(widget);

    if (tab === null) {
        return;
    }

    if (tab.notebook.getFocusOnClick()) {
        tab.notebook.grabFocus();
    }

    tab.notebook.setCurrentPage(tab.index);
};

export { applyTabClick, isNotebookTab };
