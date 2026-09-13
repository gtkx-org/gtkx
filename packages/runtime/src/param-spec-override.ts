import type { AnyClass } from "@gtkx/utils";
import type {
    descriptorFreePropertySpec,
    propertyMapOverride,
    writablePropertyMapOverride,
} from "./property-brand.js";
import type { Camelized, Dashed } from "./property-types.js";
import { newParamSpecOverride } from "./properties.js";
import { wrapHandle } from "./registry.js";

type SourceInstance<TSource> = [TSource] extends [AnyClass]
    ? TSource extends {
        __impl__: (...args: never[]) => infer TInstance;
    }
        ? TInstance
        : TSource extends AnyClass<infer TInstance>
            ? TInstance
            : never
    : never;

type ReadableProperties<TInstance> = TInstance extends {
    [propertyMapOverride]?: infer TResolver;
}
    ? TResolver extends () => infer TMap
        ? NonNullable<TMap>
        : TInstance extends { __properties__: infer TMap }
            ? NonNullable<TMap>
            : object
    : TInstance extends { __properties__: infer TMap }
        ? NonNullable<TMap>
        : object;

type WritableProperties<TInstance> = TInstance extends {
    [writablePropertyMapOverride]?: infer TResolver;
}
    ? TResolver extends () => infer TMap
        ? NonNullable<TMap>
        : TInstance extends { __writableProperties__: infer TMap }
            ? NonNullable<TMap>
            : object
    : TInstance extends { __writableProperties__: infer TMap }
        ? NonNullable<TMap>
        : object;

type OverridePropertySpec<TParamSpec, TName extends string, TSource> = [TSource] extends [AnyClass]
    ? [SourceInstance<TSource>] extends [never]
            ? TParamSpec
            : Camelized<Dashed<TName>> extends
            | keyof ReadableProperties<SourceInstance<TSource>> |
            keyof WritableProperties<SourceInstance<TSource>>
                ? TParamSpec & { readonly [descriptorFreePropertySpec]: true }
                : TParamSpec
    : TParamSpec;

type ParamSpecOverride<TParamSpec> =
    <const TName extends string, const TSource extends bigint | AnyClass>(
        name: TName,
        source: TSource,
    ) => OverridePropertySpec<TParamSpec, TName, TSource>;

const createParamSpecOverride = <TParamSpec extends object>(
    paramSpecClass: AnyClass<TParamSpec>,
): ParamSpecOverride<TParamSpec> => (name, source) =>
    wrapHandle(newParamSpecOverride(name, source), paramSpecClass) as
        OverridePropertySpec<TParamSpec, typeof name, typeof source>;

export { createParamSpecOverride, type ParamSpecOverride };
