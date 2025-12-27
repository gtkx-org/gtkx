

import { call, createRef } from "@gtkx/native";
import { GL_INFO_LOG_LENGTH } from "./constants.js";

const LIB = "libGL.so.1";

export function glClear(mask: number): void {
    call(LIB, "glClear", [{ type: { type: "int", size: 32, unsigned: true }, value: mask }], { type: "undefined" });
}

export function glClearColor(red: number, green: number, blue: number, alpha: number): void {
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

export function glViewport(x: number, y: number, width: number, height: number): void {
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

export function glEnable(cap: number): void {
    call(LIB, "glEnable", [{ type: { type: "int", size: 32, unsigned: true }, value: cap }], { type: "undefined" });
}

export function glDisable(cap: number): void {
    call(LIB, "glDisable", [{ type: { type: "int", size: 32, unsigned: true }, value: cap }], { type: "undefined" });
}

export function glClearDepth(depth: number): void {
    call(LIB, "glClearDepth", [{ type: { type: "float", size: 64 }, value: depth }], { type: "undefined" });
}

export function glDepthFunc(func: number): void {
    call(LIB, "glDepthFunc", [{ type: { type: "int", size: 32, unsigned: true }, value: func }], { type: "undefined" });
}

export function glCreateShader(type: number): number {
    return call(LIB, "glCreateShader", [{ type: { type: "int", size: 32, unsigned: true }, value: type }], {
        type: "int",
        size: 32,
        unsigned: true,
    }) as number;
}

export function glShaderSource(shader: number, source: string): void {
    call(
        LIB,
        "glShaderSource",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: shader },
            { type: { type: "int", size: 32, unsigned: false }, value: 1 },
            { type: { type: "array", itemType: { type: "string" } }, value: [source] },
            { type: { type: "int", size: 64, unsigned: true }, value: 0 },
        ],
        { type: "undefined" },
    );
}

export function glCompileShader(shader: number): void {
    call(LIB, "glCompileShader", [{ type: { type: "int", size: 32, unsigned: true }, value: shader }], {
        type: "undefined",
    });
}

