import type { Type } from "@gtkx/native";

export type SignalMeta = Record<string, { params: Type[]; returnType?: Type }>;
