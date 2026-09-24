import { t } from "@gtkx/runtime";
import type { GLenum, GLint, GLuint } from "./generated/types.js";
import { getProgramiv, getProgramPipelineiv, getShaderiv, LIB } from "./generated/commands.js";
import { INFO_LOG_LENGTH } from "./generated/enums.js";

type LengthQuery = (id: GLuint, pname: GLenum) => GLint;

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

export { getShaderInfoLog, getProgramInfoLog, getProgramPipelineInfoLog };
