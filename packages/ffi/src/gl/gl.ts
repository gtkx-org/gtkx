import { call, createRef } from "@gtkx/native";
import { INFO_LOG_LENGTH } from "./constants.js";

const LIB = "libGL.so.1";

/**
 * Clears buffers to preset values.
 * @param mask - Bitwise OR of masks indicating buffers to clear (GL_COLOR_BUFFER_BIT, GL_DEPTH_BUFFER_BIT, GL_STENCIL_BUFFER_BIT)
 */
export function clear(mask: number): void {
    call(LIB, "glClear", [{ type: { type: "int", size: 32, unsigned: true }, value: mask }], { type: "undefined" });
}

/**
 * Sets the clear color for the color buffer.
 * @param red - Red component (0.0 to 1.0)
 * @param green - Green component (0.0 to 1.0)
 * @param blue - Blue component (0.0 to 1.0)
 * @param alpha - Alpha component (0.0 to 1.0)
 */
export function clearColor(red: number, green: number, blue: number, alpha: number): void {
    call(
        LIB,
        "glClearColor",
        [
            { type: { type: "float", size: 32 }, value: red },
            { type: { type: "float", size: 32 }, value: green },
            { type: { type: "float", size: 32 }, value: blue },
            { type: { type: "float", size: 32 }, value: alpha },
        ],
        { type: "undefined" },
    );
}

/**
 * Sets the viewport transformation.
 * @param x - X coordinate of the lower-left corner of the viewport
 * @param y - Y coordinate of the lower-left corner of the viewport
 * @param width - Width of the viewport
 * @param height - Height of the viewport
 */
export function viewport(x: number, y: number, width: number, height: number): void {
    call(
        LIB,
        "glViewport",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: x },
            { type: { type: "int", size: 32, unsigned: false }, value: y },
            { type: { type: "int", size: 32, unsigned: false }, value: width },
            { type: { type: "int", size: 32, unsigned: false }, value: height },
        ],
        { type: "undefined" },
    );
}

/**
 * Enables a GL capability.
 * @param cap - The capability to enable (e.g., GL_DEPTH_TEST, GL_BLEND)
 */
export function enable(cap: number): void {
    call(LIB, "glEnable", [{ type: { type: "int", size: 32, unsigned: true }, value: cap }], { type: "undefined" });
}

/**
 * Disables a GL capability.
 * @param cap - The capability to disable
 */
export function disable(cap: number): void {
    call(LIB, "glDisable", [{ type: { type: "int", size: 32, unsigned: true }, value: cap }], { type: "undefined" });
}

/**
 * Sets the clear value for the depth buffer.
 * @param depth - Depth value used when clearing (0.0 to 1.0)
 */
export function clearDepth(depth: number): void {
    call(LIB, "glClearDepth", [{ type: { type: "float", size: 64 }, value: depth }], { type: "undefined" });
}

/**
 * Sets the depth comparison function.
 * @param func - The comparison function (e.g., GL_LESS, GL_LEQUAL)
 */
export function depthFunc(func: number): void {
    call(LIB, "glDepthFunc", [{ type: { type: "int", size: 32, unsigned: true }, value: func }], { type: "undefined" });
}

/**
 * Creates a shader object.
 * @param type - The type of shader (GL_VERTEX_SHADER or GL_FRAGMENT_SHADER)
 * @returns The shader object ID
 */
export function createShader(type: number): number {
    return call(LIB, "glCreateShader", [{ type: { type: "int", size: 32, unsigned: true }, value: type }], {
        type: "int",
        size: 32,
        unsigned: true,
    }) as number;
}

/**
 * Sets the source code for a shader object.
 * @param shader - The shader object ID
 * @param source - The GLSL source code string
 */
export function shaderSource(shader: number, source: string): void {
    call(
        LIB,
        "glShaderSource",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: shader },
            { type: { type: "int", size: 32, unsigned: false }, value: 1 },
            {
                type: {
                    type: "array",
                    itemType: { type: "string", ownership: "borrowed" },
                    arrayType: "array",
                    ownership: "borrowed",
                },
                value: [source],
            },
            { type: { type: "int", size: 64, unsigned: true }, value: 0 },
        ],
        { type: "undefined" },
    );
}

