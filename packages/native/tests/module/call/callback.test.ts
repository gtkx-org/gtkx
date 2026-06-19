import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import { expectClickedSignalHandlerId } from "../call-callback-integer-helpers.js";
import { suppressUnhandledRejections } from "../lifecycle.js";
import {
    connectSignal,
    connectSignalCallback,
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

describe("call - callback - connect", () => {
    it("connects callback to signal", () => {
        expectClickedSignalHandlerId();
    });
});

describe("call - callback - invoke", () => {
    it("invokes callback when signal emits", () => {
        const cancellable = createCancellable();
        let callbackInvoked = false;

        connectSignalCallback(cancellable, "cancelled", () => {
            callbackInvoked = true;
        });

        call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);

        expect(callbackInvoked).toBe(true);
    });
});

describe("call - callback - args", () => {
    it("receives signal arguments in callback", () => {
        const cancellable = createCancellable();
        let receivedArg: unknown = null;

        connectSignalCallback(cancellable, "cancelled", (arg) => {
            receivedArg = arg;
        });

        call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);

        expect(receivedArg).toBeDefined();
    });
});

describe("call - callback - disconnect", () => {
    it("disconnects callback correctly", () => {
        const button = createButton("Test");

        const handlerId = connectSignal(button, "clicked", () => {});

        disconnectSignal(button, handlerId);

        expect(isSignalHandlerConnected(button, handlerId)).toBe(false);
    });
});

describe("call - callback - multiple", () => {
    it("handles multiple callbacks on same signal", () => {
        const cancellable = createCancellable();
        let count1 = 0;
        let count2 = 0;

        connectSignalCallback(cancellable, "cancelled", () => {
            count1++;
        });
        connectSignalCallback(cancellable, "cancelled", () => {
            count2++;
        });

        call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);

        expect(count1).toBe(1);
        expect(count2).toBe(1);
    });
});

describe("call - callback - destroy notify", () => {
    it("connects signal with callback destroy handler", () => {
        const cancellable = createCancellable();
        let callbackInvoked = false;

        const handlerId = connectSignalCallback(cancellable, "cancelled", () => {
            callbackInvoked = true;
        });

        expect(typeof handlerId).toBe("number");
        expect(handlerId).toBeGreaterThan(0);

        call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);

        expect(callbackInvoked).toBe(true);
    });
});

describe("call - callback - argument types", () => {
    it("passes gobject arguments to callback", () => {
        const cancellable = createCancellable();
        let receivedObject: unknown = null;

        connectSignalCallback(cancellable, "cancelled", (obj) => {
            receivedObject = obj;
        });

        call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);

        expect(receivedObject).not.toBeNull();
    });
});

describe("call - callback - memory leaks disconnect", () => {
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

describe("call - callback - memory leaks many", () => {
    it("does not leak when connecting many handlers in loop", () => {
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 100; i++) {
            const button = createButton(`Button ${i}`);
            connectSignal(button, "clicked", () => {});
        }

        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
    });
});

describe("call - callback - memory leaks callback", () => {
    it("does not leak callback memory on disconnect", () => {
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 100; i++) {
            const cancellable = createCancellable();

            const handlerId = connectSignalCallback(cancellable, "cancelled", () => {});

            disconnectSignal(cancellable, handlerId);
        }

        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
    });
});

describe("call - callback - edge cases throw", () => {
    it("handles callback that throws exception gracefully", async () => {
        const cancellable = createCancellable();

        connectSignalCallback(cancellable, "cancelled", () => {
            throw new Error("Test error in callback");
        });

        await suppressUnhandledRejections(() => {
            expect(() => {
                call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_BORROWED, value: cancellable }], VOID);
            }).not.toThrow();
        });
    });
});

describe("call - callback - edge cases multiple object", () => {
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
