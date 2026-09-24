import {
    allocField,
    bindField,
    type Descriptor,
    type ExternalObject,
    type Handle,
    readField,
    writeField,
} from "@gtkx/native";

type StorageHandle = ExternalObject<Handle>;
type OutputStorage = {
    allocate: (value: unknown) => StorageHandle;
    read: (handle: StorageHandle) => unknown;
    write: (handle: StorageHandle, value: unknown) => void;
};

const scalarKinds: Set<Descriptor["kind"]> = new Set([
    "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
    "bigint64", "biguint64", "float32", "float64",
]);

const isScalarStorageDescriptor = (descriptor: Descriptor): boolean => scalarKinds.has(descriptor.kind);

const compileOutputStorage = (descriptor: Descriptor): OutputStorage | undefined => {
    if (!isScalarStorageDescriptor(descriptor)) {
        return undefined;
    }
    const field = bindField(descriptor);

    return {
        allocate(value) {
            const handle = allocField(field);
            if (value != null) {
                writeField(field, handle, 0, value);
            }

            return handle;
        },
        read: (handle) => readField(field, handle, 0),
        write: (handle, value) => {
            writeField(field, handle, 0, value);
        },
    };
};

export { compileOutputStorage, isScalarStorageDescriptor, type OutputStorage, type StorageHandle };
