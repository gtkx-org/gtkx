import {
    alloc,
    type CompiledDescriptor,
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
    bigint64: 8,
    biguint64: 8,
    float32: 4,
    float64: 8,
};

const scalarStorageSize = (descriptor: Descriptor): number | undefined => scalarSizes[descriptor.kind];

const isScalarStorageDescriptor = (descriptor: Descriptor): boolean => scalarStorageSize(descriptor) !== undefined;

const compileOutputStorage = (
    descriptor: Descriptor,
    compiled: () => ExternalObject<CompiledDescriptor>,
): OutputStorage | undefined => {
    const size = scalarStorageSize(descriptor);
    if (size === undefined) {
        return undefined;
    }
    const storageDescriptor = compiled();

    return {
        allocate(value) {
            const handle = alloc(size);
            if (value != null) {
                writeField(storageDescriptor, handle, 0, value);
            }

            return handle;
        },
        read: (handle) => readField(storageDescriptor, handle, 0),
        write: (handle, value) => {
            writeField(storageDescriptor, handle, 0, value);
        },
    };
};

export { compileOutputStorage, isScalarStorageDescriptor, scalarStorageSize, type OutputStorage, type StorageHandle };
