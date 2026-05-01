import { createRef } from "@gtkx/native";
import { t } from "../native.js";
import { INFO_LOG_LENGTH } from "./constants.js";

const LIB = "libGL.so.1";

const { fn } = t;
const VOID = t.void;
const U32 = t.uint32;
const I32 = t.int32;
const I64 = t.int64;
const U64 = t.uint64;
const F32 = t.float32;
const F64 = t.float64;
const BOOL = t.boolean;
const STR = t.string("borrowed");
const REF_I32 = t.ref(I32);
const REF_U32 = t.ref(U32);
const ARRAY_F32 = t.array(F32);
const ARRAY_U16 = t.array(t.uint16);
const ARRAY_U32 = t.array(U32);
const ARRAY_STR = t.array(STR);

const glClear = fn(LIB, "glClear", [{ type: U32 }], VOID);
const glClearColor = fn(LIB, "glClearColor", [{ type: F32 }, { type: F32 }, { type: F32 }, { type: F32 }], VOID);
const glViewport = fn(LIB, "glViewport", [{ type: I32 }, { type: I32 }, { type: I32 }, { type: I32 }], VOID);
const glEnable = fn(LIB, "glEnable", [{ type: U32 }], VOID);
const glDisable = fn(LIB, "glDisable", [{ type: U32 }], VOID);
const glClearDepth = fn(LIB, "glClearDepth", [{ type: F64 }], VOID);
const glDepthFunc = fn(LIB, "glDepthFunc", [{ type: U32 }], VOID);

const glCreateShader = fn(LIB, "glCreateShader", [{ type: U32 }], U32);
const glShaderSource = fn(
    LIB,
    "glShaderSource",
    [{ type: U32 }, { type: I32 }, { type: ARRAY_STR }, { type: U64 }],
    VOID,
);
const glCompileShader = fn(LIB, "glCompileShader", [{ type: U32 }], VOID);
const glGetShaderiv = fn(LIB, "glGetShaderiv", [{ type: U32 }, { type: U32 }, { type: REF_I32 }], VOID);
const glDeleteShader = fn(LIB, "glDeleteShader", [{ type: U32 }], VOID);

const glCreateProgram = fn(LIB, "glCreateProgram", [], U32);
const glAttachShader = fn(LIB, "glAttachShader", [{ type: U32 }, { type: U32 }], VOID);
const glDetachShader = fn(LIB, "glDetachShader", [{ type: U32 }, { type: U32 }], VOID);
const glLinkProgram = fn(LIB, "glLinkProgram", [{ type: U32 }], VOID);
const glUseProgram = fn(LIB, "glUseProgram", [{ type: U32 }], VOID);
const glGetProgramiv = fn(LIB, "glGetProgramiv", [{ type: U32 }, { type: U32 }, { type: REF_I32 }], VOID);
const glDeleteProgram = fn(LIB, "glDeleteProgram", [{ type: U32 }], VOID);

const glGetUniformLocation = fn(LIB, "glGetUniformLocation", [{ type: U32 }, { type: STR }], I32);
const glGetAttribLocation = fn(LIB, "glGetAttribLocation", [{ type: U32 }, { type: STR }], I32);
const glBindAttribLocation = fn(LIB, "glBindAttribLocation", [{ type: U32 }, { type: U32 }, { type: STR }], VOID);

const glUniform1f = fn(LIB, "glUniform1f", [{ type: I32 }, { type: F32 }], VOID);
const glUniform2f = fn(LIB, "glUniform2f", [{ type: I32 }, { type: F32 }, { type: F32 }], VOID);
const glUniform3f = fn(LIB, "glUniform3f", [{ type: I32 }, { type: F32 }, { type: F32 }, { type: F32 }], VOID);
const glUniform4f = fn(
    LIB,
    "glUniform4f",
    [{ type: I32 }, { type: F32 }, { type: F32 }, { type: F32 }, { type: F32 }],
    VOID,
);
const glUniform1i = fn(LIB, "glUniform1i", [{ type: I32 }, { type: I32 }], VOID);
const glUniformMatrix4fv = fn(
    LIB,
    "glUniformMatrix4fv",
    [{ type: I32 }, { type: I32 }, { type: BOOL }, { type: ARRAY_F32 }],
    VOID,
);

const glGenVertexArrays = fn(LIB, "glGenVertexArrays", [{ type: I32 }, { type: REF_U32 }], VOID);
const glBindVertexArray = fn(LIB, "glBindVertexArray", [{ type: U32 }], VOID);
const glDeleteVertexArrays = fn(LIB, "glDeleteVertexArrays", [{ type: I32 }, { type: ARRAY_U32 }], VOID);