export function glGetShaderiv(shader: number, pname: number): number {
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

export function glGetShaderInfoLog(shader: number, _maxLength: number): string {
    const logLength = glGetShaderiv(shader, GL_INFO_LOG_LENGTH);
    if (logLength <= 0) {
        return "";
    }

    return `Shader info log length: ${logLength} (use console.error for details)`;
}

export function glDeleteShader(shader: number): void {
    call(LIB, "glDeleteShader", [{ type: { type: "int", size: 32, unsigned: true }, value: shader }], {
        type: "undefined",
    });
}

export function glCreateProgram(): number {
    return call(LIB, "glCreateProgram", [], { type: "int", size: 32, unsigned: true }) as number;
}

export function glAttachShader(program: number, shader: number): void {
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

export function glLinkProgram(program: number): void {
    call(LIB, "glLinkProgram", [{ type: { type: "int", size: 32, unsigned: true }, value: program }], {
        type: "undefined",
    });
}

export function glUseProgram(program: number): void {
    call(LIB, "glUseProgram", [{ type: { type: "int", size: 32, unsigned: true }, value: program }], {
        type: "undefined",
    });
}

export function glGetProgramiv(program: number, pname: number): number {
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

export function glGetProgramInfoLog(program: number, _maxLength: number): string {
    const logLength = glGetProgramiv(program, GL_INFO_LOG_LENGTH);
    if (logLength <= 0) {
        return "";
    }
    return `Program info log length: ${logLength} (use console.error for details)`;
}

export function glDeleteProgram(program: number): void {
    call(LIB, "glDeleteProgram", [{ type: { type: "int", size: 32, unsigned: true }, value: program }], {
        type: "undefined",
    });
}

export function glGetUniformLocation(program: number, name: string): number {
    return call(
        LIB,
        "glGetUniformLocation",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: program },
            { type: { type: "string" }, value: name },
        ],
        { type: "int", size: 32, unsigned: false },
    ) as number;
}

export function glUniform1f(location: number, v0: number): void {
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

export function glUniform2f(location: number, v0: number, v1: number): void {
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

export function glUniform3f(location: number, v0: number, v1: number, v2: number): void {
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

export function glUniform4f(location: number, v0: number, v1: number, v2: number, v3: number): void {
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

export function glUniform1i(location: number, v0: number): void {
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

export function glUniformMatrix4fv(location: number, count: number, transpose: boolean, value: number[]): void {
    call(
        LIB,
        "glUniformMatrix4fv",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: location },
            { type: { type: "int", size: 32, unsigned: false }, value: count },
            { type: { type: "boolean" }, value: transpose },
            { type: { type: "array", itemType: { type: "float", size: 32 } }, value },
        ],
        { type: "undefined" },
    );
}

export function glGenVertexArray(): number {
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

export function glBindVertexArray(array: number): void {
    call(LIB, "glBindVertexArray", [{ type: { type: "int", size: 32, unsigned: true }, value: array }], {
        type: "undefined",
    });
}

export function glDeleteVertexArray(array: number): void {
    call(
        LIB,
        "glDeleteVertexArrays",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: 1 },
            { type: { type: "array", itemType: { type: "int", size: 32, unsigned: true } }, value: [array] },
        ],
        { type: "undefined" },
    );
}

export function glGenBuffer(): number {
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

export function glBindBuffer(target: number, buffer: number): void {
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

export function glDeleteBuffer(buffer: number): void {
    call(
        LIB,
        "glDeleteBuffers",
        [
            { type: { type: "int", size: 32, unsigned: false }, value: 1 },
            { type: { type: "array", itemType: { type: "int", size: 32, unsigned: true } }, value: [buffer] },
        ],
        { type: "undefined" },
    );
}

export function glBufferData(target: number, data: number[], usage: number): void {
    const size = data.length * 4;

    call(
        LIB,
        "glBufferData",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: target },
            { type: { type: "int", size: 64, unsigned: false }, value: size },
            { type: { type: "array", itemType: { type: "float", size: 32 } }, value: data },
            { type: { type: "int", size: 32, unsigned: true }, value: usage },
        ],
        { type: "undefined" },
    );
}

export function glVertexAttribPointer(
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

export function glEnableVertexAttribArray(index: number): void {
    call(LIB, "glEnableVertexAttribArray", [{ type: { type: "int", size: 32, unsigned: true }, value: index }], {
        type: "undefined",
    });
}

export function glDisableVertexAttribArray(index: number): void {
    call(LIB, "glDisableVertexAttribArray", [{ type: { type: "int", size: 32, unsigned: true }, value: index }], {
        type: "undefined",
    });
}

export function glDrawArrays(mode: number, first: number, count: number): void {
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

export function glBufferDataUshort(target: number, data: number[], usage: number): void {
    const size = data.length * 2;

    call(
        LIB,
        "glBufferData",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: target },
            { type: { type: "int", size: 64, unsigned: false }, value: size },
            { type: { type: "array", itemType: { type: "int", size: 16, unsigned: true } }, value: data },
            { type: { type: "int", size: 32, unsigned: true }, value: usage },
        ],
        { type: "undefined" },
    );
}

export function glDrawElements(mode: number, count: number, type: number, offset: number): void {
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

export function glGetAttribLocation(program: number, name: string): number {
    return call(
        LIB,
        "glGetAttribLocation",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: program },
            { type: { type: "string" }, value: name },
        ],
        { type: "int", size: 32, unsigned: false },
    ) as number;
}

export function glBindAttribLocation(program: number, index: number, name: string): void {
    call(
        LIB,
        "glBindAttribLocation",
        [
            { type: { type: "int", size: 32, unsigned: true }, value: program },
            { type: { type: "int", size: 32, unsigned: true }, value: index },
            { type: { type: "string" }, value: name },
        ],
        { type: "undefined" },
    );
}

export function glGetError(): number {
    return call(LIB, "glGetError", [], { type: "int", size: 32, unsigned: true }) as number;
}
