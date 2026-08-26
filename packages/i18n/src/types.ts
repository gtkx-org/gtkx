import type {
    Callback,
    FlatNamespace,
    i18n as I18n,
    InitOptions,
    InterpolationMap,
    KeyPrefix,
    Namespace,
    TFunctionDetailedResult,
    TOptions,
    TFunction as UpstreamTFunction,
} from "i18next";
import type * as React from "react";
import type {
    FallbackNs,
    IcuTrans as upstreamIcuTrans,
    IcuTransProps as UpstreamIcuTransProps,
    IcuTransWithoutContext as upstreamIcuTransWithoutContext,
    IcuTransWithoutContextProps as UpstreamIcuTransWithoutContextProps,
    Trans as upstreamTrans,
    Translation as upstreamTranslation,
    TranslationProps as UpstreamTranslationProps,
    TransProps as UpstreamTransProps,
    TransWithoutContext as upstreamTransWithoutContext,
    useTranslation as upstreamUseTranslation,
    UseTranslationResponse as UpstreamUseTranslationResponse,
    WithTranslation as UpstreamWithTranslation,
    withTranslation as upstreamWithTranslation,
    UseTranslationOptions,
    WithTranslationProps,
} from "react-i18next";
import type { TranslationRegistry } from "./index.js";

/** A translatable key emitted by GTKX code generation. */
type RegistryKey = Extract<keyof TranslationRegistry, string>;
/** The generated metadata associated with a translation key. */
type RegistryEntry<Key extends RegistryKey> = TranslationRegistry[Key];
/** Whether code generation found no translation keys. */
type IsRegistryEmpty = [RegistryKey] extends [never] ? true : false;

/** The generated translation entries within a key prefix. */
type ScopedRegistry<KPrefix extends string | undefined> = KPrefix extends "" | undefined
    ? TranslationRegistry
    : KPrefix extends string
        ? {
                [Key in RegistryKey as Key extends `${KPrefix}.${infer LocalKey}` ? LocalKey : never]:
                RegistryEntry<Key>;
            }
        : TranslationRegistry;

/** A translation key accepted for a key prefix. */
type CallKey<KPrefix extends string | undefined> = Extract<keyof ScopedRegistry<KPrefix>, string>;

/** The generated metadata for a prefixed translation key. */
type ScopedRegistryEntry<
    Key extends CallKey<KPrefix>,
    KPrefix extends string | undefined,
> = ScopedRegistry<KPrefix>[Key];

/** The effective key prefix after i18next normalization. */
type NormalizedKeyPrefix<KPrefix> = KPrefix extends ""
    ? undefined
    : KPrefix extends string
        ? KPrefix
        : undefined;

/** The source translation text recorded for an entry. */
type EntryValue<Entry> = Entry extends { value: infer Value extends string } ? Value : never;

/** The context option required by a generated entry. */
type ContextOptions<Entry> = Entry extends { context: infer Context extends string }
    ? { context: Context }
    : { context?: never };

/** The count option accepted by a generated entry. */
type CountOptions<Entry> = Entry extends { kind: "plural" | "pluralDefaults" }
    ? { count: number; ordinal?: never }
    : { count?: never; ordinal?: never };

/** The interpolation variables required by a generated entry. */
type InterpolationOptions<Entry> = Entry extends { interpolated: true }
    ? InterpolationMap<EntryValue<Entry>> | { replace: InterpolationMap<EntryValue<Entry>> }
    : Record<never, never>;

/** An i18next plural fallback property. */
type PluralDefaultKey =
    | "defaultValue_few" |
    "defaultValue_many" |
    "defaultValue_one" |
    "defaultValue_ordinal_few" |
    "defaultValue_ordinal_many" |
    "defaultValue_ordinal_one" |
    "defaultValue_ordinal_other" |
    "defaultValue_ordinal_two" |
    "defaultValue_other" |
    "defaultValue_two" |
    "defaultValue_zero";

/** Plural fallback properties excluded from a basic lookup. */
type PluralDefaultExclusions = Partial<Record<PluralDefaultKey, never>>;

/** Common options accepted for a generated translation entry. */
type BaseEntryOptions<Entry> = Entry extends { value: string }
    ? Omit<
        TOptions,
        "context" | "count" | "defaultValue" | "keyPrefix" | "ordinal" | "replace"
    > &
    InterpolationOptions<Entry> &
    ContextOptions<Entry> &
    CountOptions<Entry> & {
        keyPrefix?: never;
    }
    : never;

/** Options for a lookup without an inline default value. */
type EntryOptions<Entry> = BaseEntryOptions<Entry> & PluralDefaultExclusions & {
    /** Prevents an ungenerated default value from bypassing strict lookup types. */
    defaultValue?: never;
};

/** Options for a lookup with an inline default value. */
type DefaultEntryOptions<Entry, DefaultValue extends string> = BaseEntryOptions<Entry> &
    PluralDefaultExclusions & {
        /** The generated inline fallback translation. */
        defaultValue: DefaultValue;
    };

/** Options for a plural lookup with an `other` fallback. */
type PluralOtherEntryOptions<Entry, DefaultValue extends string> = BaseEntryOptions<Entry> &
    Omit<PluralDefaultExclusions, "defaultValue_other"> & {
        /** Prevents the singular default property in an `other`-only lookup. */
        defaultValue?: never;
    } &
    Record<"defaultValue_other", DefaultValue>;

/** Explicit `one` and `other` plural fallback values. */
type SpecificPluralDefaults<DefaultValueOne extends string, DefaultValueOther extends string> = {
    /** Prevents a general fallback when explicit plural forms are supplied. */
    defaultValue?: never;
} &
Record<"defaultValue_one", DefaultValueOne> &
Record<"defaultValue_other", DefaultValueOther>;

