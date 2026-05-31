import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import { expectClickedSignalHandlerId } from "../call-callback-integer-setup.js";
import { suppressUnhandledRejections } from "../lifecycle.js";
import {
    connectSignal,
    connectSignalTrampoline,
    createButton,
    createCancellable,
    disconnectSignal,
    forceGC,
    GIO_LIB,
    GOBJECT_BORROWED,
    getRefCount,
    isSignalHandlerConnected,
    startMemoryMeasurement,
    VOID,
} from "../utils.js";

describe("call - trampoline - connect", () => {
    it("connects callback to signal", () => {
        expectClickedSignalHandlerId();
    });
});

describe("call - trampoline - invoke", () => {
    it("invokes callback when signal emits", () => {
        const cancellable = createCancellable();
        let callbackInvoked = false;

        connectSignalTrampoline(cancellable, "cancelled", () => {
            callbackInvoked = true;
        });

        call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);

        expect(callbackInvoked).toBe(true);
    });
});

describe("call - trampoline - args", () => {
    it("receives signal arguments in callback", () => {
        const cancellable = createCancellable();
        let receivedArg: unknown = null;

        connectSignalTrampoline(cancellable, "cancelled", (arg) => {
            receivedArg = arg;
        });

        call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);

        expect(receivedArg).toBeDefined();
    });
});

describe("call - trampoline - disconnect", () => {
    it("disconnects callback correctly", () => {
        const button = createButton("Test");

        const handlerId = connectSignal(button, "clicked", () => {});

        disconnectSignal(button, handlerId);

        expect(isSignalHandlerConnected(button, handlerId)).toBe(false);
    });
});

describe("call - trampoline - multiple", () => {
    it("handles multiple callbacks on same signal", () => {
        const cancellable = createCancellable();
        let count1 = 0;
        let count2 = 0;

        connectSignalTrampoline(cancellable, "cancelled", () => {
            count1++;
        });
        connectSignalTrampoline(cancellable, "cancelled", () => {
            count2++;
        });

        call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);

        expect(count1).toBe(1);
        expect(count2).toBe(1);
    });
});

describe("call - trampoline - destroy notify", () => {
    it("connects signal with trampoline destroy handler", () => {
        const cancellable = createCancellable();
        let callbackInvoked = false;

        const handlerId = connectSignalTrampoline(cancellable, "cancelled", () => {
            callbackInvoked = true;
        });

        expect(typeof handlerId).toBe("number");
        expect(handlerId).toBeGreaterThan(0);

        call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);

        expect(callbackInvoked).toBe(true);
    });
});

describe("call - trampoline - argument types", () => {
    it("passes gobject arguments to callback", () => {
        const cancellable = createCancellable();
        let receivedObject: unknown = null;

        connectSignalTrampoline(cancellable, "cancelled", (obj) => {
            receivedObject = obj;
        });

        call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);

        expect(receivedObject).not.toBeNull();
    });
});

describe("call - trampoline - memory leaks disconnect", () => {
    it("does not leak closure when signal handler disconnects", () => {
        const button = createButton("Test");
        const buttonRefCount = getRefCount(button);

        for (let i = 0; i < 100; i++) {
            const handlerId = connectSignal(button, "clicked", () => {});
            disconnectSignal(button, handlerId);
        }

        forceGC();
        expect(getRefCount(button)).toBe(buttonRefCount);
    });
});

describe("call - trampoline - memory leaks many", () => {
    it("does not leak when connecting many handlers in loop", () => {
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 100; i++) {
            const button = createButton(`Button ${i}`);
            connectSignal(button, "clicked", () => {});
        }

        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
    });
});

describe("call - trampoline - memory leaks trampoline", () => {
    it("does not leak trampoline memory on disconnect", () => {
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 100; i++) {
            const cancellable = createCancellable();

            const handlerId = connectSignalTrampoline(cancellable, "cancelled", () => {});

            disconnectSignal(cancellable, handlerId);
        }

        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
    });
});

describe("call - trampoline - edge cases throw", () => {
    it("handles callback that throws exception gracefully", async () => {
        const cancellable = createCancellable();

        connectSignalTrampoline(cancellable, "cancelled", () => {
            throw new Error("Test error in callback");
        });

        await suppressUnhandledRejections(() => {
            expect(() => {
                call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);
            }).not.toThrow();
        });
    });
});

describe("call - trampoline - edge cases multiple object", () => {
    it("handles multiple callbacks on same object", () => {
        const button = createButton("Test");
        const handlers: number[] = [];

        for (let i = 0; i < 5; i++) {
            handlers.push(connectSignal(button, "clicked", () => {}));
        }

        for (const handlerId of handlers) {
            expect(isSignalHandlerConnected(button, handlerId)).toBe(true);
        }

        for (const handlerId of handlers) {
            disconnectSignal(button, handlerId);
        }
    });
});
