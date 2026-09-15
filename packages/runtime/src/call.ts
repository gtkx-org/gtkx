import { type CallDescriptor, type ExternalObject, call as nativeCall, type Ref } from "@gtkx/native";
import type { Descriptor } from "./descriptor-types.js";
import type { StorageHandle } from "./output-storage.js";

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
    const scalarOutputs = args.flatMap((plan, index) =>
        plan.inner !== undefined && plan.storage !== undefined
            ? [{ index, inner: plan.inner, storage: plan.storage }]
            : []);
    const index = argDescriptors.findIndex((arg) => isCompletionCallback(arg));
    const completionIndex = index === -1 ? undefined : index;

    return (values) => {
        if (values.length !== args.length) {
            throw new TypeError("Argument count does not match the bound signature");
        }
        const encoded = args.map((plan, index) => plan.encode(values[index]));
        const result = nativeCall(descriptor, encoded, completionIndex);

        const returned = returns.decode(result.value);
        const outputs = result.outputs.flatMap((output) => {
            const inner = args[output.index]?.inner;

            return inner === undefined ? [] : [{ index: output.index, value: inner.decode(output.value) }];
        });
        for (const { index, inner, storage } of scalarOutputs) {
            if (encoded[index] != null) {
                outputs.push({ index, value: inner.decode(storage.read(encoded[index] as StorageHandle)) });
            }
        }
        outputs.sort((left, right) => left.index - right.index);
        for (const output of outputs) {
            (values[output.index] as Ref).value = output.value;
        }

        return returned;
    };
};

export { createCall };
