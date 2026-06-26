import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import type { builtinQueries } from "./queries.js";
import type { Container } from "./traversal.js";
import type { BoundCustomQueries, DebugUtilities, QueryMap } from "./types.js";

/**
 * The built-in queries bound to a container: every `getBy`/`queryBy`/`findBy`
 * family from {@link builtinQueries} with the container argument pre-applied.
 */
export type BoundQueries = BoundCustomQueries<typeof builtinQueries>;

/**
 * The global `screen` shape: the document-bound built-in queries plus the
 * debugging utilities.
 */
export type Screen = BoundQueries & DebugUtilities;

/**
 * The result of {@link render}: the bound built-in queries, any custom queries,
 * the debug utilities, and the lifecycle handles for the mounted tree.
 */
export type RenderResult<Q extends QueryMap = Record<never, never>> = BoundQueries &
    BoundCustomQueries<Q> &
    DebugUtilities & {
        container: Gtk.Widget;
        baseElement: Container;
        unmount: () => Promise<void>;
        rerender: (element: ReactNode) => Promise<void>;
    };
