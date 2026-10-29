const REPEATED_REGISTRATION_PATTERN = /Type name '[^']+' is already registered/;

const isRepeatedRegistration = (cause: unknown): boolean =>
    cause instanceof Error && REPEATED_REGISTRATION_PATTERN.test(cause.message);

export { isRepeatedRegistration };
