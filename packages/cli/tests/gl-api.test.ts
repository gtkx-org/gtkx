import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject } from "./cli-project.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

const REJECTED = [
    {
        name: "the packed debug-message log import",
        source: 'import { getDebugMessageLog } from "@gtkx/gl"; export const read = getDebugMessageLog;',
    },
    {
        name: "packed debug-message retrieval through the namespace",
        source: 'import * as gl from "@gtkx/gl"; export const read = gl.getDebugMessageLog;',
    },
    {
        name: "a driver callback registration import",
        source: 'import { debugMessageCallback } from "@gtkx/gl"; export const register = debugMessageCallback;',
    },
    {
        name: "driver callback registration through the namespace",
        source: 'import * as gl from "@gtkx/gl"; gl.debugMessageCallback(null);',
    },
    {
        name: "the driver callback type",
        source: 'import type { DebugMessageCallback } from "@gtkx/gl"; export type Callback = DebugMessageCallback;',
    },
    {
        name: "the driver callback message type",
        source: 'import type { DebugMessage } from "@gtkx/gl"; export type Message = DebugMessage;',
    },
];

describe("the public OpenGL package", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-gl-types-",
            hasStore: true,
            shouldShareStore: true,
        }));
        isolateTypeConsumer(project, ["gl"]);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts generated commands and info-log overrides", () => {
        expect(typecheckSource(project, `import * as gl from "@gtkx/gl";
export const draw = (): void => {
    gl.clearColor(0, 1, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
};
export const logs = (shader: gl.GLuint, program: gl.GLuint, pipeline: gl.GLuint): string[] => [
    gl.getShaderInfoLog(shader),
    gl.getProgramInfoLog(program),
    gl.getProgramPipelineInfoLog(pipeline),
];
export const timeout: bigint = gl.TIMEOUT_IGNORED;
`)).toBe(0);
    });

    it.each(REJECTED)("rejects $name", ({ source }) => {
        expect(typecheckSource(project, source)).not.toBe(0);
    });
});
