import { createContext } from "react";
import type { ListController } from "./list-controller.js";

/**
 * Shares the column view's settled {@link ListController} with the
 * `<GtkColumnViewColumn>` children rendered inside it, so each column
 * registers its own {@link "./column-controller".ColumnController} the moment
 * the list controller exists — `null` until the column view's widget settles.
 */
export const ColumnViewContext = createContext<ListController | null>(null);
