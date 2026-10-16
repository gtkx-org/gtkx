import { type BoundCall, call as nativeCall, type Ref } from "./native.js";
import type { Descriptor } from "./descriptor-types.js";
import type { StorageHandle } from "./output-storage.js";

import { compileDescriptors, type DescriptorPlans } from "./scalar-plan.js";

type CallPlan = DescriptorPlans & { completionIndex: number | undefined };

const isCompletionCallback = (descriptor: Descriptor): boolean =>
    descriptor.kind === "callback" &&
    descriptor.scope === "async" &&
    descriptor.hasUserData === true &&
    descriptor.userDataIndex === 2 &&
    descriptor.returnDescriptor.kind === "void" &&
    descriptor.argDescriptors.length === 3 &&
    descriptor.argDescriptors[0]?.kind === "object" &&
    descriptor.argDescriptors[1]?.kind === "object";

const compileCallPlan = (argDescriptors: Descriptor[], returnDescriptor: Descriptor): CallPlan => {
    const index = argDescriptors.findIndex((arg) => isCompletionCallback(arg));
    return {
        ...compileDescriptors(argDescriptors, returnDescriptor),
        completionIndex: index === -1 ? undefined : index,
    };
};

const createCall = (
    descriptor: BoundCall,
    { args, returns, completionIndex }: CallPlan,
): ((values: unknown[]) => unknown) => {
    const hasReferences = args.some((plan) => plan.referenceStorage !== undefined);
    const scalarOutputs = args.flatMap((plan, index) =>
        plan.inner !== undefined && plan.storage !== undefined
            ? [{ index, inner: plan.inner, storage: plan.storage }]
            : [],
    );

    return (values) => {
        if (values.length !== args.length) {
            throw new TypeError("Argument count does not match the bound signature");
        }
        const encoded: unknown[] = [];
        const encode = (index: number): unknown => {
            const plan = args[index];
            if (plan === undefined) {
                throw new RangeError("Argument index exceeds the bound signature");
            }
            const value = plan.encode(values[index]);
            encoded[index] = value;
            return value;
        };
        const normalized = hasReferences ? encode : args.map((_, index) => encode(index));
        const result = nativeCall(descriptor, normalized, completionIndex);

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

export { compileCallPlan, createCall, type CallPlan };
