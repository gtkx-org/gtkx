import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode, RefObject } from "react";
import { GtkLabel, GtkNotebook, GtkNotebookPage } from "@gtkx/jsx/gtk";
import type { ChildrenBuilder } from "./render-children.js";

type NotebookPageContent = (label: string) => ReactNode;

const buildNotebookFrom =
    (ref: RefObject<Gtk.Notebook | null>, content: NotebookPageContent): ChildrenBuilder<string> =>
        (pages) => (
            <GtkNotebook ref={ref}>
                {pages.map((label) => (
                    <GtkNotebookPage key={label} tabLabel={label}>
                        {content(label)}
                    </GtkNotebookPage>
                ))}
            </GtkNotebook>
        );

const buildPlainNotebook = (ref: RefObject<Gtk.Notebook | null>): ChildrenBuilder<string> =>
    buildNotebookFrom(ref, (label) => <GtkLabel>{label}</GtkLabel>);

const buildLabelNotebook = (ref: RefObject<Gtk.Notebook | null>): ChildrenBuilder<string> =>
    buildNotebookFrom(ref, (label) => <GtkLabel>{`Content: ${label}`}</GtkLabel>);

export { buildPlainNotebook, buildLabelNotebook, type NotebookPageContent };
