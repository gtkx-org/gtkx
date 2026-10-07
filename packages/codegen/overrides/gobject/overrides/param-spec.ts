import { type AnyClass, newParamSpecOverride, wrapHandle } from "@gtkx/runtime";
import type {
    Camelized,
    Dashed,
    descriptorFreePropertySpec,
    ReadableProperties,
    WritableProperties,
} from "@gtkx/runtime/internal";
import { ParamSpec } from "../gobject.js";

type SourceInstance<TSource> = [TSource] extends [AnyClass]
    ? TSource extends {
        __impl__: (...args: never[]) => infer TInstance;
    }
        ? TInstance
        : TSource extends AnyClass<infer TInstance>
            ? TInstance
            : never
    : never;

type OverridePropertySpec<TName extends string, TSource> = [TSource] extends [AnyClass]
    ? [SourceInstance<TSource>] extends [never]
            ? ParamSpec
            : Camelized<Dashed<TName>> extends
            | keyof ReadableProperties<SourceInstance<TSource>> |
            keyof WritableProperties<SourceInstance<TSource>>
                ? ParamSpec & { readonly [descriptorFreePropertySpec]: true }
                : ParamSpec
    : ParamSpec;

/**
 * Creates a `ParamSpec` overriding a property declared by a parent class or interface.
 * This exposes the non-introspectable `g_param_spec_override` operation.
 *
 * Install the result through `registerClass`'s `properties` option to give the subclass its
 * own storage and change notifications. The original type, flags, and default are preserved.
 *
 * @param name Canonical property name.
 * @param source GType, registered wrapper class, or interface declaring the property.
 * @returns An override spec ready to install on a subclass.
 * @throws If `source` is not a GType or registered class/interface, or declares no such property.
 */
export function paramSpecOverride<const TName extends string, const TSource extends bigint | AnyClass>(
    name: TName,
    source: TSource,
): OverridePropertySpec<TName, TSource> {
    return wrapHandle(newParamSpecOverride(name, source), ParamSpec) as OverridePropertySpec<TName, TSource>;
}