/** A singular general fallback paired with an `other` plural fallback. */
type GeneralSingularDefaults<DefaultValueOne extends string, DefaultValueOther extends string> = {
    /** The singular generated fallback translation. */
    defaultValue: DefaultValueOne;
} &
Partial<Record<"defaultValue_one", never>> &
Record<"defaultValue_other", DefaultValueOther>;

/** A plural general fallback paired with a `one` plural fallback. */
type GeneralPluralDefaults<DefaultValueOne extends string, DefaultValueOther extends string> = {
    /** The plural generated fallback translation. */
    defaultValue: DefaultValueOther;
} &
Record<"defaultValue_one", DefaultValueOne> &
Partial<Record<"defaultValue_other", never>>;

/** A generated singular fallback whose plural fallback is the key. */
type SingularOnlyDefault<DefaultValueOne extends string> = {
    /** Prevents a general fallback for key-backed plurals. */
    defaultValue?: never;
} &
Record<"defaultValue_one", DefaultValueOne> &
Partial<Record<"defaultValue_other", never>>;

/** A generated plural fallback whose singular fallback is the key. */
type PluralOnlyDefault<DefaultValueOther extends string> = {
    /** Prevents a general fallback for key-backed singulars. */
    defaultValue?: never;
} &
Partial<Record<"defaultValue_one", never>> &
Record<"defaultValue_other", DefaultValueOther>;

/** Options matching the generated singular and plural fallback values. */
type PluralDefaultsEntryOptions<
    Entry,
    Key extends string,
    DefaultValueOne extends string,
    DefaultValueOther extends string,
> = BaseEntryOptions<Entry> &
    Omit<PluralDefaultExclusions, "defaultValue_one" | "defaultValue_other"> &
    (
        SpecificPluralDefaults<DefaultValueOne, DefaultValueOther> |
        GeneralSingularDefaults<DefaultValueOne, DefaultValueOther> |
        GeneralPluralDefaults<DefaultValueOne, DefaultValueOther> |
        (DefaultValueOther extends Key ? SingularOnlyDefault<DefaultValueOne> : never) |
        (DefaultValueOne extends Key ? PluralOnlyDefault<DefaultValueOther> : never)
    );

/** Lookup options that request i18next result metadata. */
type DetailedOptions<Options> = Options & {
    /** Requests the detailed i18next result object. */
    returnDetails: true;
};

/** Arguments accepted when looking up a generated point translation. */
type PointLookupArgs<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: ScopedRegistryEntry<Key, KPrefix> extends infer Entry
        ? Entry extends { kind: "point"; required: boolean }
            ? Entry extends { required: true }
                ? [key: Key, options: EntryOptions<Entry>]
                : [key: Key, options?: EntryOptions<Entry>]
            : never
        : never;
}[CallKey<KPrefix>];

/** Arguments accepted for a generated positional fallback. */
type DefaultValueArgs<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: ScopedRegistryEntry<Key, KPrefix> extends infer Entry
        ? Entry extends {
            defaultValue: infer DefaultValue extends string;
            kind: "default" | "plural";
            required: boolean;
        }
            ? Entry extends { required: true }
                ? [key: Key, defaultValue: DefaultValue, options: EntryOptions<Entry>]
                : [key: Key, defaultValue: DefaultValue, options?: EntryOptions<Entry>]
            : never
        : never;
}[CallKey<KPrefix>];

/** A generated key with an object-form fallback value. */
type ObjectDefaultValueKey<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: ScopedRegistryEntry<Key, KPrefix> extends infer Entry
        ? Entry extends {
            defaultValue: string;
            kind: "default" | "plural";
        }
            ? Key
            : never
        : never;
}[CallKey<KPrefix>];

/** Options matching the generated object-form fallback for a key. */
type ObjectDefaultValueOptions<
    Key extends ObjectDefaultValueKey<KPrefix>,
    KPrefix extends string | undefined,
    Entry = ScopedRegistryEntry<Key, KPrefix>,
> = Entry extends {
    defaultValue: infer DefaultValue extends string;
    kind: "default" | "plural";
}
    ? DefaultEntryOptions<Entry, DefaultValue>
    : never;

/** Arguments accepted for an `other`-only plural fallback. */
type PluralOtherArgs<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: ScopedRegistryEntry<Key, KPrefix> extends infer Entry
        ? Entry extends { defaultValue: infer DefaultValue extends string; kind: "plural" }
            ? [key: Key, options: PluralOtherEntryOptions<Entry, DefaultValue>]
            : never
        : never;
}[CallKey<KPrefix>];

/** Arguments accepted for generated singular and plural fallbacks. */
type PluralDefaultsArgs<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: ScopedRegistryEntry<Key, KPrefix> extends infer Entry
        ? Entry extends {
            defaultValueOne: infer DefaultValueOne extends string;
            defaultValueOther: infer DefaultValueOther extends string;
            kind: "pluralDefaults";
        }
            ? [
                  key: Key,
                  options: PluralDefaultsEntryOptions<Entry, Key, DefaultValueOne, DefaultValueOther>,
                ]
            : never
        : never;
}[CallKey<KPrefix>];

/** Detailed-result arguments for a generated point translation. */
type DetailedPointLookupArgs<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: ScopedRegistryEntry<Key, KPrefix> extends infer Entry
        ? Entry extends { kind: "point" }
            ? [key: Key, options: DetailedOptions<EntryOptions<Entry>>]
            : never
        : never;
}[CallKey<KPrefix>];

/** Detailed-result arguments for an `other`-only plural fallback. */
type DetailedPluralOtherArgs<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: ScopedRegistryEntry<Key, KPrefix> extends infer Entry
        ? Entry extends { defaultValue: infer DefaultValue extends string; kind: "plural" }
            ? [key: Key, options: DetailedOptions<PluralOtherEntryOptions<Entry, DefaultValue>>]
            : never
        : never;
}[CallKey<KPrefix>];

