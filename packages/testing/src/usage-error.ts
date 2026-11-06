const usageErrors: WeakSet<Error> = new WeakSet();

/** Marks an error @gtkx/testing raises because it was called on a target or with input it cannot use. */
const usageError = <T extends Error>(error: T): T => {
    usageErrors.add(error);

    return error;
};

/**
 * Whether @gtkx/testing raised this error because it was misused, such as typing into a widget that is not editable,
 * rather than because the code under test threw it while handling the interaction.
 */
const isUsageError = (reason: unknown): boolean => reason instanceof Error && usageErrors.has(reason);

export { isUsageError, usageError };
