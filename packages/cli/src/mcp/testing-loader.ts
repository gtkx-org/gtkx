type TestingPublicModule = typeof import("@gtkx/testing");
type TestingInternalModule = typeof import("@gtkx/testing/internal");
type TestingModule = TestingPublicModule & Pick<TestingInternalModule, "getTypeTag">;
type TestingModuleLoader = () => Promise<TestingModule>;

type TestingModuleCache = {
    setLoader: (next: TestingModuleLoader | null) => void;
    load: () => Promise<TestingModule>;
};

type TestingModuleState = {
    loader: TestingModuleLoader;
    testingModule: TestingModule | null;
    testingLoadError: Error | null;
};

const { setLoader: setTestingModuleLoader, load: loadTestingModule } = createTestingModuleCache();

function mergeTestingModule(publicApi: TestingPublicModule, internals: TestingInternalModule): TestingModule {
    return { ...publicApi, getTypeTag: internals.getTypeTag };
}

async function defaultLoader(): Promise<TestingModule> {
    const [publicApi, internals] = await Promise.all([import("@gtkx/testing"), import("@gtkx/testing/internal")]);

    return mergeTestingModule(publicApi, internals);
}

function missingTestingPackageError(cause: unknown): Error {
    return new Error(
        "@gtkx/testing is not installed, install it to enable MCP widget interactions: " +
        `pnpm add -D @gtkx/testing (import failed: ${String(cause)})`,
        { cause },
    );
}

function replaceLoader(state: TestingModuleState, next: TestingModuleLoader | null): void {
    state.loader = next ?? defaultLoader;
    state.testingModule = null;
    state.testingLoadError = null;
}

async function importTestingModule(state: TestingModuleState): Promise<TestingModule> {
    try {
        state.testingModule = await state.loader();

        return state.testingModule;
    } catch (error) {
        state.testingLoadError = missingTestingPackageError(error);
        throw state.testingLoadError;
    }
}

function loadCachedTestingModule(state: TestingModuleState): Promise<TestingModule> {
    if (state.testingModule) {
        return Promise.resolve(state.testingModule);
    }

    if (state.testingLoadError) {
        return Promise.reject(state.testingLoadError);
    }

    return importTestingModule(state);
}

function createTestingModuleCache(): TestingModuleCache {
    const state: TestingModuleState = {
        loader: defaultLoader,
        testingModule: null,
        testingLoadError: null,
    };

    return {
        setLoader: (next: TestingModuleLoader | null): void => {
            replaceLoader(state, next);
        },
        load: (): Promise<TestingModule> => loadCachedTestingModule(state),
    };
}

export {
    setTestingModuleLoader,
    loadTestingModule,
    mergeTestingModule,
    type TestingInternalModule,
    type TestingModule,
    type TestingPublicModule,
};