/**
 * Compiles a shader object.
 * @param shader - The shader object ID to compile
 */
export function compileShader(shader: number): void {
    call(LIB, "glCompileShader", [{ type: { type: "int", size: 32, unsigned: true }, value: shader }], {
        type: "undefined",
    });
}

/**
 * Gets a parameter from a shader object.
 * @param shader - The shader object ID
 * @param pname - The parameter to query (e.g., GL_COMPILE_STATUS, GL_INFO_LOG_LENGTH)
 * @returns The parameter value
 */
export function getShaderiv(shader: number, pname: number): number {
    const params = createRef(0);
    call(
        LIB,
        "glGetShaderiv",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: shader },
            { type: { type: "int", size: 32, unsigned: true }, value: pname },
            { type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } }, value: params },
        ],
        { type: "undefined" },
    );
    return params.value;
}

/**
 * Gets the information log for a shader object.
 * @param shader - The shader object ID
 * @returns The shader info log string
 */
export function getShaderInfoLog(shader: number): string {
    const logLength = getShaderiv(shader, INFO_LOG_LENGTH);
    if (logLength <= 0) {
        return "";
    }

    const infoLogRef = createRef("");
    const lengthRef = createRef(0);

    call(
        LIB,
        "glGetShaderInfoLog",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: shader },
            { type: { type: "int", size: 32, unsigned: false }, value: logLength },
            { type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } }, value: lengthRef },
            {
                type: { type: "ref", innerType: { type: "string", ownership: "borrowed", length: logLength } },
                value: infoLogRef,
            },
        ],
        { type: "undefined" },
    );

    return infoLogRef.value;
}

/**
 * Deletes a shader object.
 * @param shader - The shader object ID to delete
 */
export function deleteShader(shader: number): void {
    call(LIB, "glDeleteShader", [{ type: { type: "int", size: 32, unsigned: true }, value: shader }], {
        type: "undefined",
    });
}

/**
 * Creates a program object.
 * @returns The program object ID
 */
export function createProgram(): number {
    return call(LIB, "glCreateProgram", [], { type: "int", size: 32, unsigned: true }) as number;
}

/**
 * Attaches a shader object to a program object.
 * @param program - The program object ID
 * @param shader - The shader object ID to attach
 */
export function attachShader(program: number, shader: number): void {
    call(
        LIB,
        "glAttachShader",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: program },
            { type: { type: "int", size: 32, unsigned: true }, value: shader },
        ],
        { type: "undefined" },
    );
}

/**
 * Links a program object.
 * @param program - The program object ID to link
 */
export function linkProgram(program: number): void {
    call(LIB, "glLinkProgram", [{ type: { type: "int", size: 32, unsigned: true }, value: program }], {
        type: "undefined",
    });
}

/**
 * Installs a program object as part of the current rendering state.
 * @param program - The program object ID to use (0 to uninstall)
 */
export function useProgram(program: number): void {
    call(LIB, "glUseProgram", [{ type: { type: "int", size: 32, unsigned: true }, value: program }], {
        type: "undefined",
    });
}

/**
 * Gets a parameter from a program object.
 * @param program - The program object ID
 * @param pname - The parameter to query (e.g., GL_LINK_STATUS, GL_INFO_LOG_LENGTH)
 * @returns The parameter value
 */
export function getProgramiv(program: number, pname: number): number {
    const params = createRef(0);
    call(
        LIB,
        "glGetProgramiv",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: program },
            { type: { type: "int", size: 32, unsigned: true }, value: pname },
            { type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } }, value: params },
        ],
        { type: "undefined" },
    );
    return params.value;
}

/**
 * Gets the information log for a program object.
 * @param program - The program object ID
 * @returns The program info log string
 */