/** Detailed-result arguments for singular and plural fallbacks. */
type DetailedPluralDefaultsArgs<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: ScopedRegistryEntry<Key, KPrefix> extends infer Entry
        ? Entry extends {
            defaultValueOne: infer DefaultValueOne extends string;
            defaultValueOther: infer DefaultValueOther extends string;
            kind: "pluralDefaults";
        }
            ? [
                  key: Key,
                  options: DetailedOptions<
                      PluralDefaultsEntryOptions<Entry, Key, DefaultValueOne, DefaultValueOther>
                  >,
                ]
            : never
        : never;
}[CallKey<KPrefix>];

/** Detailed-result arguments for a positional fallback. */
type DetailedDefaultValueArgs<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: ScopedRegistryEntry<Key, KPrefix> extends infer Entry
        ? Entry extends {
            defaultValue: infer DefaultValue extends string;
            kind: "default" | "plural";
        }
            ? [key: Key, defaultValue: DefaultValue, options: DetailedOptions<EntryOptions<Entry>>]
            : never
        : never;
}[CallKey<KPrefix>];

/** Point-translation metadata eligible for an i18next fallback array. */
type FallbackPointEntry<
    Key extends CallKey<KPrefix>,
    KPrefix extends string | undefined,
> = Extract<ScopedRegistryEntry<Key, KPrefix>, { kind: "point" }>;

/** A generated point-translation key eligible for a fallback array. */
type FallbackPointKey<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: [FallbackPointEntry<Key, KPrefix>] extends [never] ? never : Key;
}[CallKey<KPrefix>];

/** Combined generated metadata for a fallback-array branch. */
type FallbackArrayMetadata<Entries> = {
    /** Whether any fallback entry requires interpolation variables. */
    interpolated: Extract<Entries, { interpolated: true }> extends never ? false : true;
    /** Identifies fallback-array entries as point translations. */
    kind: "point";
    /** Whether any fallback entry requires options. */
    required: Extract<Entries, { required: true }> extends never ? false : true;
    /** The source translation text accepted by the fallback array. */
    value: EntryValue<Entries>;
};

/** Generated metadata for every valid fallback-array context branch. */
type FallbackArrayEntry<
    Keys extends readonly FallbackPointKey<KPrefix>[],
    KPrefix extends string | undefined,
    Entries = FallbackPointEntry<Keys[number], KPrefix>,
    BaseEntries = Exclude<Entries, { context: string }>,
    Contexts extends string = Extract<Entries, { context: string }> extends infer Contextual
        ? Contextual extends { context: infer Context extends string }
            ? Context
            : never
        : never,
> = [
    [BaseEntries] extends [never] ? never : FallbackArrayMetadata<BaseEntries>,
    {
        [Context in Contexts]: FallbackArrayMetadata<
            BaseEntries | Extract<Entries, { context: Context }>
        > & {
            context: Context;
        };
    }[Contexts],
][number];

/** Arguments accepted for a generated fallback-key array. */
type FallbackArrayArgs<
    Keys extends readonly [FallbackPointKey<KPrefix>, ...FallbackPointKey<KPrefix>[]],
    KPrefix extends string | undefined,
    Entry = FallbackArrayEntry<Keys, KPrefix>,
> = Entry extends { required: true }
    ? [keys: Keys, options: EntryOptions<Entry>]
    : [keys: Keys, options?: EntryOptions<Entry>];

/** Detailed-result arguments for a generated fallback-key array. */
type DetailedFallbackArrayArgs<
    Keys extends readonly [FallbackPointKey<KPrefix>, ...FallbackPointKey<KPrefix>[]],
    KPrefix extends string | undefined,
> = [keys: Keys, options: DetailedOptions<EntryOptions<FallbackArrayEntry<Keys, KPrefix>>>];

/** Generated default-value metadata eligible for a fallback array. */
type FallbackDefaultEntry<
    Key extends CallKey<KPrefix>,
    KPrefix extends string | undefined,
> = Extract<ScopedRegistryEntry<Key, KPrefix>, { kind: "default" }>;

/** A generated default-valued key eligible for a fallback array. */
type FallbackDefaultKey<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: [FallbackDefaultEntry<Key, KPrefix>] extends [never] ? never : Key;
}[CallKey<KPrefix>];

/** Key-backed default metadata eligible before an array's final fallback. */
type FallbackLeadingDefaultEntry<
    Key extends CallKey<KPrefix>,
    KPrefix extends string | undefined,
> = Extract<FallbackDefaultEntry<Key, KPrefix>, { defaultValue: Key }>;

/** A key-backed default entry eligible before an array's final fallback. */
type FallbackLeadingDefaultKey<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: [FallbackLeadingDefaultEntry<Key, KPrefix>] extends [never]
        ? never
        : Key;
}[CallKey<KPrefix>];

/** Generated key tuples carrying an explicit final fallback value. */
type FallbackDefaultKeys<KPrefix extends string | undefined> = readonly [
    ...FallbackLeadingDefaultKey<KPrefix>[],
    FallbackDefaultKey<KPrefix>,
];

/** The keys preceding the final element of a fallback tuple. */
type FallbackLeadingKey<Keys extends readonly string[]> = Keys extends readonly [
    ...infer Leading,
    string,
]
    ? Extract<Leading[number], string>
    : never;

/** The final key of a fallback tuple. */
type FallbackLastKey<Keys extends readonly string[]> = Keys extends readonly [
    ...string[],
    infer Last,
]
    ? Extract<Last, string>
    : never;

/** Generated entries compatible with a selected context branch. */
type FallbackEntriesInScope<Entries, ScopeEntry> = ScopeEntry extends {
    context: infer Context extends string;
}
    ? Exclude<Entries, { context: string }> | Extract<Entries, { context: Context }>
    : Exclude<Entries, { context: string }>;