const glGenBuffers = fn(LIB, "glGenBuffers", [{ type: I32 }, { type: REF_U32 }], VOID);
const glBindBuffer = fn(LIB, "glBindBuffer", [{ type: U32 }, { type: U32 }], VOID);
const glDeleteBuffers = fn(LIB, "glDeleteBuffers", [{ type: I32 }, { type: ARRAY_U32 }], VOID);
const glBufferDataF32 = fn(
    LIB,
    "glBufferData",
    [{ type: U32 }, { type: I64 }, { type: ARRAY_F32 }, { type: U32 }],
    VOID,
);
const glBufferDataU16 = fn(
    LIB,
    "glBufferData",
    [{ type: U32 }, { type: I64 }, { type: ARRAY_U16 }, { type: U32 }],
    VOID,
);

const glVertexAttribPointer = fn(
    LIB,
    "glVertexAttribPointer",
    [{ type: U32 }, { type: I32 }, { type: U32 }, { type: BOOL }, { type: I32 }, { type: U64 }],
    VOID,
);
const glEnableVertexAttribArray = fn(LIB, "glEnableVertexAttribArray", [{ type: U32 }], VOID);
const glDisableVertexAttribArray = fn(LIB, "glDisableVertexAttribArray", [{ type: U32 }], VOID);
const glDrawArrays = fn(LIB, "glDrawArrays", [{ type: U32 }, { type: I32 }, { type: I32 }], VOID);
const glDrawElements = fn(LIB, "glDrawElements", [{ type: U32 }, { type: I32 }, { type: U32 }, { type: U64 }], VOID);

const glGetError = fn(LIB, "glGetError", [], U32);
const glFlush = fn(LIB, "glFlush", [], VOID);

/**
 * Clears buffers to preset values.
 * @param mask - Bitwise OR of masks indicating buffers to clear (GL_COLOR_BUFFER_BIT, GL_DEPTH_BUFFER_BIT, GL_STENCIL_BUFFER_BIT)
 */
export function clear(mask: number): void {
    glClear(mask);
}

/**
 * Sets the clear color for the color buffer.
 * @param red - Red component (0.0 to 1.0)
 * @param green - Green component (0.0 to 1.0)
 * @param blue - Blue component (0.0 to 1.0)
 * @param alpha - Alpha component (0.0 to 1.0)
 */
export function clearColor(red: number, green: number, blue: number, alpha: number): void {
    glClearColor(red, green, blue, alpha);
}

/**
 * Sets the viewport transformation.
 * @param x - X coordinate of the lower-left corner of the viewport
 * @param y - Y coordinate of the lower-left corner of the viewport
 * @param width - Width of the viewport
 * @param height - Height of the viewport
 */
export function viewport(x: number, y: number, width: number, height: number): void {
    glViewport(x, y, width, height);
}

/**
 * Enables a GL capability.
 * @param cap - The capability to enable (e.g., GL_DEPTH_TEST, GL_BLEND)
 */
export function enable(cap: number): void {
    glEnable(cap);
}

/**
 * Disables a GL capability.
 * @param cap - The capability to disable
 */
export function disable(cap: number): void {
    glDisable(cap);
}

/**
 * Sets the clear value for the depth buffer.
 * @param depth - Depth value used when clearing (0.0 to 1.0)
 */
export function clearDepth(depth: number): void {
    glClearDepth(depth);
}

/**
 * Sets the depth comparison function.
 * @param func - The comparison function (e.g., GL_LESS, GL_LEQUAL)
 */
export function depthFunc(func: number): void {
    glDepthFunc(func);
}

/**
 * Creates a shader object.
 * @param type - The type of shader (GL_VERTEX_SHADER or GL_FRAGMENT_SHADER)
 * @returns The shader object ID
 */
export function createShader(type: number): number {
    return glCreateShader(type) as number;
}

/**
 * Sets the source code for a shader object.
 * @param shader - The shader object ID
 * @param source - The GLSL source code string
 */
export function shaderSource(shader: number, source: string): void {
    glShaderSource(shader, 1, [source], 0);
}

/**
 * Compiles a shader object.
 * @param shader - The shader object ID to compile
 */
export function compileShader(shader: number): void {
    glCompileShader(shader);
}

/**
 * Gets a parameter from a shader object.
 * @param shader - The shader object ID
 * @param pname - The parameter to query (e.g., GL_COMPILE_STATUS, GL_INFO_LOG_LENGTH)
 * @returns The parameter value
 */
export function getShaderiv(shader: number, pname: number): number {
    const params = createRef(0);
    glGetShaderiv(shader, pname, params);
    return params.value;
}

