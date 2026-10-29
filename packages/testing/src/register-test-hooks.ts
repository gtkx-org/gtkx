import { quit } from "@gtkx/runtime";
import { getIsReactActEnvironment, setIsReactActEnvironment } from "./act.js";
import { registerMatchers } from "./matchers.js";
import { widgetSnapshotSerializer } from "./pretty-widget.js";
import { cleanup } from "./render.js";

type RunnerHook = "beforeAll" | "afterEach" | "afterAll";
type SnapshotExpect = { addSnapshotSerializer: (serializer: typeof widgetSnapshotSerializer) => void };

const callRunnerHook = (name: RunnerHook, callback: () => unknown): void => {
    const hook: unknown = Reflect.get(globalThis, name);

    if (typeof hook === "function") {
        (hook as (callback: () => unknown) => void)(callback);
    }
};

const registerActEnvironment = (): void => {
    let previousActEnvironment: boolean | undefined;

    callRunnerHook("beforeAll", () => {
        previousActEnvironment = getIsReactActEnvironment();
        setIsReactActEnvironment(true);
    });

    callRunnerHook("afterAll", () => {
        setIsReactActEnvironment(previousActEnvironment);
    });
};

const registerSnapshotSerializer = (): void => {
    const expect: unknown = Reflect.get(globalThis, "expect");

    if (expect && typeof (expect as SnapshotExpect).addSnapshotSerializer === "function") {
        (expect as SnapshotExpect).addSnapshotSerializer(widgetSnapshotSerializer);
    }
};

const registerTestRuntimeHooks = (): void => {
    registerActEnvironment();
    callRunnerHook("afterEach", cleanup);
    callRunnerHook("afterAll", quit);
    registerMatchers();
    registerSnapshotSerializer();
};

registerTestRuntimeHooks();
