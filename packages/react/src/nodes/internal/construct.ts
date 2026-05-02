import type { NativeClass, Type } from "@gtkx/ffi";
import { Object as GObject, Value } from "@gtkx/ffi/gobject";
import { CONSTRUCTION_META } from "../../generated/internal.js";
import type { Container, ContainerClass, Props } from "../../types.js";

type ConstructionPropMeta = {
    girName: string;
    ffiType: Type;
    constructOnly?: true;
};

function collectMetaPropsForType(
    meta: Record<string, ConstructionPropMeta>,
    props: Props,
    seen: Set<string>,
    result: Array<{ girName: string; ffiType: Type; value: unknown }>,
): void {
    for (const [camelName, propMeta] of Object.entries(meta)) {
        if (seen.has(camelName)) continue;
        seen.add(camelName);
        if (props[camelName] !== undefined) {
            result.push({
                girName: propMeta.girName,
                ffiType: propMeta.ffiType,
                value: props[camelName],
            });
        }
    }
}

function collectConstructionProps(
    containerClass: ContainerClass,
    props: Props,
): Array<{ girName: string; ffiType: Type; value: unknown }> {
    const result: Array<{ girName: string; ffiType: Type; value: unknown }> = [];
    const seen = new Set<string>();

    // biome-ignore lint/complexity/noBannedTypes: Walking prototype chain requires Function type
    let current: Function | null = containerClass;
    while (current) {
        const typeName = (current as NativeClass).glibTypeName;
        if (!typeName) break;

        const meta: Record<string, ConstructionPropMeta> | undefined = CONSTRUCTION_META[typeName];
        if (meta) {
            collectMetaPropsForType(meta, props, seen, result);
        }

        current = Object.getPrototypeOf(current);
        if (current === Object || current === Function) break;
    }

    return result;
}

export function createContainerWithProperties(containerClass: ContainerClass, props: Props): Container {
    const gtype = containerClass.getGType();
    const constructionProps = collectConstructionProps(containerClass, props);

    const names: string[] = [];
    const values: Value[] = [];

    for (const { girName, ffiType, value } of constructionProps) {
        names.push(girName);
        values.push(Value.newFrom(ffiType, value));
    }

    return GObject.newWithProperties(gtype, names, values) as unknown as Container;
}
