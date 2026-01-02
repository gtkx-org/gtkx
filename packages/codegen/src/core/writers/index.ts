import { FfiTypeWriter } from "./ffi-type-writer.js";

export type Writers = {
    ffiTypeWriter: FfiTypeWriter;
};

export type CreateWritersOptions = {
    sharedLibrary?: string;
    glibLibrary?: string;
};

export const createWriters = (options: CreateWritersOptions): Writers => {
    const ffiTypeWriter = new FfiTypeWriter({
        currentSharedLibrary: options.sharedLibrary,
        glibLibrary: options.glibLibrary,
    });

    return {
        ffiTypeWriter,
    };
};
