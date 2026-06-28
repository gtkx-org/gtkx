import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import type { builtinQueries } from "./queries.js";
import type { Container } from "./traversal.js";
import type { BoundCustomQueries, DebugUtilities, QueryMap } from "./types.js";

export type BoundQueries = BoundCustomQueries<typeof builtinQueries>;

export type Screen = BoundQueries & DebugUtilities;

export type RenderResult<Q extends QueryMap = Record<never, never>> = BoundQueries &
    BoundCustomQueries<Q> &
    DebugUtilities & {
        container: Gtk.Widget;
        baseElement: Container;
        unmount: () => Promise<void>;
        rerender: (element: ReactNode) => Promise<void>;
    };