/** Combined generated metadata for an explicit-default fallback array. */
type FallbackDefaultArrayMetadata<Entries, DefaultValue extends string> = {
    /** The explicit fallback text accepted for the final key. */
    defaultValue: DefaultValue;
    /** Whether any fallback entry requires interpolation variables. */
    interpolated: Extract<Entries, { interpolated: true }> extends never ? false : true;
    /** Identifies fallback-array entries carrying an explicit default. */
    kind: "default";
    /** Whether any fallback entry requires options. */
    required: Extract<Entries, { required: true }> extends never ? false : true;
    /** The source translation text accepted by the fallback array. */
    value: EntryValue<Entries>;
};

/** Generated metadata for a fallback array with an explicit final default. */
type FallbackDefaultArrayEntry<
    Keys extends FallbackDefaultKeys<KPrefix>,
    KPrefix extends string | undefined,
    LeadingKey extends FallbackLeadingDefaultKey<KPrefix> = Extract<
        FallbackLeadingKey<Keys>,
        FallbackLeadingDefaultKey<KPrefix>
    >,
    LastKey extends FallbackDefaultKey<KPrefix> = Extract<
        FallbackLastKey<Keys>,
        FallbackDefaultKey<KPrefix>
    >,
    LeadingEntries = FallbackLeadingDefaultEntry<LeadingKey, KPrefix>,
    LastEntry = FallbackDefaultEntry<LastKey, KPrefix>,
> = LastEntry extends {
    defaultValue: infer DefaultValue extends string;
    kind: "default";
}
    ? (
        FallbackDefaultArrayMetadata<
            FallbackEntriesInScope<LeadingEntries, LastEntry> | LastEntry,
            DefaultValue
        > &
        (LastEntry extends { context: infer Context extends string }
            ? { context: Context }
            : Record<never, never>)
        )
    : never;

/** Arguments accepted for a generated explicit-default fallback array. */
type FallbackDefaultArrayArgs<
    Keys extends FallbackDefaultKeys<KPrefix>,
    KPrefix extends string | undefined,
    Entry = FallbackDefaultArrayEntry<Keys, KPrefix>,
> = Entry extends { defaultValue: infer DefaultValue extends string; required: boolean }
    ? [
            [keys: Keys, options: DefaultEntryOptions<Entry, DefaultValue>],
            Entry extends { required: true }
                ? [keys: Keys, defaultValue: DefaultValue, options: EntryOptions<Entry>]
                : [keys: Keys, defaultValue: DefaultValue, options?: EntryOptions<Entry>],
        ][number]
    : never;

/** Detailed-result arguments for an explicit-default fallback array. */
type DetailedFallbackDefaultArrayArgs<
    Keys extends FallbackDefaultKeys<KPrefix>,
    KPrefix extends string | undefined,
    Entry = FallbackDefaultArrayEntry<Keys, KPrefix>,
> = Entry extends { defaultValue: infer DefaultValue extends string }
    ? [
            [keys: Keys, options: DetailedOptions<DefaultEntryOptions<Entry, DefaultValue>>],
            [keys: Keys, defaultValue: DefaultValue, options: DetailedOptions<EntryOptions<Entry>>],
        ][number]
    : never;

/** Generated natural-plural metadata eligible for a fallback array. */
type FallbackPluralEntry<
    Key extends CallKey<KPrefix>,
    KPrefix extends string | undefined,
> = Extract<ScopedRegistryEntry<Key, KPrefix>, { kind: "plural" }>;

/** A generated natural-plural key eligible for a fallback array. */
type FallbackPluralKey<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: [FallbackPluralEntry<Key, KPrefix>] extends [never] ? never : Key;
}[CallKey<KPrefix>];

/** Generated key tuples carrying a natural plural fallback. */
type FallbackPluralKeys<KPrefix extends string | undefined> = readonly [
    FallbackPluralKey<KPrefix>,
    ...FallbackPluralKey<KPrefix>[],
];

/** Combined generated metadata for a natural-plural fallback array. */
type FallbackPluralArrayMetadata<Entries> = {
    /** The plural fallback text accepted by the fallback array. */
    defaultValue: Entries extends { defaultValue: infer DefaultValue extends string }
        ? DefaultValue
        : never;
    /** Whether any fallback entry requires interpolation variables. */
    interpolated: Extract<Entries, { interpolated: true }> extends never ? false : true;
    /** Identifies fallback-array entries using a natural plural. */
    kind: "plural";
    /** Marks count and interpolation options as required. */
    required: true;
    /** The singular and plural source text accepted by the fallback array. */
    value: EntryValue<Entries>;
};

/** Generated metadata for every natural-plural fallback-array branch. */
type FallbackPluralArrayEntry<
    Keys extends FallbackPluralKeys<KPrefix>,
    KPrefix extends string | undefined,
    Entries = FallbackPluralEntry<Keys[number], KPrefix>,
    BaseEntries = Exclude<Entries, { context: string }>,
    Contexts extends string = Extract<Entries, { context: string }> extends infer Contextual
        ? Contextual extends { context: infer Context extends string }
            ? Context
            : never
        : never,
> = [
    [BaseEntries] extends [never] ? never : FallbackPluralArrayMetadata<BaseEntries>,
    {
        [Context in Contexts]: FallbackPluralArrayMetadata<
            BaseEntries | Extract<Entries, { context: Context }>
        > & {
            context: Context;
        };
    }[Contexts],
][number];

/** Arguments accepted for a generated natural-plural fallback array. */
type FallbackPluralArrayArgs<
    Keys extends FallbackPluralKeys<KPrefix>,
    KPrefix extends string | undefined,
    Entry = FallbackPluralArrayEntry<Keys, KPrefix>,
