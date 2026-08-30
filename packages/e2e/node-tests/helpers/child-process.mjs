const childEnv = (overrides = {}) => {
    const environment = { ...process.env, ...overrides };

    if (environment.LSAN_OPTIONS !== undefined) {
        environment.LSAN_OPTIONS = `${environment.LSAN_OPTIONS}:leak_check_at_exit=0`;
    }

    return environment;
};

export { childEnv };
