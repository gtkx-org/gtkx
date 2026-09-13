import { type CallDescriptor, type ExternalObject, call as nativeCall, type Ref } from "@gtkx/native";
import type { Descriptor } from "./descriptor-types.js";

import { compileDescriptor } from "./scalar-plan.js";

const isCompletionCallback = (descriptor: Descriptor): boolean =>
    descriptor.kind === "callback" &&
    descriptor.scope === "async" &&
    descriptor.hasUserData === true &&
    descriptor.userDataIndex === 2 &&
    descriptor.returnDescriptor.kind === "void" &&
    descriptor.argDescriptors.length === 3 &&
    descriptor.argDescriptors[0]?.kind === "object" &&
    descriptor.argDescriptors[1]?.kind === "object";

const createCall = (
    descriptor: ExternalObject<CallDescriptor>,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
): ((values: unknown[]) => unknown) => {
    const args = argDescriptors.map((descriptor) => compileDescriptor(descriptor));
    const returns = compileDescriptor(returnDescriptor);
    const index = argDescriptors.findIndex((arg) => isCompletionCallback(arg));
    const completionIndex = index === -1 ? undefined : index;

    return (values) => {
        if (values.length !== args.length) {
            throw new TypeError("Argument count does not match the bound signature");
        }
        const result = nativeCall(descriptor, args.map((plan, index) => plan.encode(values[index])), completionIndex);

        const returned = returns.decode(result.value);
        const outputs = result.outputs.flatMap((output) => {
            const plan = args[output.index]?.inner;

            return plan === undefined ? [] : [{ index: output.index, value: plan.decode(output.value) }];
        });
        for (const output of outputs) {
            (values[output.index] as Ref).value = output.value;
        }

        return returned;
    };
};

export { createCall };
