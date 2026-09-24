import * as Gio from "@gtkx/gi/gio";
import { registerClass } from "@gtkx/runtime";
import { expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type Invocation = [message: string, processes: number[], choices: string[]];

class ProcessMountOperation extends Gio.MountOperation {
    readonly invocations: Invocation[] = [];

    protected override vfuncShowProcesses(message: string, processes: number[], choices: string[]): void {
        this.invocations.push([message, processes, choices]);
    }
}

registerClass(ProcessMountOperation, { typeName: createTypeNameFactory("_")("GtkxScalarGArrayMountOperation") });

it("emits PID arrays through the signal handler and native class slot", () => {
    const operation = new ProcessMountOperation({});
    const received: Invocation[] = [];
    const handler = (...args: Invocation): void => {
        received.push(args);
    };
    operation.on("show-processes", handler);

    try {
        const processes = [17, 42];
        const choices = ["Wait", "Cancel"];
        operation.emit("show-processes", "Busy", processes, choices);
        expect(received).toEqual([["Busy", [17, 42], ["Wait", "Cancel"]]]);
        expect(operation.invocations).toEqual(received);

        processes[0] = 99;
        choices.push("Retry");
        expect(received).toEqual([["Busy", [17, 42], ["Wait", "Cancel"]]]);
        expect(operation.invocations).toEqual(received);
    } finally {
        operation.off("show-processes", handler);
    }
});

it("emits empty PID and choice arrays", () => {
    const operation = new ProcessMountOperation({});
    const received: Invocation[] = [];
    const handler = (...args: Invocation): void => {
        received.push(args);
    };
    operation.on("show-processes", handler);

    try {
        operation.emit("show-processes", "", [], []);
        expect(received).toEqual([["", [], []]]);
        expect(operation.invocations).toEqual(received);
    } finally {
        operation.off("show-processes", handler);
    }
});

it.each([0.5, 0x80_00_00_00])("rejects invalid PID %s before delivery and recovers", (invalid) => {
    const operation = new ProcessMountOperation({});
    const received: Invocation[] = [];
    const handler = (...args: Invocation): void => {
        received.push(args);
    };
    operation.on("show-processes", handler);

    try {
        expect(() => {
            operation.emit("show-processes", "Busy", [invalid], ["Wait"]);
        }).toThrow();
        expect(received).toEqual([]);
        expect(operation.invocations).toEqual([]);

        operation.emit("show-processes", "Recovered", [42], ["Cancel"]);
        expect(received).toEqual([["Recovered", [42], ["Cancel"]]]);
        expect(operation.invocations).toEqual(received);
    } finally {
        operation.off("show-processes", handler);
    }
});