function readInfoLog(symbol: string, id: number, logLength: number): string {
    const infoLogRef = createRef("");
    const lengthRef = createRef(0);
    fn(
        LIB,
        symbol,
        [{ type: U32 }, { type: I32 }, { type: REF_I32 }, { type: t.ref(t.string("borrowed", logLength)) }],
        VOID,
    )(id, logLength, lengthRef, infoLogRef);
    return infoLogRef.value;
}

/**
 * Gets the information log for a shader object.
 * @param shader - The shader object ID
 * @returns The shader info log string
 */
export function getShaderInfoLog(shader: number): string {
    const logLength = getShaderiv(shader, INFO_LOG_LENGTH);
    return logLength <= 0 ? "" : readInfoLog("glGetShaderInfoLog", shader, logLength);
}

/**
 * Deletes a shader object.
 * @param shader - The shader object ID to delete
 */
export function deleteShader(shader: number): void {
    glDeleteShader(shader);
}

/**
 * Creates a program object.
 * @returns The program object ID
 */
export function createProgram(): number {
    return glCreateProgram() as number;
}

/**
 * Attaches a shader object to a program object.
 * @param program - The program object ID
 * @param shader - The shader object ID to attach
 */
export function attachShader(program: number, shader: number): void {
    glAttachShader(program, shader);
}

export function detachShader(program: number, shader: number): void {
    glDetachShader(program, shader);
}

/**
 * Links a program object.
 * @param program - The program object ID to link
 */
export function linkProgram(program: number): void {
    glLinkProgram(program);
}

/**
 * Installs a program object as part of the current rendering state.
 * @param program - The program object ID to use (0 to uninstall)
 */
export function useProgram(program: number): void {
    glUseProgram(program);
}

/**
 * Gets a parameter from a program object.
 * @param program - The program object ID
 * @param pname - The parameter to query (e.g., GL_LINK_STATUS, GL_INFO_LOG_LENGTH)
 * @returns The parameter value
 */
export function getProgramiv(program: number, pname: number): number {
    const params = createRef(0);
    glGetProgramiv(program, pname, params);
    return params.value;
}

/**
 * Gets the information log for a program object.
 * @param program - The program object ID
 * @returns The program info log string
 */
export function getProgramInfoLog(program: number): string {
    const logLength = getProgramiv(program, INFO_LOG_LENGTH);
    return logLength <= 0 ? "" : readInfoLog("glGetProgramInfoLog", program, logLength);
}

/**
 * Deletes a program object.
 * @param program - The program object ID to delete
 */
export function deleteProgram(program: number): void {
    glDeleteProgram(program);
}

/**
 * Gets the location of a uniform variable in a program.
 * @param program - The program object ID
 * @param name - The name of the uniform variable
 * @returns The location of the uniform, or -1 if not found
 */
export function getUniformLocation(program: number, name: string): number {
    return glGetUniformLocation(program, name) as number;
}

/**
 * Sets a float uniform variable.
 * @param location - The uniform location
 * @param v0 - The float value
 */
export function uniform1f(location: number, v0: number): void {
    glUniform1f(location, v0);
}

/**
 * Sets a vec2 uniform variable.
 * @param location - The uniform location
 * @param v0 - The first component
 * @param v1 - The second component
 */
export function uniform2f(location: number, v0: number, v1: number): void {
    glUniform2f(location, v0, v1);
}

/**
 * Sets a vec3 uniform variable.
 * @param location - The uniform location
 * @param v0 - The first component
 * @param v1 - The second component
 * @param v2 - The third component
 */
export function uniform3f(location: number, v0: number, v1: number, v2: number): void {
    glUniform3f(location, v0, v1, v2);
}

/**
 * Sets a vec4 uniform variable.
 * @param location - The uniform location
 * @param v0 - The first component
 * @param v1 - The second component
 * @param v2 - The third component
 * @param v3 - The fourth component
 */
export function uniform4f(location: number, v0: number, v1: number, v2: number, v3: number): void {
    glUniform4f(location, v0, v1, v2, v3);
}

/**
 * Sets an integer uniform variable.
 * @param location - The uniform location
 * @param v0 - The integer value
 */
export function uniform1i(location: number, v0: number): void {
    glUniform1i(location, v0);
}

/**
 * Sets a 4x4 matrix uniform variable.
 * @param location - The uniform location
 * @param count - Number of matrices to set
 * @param transpose - Whether to transpose the matrix
 * @param value - Array of 16 floats representing the matrix in column-major order
 */
export function uniformMatrix4fv(location: number, count: number, transpose: boolean, value: number[]): void {
    glUniformMatrix4fv(location, count, transpose, value);
}

