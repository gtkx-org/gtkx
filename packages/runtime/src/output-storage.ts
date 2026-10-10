import {
    alloc,
    bindField,
    type Descriptor,
    type ExternalObject,
    type Handle,
    readField,
    writeField,
} from "./native.js";

type StorageHandle = ExternalObject<Handle>;
type OutputStorage = {
    allocate: (value: unknown) => StorageHandle;
    read: (handle: StorageHandle) => unknown;
    write: (handle: StorageHandle, value: unknown) => void;
};

const scalarSizes: Partial<Record<Descriptor["kind"], number>> = {
    int8: 1,
    uint8: 1,
    int16: 2,
    uint16: 2,
    int32: 4,
    uint32: 4,
    int64: 8,
    uint64: 8,
    bigint64: 8,
    biguint64: 8,
    float32: 4,
    float64: 8,
};

const isScalarStorageDescriptor = (descriptor: Descriptor): boolean => scalarSizes[descriptor.kind] !== undefined;

const compileOutputStorage = (descriptor: Descriptor): OutputStorage | undefined => {
    const size = scalarSizes[descriptor.kind];
    if (size === undefined) {
        return undefined;
    }
    const field = bindField(descriptor);

    return {
        allocate(value) {
            const handle = alloc(size);
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
