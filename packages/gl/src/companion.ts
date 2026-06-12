/**
 * Hand-written companions to the generated GL surface.
 *
 * Covers the cold paths the registry cannot express mechanically: the
 * string-returning info-log helpers (hiding the two-call length dance), the
 * debug-message callback (forced synchronous so the driver invokes it inside
 * the GL call frame on the GLib thread), and a bounded wait-loop substitute
 * for the `GL_TIMEOUT_IGNORED` token, whose value exceeds the safe integer
 * range and is therefore not generated.
 *
 * Export names here must stay disjoint from the generated modules; the
 * generator asserts this at generation time.
 */
import { t } from "@gtkx/ffi";
import { clientWaitSync, enable, getProgramiv, getProgramPipelineiv, getShaderiv } from "./generated/commands.js";
import {
    ALREADY_SIGNALED,
    CONDITION_SATISFIED,
    DEBUG_OUTPUT,
    DEBUG_OUTPUT_SYNCHRONOUS,
    INFO_LOG_LENGTH,
    TIMEOUT_EXPIRED,
} from "./generated/enums.js";
import type { GLbitfield, GLenum, GLint, GLsync, GLuint } from "./generated/types.js";

const LIB = "libGL.so.1";

type LengthQuery = (id: GLuint, pname: GLenum) => GLint;

const readInfoLog = (symbol: string, id: GLuint, query: LengthQuery): string => {
    const length = query(id, INFO_LOG_LENGTH);
    if (length <= 0) return "";
    const written = { value: 0 };
    const log = { value: "" };
    t.fn(
        LIB,
        symbol,
        [
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.string("borrowed", length)) },
        ],
        t.void,
    )(id, length, written, log);
    return log.value;
};

/**
 * Returns a shader object's information log.
 *
 * Performs the `GL_INFO_LOG_LENGTH` query and the sized `glGetShaderInfoLog`
 * read in one call.
 *
 * @param shader - The shader object name
 * @returns The info log, or `""` when the log is empty
 */
export function getShaderInfoLog(shader: GLuint): string {
    return readInfoLog("glGetShaderInfoLog", shader, getShaderiv);
}

/**
 * Returns a program object's information log.
 *
 * Performs the `GL_INFO_LOG_LENGTH` query and the sized `glGetProgramInfoLog`
 * read in one call.
 *
 * @param program - The program object name
 * @returns The info log, or `""` when the log is empty
 */
export function getProgramInfoLog(program: GLuint): string {
    return readInfoLog("glGetProgramInfoLog", program, getProgramiv);
}

/**
 * Returns a program pipeline object's information log.
 *
 * Performs the `GL_INFO_LOG_LENGTH` query and the sized
 * `glGetProgramPipelineInfoLog` read in one call.
 *
 * @param pipeline - The program pipeline object name
 * @returns The info log, or `""` when the log is empty
 */
export function getProgramPipelineInfoLog(pipeline: GLuint): string {
    return readInfoLog("glGetProgramPipelineInfoLog", pipeline, getProgramPipelineiv);
}

/**
 * A GL debug-output handler.
 *
 * @param source - The `GL_DEBUG_SOURCE_*` token
 * @param type - The `GL_DEBUG_TYPE_*` token
 * @param id - The message identifier
 * @param severity - The `GL_DEBUG_SEVERITY_*` token
 * @param message - The message text
 */
// biome-ignore lint/complexity/useMaxParams: mirrors the C `GLDEBUGPROC` callback signature
export type DebugMessageCallback = (
    source: GLenum,
    type: GLenum,
    id: GLuint,
    severity: GLenum,
    message: string,
) => void;

const glDebugMessageCallbackBinding = t.fn(
    LIB,
    "glDebugMessageCallback",
    [
        {
            type: t.trampoline(
                [t.uint32, t.uint32, t.uint32, t.uint32, t.int32, t.string("borrowed"), t.uint64],
                t.void,
                { userDataIndex: 6, scope: "forever" },
            ),
            optional: true,
        },
    ],
    t.void,
);

/**
 * Installs a debug-output handler, forcing `GL_DEBUG_OUTPUT` and
 * `GL_DEBUG_OUTPUT_SYNCHRONOUS` so the driver invokes the handler inside the
 * GL call that produced the message. Synchronous delivery is what makes the
 * callback sound here: every invocation happens on the GLib thread while the
 * calling JavaScript thread is parked in that same GL call.
 *
 * @param callback - The handler, or `null` to uninstall
 */
export function debugMessageCallback(callback: DebugMessageCallback | null): void {
    if (callback === null) {
        glDebugMessageCallbackBinding(null);
        return;
    }
    enable(DEBUG_OUTPUT);
    enable(DEBUG_OUTPUT_SYNCHRONOUS);
    glDebugMessageCallbackBinding(
        // biome-ignore lint/complexity/useMaxParams: mirrors the C `GLDEBUGPROC` callback signature
        (source: GLenum, type: GLenum, id: GLuint, severity: GLenum, _length: number, message: string) =>
            callback(source, type, id, severity, message),
    );
}

const MAX_WAIT_CHUNK_NS = 1_000_000_000;

/**
 * Waits for a fence to signal, looping bounded `clientWaitSync` calls in
 * place of the ungeneratable `GL_TIMEOUT_IGNORED` token (its value exceeds
 * the safe integer range).
 *
 * @param sync - The fence returned by `fenceSync`
 * @param flags - `GL_SYNC_FLUSH_COMMANDS_BIT` or `0`; applied to the first wait only
 * @param timeoutNs - Total nanoseconds to wait before giving up
 * @returns The final `clientWaitSync` status
 */
export function clientWaitSyncLoop(sync: GLsync, flags: GLbitfield, timeoutNs: number): GLenum {
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