export function getProgramInfoLog(program: number): string {
    const logLength = getProgramiv(program, INFO_LOG_LENGTH);
    if (logLength <= 0) {
        return "";
    }

    const infoLogRef = createRef("");
    const lengthRef = createRef(0);

    call(
        LIB,
        "glGetProgramInfoLog",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: program },
            { type: { type: "int", size: 32, unsigned: false }, value: logLength },
            { type: { type: "ref", innerType: { type: "int", size: 32, unsigned: false } }, value: lengthRef },
            {
                type: { type: "ref", innerType: { type: "string", ownership: "borrowed", length: logLength } },
                value: infoLogRef,
            },
        ],
        { type: "undefined" },
    );

    return infoLogRef.value;
}

/**
 * Deletes a program object.
 * @param program - The program object ID to delete
 */
export function deleteProgram(program: number): void {
    call(LIB, "glDeleteProgram", [{ type: { type: "int", size: 32, unsigned: true }, value: program }], {
        type: "undefined",
    });
}

/**
 * Gets the location of a uniform variable in a program.
 * @param program - The program object ID
 * @param name - The name of the uniform variable
 * @returns The location of the uniform, or -1 if not found
 */
export function getUniformLocation(program: number, name: string): number {
    return call(
        LIB,
        "glGetUniformLocation",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: program },
            { type: { type: "string", ownership: "borrowed" }, value: name },
        ],
        { type: "int", size: 32, unsigned: false },
    ) as number;
}

/**
 * Sets a float uniform variable.
 * @param location - The uniform location
 * @param v0 - The float value
 */
export function uniform1f(location: number, v0: number): void {
    call(
        LIB,
        "glUniform1f",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: location },
            { type: { type: "float", size: 32 }, value: v0 },
        ],
        { type: "undefined" },
    );
}

/**
 * Sets a vec2 uniform variable.
 * @param location - The uniform location
 * @param v0 - The first component
 * @param v1 - The second component
 */
export function uniform2f(location: number, v0: number, v1: number): void {
    call(
        LIB,
        "glUniform2f",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: location },
            { type: { type: "float", size: 32 }, value: v0 },
            { type: { type: "float", size: 32 }, value: v1 },
        ],
        { type: "undefined" },
    );
}

/**
 * Sets a vec3 uniform variable.
 * @param location - The uniform location
 * @param v0 - The first component
 * @param v1 - The second component
 * @param v2 - The third component
 */
export function uniform3f(location: number, v0: number, v1: number, v2: number): void {
    call(
        LIB,
        "glUniform3f",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: location },
            { type: { type: "float", size: 32 }, value: v0 },
            { type: { type: "float", size: 32 }, value: v1 },
            { type: { type: "float", size: 32 }, value: v2 },
        ],
        { type: "undefined" },
    );
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
    call(
        LIB,
        "glUniform4f",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: location },
            { type: { type: "float", size: 32 }, value: v0 },
            { type: { type: "float", size: 32 }, value: v1 },
            { type: { type: "float", size: 32 }, value: v2 },
            { type: { type: "float", size: 32 }, value: v3 },
        ],
        { type: "undefined" },
    );
}

/**
 * Sets an integer uniform variable.
 * @param location - The uniform location
 * @param v0 - The integer value
 */
export function uniform1i(location: number, v0: number): void {
    call(
        LIB,
        "glUniform1i",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: location },
            { type: { type: "int", size: 32, unsigned: false }, value: v0 },
        ],
        { type: "undefined" },
    );
}

/**
 * Sets a 4x4 matrix uniform variable.
 * @param location - The uniform location
 * @param count - Number of matrices to set
 * @param transpose - Whether to transpose the matrix
 * @param value - Array of 16 floats representing the matrix in column-major order
 */
export function uniformMatrix4fv(location: number, count: number, transpose: boolean, value: number[]): void {
    call(
        LIB,
        "glUniformMatrix4fv",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: location },
            { type: { type: "int", size: 32, unsigned: false }, value: count },
            { type: { type: "boolean" }, value: transpose },
            {
                type: {
                    type: "array",
                    itemType: { type: "float", size: 32 },
                    arrayType: "array",
                    ownership: "borrowed",
                },
                value,
            },
        ],
        { type: "undefined" },
    );
}

