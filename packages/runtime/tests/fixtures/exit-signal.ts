import {
    type ExternalObject,
    getHandle,
    type Handle,
    onExit,
    registerWrapperClass,
    resolveType,
    t,
    wrapHandle,
} from "@gtkx/runtime";

const HOLD_TIMEOUT_MS = 60_000;
const HANDLED_MODE = "handled";
const HANDLED_EXIT_CODE = 7;
const NATIVE_EXIT_MODE = "native-exit";

class Application {}

const holdProcess = (): void => {
    setTimeout(() => {
        process.stdout.write("HELD TOO LONG\n");
    }, HOLD_TIMEOUT_MS);
};

const takeOverSignal = (): void => {
    process.on("SIGTERM", () => {
        process.exit(HANDLED_EXIT_CODE);
    });
};

const announceExit = (): void => {
    process.stdout.write("ONEXIT RAN\n");
};

const exitInsideNativeCall = (): void => {
    registerWrapperClass(Application, resolveType("libgio-2.0.so.0", "g_application_get_type"));
    const create = t.bind("libgio-2.0.so.0", "g_application_new", [t.string(), t.int32], t.object("full"));
    const run = t.bind(
        "libgio-2.0.so.0",
        "g_application_run",
        [t.object(), t.int32, t.array(t.string(), "array", "borrowed", { isZeroTerminated: true })],
        t.int32,
    );
    const application = wrapHandle(create("org.gtkx.ExitSignalFixture", 0) as ExternalObject<Handle>);

    run(getHandle(application), 2, ["exit-signal", "--help"]);
};

const start = (mode: string): void => {
    if (mode === NATIVE_EXIT_MODE) {
        exitInsideNativeCall();
        return;
    }

    onExit(announceExit);

    if (mode === HANDLED_MODE) {
        takeOverSignal();
    }

    process.stdout.write("READY\n");
    holdProcess();
};

start(process.argv[2] ?? "");
