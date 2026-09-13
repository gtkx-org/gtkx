/** Converts underscores in a property name to canonical dashes. */
type Dashed<TName extends string> = TName extends `${infer THead}_${infer TTail}`
    ? Dashed<`${THead}-${TTail}`>
    : TName;

/** Converts a dashed property name to its JavaScript spelling. */
type Camelized<TName extends string> = TName extends `${infer THead}-${infer TTail}`
    ? `${THead}${Capitalize<Camelized<TTail>>}`
    : TName;

export { type Dashed, type Camelized };
