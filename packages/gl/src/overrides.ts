import { t } from "@gtkx/runtime";
import type {
    DebugSeverity,
    DebugSource,
    DebugType,
    GLenum,
    GLint,
    GLuint,
} from "./generated/types.js";
import { getProgramiv, getProgramPipelineiv, getShaderiv, LIB } from "./generated/commands.js";
import { INFO_LOG_LENGTH } from "./generated/enums.js";

type LengthQuery = (id: GLuint, pname: GLenum) => GLint;
type DebugCallbackArgs = [GLenum, GLenum, GLuint, GLenum, number, string];

/**
 * A debug message reported by the GL driver.
 */
type DebugMessage = {
    /** The origin of the message (API, window system, shader compiler, and so on). */
    source: DebugSource;
    /** The category of the message (error, deprecated behavior, performance, and so on). */
    type: DebugType;
    /** The driver-assigned identifier of the message. */
    id: GLuint;
    /** The severity level of the message. */
    severity: DebugSeverity;
    /** The human-readable message text. */
    message: string;
};

/**
 * Callback invoked for each GL debug message reported by the driver.
 * @param message - The message reported by the driver.
 */
type DebugMessageCallback = (message: DebugMessage) => void;

const glDebugMessageCallbackBinding = t.bind(
    LIB,
    "glDebugMessageCallback",
    [
        t.callback([t.uint32, t.uint32, t.uint32, t.uint32, t.int32, t.string("borrowed"), t.buffer], t.void, {
            hasUserData: true,
            userDataIndex: 6,
            scope: "forever",
        }),
    ],
    t.void,
);

const readInfoLog = (symbol: string, id: GLuint, query: LengthQuery): string => {
    const length = query(id, INFO_LOG_LENGTH);

    if (length <= 0) {
        return "";
    }

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
function getShaderInfoLog(shader: GLuint): string {
    return readInfoLog("glGetShaderInfoLog", shader, getShaderiv);
}

/**
 * Reads the info log for a program object, containing linking diagnostics.
 * @param program The name of the program object to query.
 * @returns The program info log, or an empty string when none is available.
 */
function getProgramInfoLog(program: GLuint): string {
    return readInfoLog("glGetProgramInfoLog", program, getProgramiv);
}

/**
 * Reads the info log for a program pipeline object, containing validation diagnostics.
 * @param pipeline The name of the program pipeline object to query.
 * @returns The pipeline info log, or an empty string when none is available.
 */
function getProgramPipelineInfoLog(pipeline: GLuint): string {
    return readInfoLog("glGetProgramPipelineInfoLog", pipeline, getProgramPipelineiv);
}

/**
 * Installs a callback that receives GL debug messages.
 * Passing null removes any previously installed callback.
 * @param callback The handler to invoke for each debug message, or null to clear it.
 */
function debugMessageCallback(callback: DebugMessageCallback | null): void {
    if (callback === null) {
        glDebugMessageCallbackBinding(null);

        return;
    }

    glDebugMessageCallbackBinding((...args: DebugCallbackArgs) => {
        const [source, type, id, severity, , message] = args;
        callback({ source, type, id, severity, message });
    });
}

export {
    getShaderInfoLog,
    getProgramInfoLog,
    getProgramPipelineInfoLog,
    debugMessageCallback,
    type DebugMessage,
    type DebugMessageCallback,
};
