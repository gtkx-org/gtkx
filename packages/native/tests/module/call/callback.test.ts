import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import {
    BOOLEAN,
    connectSignal,
    createButton,
    createCancellable,
    disconnectSignal,
    forceGC,
    GIO_LIB,
    GOBJECT_LIB,
    GOBJECT_NONE,
    getRefCount,
    INT32,
    NULL,
    STRING,
    startMemoryMeasurement,
    UINT64,
    UNDEFINED,
} from "../utils.js";

describe("call - callback types", () => {
    describe("closure trampoline (signals)", () => {
        it("connects callback to signal", () => {
            const button = createButton("Test");

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_data",
                [
                    { type: GOBJECT_NONE, value: button },
                    { type: STRING, value: "clicked" },
                    { type: { type: "callback", trampoline: "closure" }, value: () => {} },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: INT32, value: 0 },
                ],
                UINT64,
            );

            expect(typeof handlerId).toBe("number");
            expect(handlerId).toBeGreaterThan(0);
        });

        it("invokes callback when signal emits", () => {
            const cancellable = createCancellable();
            let callbackInvoked = false;

            call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: GOBJECT_NONE, value: cancellable },
                    { type: STRING, value: "cancelled" },
                    {
                        type: { type: "callback", trampoline: "closure" },
                        value: () => {
                            callbackInvoked = true;
                        },
                    },
                    { type: BOOLEAN, value: false },
                ],
                UINT64,
            );

            call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_NONE, value: cancellable }], UNDEFINED);

            expect(callbackInvoked).toBe(true);
        });

        it("receives signal arguments in callback", () => {
            const cancellable = createCancellable();
            let receivedArg: unknown = null;

            call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: GOBJECT_NONE, value: cancellable },
                    { type: STRING, value: "cancelled" },
                    {
                        type: {
                            type: "callback",
                            trampoline: "closure",
                            argTypes: [{ type: "gobject", ownership: "none" }],
                        },
                        value: (arg: unknown) => {
                            receivedArg = arg;
                        },
                    },
                    { type: BOOLEAN, value: false },
                ],
                UINT64,
            );

            call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_NONE, value: cancellable }], UNDEFINED);

            expect(receivedArg).toBeDefined();
        });

        it("disconnects callback correctly", () => {
            const button = createButton("Test");

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_data",
                [
                    { type: GOBJECT_NONE, value: button },
                    { type: STRING, value: "clicked" },
                    { type: { type: "callback", trampoline: "closure" }, value: () => {} },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: INT32, value: 0 },
                ],
                UINT64,
            ) as number;

            disconnectSignal(button, handlerId);

            const isConnected = call(
                GOBJECT_LIB,
                "g_signal_handler_is_connected",
                [
                    { type: GOBJECT_NONE, value: button },
                    { type: UINT64, value: handlerId },
                ],
                BOOLEAN,
            );

            expect(isConnected).toBe(false);
        });

        it("handles multiple callbacks on same signal", () => {
            const cancellable = createCancellable();
            let count1 = 0;
            let count2 = 0;

            call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: GOBJECT_NONE, value: cancellable },
                    { type: STRING, value: "cancelled" },
                    {
                        type: { type: "callback", trampoline: "closure" },
                        value: () => {
                            count1++;
                        },
                    },
                    { type: BOOLEAN, value: false },
                ],
                UINT64,
            );

            call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: GOBJECT_NONE, value: cancellable },
                    { type: STRING, value: "cancelled" },
                    {
                        type: { type: "callback", trampoline: "closure" },
                        value: () => {
                            count2++;
                        },
                    },
                    { type: BOOLEAN, value: false },
                ],
                UINT64,
            );

            call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_NONE, value: cancellable }], UNDEFINED);

            expect(count1).toBe(1);
            expect(count2).toBe(1);
        });
    });

    describe("destroy trampoline", () => {
        it("registers destroy notify callback", () => {
            const button = createButton("Test");
            let destroyCalled = false;

            call(
                GOBJECT_LIB,
                "g_object_set_data_full",
                [
                    { type: GOBJECT_NONE, value: button },
                    { type: STRING, value: "test-data" },
                    {
                        type: { type: "callback", trampoline: "destroy" },
                        value: () => {
                            destroyCalled = true;
                        },
                    },
                ],
                UNDEFINED,
            );

            call(
                GOBJECT_LIB,
                "g_object_set_data",
                [
                    { type: GOBJECT_NONE, value: button },
                    { type: STRING, value: "test-data" },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            expect(destroyCalled).toBe(true);
        });
    });

    describe("callback argument types", () => {
        it("passes gobject arguments to callback", () => {
            const cancellable = createCancellable();
            let receivedObject: unknown = null;

            call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: GOBJECT_NONE, value: cancellable },
                    { type: STRING, value: "cancelled" },
                    {
                        type: {
                            type: "callback",
                            trampoline: "closure",
                            argTypes: [{ type: "gobject", ownership: "none" }],
                        },
                        value: (obj: unknown) => {
                            receivedObject = obj;
                        },
                    },
                    { type: BOOLEAN, value: false },
                ],
                UINT64,
            );

            call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_NONE, value: cancellable }], UNDEFINED);

            expect(receivedObject).not.toBeNull();
        });
    });

    describe("memory leaks", () => {
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

        it("does not leak when connecting many handlers in loop", () => {
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 100; i++) {
                const button = createButton(`Button ${i}`);
                connectSignal(button, "clicked", () => {});
            }

            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
        });

        it("does not leak destroy callback after invocation", () => {
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 100; i++) {
                const button = createButton(`Button ${i}`);

                call(
                    GOBJECT_LIB,
                    "g_object_set_data_full",
                    [
                        { type: GOBJECT_NONE, value: button },
                        { type: STRING, value: "data" },
                        {
                            type: { type: "callback", trampoline: "destroy" },
                            value: () => {},
                        },
                    ],
                    UNDEFINED,
                );

                call(
                    GOBJECT_LIB,
                    "g_object_set_data",
                    [
                        { type: GOBJECT_NONE, value: button },
                        { type: STRING, value: "data" },
                        { type: NULL, value: null },
                    ],
                    UNDEFINED,
                );
            }

            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
        });
    });

    describe("edge cases", () => {
        it("handles callback that throws exception gracefully", () => {
            const cancellable = createCancellable();

            call(
                GOBJECT_LIB,
                "g_signal_connect_closure",
                [
                    { type: GOBJECT_NONE, value: cancellable },
                    { type: STRING, value: "cancelled" },
                    {
                        type: { type: "callback", trampoline: "closure" },
                        value: () => {
                            throw new Error("Test error in callback");
                        },
                    },
                    { type: BOOLEAN, value: false },
                ],
                UINT64,
            );

            expect(() => {
                call(GIO_LIB, "g_cancellable_cancel", [{ type: GOBJECT_NONE, value: cancellable }], UNDEFINED);
            }).toThrow();
        });

        it("handles multiple callbacks on same object", () => {
            const button = createButton("Test");
            const handlers: number[] = [];

            for (let i = 0; i < 5; i++) {
                const handlerId = connectSignal(button, "clicked", () => {});
                handlers.push(handlerId);
            }

            for (const handlerId of handlers) {
                const isConnected = call(
                    GOBJECT_LIB,
                    "g_signal_handler_is_connected",
                    [
                        { type: GOBJECT_NONE, value: button },
                        { type: UINT64, value: handlerId },
                    ],
                    BOOLEAN,
                );
                expect(isConnected).toBe(true);
            }

            for (const handlerId of handlers) {
                disconnectSignal(button, handlerId);
            }
        });

        it("handles closure callback trampoline", () => {
            const button = createButton("Test");

            const handlerId = call(
                GOBJECT_LIB,
                "g_signal_connect_data",
                [
                    { type: GOBJECT_NONE, value: button },
                    { type: STRING, value: "clicked" },
                    { type: { type: "callback", trampoline: "closure" }, value: () => {} },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: INT32, value: 0 },
                ],
                UINT64,
            );

            expect(typeof handlerId).toBe("number");
            expect(handlerId).toBeGreaterThan(0);
        });
    });
});