> = Entry extends { defaultValue: infer DefaultValue extends string }
    ? [
            [keys: Keys, defaultValue: DefaultValue, options: EntryOptions<Entry>],
            [
            keys: Keys,
            options:
                DefaultEntryOptions<Entry, DefaultValue> |
                PluralOtherEntryOptions<Entry, DefaultValue>,
            ],
        ][number]
    : never;

/** Detailed-result arguments for a natural-plural fallback array. */
type DetailedFallbackPluralArrayArgs<
    Keys extends FallbackPluralKeys<KPrefix>,
    KPrefix extends string | undefined,
    Entry = FallbackPluralArrayEntry<Keys, KPrefix>,
> = Entry extends { defaultValue: infer DefaultValue extends string }
    ? [
            [
            keys: Keys,
            defaultValue: DefaultValue,
            options: DetailedOptions<EntryOptions<Entry>>,
            ],
            [
            keys: Keys,
            options: DetailedOptions<
                DefaultEntryOptions<Entry, DefaultValue> |
                PluralOtherEntryOptions<Entry, DefaultValue>
            >,
            ],
        ][number]
    : never;

/** Generated explicit-plural metadata eligible for a fallback array. */
type FallbackPluralDefaultsEntry<
    Key extends CallKey<KPrefix>,
    KPrefix extends string | undefined,
> = Extract<ScopedRegistryEntry<Key, KPrefix>, { kind: "pluralDefaults" }>;

/** A generated explicit-plural key eligible for a fallback array. */
type FallbackPluralDefaultsKey<KPrefix extends string | undefined> = {
    [Key in CallKey<KPrefix>]: [FallbackPluralDefaultsEntry<Key, KPrefix>] extends [never]
        ? never
        : Key;
}[CallKey<KPrefix>];

/** Generated key tuples carrying explicit singular and plural defaults. */
type FallbackPluralDefaultsKeys<KPrefix extends string | undefined> = readonly [
    FallbackPluralDefaultsKey<KPrefix>,
    ...FallbackPluralDefaultsKey<KPrefix>[],
];

/** Combined generated metadata for an explicit-plural fallback array. */
type FallbackPluralDefaultsArrayMetadata<Entries> = {
    /** The singular fallback text accepted by the fallback array. */
    defaultValueOne: Entries extends { defaultValueOne: infer DefaultValueOne extends string }
        ? DefaultValueOne
        : never;
    /** The plural fallback text accepted by the fallback array. */
    defaultValueOther: Entries extends {
        defaultValueOther: infer DefaultValueOther extends string;
    }
        ? DefaultValueOther
        : never;
    /** Whether any fallback entry requires interpolation variables. */
    interpolated: Extract<Entries, { interpolated: true }> extends never ? false : true;
    /** Identifies fallback-array entries using explicit plural defaults. */
    kind: "pluralDefaults";
    /** Marks count and interpolation options as required. */
    required: true;
    /** The singular and plural source text accepted by the fallback array. */
    value: EntryValue<Entries>;
};

/** Generated metadata for every explicit-plural fallback-array branch. */
type FallbackPluralDefaultsArrayEntry<
    Keys extends FallbackPluralDefaultsKeys<KPrefix>,
    KPrefix extends string | undefined,
    Entries = FallbackPluralDefaultsEntry<Keys[number], KPrefix>,
    BaseEntries = Exclude<Entries, { context: string }>,
    Contexts extends string = Extract<Entries, { context: string }> extends infer Contextual
        ? Contextual extends { context: infer Context extends string }
            ? Context
            : never
        : never,
> = [
    [BaseEntries] extends [never] ? never : FallbackPluralDefaultsArrayMetadata<BaseEntries>,
    {
        [Context in Contexts]: FallbackPluralDefaultsArrayMetadata<
            BaseEntries | Extract<Entries, { context: Context }>
        > & {
            context: Context;
        };
    }[Contexts],
][number];

/** Arguments accepted for an explicit-plural fallback array. */
type FallbackPluralDefaultsArrayArgs<
    Keys extends FallbackPluralDefaultsKeys<KPrefix>,
    KPrefix extends string | undefined,
    Entry = FallbackPluralDefaultsArrayEntry<Keys, KPrefix>,
> = Entry extends {
    defaultValueOne: infer DefaultValueOne extends string;
    defaultValueOther: infer DefaultValueOther extends string;
}
    ? [
          keys: Keys,
          options: PluralDefaultsEntryOptions<
              Entry,
              Keys[number],
              DefaultValueOne,
              DefaultValueOther
          >,
        ]
    : never;

/** Detailed-result arguments for an explicit-plural fallback array. */
type DetailedFallbackPluralDefaultsArrayArgs<
    Keys extends FallbackPluralDefaultsKeys<KPrefix>,
    KPrefix extends string | undefined,
    Entry = FallbackPluralDefaultsArrayEntry<Keys, KPrefix>,
> = Entry extends {
    defaultValueOne: infer DefaultValueOne extends string;
    defaultValueOther: infer DefaultValueOther extends string;
}
    ? [
          keys: Keys,
          options: DetailedOptions<
              PluralDefaultsEntryOptions<
                  Entry,
                  Keys[number],
                  DefaultValueOne,
                  DefaultValueOther
              >
          >,
        ]
    : never;

/** The i18next result returned when `returnDetails` is enabled. */
type DetailedResult = TFunctionDetailedResult<string, TOptions & { returnDetails: true }>;

/** Object-form fallback arguments accepted by a generated key. */
type ObjectDefaultValueTuple<KPrefix extends string | undefined> = {
    [Key in ObjectDefaultValueKey<KPrefix>]: [
        key: Key,
        options: ObjectDefaultValueOptions<Key, KPrefix>,
    ];
}[ObjectDefaultValueKey<KPrefix>];

