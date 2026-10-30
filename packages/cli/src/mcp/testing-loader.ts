type TestingPublicModule = typeof import("@gtkx/testing");
type TestingInternalModule = typeof import("@gtkx/testing/internal");
type TestingModule = TestingPublicModule &
    Pick<TestingInternalModule, "getTypeTag" | "getWidgetAccessibleName" | "isUncaughtError" | "isUsageError">;
type TestingModuleLoader = () => Promise<TestingModule>;

function mergeTestingModule(publicApi: TestingPublicModule, internals: TestingInternalModule): TestingModule {
    return {
        ...publicApi,
        getTypeTag: internals.getTypeTag,
        getWidgetAccessibleName: internals.getWidgetAccessibleName,
        isUncaughtError: internals.isUncaughtError,
        isUsageError: internals.isUsageError,
    };
}

function missingTestingPackageError(cause: unknown): Error {
    return new Error(
        "@gtkx/testing is not installed, install it to enable MCP widget interactions: " +
            `pnpm add -D @gtkx/testing (import failed: ${String(cause)})`,
        { cause },
    );
}

/**
 * Loads the application's `@gtkx/testing` through `loader` on first use and reuses the module, or the
 * failure to find it, afterwards.
 */
function cacheTestingModule(loader: TestingModuleLoader): TestingModuleLoader {
    let loading: Promise<TestingModule> | null = null;

    return () => {
        loading ??= loader().catch((error: unknown) => {
            throw missingTestingPackageError(error);
        });

        return loading;
    };
}

export {
    cacheTestingModule,
    mergeTestingModule,
    type TestingInternalModule,
    type TestingModule,
    type TestingModuleLoader,
    type TestingPublicModule,
};