/**
 * Generates a vertex array object (VAO).
 * @returns The VAO ID
 */
export function genVertexArray(): number {
    const array = createRef(0);
    call(
        LIB,
        "glGenVertexArrays",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: 1 },
            { type: { type: "ref", innerType: { type: "int", size: 32, unsigned: true } }, value: array },
        ],
        { type: "undefined" },
    );
    return array.value;
}

/**
 * Binds a vertex array object.
 * @param array - The VAO ID to bind (0 to unbind)
 */
export function bindVertexArray(array: number): void {
    call(LIB, "glBindVertexArray", [{ type: { type: "int", size: 32, unsigned: true }, value: array }], {
        type: "undefined",
    });
}

/**
 * Deletes a vertex array object.
 * @param array - The VAO ID to delete
 */
export function deleteVertexArray(array: number): void {
    call(
        LIB,
        "glDeleteVertexArrays",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: 1 },
            {
                type: {
                    type: "array",
                    itemType: { type: "int", size: 32, unsigned: true },
                    arrayType: "array",
                    ownership: "borrowed",
                },
                value: [array],
            },
        ],
        { type: "undefined" },
    );
}

/**
 * Generates a buffer object.
 * @returns The buffer object ID
 */
export function genBuffer(): number {
    const buffer = createRef(0);
    call(
        LIB,
        "glGenBuffers",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: 1 },
            { type: { type: "ref", innerType: { type: "int", size: 32, unsigned: true } }, value: buffer },
        ],
        { type: "undefined" },
    );
    return buffer.value;
}

/**
 * Binds a buffer object to a target.
 * @param target - The buffer target (e.g., GL_ARRAY_BUFFER, GL_ELEMENT_ARRAY_BUFFER)
 * @param buffer - The buffer object ID to bind (0 to unbind)
 */
export function bindBuffer(target: number, buffer: number): void {
    call(
        LIB,
        "glBindBuffer",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: target },
            { type: { type: "int", size: 32, unsigned: true }, value: buffer },
        ],
        { type: "undefined" },
    );
}

/**
 * Deletes a buffer object.
 * @param buffer - The buffer object ID to delete
 */
export function deleteBuffer(buffer: number): void {
    call(
        LIB,
        "glDeleteBuffers",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: 1 },
            {
                type: {
                    type: "array",
                    itemType: { type: "int", size: 32, unsigned: true },
                    arrayType: "array",
                    ownership: "borrowed",
                },
                value: [buffer],
            },
        ],
        { type: "undefined" },
    );
}

/**
 * Creates and initializes a buffer object's data store with float data.
 * @param target - The buffer target
 * @param data - Array of float values to upload
 * @param usage - Usage pattern hint (e.g., GL_STATIC_DRAW, GL_DYNAMIC_DRAW)
 */
export function bufferData(target: number, data: number[], usage: number): void {
    const size = data.length * 4;

    call(
        LIB,
        "glBufferData",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: target },
            { type: { type: "int", size: 64, unsigned: false }, value: size },
            {
                type: {
                    type: "array",
                    itemType: { type: "float", size: 32 },
                    arrayType: "array",
                    ownership: "borrowed",
                },
                value: data,
            },
            { type: { type: "int", size: 32, unsigned: true }, value: usage },
        ],
        { type: "undefined" },
    );
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
    call(
        LIB,
        "glVertexAttribPointer",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: index },
            { type: { type: "int", size: 32, unsigned: false }, value: size },
            { type: { type: "int", size: 32, unsigned: true }, value: type },
            { type: { type: "boolean" }, value: normalized },
            { type: { type: "int", size: 32, unsigned: false }, value: stride },
            { type: { type: "int", size: 64, unsigned: true }, value: offset },
        ],
        { type: "undefined" },
    );
}

