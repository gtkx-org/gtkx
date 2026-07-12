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

/**
 * Reads the info log for a shader object, containing compilation diagnostics.
 * @param shader The name of the shader object to query.
 * @returns The shader info log, or an empty string when none is available.
 */
export function getShaderInfoLog(shader: GLuint): string {
    return readInfoLog("glGetShaderInfoLog", shader, getShaderiv);
}

/**
 * Reads the info log for a program object, containing linking diagnostics.
 * @param program The name of the program object to query.
 * @returns The program info log, or an empty string when none is available.
 */
export function getProgramInfoLog(program: GLuint): string {
    return readInfoLog("glGetProgramInfoLog", program, getProgramiv);
}

/**
 * Reads the info log for a program pipeline object, containing validation diagnostics.
 * @param pipeline The name of the program pipeline object to query.
 * @returns The pipeline info log, or an empty string when none is available.
 */
export function getProgramPipelineInfoLog(pipeline: GLuint): string {
    return readInfoLog("glGetProgramPipelineInfoLog", pipeline, getProgramPipelineiv);
}

/**
 * Callback invoked for each GL debug message reported by the driver.
 * @param source The origin of the message (API, window system, shader compiler, and so on).
 * @param type The category of the message (error, deprecated behavior, performance, and so on).
 * @param id The driver-assigned identifier of the message.
 * @param severity The severity level of the message.
 * @param message The human-readable message text.
 */
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

/**
 * Installs a callback that receives GL debug messages, enabling synchronous debug output.
 * Passing null removes any previously installed callback.
 * @param callback The handler to invoke for each debug message, or null to clear it.
 */
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

/**
 * Blocks until a sync object is signaled or the timeout elapses, looping over glClientWaitSync
 * in bounded chunks so long waits are not truncated by the driver's per-call limit.
 * @param sync The sync object (fence) to wait on.
 * @param flags Flags controlling the wait, such as flushing pending commands on the first call.
 * @param timeoutNs The total time to wait, in nanoseconds.
 * @returns The status of the sync object: signaled, condition satisfied, or timeout expired.
 */
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
