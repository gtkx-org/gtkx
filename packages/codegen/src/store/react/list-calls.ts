import type { ListProp } from "@gtkx/config";

export const addCalls = (add: ListProp["add"]): string[] => (Array.isArray(add) ? [...add] : [add]);
