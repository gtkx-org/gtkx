import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkNotebook, GtkNotebookPage } from "@gtkx/jsx/gtk";
import type { ReactNode, RefObject } from "react";
import type { ChildrenBuilder } from "./render-children.js";

/**
 * Maps a page label to the content rendered inside its `GtkNotebookPage`.
 *
 * @param label - The page's tab label, also used as its React key.
 */
export type NotebookPageContent = (label: string) => ReactNode;

/**
 * Builds a {@link ChildrenBuilder} that renders a `GtkNotebook` bound to `ref`
 * and turns each item label into a `GtkNotebookPage` whose tab label is the
 * item and whose content is produced by `content`.
 *
 * @param ref - Ref attached to the rendered `GtkNotebook`.
 * @param content - Maps each page label to the node rendered inside its page.
 */
const buildNotebookFrom =
    (ref: RefObject<Gtk.Notebook | null>, content: NotebookPageContent): ChildrenBuilder<string> =>
    (pages) => (
        <GtkNotebook ref={ref}>
            {pages.map((label) => (
                <GtkNotebookPage key={label} label={label}>
                    {content(label)}
                </GtkNotebookPage>
            ))}
        </GtkNotebook>
    );

/**
 * Builds a {@link ChildrenBuilder} that renders a `GtkNotebook` whose pages use
 * their label string directly as their content.
 *
 * @param ref - Ref attached to the rendered `GtkNotebook`.
 */
export const buildPlainNotebook = (ref: RefObject<Gtk.Notebook | null>): ChildrenBuilder<string> =>
    buildNotebookFrom(ref, (label) => label);

/**
 * Builds a {@link ChildrenBuilder} that renders a `GtkNotebook` whose pages wrap
 * a `GtkLabel` reading `Content: <label>`.
 *
 * @param ref - Ref attached to the rendered `GtkNotebook`.
 */
export const buildLabelNotebook = (ref: RefObject<Gtk.Notebook | null>): ChildrenBuilder<string> =>
    buildNotebookFrom(ref, (label) => <GtkLabel label={`Content: ${label}`} />);