/** Detailed-result object-form fallback arguments for a generated key. */
type DetailedObjectDefaultValueTuple<KPrefix extends string | undefined> = {
    [Key in ObjectDefaultValueKey<KPrefix>]: [
        key: Key,
        options: DetailedOptions<ObjectDefaultValueOptions<Key, KPrefix>>,
    ];
}[ObjectDefaultValueKey<KPrefix>];

/** Lookup options carrying an explicit call-level key prefix. */
type RequiredCallPrefixOptions<Options, Prefix extends string> = Omit<
    Exclude<Options, undefined>,
    "keyPrefix"
> & {
    /** The key prefix applied to this translation call. */
    keyPrefix: Prefix;
};

/** Adds a required call-level key prefix to an argument tuple. */
type CallPrefixArgs<Args, Prefix extends string> = Args extends [
    key: infer Key,
    defaultValue: infer DefaultValue extends string,
    options?: infer Options,
]
    ? [
          key: Key,
          defaultValue: DefaultValue,
          options: RequiredCallPrefixOptions<Options, Prefix>,
        ]
    : Args extends [key: infer Key, options?: infer Options]
        ? [key: Key, options: RequiredCallPrefixOptions<Options, Prefix>]
        : never;

/** Scalar lookup arguments using a call-level key prefix. */
type ScalarCallPrefixArgs<Prefix extends string> = CallPrefixArgs<
    | PointLookupArgs<Prefix> |
    DefaultValueArgs<Prefix> |
    ObjectDefaultValueTuple<Prefix> |
    PluralOtherArgs<Prefix> |
    PluralDefaultsArgs<Prefix>,
    Prefix
>;

/** Detailed-result scalar arguments using a call-level key prefix. */
type DetailedScalarCallPrefixArgs<Prefix extends string> = CallPrefixArgs<
    | DetailedPointLookupArgs<Prefix> |
    DetailedDefaultValueArgs<Prefix> |
    DetailedObjectDefaultValueTuple<Prefix> |
    DetailedPluralOtherArgs<Prefix> |
    DetailedPluralDefaultsArgs<Prefix>,
    Prefix
>;

/** Translation overloads derived from generated source metadata. */
type GeneratedTFunction<KPrefix extends string | undefined> = Pick<
    UpstreamTFunction,
    "$TFunctionBrand"
> & {
    <const Keys extends FallbackDefaultKeys<KPrefix>>(
        ...args: DetailedFallbackDefaultArrayArgs<Keys, KPrefix>
    ): DetailedResult;
    <const Keys extends FallbackPluralKeys<KPrefix>>(
        ...args: DetailedFallbackPluralArrayArgs<Keys, KPrefix>
    ): DetailedResult;
    <const Keys extends FallbackPluralDefaultsKeys<KPrefix>>(
        ...args: DetailedFallbackPluralDefaultsArrayArgs<Keys, KPrefix>
    ): DetailedResult;
    <const Keys extends readonly [FallbackPointKey<KPrefix>, ...FallbackPointKey<KPrefix>[]]>(
        ...args: DetailedFallbackArrayArgs<Keys, KPrefix>
    ): DetailedResult;
    (...args: DetailedPointLookupArgs<KPrefix>): DetailedResult;
    (...args: DetailedDefaultValueArgs<KPrefix>): DetailedResult;
    <const Key extends ObjectDefaultValueKey<KPrefix>>(
        key: Key,
        options: DetailedOptions<ObjectDefaultValueOptions<Key, KPrefix>>,
    ): DetailedResult;
    (...args: DetailedPluralOtherArgs<KPrefix>): DetailedResult;
    (...args: DetailedPluralDefaultsArgs<KPrefix>): DetailedResult;
    <const Keys extends FallbackDefaultKeys<KPrefix>>(
        ...args: FallbackDefaultArrayArgs<Keys, KPrefix>
    ): string;
    <const Keys extends FallbackPluralKeys<KPrefix>>(
        ...args: FallbackPluralArrayArgs<Keys, KPrefix>
    ): string;
    <const Keys extends FallbackPluralDefaultsKeys<KPrefix>>(
        ...args: FallbackPluralDefaultsArrayArgs<Keys, KPrefix>
    ): string;
    <const Keys extends readonly [FallbackPointKey<KPrefix>, ...FallbackPointKey<KPrefix>[]]>(
        ...args: FallbackArrayArgs<Keys, KPrefix>
    ): string;
    (...args: PointLookupArgs<KPrefix>): string;
    (...args: DefaultValueArgs<KPrefix>): string;
    <const Key extends ObjectDefaultValueKey<KPrefix>>(
        key: Key,
        options: ObjectDefaultValueOptions<Key, KPrefix>,
    ): string;
    (...args: PluralOtherArgs<KPrefix>): string;
    (...args: PluralDefaultsArgs<KPrefix>): string;
};

