import {
    bind,
    bindField,
    call,
    createRecordConverter,
    type Descriptor,
    disposeHandle,
    type ExternalObject,
    type Handle,
    readField,
    type RecordConverter,
} from "./native.js";
import { functionResolver } from "./descriptor-lifecycle.js";

const converters: Map<string, ExternalObject<RecordConverter>> = new Map();

const cairoPathConverter = (sharedLibrary: string): ExternalObject<RecordConverter> =>
    converters.getOrInsertComputed(sharedLibrary, () => {
        const record = (freeFnName?: string): Descriptor => ({
            kind: "struct",
            ownership: freeFnName === undefined ? "borrowed" : "full",
            isCallerAllocated: false,
            isInline: false,
            isValueSafe: false,
            ...(freeFnName === undefined ? {} : { freeResolver: functionResolver(sharedLibrary, freeFnName) }),
        });
        const integer: Descriptor = { kind: "int32" };
        const surfaceCreate = bind(
            sharedLibrary,
            "cairo_image_surface_create",
            [integer, integer, integer],
            record("cairo_surface_destroy"),
            { argOrder: [0, 1, 2] },
        );
        const contextCreate = bind(sharedLibrary, "cairo_create", [record()], record("cairo_destroy"), {
            argOrder: [0],
        });
        const appendPath = bind(
            sharedLibrary,
            "cairo_append_path",
            [record(), record()],
            { kind: "void" },
            {
                argOrder: [0, 1],
            },
        );
        const copyPath = bind(sharedLibrary, "cairo_copy_path", [record()], record("cairo_path_destroy"), {
            argOrder: [0],
        });
        const status = bind(sharedLibrary, "cairo_status", [record()], integer, { argOrder: [0] });
        const pathStatus = bindField(integer);

        return createRecordConverter((source) => {
            const surface = call(surfaceCreate, [0, 1, 1]).value as ExternalObject<Handle> | null;
            if (surface === null) {
                throw new Error("Cairo could not allocate a copy surface");
            }
            try {
                const context = call(contextCreate, [surface]).value as ExternalObject<Handle> | null;
                if (context === null) {
                    throw new Error("Cairo could not allocate a copy context");
                }
                try {
                    call(appendPath, [context, source]);
                    const contextStatus = call(status, [context]).value;
                    if (contextStatus !== 0) {
                        throw new Error(`Cairo path copy failed with status ${String(contextStatus)}`);
                    }
                    const result = call(copyPath, [context]).value as ExternalObject<Handle> | null;
                    if (result === null) {
                        throw new Error("Cairo could not allocate a path copy");
                    }
                    try {
                        const resultStatus = readField(pathStatus, result, 0);
                        if (resultStatus !== 0) {
                            throw new Error(`Cairo path copy failed with status ${String(resultStatus)}`);
                        }
                        return result;
                    } catch (error) {
                        disposeHandle(result);
                        throw error;
                    }
                } finally {
                    disposeHandle(context);
                }
            } finally {
                disposeHandle(surface);
            }
        });
    });

export { cairoPathConverter };
