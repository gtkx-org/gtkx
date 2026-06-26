import type { GirCallback } from "./callback.js";
import type { GirClass } from "./class.js";
import type { GirEnum } from "./enum.js";
import type { GirAlias, GirNamespace } from "./namespace.js";
import type { GirRecord } from "./record.js";
import type { StructuralType } from "./type-id.js";

export type EntityType =
    | { kind: "class"; namespace: GirNamespace; value: GirClass }
    | { kind: "interface"; namespace: GirNamespace; value: GirClass }
    | { kind: "record"; namespace: GirNamespace; value: GirRecord }
    | { kind: "enum"; namespace: GirNamespace; value: GirEnum }
    | { kind: "callback"; namespace: GirNamespace; value: GirCallback }
    | { kind: "alias"; namespace: GirNamespace; value: GirAlias };

export type GirType = StructuralType | EntityType;