/** Generated translation overloads with per-call key prefixes. */
type GeneratedCallPrefixTFunction = {
    <const Prefix extends string, const Keys extends FallbackDefaultKeys<Prefix>>(
        ...args: CallPrefixArgs<DetailedFallbackDefaultArrayArgs<Keys, Prefix>, Prefix>
    ): DetailedResult;
    <const Prefix extends string, const Keys extends FallbackPluralKeys<Prefix>>(
        ...args: CallPrefixArgs<DetailedFallbackPluralArrayArgs<Keys, Prefix>, Prefix>
    ): DetailedResult;
    <const Prefix extends string, const Keys extends FallbackPluralDefaultsKeys<Prefix>>(
        ...args: CallPrefixArgs<DetailedFallbackPluralDefaultsArrayArgs<Keys, Prefix>, Prefix>
    ): DetailedResult;
    <
        const Prefix extends string,
        const Keys extends readonly [FallbackPointKey<Prefix>, ...FallbackPointKey<Prefix>[]],
    >(...args: CallPrefixArgs<DetailedFallbackArrayArgs<Keys, Prefix>, Prefix>): DetailedResult;
    <const Prefix extends string>(...args: DetailedScalarCallPrefixArgs<Prefix>): DetailedResult;
    <const Prefix extends string, const Keys extends FallbackDefaultKeys<Prefix>>(
        ...args: CallPrefixArgs<FallbackDefaultArrayArgs<Keys, Prefix>, Prefix>
    ): string;
    <const Prefix extends string, const Keys extends FallbackPluralKeys<Prefix>>(
        ...args: CallPrefixArgs<FallbackPluralArrayArgs<Keys, Prefix>, Prefix>
    ): string;
    <const Prefix extends string, const Keys extends FallbackPluralDefaultsKeys<Prefix>>(
        ...args: CallPrefixArgs<FallbackPluralDefaultsArrayArgs<Keys, Prefix>, Prefix>
    ): string;
    <
        const Prefix extends string,
        const Keys extends readonly [FallbackPointKey<Prefix>, ...FallbackPointKey<Prefix>[]],
    >(...args: CallPrefixArgs<FallbackArrayArgs<Keys, Prefix>, Prefix>): string;
    <const Prefix extends string>(...args: ScalarCallPrefixArgs<Prefix>): string;
};

/** Generated translation overloads available to a fixed translation function. */
type GeneratedFixedTFunction<KPrefix extends string | undefined> = GeneratedTFunction<KPrefix> &
    GeneratedCallPrefixTFunction;

/** The application's translation function, narrowed by generated metadata when available. */
type TFunction<KPrefix extends string | undefined = undefined> = IsRegistryEmpty extends true
    ? UpstreamTFunction<"translation", KPrefix>
    : GeneratedTFunction<KPrefix>;

/** A fixed i18next translation function narrowed by generated metadata. */
type FixedTFunction<KPrefix extends string | undefined = undefined> = IsRegistryEmpty extends true
    ? UpstreamTFunction<"translation", KPrefix>
    : GeneratedFixedTFunction<KPrefix>;

/** Generated overloads for creating a fixed translation function. */
type GeneratedGetFixedT = {
    <const KPrefix extends string | undefined = undefined>(
        lng: string | readonly string[],
        ns?: Namespace | null,
        keyPrefix?: KPrefix,
    ): FixedTFunction<NormalizedKeyPrefix<KPrefix>>;
    <const KPrefix extends string | undefined = undefined>(
        lng: null,
        ns: Namespace | null,
        keyPrefix?: KPrefix,
    ): FixedTFunction<NormalizedKeyPrefix<KPrefix>>;
};

/** The shared i18next instance narrowed by generated translation metadata. */
type ConfiguredI18n = IsRegistryEmpty extends true
    ? I18n
    : Omit<I18n, "getFixedT" | "init" | "t"> & {
        getFixedT: GeneratedGetFixedT;
        init: Init;
        t: TFunction;
    };

/** Returns the shared configured i18next instance. */
type GetI18n = () => ConfiguredI18n;

/** The generated call signature for the React `Trans` component. */
type GeneratedTransCall = <
    const Key extends string = string,
    Ns extends Namespace = "translation",
    KPrefix extends string | undefined = undefined,
    TContext extends string | undefined = undefined,
    TOpt extends TOptions & { context?: TContext } = { context: TContext },
    Ret = string,
    E = React.HTMLProps<HTMLDivElement>,
>(
    props: Omit<UpstreamTransProps<Key, Ns, KPrefix, TContext, TOpt, Ret, E>, "t"> & {
        t?: FixedTFunction<NormalizedKeyPrefix<KPrefix>> | TFunction;
    },
) => React.ReactElement;

/** The generated call signature for the React `IcuTrans` component. */
type GeneratedIcuTransCall = <
    const Key extends string = string,
    Ns extends Namespace = "translation",
    KPrefix extends string | undefined = undefined,
    TContext extends string | undefined = undefined,
    TOpt extends TOptions & { context?: TContext } = { context: TContext },
>(
    props: Omit<UpstreamIcuTransProps<Key, Ns, KPrefix, TContext, TOpt>, "t"> & {
        t?: FixedTFunction<NormalizedKeyPrefix<KPrefix>> | TFunction;
    },
) => React.ReactElement;

/** The generated call signature for context-free React ICU translations. */
type GeneratedIcuTransWithoutContextCall = <
    const Key extends string = string,
    Ns extends Namespace = "translation",
    KPrefix extends string | undefined = undefined,
    TContext extends string | undefined = undefined,
    TOpt extends TOptions & { context?: TContext } = { context: TContext },
>(
    props: Omit<
        UpstreamIcuTransWithoutContextProps<Key, Ns, KPrefix, TContext, TOpt>,
        "t"
    > & {
        t?: FixedTFunction<NormalizedKeyPrefix<KPrefix>> | TFunction;
    },
) => React.ReactElement;

/** The react-i18next `Trans` component narrowed by generated metadata. */
type TransComponent = IsRegistryEmpty extends true
    ? typeof upstreamTrans
    : GeneratedTransCall;

/** The react-i18next context-free `Trans` component narrowed by generated metadata. */
type TransWithoutContextComponent = IsRegistryEmpty extends true
    ? typeof upstreamTransWithoutContext
    : GeneratedTransCall;

/** The react-i18next `IcuTrans` component narrowed by generated metadata. */
type IcuTransComponent = IsRegistryEmpty extends true
    ? typeof upstreamIcuTrans
    : GeneratedIcuTransCall;

/** The context-free react-i18next ICU component narrowed by generated metadata. */
type IcuTransWithoutContextComponent = IsRegistryEmpty extends true
    ? typeof upstreamIcuTransWithoutContext
    : GeneratedIcuTransWithoutContextCall;