/**
 * Enables a generic vertex attribute array.
 * @param index - The attribute index to enable
 */
export function enableVertexAttribArray(index: number): void {
    call(LIB, "glEnableVertexAttribArray", [{ type: { type: "int", size: 32, unsigned: true }, value: index }], {
        type: "undefined",
    });
}

/**
 * Disables a generic vertex attribute array.
 * @param index - The attribute index to disable
 */
export function disableVertexAttribArray(index: number): void {
    call(LIB, "glDisableVertexAttribArray", [{ type: { type: "int", size: 32, unsigned: true }, value: index }], {
        type: "undefined",
    });
}

/**
 * Renders primitives from array data.
 * @param mode - The primitive type (e.g., GL_TRIANGLES, GL_TRIANGLE_STRIP)
 * @param first - Starting index in the enabled arrays
 * @param count - Number of indices to render
 */
export function drawArrays(mode: number, first: number, count: number): void {
    call(
        LIB,
        "glDrawArrays",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: mode },
            { type: { type: "int", size: 32, unsigned: false }, value: first },
            { type: { type: "int", size: 32, unsigned: false }, value: count },
        ],
        { type: "undefined" },
    );
}

/**
 * Creates and initializes a buffer object's data store with unsigned short data.
 * @param target - The buffer target
 * @param data - Array of unsigned short values to upload
 * @param usage - Usage pattern hint (e.g., GL_STATIC_DRAW, GL_DYNAMIC_DRAW)
 */
export function bufferDataUshort(target: number, data: number[], usage: number): void {
    const size = data.length * 2;

    call(
        LIB,
        "glBufferData",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: target },
            { type: { type: "int", size: 64, unsigned: false }, value: size },
            {
                type: {
                    type: "array",
                    itemType: { type: "int", size: 16, unsigned: true },
                    arrayType: "array",
                    ownership: "borrowed",
                },
                value: data,
            },
            { type: { type: "int", size: 32, unsigned: true }, value: usage },
        ],
        { type: "undefined" },
    );
}

/**
 * Renders primitives from indexed array data.
 * @param mode - The primitive type (e.g., GL_TRIANGLES)
 * @param count - Number of elements to render
 * @param type - Type of indices (e.g., GL_UNSIGNED_SHORT, GL_UNSIGNED_INT)
 * @param offset - Byte offset into the element array buffer
 */
export function drawElements(mode: number, count: number, type: number, offset: number): void {
    call(
        LIB,
        "glDrawElements",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: mode },
            { type: { type: "int", size: 32, unsigned: false }, value: count },
            { type: { type: "int", size: 32, unsigned: true }, value: type },
            { type: { type: "int", size: 64, unsigned: true }, value: offset },
        ],
        { type: "undefined" },
    );
}

/**
 * Gets the location of an attribute variable in a program.
 * @param program - The program object ID
 * @param name - The name of the attribute variable
 * @returns The location of the attribute, or -1 if not found
 */
export function getAttribLocation(program: number, name: string): number {
    return call(
        LIB,
        "glGetAttribLocation",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: program },
            { type: { type: "string", ownership: "borrowed" }, value: name },
        ],
        { type: "int", size: 32, unsigned: false },
    ) as number;
}

/**
 * Associates a generic vertex attribute index with a named attribute variable.
 * @param program - The program object ID
 * @param index - The attribute index to bind
 * @param name - The name of the attribute variable
 */
export function bindAttribLocation(program: number, index: number, name: string): void {
    call(
        LIB,
        "glBindAttribLocation",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: program },
            { type: { type: "int", size: 32, unsigned: true }, value: index },
            { type: { type: "string", ownership: "borrowed" }, value: name },
        ],
        { type: "undefined" },
    );
}

/**
 * Gets the current GL error code.
 * @returns The error code (GL_NO_ERROR if no error)
 */
export function getError(): number {
    return call(LIB, "glGetError", [], { type: "int", size: 32, unsigned: true }) as number;
}
