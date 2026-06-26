import { t } from "@gtkx/ffi";
import { clientWaitSync, enable, getProgramiv, getProgramPipelineiv, getShaderiv, LIB } from "./generated/commands.js";
import {
    ALREADY_SIGNALED,
    CONDITION_SATISFIED,
    DEBUG_OUTPUT,
    DEBUG_OUTPUT_SYNCHRONOUS,
    INFO_LOG_LENGTH,
    TIMEOUT_EXPIRED,
} from "./generated/enums.js";
import type {
    DebugSeverity,
    DebugSource,
    DebugType,
    GLenum,
    GLint,
    GLsync,
    GLuint,
    SyncObjectMask,
    SyncStatus,
} from "./generated/types.js";

type LengthQuery = (id: GLuint, pname: GLenum) => GLint;

const readInfoLog = (symbol: string, id: GLuint, query: LengthQuery): string => {
    const length = query(id, INFO_LOG_LENGTH);
    if (length <= 0) return "";
    const written = { value: 0 };
    const log = { value: "" };
    t.bind(LIB, symbol, [t.uint32, t.int32, t.ref(t.int32), t.ref(t.string("borrowed", length))], t.void)(
        id,
        length,
        written,
        log,
    );
    return log.value;
};

export function getShaderInfoLog(shader: GLuint): string {
    return readInfoLog("glGetShaderInfoLog", shader, getShaderiv);
}

export function getProgramInfoLog(program: GLuint): string {
    return readInfoLog("glGetProgramInfoLog", program, getProgramiv);
}

export function getProgramPipelineInfoLog(pipeline: GLuint): string {
    return readInfoLog("glGetProgramPipelineInfoLog", pipeline, getProgramPipelineiv);
}

export type DebugMessageCallback = (
    source: DebugSource,
    type: DebugType,
    id: GLuint,
    severity: DebugSeverity,
    message: string,
) => void;

const glDebugMessageCallbackBinding = t.bind(
    LIB,
    "glDebugMessageCallback",
    [
        t.callback([t.uint32, t.uint32, t.uint32, t.uint32, t.int32, t.string("borrowed"), t.uint64], t.void, {
            userDataIndex: 6,
            scope: "forever",
        }),
    ],
    t.void,
);

export function debugMessageCallback(callback: DebugMessageCallback | null): void {
    if (callback === null) {
        glDebugMessageCallbackBinding(null);
        return;
    }
    enable(DEBUG_OUTPUT);
    enable(DEBUG_OUTPUT_SYNCHRONOUS);
    glDebugMessageCallbackBinding(
        (source: GLenum, type: GLenum, id: GLuint, severity: GLenum, _length: number, message: string) =>
            callback(source, type, id, severity, message),
    );
}

const MAX_WAIT_CHUNK_NS = 1_000_000_000;

export function clientWaitSyncLoop(sync: GLsync, flags: SyncObjectMask, timeoutNs: number): SyncStatus {
    let remaining = timeoutNs;
    let currentFlags = flags;
    for (;;) {
        const chunk = Math.min(remaining, MAX_WAIT_CHUNK_NS);
        const status = clientWaitSync(sync, currentFlags, chunk);
        if (status === ALREADY_SIGNALED || status === CONDITION_SATISFIED) return status;
        if (status !== TIMEOUT_EXPIRED) return status;
        remaining -= chunk;
        if (remaining <= 0) return TIMEOUT_EXPIRED;
        currentFlags = 0;
    }
}