/** The generated tuple and named fields returned by `useTranslation`. */
type GeneratedUseTranslationResponse<KPrefix extends string | undefined> = [
    t: FixedTFunction<KPrefix>,
    i18n: ConfiguredI18n,
    ready: boolean,
] &
Omit<UpstreamUseTranslationResponse<"translation", undefined>, 0 | 1 | "i18n" | "t"> &
Record<"i18n", ConfiguredI18n> &
Record<"t", FixedTFunction<KPrefix>>;

/** The result returned by {@link useTranslation}. */
type UseTranslationResponse<Ns extends Namespace = "translation", KPrefix = undefined> =
    IsRegistryEmpty extends true
        ? UpstreamUseTranslationResponse<Ns, KPrefix>
        : GeneratedUseTranslationResponse<NormalizedKeyPrefix<KPrefix>>;

/** The generated signature for the react-i18next `useTranslation` hook. */
type GeneratedUseTranslation = <
    const Ns extends FlatNamespace | readonly FlatNamespace[] | undefined = undefined,
    const KPrefix extends KeyPrefix<FallbackNs<Ns>> = undefined,
>(
    ns?: Ns,
    options?: UseTranslationOptions<KPrefix>,
) => UseTranslationResponse<FallbackNs<Ns>, KPrefix>;

/** The react-i18next `useTranslation` hook narrowed by generated metadata. */
type UseTranslation = IsRegistryEmpty extends true ? typeof upstreamUseTranslation : GeneratedUseTranslation;

/** Generated translation props injected by `withTranslation`. */
type GeneratedWithTranslation<KPrefix extends string | undefined> = Omit<
    UpstreamWithTranslation,
    "i18n" | "t"
> &
Record<"i18n", ConfiguredI18n> &
Record<"t", FixedTFunction<KPrefix>>;

/** Props injected by {@link withTranslation}. */
type WithTranslation<
    Ns extends FlatNamespace | readonly FlatNamespace[] | undefined = undefined,
    KPrefix extends KeyPrefix<FallbackNs<Ns>> = undefined,
> = IsRegistryEmpty extends true
    ? UpstreamWithTranslation<Ns, KPrefix>
    : GeneratedWithTranslation<NormalizedKeyPrefix<KPrefix>>;

/** The generated signature for the `withTranslation` higher-order component. */
type GeneratedWithTranslationFactory = <
    const Ns extends FlatNamespace | readonly FlatNamespace[] | undefined = undefined,
    const KPrefix extends KeyPrefix<FallbackNs<Ns>> = undefined,
>(
    ns?: Ns,
    options?: {
        withRef?: boolean;
        keyPrefix?: KPrefix;
    },
) => <
    Component extends React.ElementType,
    ResolvedProps = React.JSX.LibraryManagedAttributes<
        Component,
        Omit<React.ComponentProps<Component>, keyof WithTranslationProps>
    >,
>(
    component: Component,
) => React.ComponentType<
    Omit<ResolvedProps, keyof WithTranslation<Ns, KPrefix>> & WithTranslationProps
>;

/** The react-i18next `withTranslation` factory narrowed by generated metadata. */
type WithTranslationFactory = IsRegistryEmpty extends true
    ? typeof upstreamWithTranslation
    : GeneratedWithTranslationFactory;

/** The render callback accepted by the React `Translation` component. */
type TranslationChildren<KPrefix extends string | undefined> = (
    t: FixedTFunction<KPrefix>,
    options: Omit<Parameters<UpstreamTranslationProps<"translation">["children"]>[1], "i18n"> &
        Record<"i18n", ConfiguredI18n>,
    isReady: boolean,
) => React.ReactNode;

/** Generated props for the React `Translation` component. */
type GeneratedTranslationProps<
    Ns extends FlatNamespace | readonly FlatNamespace[] | undefined,
    KPrefix extends KeyPrefix<FallbackNs<Ns>>,
> = Omit<UpstreamTranslationProps<Ns, KPrefix>, "children"> &
    Record<"children", TranslationChildren<NormalizedKeyPrefix<KPrefix>>>;

/** Props accepted by {@link Translation}. */
type TranslationProps<
    Ns extends FlatNamespace | readonly FlatNamespace[] | undefined = undefined,
    KPrefix extends KeyPrefix<FallbackNs<Ns>> = undefined,
> = IsRegistryEmpty extends true
    ? UpstreamTranslationProps<Ns, KPrefix>
    : GeneratedTranslationProps<Ns, KPrefix>;

/** The generated call signature for the React `Translation` component. */
type GeneratedTranslationComponent = <
    const Ns extends FlatNamespace | readonly FlatNamespace[] | undefined = undefined,
    const KPrefix extends KeyPrefix<FallbackNs<Ns>> = undefined,
>(
    props: TranslationProps<Ns, KPrefix>,
) => React.ReactNode;

/** The react-i18next `Translation` component narrowed by generated metadata. */
type TranslationComponent = IsRegistryEmpty extends true
    ? typeof upstreamTranslation
    : GeneratedTranslationComponent;

/** The callback accepted by generated `init` overloads. */
type GeneratedCallback = (error: Parameters<Callback>[0], t: TFunction) => void;

/** Generated initialization overloads returning the narrowed translation function. */
type GeneratedInit = {
    (callback?: GeneratedCallback): Promise<TFunction>;
    <Options>(options: InitOptions<Options>, callback?: GeneratedCallback): Promise<TFunction>;
};

/** The i18next initialization function narrowed by generated metadata. */
type Init = IsRegistryEmpty extends true ? I18n["init"] : GeneratedInit;

export type {
    GetI18n,
    IcuTransComponent,
    IcuTransWithoutContextComponent,
    Init,
    TFunction,
    TransComponent,
    TransWithoutContextComponent,
    TranslationComponent,
    TranslationProps,
    UseTranslation,
    UseTranslationResponse,
    WithTranslation,
    WithTranslationFactory,
};