/**
 * Generates a vertex array object (VAO).
 * @returns The VAO ID
 */
export function genVertexArray(): number {
    const array = createRef(0);
    glGenVertexArrays(1, array);
    return array.value;
}

/**
 * Binds a vertex array object.
 * @param array - The VAO ID to bind (0 to unbind)
 */
export function bindVertexArray(array: number): void {
    glBindVertexArray(array);
}

/**
 * Deletes a vertex array object.
 * @param array - The VAO ID to delete
 */
export function deleteVertexArray(array: number): void {
    glDeleteVertexArrays(1, [array]);
}

/**
 * Generates a buffer object.
 * @returns The buffer object ID
 */
export function genBuffer(): number {
    const buffer = createRef(0);
    glGenBuffers(1, buffer);
    return buffer.value;
}

/**
 * Binds a buffer object to a target.
 * @param target - The buffer target (e.g., GL_ARRAY_BUFFER, GL_ELEMENT_ARRAY_BUFFER)
 * @param buffer - The buffer object ID to bind (0 to unbind)
 */
export function bindBuffer(target: number, buffer: number): void {
    glBindBuffer(target, buffer);
}

/**
 * Deletes a buffer object.
 * @param buffer - The buffer object ID to delete
 */
export function deleteBuffer(buffer: number): void {
    glDeleteBuffers(1, [buffer]);
}

/**
 * Creates and initializes a buffer object's data store with float data.
 * @param target - The buffer target
 * @param data - Array of float values to upload
 * @param usage - Usage pattern hint (e.g., GL_STATIC_DRAW, GL_DYNAMIC_DRAW)
 */
export function bufferData(target: number, data: number[], usage: number): void {
    glBufferDataF32(target, data.length * 4, data, usage);
}

/**
 * Defines an array of generic vertex attribute data.
 * @param index - The attribute index
 * @param size - Number of components per attribute (1, 2, 3, or 4)
 * @param type - Data type of each component (e.g., GL_FLOAT)
 * @param normalized - Whether to normalize fixed-point data
 * @param stride - Byte offset between consecutive attributes
 * @param offset - Byte offset to the first attribute in the buffer
 */
export function vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
): void {
    glVertexAttribPointer(index, size, type, normalized, stride, offset);
}

/**
 * Enables a generic vertex attribute array.
 * @param index - The attribute index to enable
 */
export function enableVertexAttribArray(index: number): void {
    glEnableVertexAttribArray(index);
}

/**
 * Disables a generic vertex attribute array.
 * @param index - The attribute index to disable
 */
export function disableVertexAttribArray(index: number): void {
    glDisableVertexAttribArray(index);
}

/**
 * Renders primitives from array data.
 * @param mode - The primitive type (e.g., GL_TRIANGLES, GL_TRIANGLE_STRIP)
 * @param first - Starting index in the enabled arrays
 * @param count - Number of indices to render
 */
export function drawArrays(mode: number, first: number, count: number): void {
    glDrawArrays(mode, first, count);
}

/**
 * Creates and initializes a buffer object's data store with unsigned short data.
 * @param target - The buffer target
 * @param data - Array of unsigned short values to upload
 * @param usage - Usage pattern hint (e.g., GL_STATIC_DRAW, GL_DYNAMIC_DRAW)
 */
export function bufferDataUshort(target: number, data: number[], usage: number): void {
    glBufferDataU16(target, data.length * 2, data, usage);
}

/**
 * Renders primitives from indexed array data.
 * @param mode - The primitive type (e.g., GL_TRIANGLES)
 * @param count - Number of elements to render
 * @param type - Type of indices (e.g., GL_UNSIGNED_SHORT, GL_UNSIGNED_INT)
 * @param offset - Byte offset into the element array buffer
 */
export function drawElements(mode: number, count: number, type: number, offset: number): void {
    glDrawElements(mode, count, type, offset);
}

/**
 * Gets the location of an attribute variable in a program.
 * @param program - The program object ID
 * @param name - The name of the attribute variable
 * @returns The location of the attribute, or -1 if not found
 */
export function getAttribLocation(program: number, name: string): number {
    return glGetAttribLocation(program, name) as number;
}

/**
 * Associates a generic vertex attribute index with a named attribute variable.
 * @param program - The program object ID
 * @param index - The attribute index to bind
 * @param name - The name of the attribute variable
 */
export function bindAttribLocation(program: number, index: number, name: string): void {
    glBindAttribLocation(program, index, name);
}

/**
 * Gets the current GL error code.
 * @returns The error code (GL_NO_ERROR if no error)
 */
export function getError(): number {
    return glGetError() as number;
}

export function flush(): void {
    glFlush();
}
