import type { GirTypeRef } from "./gir/type-ref.js";

/**
 * Qualified `Namespace.Alias` names whose generated surface is `bigint` by
 * default. Both are GStreamer clock-time aliases of `guint64`/`gint64` whose
 * nanosecond magnitudes exceed the 2^53 range JavaScript numbers represent
 * exactly, so a `number` surface would corrupt them.
 */
export const BUILTIN_BIGINT_ALIASES: readonly string[] = ["Gst.ClockTime", "Gst.ClockTimeDiff"];

/**
 * Merges the built-in bigint alias names with the project's
 * `bigintAliases` config entries into the lookup set the writers consult.
 *
 * @param userAliases - Qualified alias names from `gtkx.config.ts`
 * @returns The merged, deduplicated lookup set
 */
export const mergeBigIntAliases = (userAliases: readonly string[] = []): ReadonlySet<string> =>
    new Set([...BUILTIN_BIGINT_ALIASES, ...userAliases]);

/**
 * The signedness of a bigint-surfaced alias, derived from its GIR target.
 */
export type BigIntAliasCategory = "int64" | "uint64";

/**
 * Resolves the 64-bit signedness of an allowlisted alias from its GIR target
 * type.
 *
 * An alias may only be surfaced as `bigint` when it directly aliases a 64-bit
 * integer primitive; anything else is a configuration error reported at
 * codegen time, naming the offending alias.
 *
 * @param qualifiedName - The alias's qualified `Namespace.Alias` name
 * @param target - The alias's GIR target type reference
 * @returns Whether the alias is signed (`"int64"`) or unsigned (`"uint64"`)
 */
export const bigintAliasCategory = (qualifiedName: string, target: GirTypeRef | undefined): BigIntAliasCategory => {
    if (target?.kind === "primitive" && (target.category === "int64" || target.category === "uint64")) {
        return target.category;
    }
    const described = target === undefined ? "unknown" : target.kind === "primitive" ? target.category : target.kind;
    throw new Error(
        `bigintAliases: "${qualifiedName}" must alias a 64-bit integer GIR type (gint64/guint64); its target is "${described}"`,
    );
};
