import type { GirRecord } from "./boxed.js";
import type { GirCallback } from "./callback.js";
import type { GirClass } from "./class.js";
import type { GirEnum } from "./enum.js";
import type { GirNamespace } from "./namespace.js";
import type { StructuralType, TypeId } from "./type-id.js";

export type EntityType =
    | { kind: "class"; namespace: GirNamespace; value: GirClass }
    | { kind: "interface"; namespace: GirNamespace; value: GirClass }
    | { kind: "record"; namespace: GirNamespace; value: GirRecord }
    | { kind: "enum"; namespace: GirNamespace; value: GirEnum }
    | { kind: "callback"; namespace: GirNamespace; value: GirCallback }
    | {
          kind: "alias";
          namespace: GirNamespace;
          target: TypeId | undefined;
          targetCType: string | undefined;
      };

export type GirType = StructuralType | EntityType;
