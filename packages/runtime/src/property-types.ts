import type { propertyMapOverride, writablePropertyMapOverride } from "./property-brand.js";

/** Converts underscores in a property name to canonical dashes. */
type Dashed<TName extends string> = TName extends `${infer THead}_${infer TTail}` ? Dashed<`${THead}-${TTail}`> : TName;

/** Converts a dashed property name to its JavaScript spelling. */
type Camelized<TName extends string> = TName extends `${infer THead}-${infer TTail}`
    ? `${THead}${Capitalize<Camelized<TTail>>}`
    : TName;

type AvailableProperties<TMap> = {
    [K in keyof TMap as [TMap[K]] extends [never] ? never : K]: TMap[K];
};

type ReadableProperties<TInstance> = TInstance extends { [propertyMapOverride]?: infer TResolver }
    ? TResolver extends () => infer TMap
        ? AvailableProperties<NonNullable<TMap>>
        : TInstance extends { __properties__?: infer TMap }
          ? AvailableProperties<NonNullable<TMap>>
          : object
    : TInstance extends { __properties__?: infer TMap }
      ? AvailableProperties<NonNullable<TMap>>
      : object;

type WritableProperties<TInstance> = TInstance extends { [writablePropertyMapOverride]?: infer TResolver }
    ? TResolver extends () => infer TMap
        ? AvailableProperties<NonNullable<TMap>>
        : TInstance extends { __writableProperties__?: infer TMap }
          ? AvailableProperties<NonNullable<TMap>>
          : object
    : TInstance extends { __writableProperties__?: infer TMap }
      ? AvailableProperties<NonNullable<TMap>>
      : object;

type PropertyValue<TMap, TName extends string> =
    Camelized<Dashed<TName>> extends keyof TMap ? TMap[Camelized<Dashed<TName>>] : unknown;

/**
 * The value read from the property `TName` of `TInstance`, in its native or JavaScript spelling, or
 * `unknown` when the instance's type declares no readable property by that name.
 */
type ReadablePropertyValue<TInstance, TName extends string> = PropertyValue<ReadableProperties<TInstance>, TName>;

/**
 * The value written to the property `TName` of `TInstance`, in its native or JavaScript spelling, or
 * `unknown` when the instance's type declares no writable property by that name.
 */
type WritablePropertyValue<TInstance, TName extends string> = PropertyValue<WritableProperties<TInstance>, TName>;

/**
 * Transforms a value travelling through a property binding, as in GJS: it receives the binding and
 * the value read from one end, and returns whether the conversion succeeded together with the value
 * to write to the other end. The value is ignored when the conversion fails.
 */
type BindingTransform<TBinding, TFrom, TTo> = (binding: TBinding, value: TFrom) => [boolean, TTo] | [false, unknown];

export {
    type BindingTransform,
    type Camelized,
    type Dashed,
    type ReadableProperties,
    type ReadablePropertyValue,
    type WritableProperties,
    type WritablePropertyValue,
};
