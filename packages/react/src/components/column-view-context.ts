import { type Context, createContext } from "react";
import type { ListController } from "./list-controller.js";

export const ColumnViewContext: Context<ListController | null> = createContext<ListController | null>(null);
