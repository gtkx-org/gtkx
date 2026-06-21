/**
 * The shared change-detection base for codegen-fed prop descriptors. Kept in its
 * own leaf module so the array-prop and descriptor-table modules can both extend
 * it without importing each other.
 */

/**
 * Lets a prop descriptor override the default structural equality used to decide
 * whether a prop changed between commits.
 */
export interface PropDiffOverride {
    /**
     * Optional change detector overriding the default structural equality used to decide whether a
     * prop changed between commits. Returns `true` when `prev` and `next` are considered equal
     * (i.e. unchanged). When omitted, the shared default equality is used.
     */
    diff?: ((prev: unknown, next: unknown) => boolean) | undefined;
}
