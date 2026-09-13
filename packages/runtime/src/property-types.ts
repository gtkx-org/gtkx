import type { propertyMapOverride, writablePropertyMapOverride } from "./property-brand.js";

/** Converts underscores in a property name to canonical dashes. */
type Dashed<TName extends string> = TName extends `${infer THead}_${infer TTail}`
    ? Dashed<`${THead}-${TTail}`>
    : TName;

/** Converts a dashed property name to its JavaScript spelling. */
type Camelized<TName extends string> = TName extends `${infer THead}-${infer TTail}`
    ? `${THead}${Capitalize<Camelized<TTail>>}`
    : TName;

type ReadableProperties<TInstance> = TInstance extends { [propertyMapOverride]?: infer TResolver }
    ? TResolver extends () => infer TMap
        ? NonNullable<TMap>
        : TInstance extends { __properties__?: infer TMap }
            ? NonNullable<TMap>
            : object
    : TInstance extends { __properties__?: infer TMap }
        ? NonNullable<TMap>
        : object;

type WritableProperties<TInstance> = TInstance extends { [writablePropertyMapOverride]?: infer TResolver }
    ? TResolver extends () => infer TMap
        ? NonNullable<TMap>
        : TInstance extends { __writableProperties__?: infer TMap }
            ? NonNullable<TMap>
            : object
    : TInstance extends { __writableProperties__?: infer TMap }
        ? NonNullable<TMap>
        : object;

export { type Dashed, type Camelized, type ReadableProperties, type WritableProperties };
