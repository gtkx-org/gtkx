import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import type { builtinQueries } from "./queries.js";
import type { Container } from "./traversal.js";
import type { BoundCustomQueries, DebugUtilities, QueryMap } from "./types.js";

/**
 * The set of built-in queries (getBy, findBy, queryBy, and their All variants)
 * bound to a specific container.
 */
type BoundQueries = BoundCustomQueries<typeof builtinQueries>;
/**
 * The global screen object's shape: built-in queries scoped to the current
 * toplevels, plus debug utilities.
 */
type Screen = BoundQueries & DebugUtilities;

/**
 * The result of a render call: queries scoped to the rendered tree, debug
 * utilities, and controls for updating or tearing down the render.
 *
 * @typeParam Q Custom queries provided at render time, merged with the built-in ones.
 */
type RenderResult<Q extends QueryMap = Record<never, never>> = BoundQueries &
    BoundCustomQueries<Q> &
    DebugUtilities & {
        /** The top-level widget the element was rendered into. */
        container: Gtk.Widget;
        /** The root the queries are scoped to (defaults to all toplevels). */
        baseElement: Container;
        /** Unmounts the rendered tree and disposes its resources. */
        unmount: () => Promise<void>;
        /** Re-renders the tree with a new element, reusing the same root. */
        rerender: (element: ReactNode) => Promise<void>;
    };

export { type BoundQueries, type Screen, type RenderResult };
