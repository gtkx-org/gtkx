/**
 * GENERATED FILE — do not edit.
 *
 * Emitted by the `@gtkx/codegen` Khronos generator from the vendored
 * `registry/gl.xml` (gl 4.6 core profile). Regenerate with
 * `pnpm --filter @gtkx/codegen codegen:gl`.
 */

import { t } from "@gtkx/ffi";
import type {
    AttributeType,
    BindTransformFeedbackTarget,
    BlendEquationModeEXT,
    BlendingFactor,
    BlitFramebufferFilter,
    Buffer,
    BufferAccessARB,
    BufferPNameARB,
    BufferStorageMask,
    BufferStorageTarget,
    BufferTargetARB,
    BufferUsageARB,
    ClampColorModeARB,
    ClampColorTargetARB,
    ClearBufferMask,
    ClipControlDepth,
    ClipControlOrigin,
    ColorBuffer,
    ConditionalRenderMode,
    CopyBufferSubDataTarget,
    CopyImageSubDataTarget,
    DebugSeverity,
    DebugSource,
    DebugType,
    DepthFunction,
    DrawBufferMode,
    DrawElementsType,
    EnableCap,
    ErrorCode,
    FramebufferAttachment,
    FramebufferAttachmentParameterName,
    FramebufferParameterName,
    FramebufferStatus,
    FramebufferTarget,
    FrontFaceDirection,
    GetFramebufferParameter,
    GetTextureParameter,
    GLbitfield,
    GLbyte,
    GLdouble,
    GLenum,
    GLfloat,
    GLint,
    GLint64,
    GLintptr,
    GLpointer,
    GLshort,
    GLsizei,
    GLsizeiptr,
    GLsync,
    GLubyte,
    GLuint,
    GLuint64,
    GLushort,
    GraphicsResetStatus,
    HintMode,
    HintTarget,
    InternalFormat,
    InternalFormatPName,
    InvalidateFramebufferAttachment,
    LogicOp,
    MapBufferAccessMask,
    MemoryBarrierMask,
    ObjectIdentifier,
    PatchParameterName,
    PipelineParameterName,
    PixelFormat,
    PixelStoreParameter,
    PixelType,
    PointParameterNameARB,
    PolygonMode,
    PrecisionType,
    PrimitiveType,
    ProgramInterface,
    ProgramParameterPName,
    ProgramPropertyARB,
    ProgramResourceProperty,
    ProgramStagePName,
    QueryCounterTarget,
    QueryObjectParameterName,
    QueryParameterName,
    QueryTarget,
    ReadBufferMode,
    RenderbufferParameterName,
    RenderbufferTarget,
    SamplerParameterF,
    SamplerParameterI,
    ShaderBinaryFormat,
    ShaderParameterName,
    ShaderType,
    SizedInternalFormat,
    StencilFunction,
    StencilOp,
    StringName,
    SyncBehaviorFlags,
    SyncCondition,
    SyncObjectMask,
    SyncParameterName,
    SyncStatus,
    TextureParameterName,
    TextureTarget,
    TextureUnit,
    TransformFeedbackBufferMode,
    TransformFeedbackPName,
    TriangleFace,
    UniformType,
    UseProgramStageMask,
    VertexArrayPName,
    VertexAttribEnum,
    VertexAttribIType,
    VertexAttribLType,
    VertexAttribPointerType,
    VertexAttribPropertyARB,
    VertexAttribType,
    VertexProvokingMode,
} from "./types.js";

const LIB = "libGL.so.1";

const glActiveShaderProgram = t.fn(LIB, "glActiveShaderProgram", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glActiveTexture = t.fn(LIB, "glActiveTexture", [{ type: t.uint32 }], t.void);

const glAttachShader = t.fn(LIB, "glAttachShader", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBeginConditionalRender = t.fn(
    LIB,
    "glBeginConditionalRender",
    [{ type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glBeginQuery = t.fn(LIB, "glBeginQuery", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBeginQueryIndexed = t.fn(
    LIB,
    "glBeginQueryIndexed",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glBeginTransformFeedback = t.fn(LIB, "glBeginTransformFeedback", [{ type: t.uint32 }], t.void);

const glBindAttribLocation = t.fn(
    LIB,
    "glBindAttribLocation",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.string("borrowed") }],
    t.void,
);

const glBindBuffer = t.fn(LIB, "glBindBuffer", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBindBufferBase = t.fn(
    LIB,
    "glBindBufferBase",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glBindBufferRange = t.fn(
    LIB,
    "glBindBufferRange",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }, { type: t.int64 }],
    t.void,
);

const glBindBuffersBase = t.fn(
    LIB,
    "glBindBuffersBase",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glBindBuffersRange = t.fn(
    LIB,
    "glBindBuffersRange",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.array(t.uint32) },
        { type: t.array(t.int64) },
        { type: t.array(t.int64) },
    ],
    t.void,
);

const glBindFragDataLocation = t.fn(
    LIB,
    "glBindFragDataLocation",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.string("borrowed") }],
    t.void,
);

const glBindFragDataLocationIndexed = t.fn(
    LIB,
    "glBindFragDataLocationIndexed",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.string("borrowed") }],
    t.void,
);

const glBindFramebuffer = t.fn(LIB, "glBindFramebuffer", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBindImageTexture = t.fn(
    LIB,
    "glBindImageTexture",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.boolean },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
    ],
    t.void,
);

const glBindImageTextures = t.fn(
    LIB,
    "glBindImageTextures",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glBindProgramPipeline = t.fn(LIB, "glBindProgramPipeline", [{ type: t.uint32 }], t.void);

const glBindRenderbuffer = t.fn(LIB, "glBindRenderbuffer", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBindSampler = t.fn(LIB, "glBindSampler", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBindSamplers = t.fn(
    LIB,
    "glBindSamplers",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glBindTexture = t.fn(LIB, "glBindTexture", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBindTextures = t.fn(
    LIB,
    "glBindTextures",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glBindTextureUnit = t.fn(LIB, "glBindTextureUnit", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBindTransformFeedback = t.fn(LIB, "glBindTransformFeedback", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBindVertexArray = t.fn(LIB, "glBindVertexArray", [{ type: t.uint32 }], t.void);

const glBindVertexBuffer = t.fn(
    LIB,
    "glBindVertexBuffer",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }, { type: t.int32 }],
    t.void,
);

const glBindVertexBuffers = t.fn(
    LIB,
    "glBindVertexBuffers",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.array(t.uint32) },
        { type: t.array(t.int64) },
        { type: t.array(t.int32) },
    ],
    t.void,
);

const glBlendColor = t.fn(
    LIB,
    "glBlendColor",
    [{ type: t.float32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glBlendEquation = t.fn(LIB, "glBlendEquation", [{ type: t.uint32 }], t.void);

const glBlendEquationi = t.fn(LIB, "glBlendEquationi", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBlendEquationSeparate = t.fn(LIB, "glBlendEquationSeparate", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBlendEquationSeparatei = t.fn(
    LIB,
    "glBlendEquationSeparatei",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glBlendFunc = t.fn(LIB, "glBlendFunc", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glBlendFunci = t.fn(LIB, "glBlendFunci", [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }], t.void);

const glBlendFuncSeparate = t.fn(
    LIB,
    "glBlendFuncSeparate",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glBlendFuncSeparatei = t.fn(
    LIB,
    "glBlendFuncSeparatei",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glBlitFramebuffer = t.fn(
    LIB,
    "glBlitFramebuffer",
    [
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
    ],
    t.void,
);

const glBlitNamedFramebuffer = t.fn(
    LIB,
    "glBlitNamedFramebuffer",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
    ],
    t.void,
);

const glBufferData = t.fn(
    LIB,
    "glBufferData",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.blob }, { type: t.uint32 }],
    t.void,
);

const glBufferStorage = t.fn(
    LIB,
    "glBufferStorage",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.blob }, { type: t.uint32 }],
    t.void,
);

const glBufferSubData = t.fn(
    LIB,
    "glBufferSubData",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.int64 }, { type: t.blob }],
    t.void,
);

const glCheckFramebufferStatus = t.fn(LIB, "glCheckFramebufferStatus", [{ type: t.uint32 }], t.uint32);

const glCheckNamedFramebufferStatus = t.fn(
    LIB,
    "glCheckNamedFramebufferStatus",
    [{ type: t.uint32 }, { type: t.uint32 }],
    t.uint32,
);

const glClampColor = t.fn(LIB, "glClampColor", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glClear = t.fn(LIB, "glClear", [{ type: t.uint32 }], t.void);

const glClearBufferData = t.fn(
    LIB,
    "glClearBufferData",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.blob }],
    t.void,
);

const glClearBufferfi = t.fn(
    LIB,
    "glClearBufferfi",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.float32 }, { type: t.int32 }],
    t.void,
);

const glClearBufferfv = t.fn(
    LIB,
    "glClearBufferfv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glClearBufferiv = t.fn(
    LIB,
    "glClearBufferiv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glClearBufferSubData = t.fn(
    LIB,
    "glClearBufferSubData",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int64 },
        { type: t.int64 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glClearBufferuiv = t.fn(
    LIB,
    "glClearBufferuiv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glClearColor = t.fn(
    LIB,
    "glClearColor",
    [{ type: t.float32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glClearDepth = t.fn(LIB, "glClearDepth", [{ type: t.float64 }], t.void);

const glClearDepthf = t.fn(LIB, "glClearDepthf", [{ type: t.float32 }], t.void);

const glClearNamedBufferData = t.fn(
    LIB,
    "glClearNamedBufferData",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.blob }],
    t.void,
);

const glClearNamedBufferSubData = t.fn(
    LIB,
    "glClearNamedBufferSubData",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int64 },
        { type: t.int64 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glClearNamedFramebufferfi = t.fn(
    LIB,
    "glClearNamedFramebufferfi",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.float32 }, { type: t.int32 }],
    t.void,
);

const glClearNamedFramebufferfv = t.fn(
    LIB,
    "glClearNamedFramebufferfv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glClearNamedFramebufferiv = t.fn(
    LIB,
    "glClearNamedFramebufferiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glClearNamedFramebufferuiv = t.fn(
    LIB,
    "glClearNamedFramebufferuiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glClearStencil = t.fn(LIB, "glClearStencil", [{ type: t.int32 }], t.void);

const glClearTexImage = t.fn(
    LIB,
    "glClearTexImage",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.blob }],
    t.void,
);

const glClearTexSubImage = t.fn(
    LIB,
    "glClearTexSubImage",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glClientWaitSync = t.fn(
    LIB,
    "glClientWaitSync",
    [{ type: t.struct("borrowed") }, { type: t.uint32 }, { type: t.uint64 }],
    t.uint32,
);

const glClipControl = t.fn(LIB, "glClipControl", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glColorMask = t.fn(
    LIB,
    "glColorMask",
    [{ type: t.boolean }, { type: t.boolean }, { type: t.boolean }, { type: t.boolean }],
    t.void,
);

const glColorMaski = t.fn(
    LIB,
    "glColorMaski",
    [{ type: t.uint32 }, { type: t.boolean }, { type: t.boolean }, { type: t.boolean }, { type: t.boolean }],
    t.void,
);

const glCompileShader = t.fn(LIB, "glCompileShader", [{ type: t.uint32 }], t.void);

const glCompressedTexImage1D = t.fn(
    LIB,
    "glCompressedTexImage1D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glCompressedTexImage2D = t.fn(
    LIB,
    "glCompressedTexImage2D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glCompressedTexImage3D = t.fn(
    LIB,
    "glCompressedTexImage3D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glCompressedTexSubImage1D = t.fn(
    LIB,
    "glCompressedTexSubImage1D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glCompressedTexSubImage2D = t.fn(
    LIB,
    "glCompressedTexSubImage2D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glCompressedTexSubImage3D = t.fn(
    LIB,
    "glCompressedTexSubImage3D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glCompressedTextureSubImage1D = t.fn(
    LIB,
    "glCompressedTextureSubImage1D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glCompressedTextureSubImage2D = t.fn(
    LIB,
    "glCompressedTextureSubImage2D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glCompressedTextureSubImage3D = t.fn(
    LIB,
    "glCompressedTextureSubImage3D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glCopyBufferSubData = t.fn(
    LIB,
    "glCopyBufferSubData",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }, { type: t.int64 }, { type: t.int64 }],
    t.void,
);

const glCopyImageSubData = t.fn(
    LIB,
    "glCopyImageSubData",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glCopyNamedBufferSubData = t.fn(
    LIB,
    "glCopyNamedBufferSubData",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }, { type: t.int64 }, { type: t.int64 }],
    t.void,
);

const glCopyTexImage1D = t.fn(
    LIB,
    "glCopyTexImage1D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glCopyTexImage2D = t.fn(
    LIB,
    "glCopyTexImage2D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glCopyTexSubImage1D = t.fn(
    LIB,
    "glCopyTexSubImage1D",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glCopyTexSubImage2D = t.fn(
    LIB,
    "glCopyTexSubImage2D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glCopyTexSubImage3D = t.fn(
    LIB,
    "glCopyTexSubImage3D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glCopyTextureSubImage1D = t.fn(
    LIB,
    "glCopyTextureSubImage1D",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glCopyTextureSubImage2D = t.fn(
    LIB,
    "glCopyTextureSubImage2D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glCopyTextureSubImage3D = t.fn(
    LIB,
    "glCopyTextureSubImage3D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glCreateBuffers = t.fn(
    LIB,
    "glCreateBuffers",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glCreateFramebuffers = t.fn(
    LIB,
    "glCreateFramebuffers",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glCreateProgram = t.fn(LIB, "glCreateProgram", [], t.uint32);

const glCreateProgramPipelines = t.fn(
    LIB,
    "glCreateProgramPipelines",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glCreateQueries = t.fn(
    LIB,
    "glCreateQueries",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 1)) }],
    t.void,
);

const glCreateRenderbuffers = t.fn(
    LIB,
    "glCreateRenderbuffers",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glCreateSamplers = t.fn(
    LIB,
    "glCreateSamplers",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glCreateShader = t.fn(LIB, "glCreateShader", [{ type: t.uint32 }], t.uint32);

const glCreateShaderProgramv = t.fn(
    LIB,
    "glCreateShaderProgramv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.string("borrowed")) }],
    t.uint32,
);

const glCreateTextures = t.fn(
    LIB,
    "glCreateTextures",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 1)) }],
    t.void,
);

const glCreateTransformFeedbacks = t.fn(
    LIB,
    "glCreateTransformFeedbacks",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glCreateVertexArrays = t.fn(
    LIB,
    "glCreateVertexArrays",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glCullFace = t.fn(LIB, "glCullFace", [{ type: t.uint32 }], t.void);

const glDebugMessageControl = t.fn(
    LIB,
    "glDebugMessageControl",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.array(t.uint32) },
        { type: t.boolean },
    ],
    t.void,
);

const glDebugMessageInsert = t.fn(
    LIB,
    "glDebugMessageInsert",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.string("borrowed") },
    ],
    t.void,
);

const glDeleteBuffers = t.fn(LIB, "glDeleteBuffers", [{ type: t.int32 }, { type: t.array(t.uint32) }], t.void);

const glDeleteFramebuffers = t.fn(
    LIB,
    "glDeleteFramebuffers",
    [{ type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glDeleteProgram = t.fn(LIB, "glDeleteProgram", [{ type: t.uint32 }], t.void);

const glDeleteProgramPipelines = t.fn(
    LIB,
    "glDeleteProgramPipelines",
    [{ type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glDeleteQueries = t.fn(LIB, "glDeleteQueries", [{ type: t.int32 }, { type: t.array(t.uint32) }], t.void);

const glDeleteRenderbuffers = t.fn(
    LIB,
    "glDeleteRenderbuffers",
    [{ type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glDeleteSamplers = t.fn(LIB, "glDeleteSamplers", [{ type: t.int32 }, { type: t.array(t.uint32) }], t.void);

const glDeleteShader = t.fn(LIB, "glDeleteShader", [{ type: t.uint32 }], t.void);

const glDeleteSync = t.fn(LIB, "glDeleteSync", [{ type: t.struct("borrowed") }], t.void);

const glDeleteTextures = t.fn(LIB, "glDeleteTextures", [{ type: t.int32 }, { type: t.array(t.uint32) }], t.void);

const glDeleteTransformFeedbacks = t.fn(
    LIB,
    "glDeleteTransformFeedbacks",
    [{ type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glDeleteVertexArrays = t.fn(
    LIB,
    "glDeleteVertexArrays",
    [{ type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glDepthFunc = t.fn(LIB, "glDepthFunc", [{ type: t.uint32 }], t.void);

const glDepthMask = t.fn(LIB, "glDepthMask", [{ type: t.boolean }], t.void);

const glDepthRange = t.fn(LIB, "glDepthRange", [{ type: t.float64 }, { type: t.float64 }], t.void);

const glDepthRangeArrayv = t.fn(
    LIB,
    "glDepthRangeArrayv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.float64) }],
    t.void,
);

const glDepthRangef = t.fn(LIB, "glDepthRangef", [{ type: t.float32 }, { type: t.float32 }], t.void);

const glDepthRangeIndexed = t.fn(
    LIB,
    "glDepthRangeIndexed",
    [{ type: t.uint32 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glDetachShader = t.fn(LIB, "glDetachShader", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glDisable = t.fn(LIB, "glDisable", [{ type: t.uint32 }], t.void);

const glDisablei = t.fn(LIB, "glDisablei", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glDisableVertexArrayAttrib = t.fn(
    LIB,
    "glDisableVertexArrayAttrib",
    [{ type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glDisableVertexAttribArray = t.fn(LIB, "glDisableVertexAttribArray", [{ type: t.uint32 }], t.void);

const glDispatchCompute = t.fn(
    LIB,
    "glDispatchCompute",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glDispatchComputeIndirect = t.fn(LIB, "glDispatchComputeIndirect", [{ type: t.int64 }], t.void);

const glDrawArrays = t.fn(LIB, "glDrawArrays", [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }], t.void);

const glDrawArraysIndirect = t.fn(LIB, "glDrawArraysIndirect", [{ type: t.uint32 }, { type: t.uint64 }], t.void);

const glDrawArraysInstanced = t.fn(
    LIB,
    "glDrawArraysInstanced",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glDrawArraysInstancedBaseInstance = t.fn(
    LIB,
    "glDrawArraysInstancedBaseInstance",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.uint32 }],
    t.void,
);

const glDrawBuffer = t.fn(LIB, "glDrawBuffer", [{ type: t.uint32 }], t.void);

const glDrawBuffers = t.fn(LIB, "glDrawBuffers", [{ type: t.int32 }, { type: t.array(t.uint32) }], t.void);

const glDrawElements = t.fn(
    LIB,
    "glDrawElements",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint64 }],
    t.void,
);

const glDrawElementsBaseVertex = t.fn(
    LIB,
    "glDrawElementsBaseVertex",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint64 }, { type: t.int32 }],
    t.void,
);

const glDrawElementsIndirect = t.fn(
    LIB,
    "glDrawElementsIndirect",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint64 }],
    t.void,
);

const glDrawElementsInstanced = t.fn(
    LIB,
    "glDrawElementsInstanced",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint64 }, { type: t.int32 }],
    t.void,
);

const glDrawElementsInstancedBaseInstance = t.fn(
    LIB,
    "glDrawElementsInstancedBaseInstance",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint64 },
        { type: t.int32 },
        { type: t.uint32 },
    ],
    t.void,
);

const glDrawElementsInstancedBaseVertex = t.fn(
    LIB,
    "glDrawElementsInstancedBaseVertex",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint64 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glDrawElementsInstancedBaseVertexBaseInstance = t.fn(
    LIB,
    "glDrawElementsInstancedBaseVertexBaseInstance",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint64 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
    ],
    t.void,
);

const glDrawRangeElements = t.fn(
    LIB,
    "glDrawRangeElements",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint64 },
    ],
    t.void,
);

const glDrawRangeElementsBaseVertex = t.fn(
    LIB,
    "glDrawRangeElementsBaseVertex",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint64 },
        { type: t.int32 },
    ],
    t.void,
);

const glDrawTransformFeedback = t.fn(LIB, "glDrawTransformFeedback", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glDrawTransformFeedbackInstanced = t.fn(
    LIB,
    "glDrawTransformFeedbackInstanced",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glDrawTransformFeedbackStream = t.fn(
    LIB,
    "glDrawTransformFeedbackStream",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glDrawTransformFeedbackStreamInstanced = t.fn(
    LIB,
    "glDrawTransformFeedbackStreamInstanced",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glEnable = t.fn(LIB, "glEnable", [{ type: t.uint32 }], t.void);

const glEnablei = t.fn(LIB, "glEnablei", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glEnableVertexArrayAttrib = t.fn(
    LIB,
    "glEnableVertexArrayAttrib",
    [{ type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glEnableVertexAttribArray = t.fn(LIB, "glEnableVertexAttribArray", [{ type: t.uint32 }], t.void);

const glEndConditionalRender = t.fn(LIB, "glEndConditionalRender", [], t.void);

const glEndQuery = t.fn(LIB, "glEndQuery", [{ type: t.uint32 }], t.void);

const glEndQueryIndexed = t.fn(LIB, "glEndQueryIndexed", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glEndTransformFeedback = t.fn(LIB, "glEndTransformFeedback", [], t.void);

const glFenceSync = t.fn(LIB, "glFenceSync", [{ type: t.uint32 }, { type: t.uint32 }], t.struct("borrowed"));

const glFinish = t.fn(LIB, "glFinish", [], t.void);

const glFlush = t.fn(LIB, "glFlush", [], t.void);

const glFlushMappedBufferRange = t.fn(
    LIB,
    "glFlushMappedBufferRange",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.int64 }],
    t.void,
);

const glFlushMappedNamedBufferRange = t.fn(
    LIB,
    "glFlushMappedNamedBufferRange",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.int64 }],
    t.void,
);

const glFramebufferParameteri = t.fn(
    LIB,
    "glFramebufferParameteri",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glFramebufferRenderbuffer = t.fn(
    LIB,
    "glFramebufferRenderbuffer",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glFramebufferTexture = t.fn(
    LIB,
    "glFramebufferTexture",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glFramebufferTexture1D = t.fn(
    LIB,
    "glFramebufferTexture1D",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glFramebufferTexture2D = t.fn(
    LIB,
    "glFramebufferTexture2D",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glFramebufferTexture3D = t.fn(
    LIB,
    "glFramebufferTexture3D",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glFramebufferTextureLayer = t.fn(
    LIB,
    "glFramebufferTextureLayer",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glFrontFace = t.fn(LIB, "glFrontFace", [{ type: t.uint32 }], t.void);

const glGenBuffers = t.fn(LIB, "glGenBuffers", [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }], t.void);

const glGenerateMipmap = t.fn(LIB, "glGenerateMipmap", [{ type: t.uint32 }], t.void);

const glGenerateTextureMipmap = t.fn(LIB, "glGenerateTextureMipmap", [{ type: t.uint32 }], t.void);

const glGenFramebuffers = t.fn(
    LIB,
    "glGenFramebuffers",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glGenProgramPipelines = t.fn(
    LIB,
    "glGenProgramPipelines",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glGenQueries = t.fn(LIB, "glGenQueries", [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }], t.void);

const glGenRenderbuffers = t.fn(
    LIB,
    "glGenRenderbuffers",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glGenSamplers = t.fn(
    LIB,
    "glGenSamplers",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glGenTextures = t.fn(
    LIB,
    "glGenTextures",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glGenTransformFeedbacks = t.fn(
    LIB,
    "glGenTransformFeedbacks",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glGenVertexArrays = t.fn(
    LIB,
    "glGenVertexArrays",
    [{ type: t.int32 }, { type: t.ref(t.sizedArray(t.uint32, 0)) }],
    t.void,
);

const glGetAttachedShaders = t.fn(
    LIB,
    "glGetAttachedShaders",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.ref(t.int32) }, { type: t.ref(t.sizedArray(t.uint32, 1)) }],
    t.void,
);

const glGetAttribLocation = t.fn(
    LIB,
    "glGetAttribLocation",
    [{ type: t.uint32 }, { type: t.string("borrowed") }],
    t.int32,
);

const glGetBufferParameteri64v = t.fn(
    LIB,
    "glGetBufferParameteri64v",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int64) }],
    t.void,
);

const glGetBufferParameteriv = t.fn(
    LIB,
    "glGetBufferParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetBufferSubData = t.fn(
    LIB,
    "glGetBufferSubData",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.int64 }, { type: t.blob }],
    t.void,
);

const glGetCompressedTexImage = t.fn(
    LIB,
    "glGetCompressedTexImage",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.blob }],
    t.void,
);

const glGetCompressedTextureImage = t.fn(
    LIB,
    "glGetCompressedTextureImage",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.blob }],
    t.void,
);

const glGetCompressedTextureSubImage = t.fn(
    LIB,
    "glGetCompressedTextureSubImage",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glGetError = t.fn(LIB, "glGetError", [], t.uint32);

const glGetFragDataIndex = t.fn(
    LIB,
    "glGetFragDataIndex",
    [{ type: t.uint32 }, { type: t.string("borrowed") }],
    t.int32,
);

const glGetFragDataLocation = t.fn(
    LIB,
    "glGetFragDataLocation",
    [{ type: t.uint32 }, { type: t.string("borrowed") }],
    t.int32,
);

const glGetFramebufferAttachmentParameteriv = t.fn(
    LIB,
    "glGetFramebufferAttachmentParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetFramebufferParameteriv = t.fn(
    LIB,
    "glGetFramebufferParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetGraphicsResetStatus = t.fn(LIB, "glGetGraphicsResetStatus", [], t.uint32);

const glGetInternalformati64v = t.fn(
    LIB,
    "glGetInternalformati64v",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.ref(t.sizedArray(t.int64, 3)) },
    ],
    t.void,
);

const glGetInternalformativ = t.fn(
    LIB,
    "glGetInternalformativ",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.ref(t.sizedArray(t.int32, 3)) },
    ],
    t.void,
);

const glGetNamedBufferParameteri64v = t.fn(
    LIB,
    "glGetNamedBufferParameteri64v",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int64) }],
    t.void,
);

const glGetNamedBufferParameteriv = t.fn(
    LIB,
    "glGetNamedBufferParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetNamedBufferSubData = t.fn(
    LIB,
    "glGetNamedBufferSubData",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.int64 }, { type: t.blob }],
    t.void,
);

const glGetNamedFramebufferAttachmentParameteriv = t.fn(
    LIB,
    "glGetNamedFramebufferAttachmentParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetNamedFramebufferParameteriv = t.fn(
    LIB,
    "glGetNamedFramebufferParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetNamedRenderbufferParameteriv = t.fn(
    LIB,
    "glGetNamedRenderbufferParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetnCompressedTexImage = t.fn(
    LIB,
    "glGetnCompressedTexImage",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.blob }],
    t.void,
);

const glGetnTexImage = t.fn(
    LIB,
    "glGetnTexImage",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glGetProgramBinary = t.fn(
    LIB,
    "glGetProgramBinary",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.ref(t.int32) }, { type: t.ref(t.uint32) }, { type: t.blob }],
    t.void,
);

const glGetProgramiv = t.fn(
    LIB,
    "glGetProgramiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetProgramPipelineiv = t.fn(
    LIB,
    "glGetProgramPipelineiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetProgramResourceIndex = t.fn(
    LIB,
    "glGetProgramResourceIndex",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.string("borrowed") }],
    t.uint32,
);

const glGetProgramResourceiv = t.fn(
    LIB,
    "glGetProgramResourceiv",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.array(t.uint32) },
        { type: t.int32 },
        { type: t.ref(t.int32) },
        { type: t.ref(t.sizedArray(t.int32, 5)) },
    ],
    t.void,
);

const glGetProgramResourceLocation = t.fn(
    LIB,
    "glGetProgramResourceLocation",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.string("borrowed") }],
    t.int32,
);

const glGetProgramResourceLocationIndex = t.fn(
    LIB,
    "glGetProgramResourceLocationIndex",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.string("borrowed") }],
    t.int32,
);

const glGetProgramStageiv = t.fn(
    LIB,
    "glGetProgramStageiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetQueryBufferObjecti64v = t.fn(
    LIB,
    "glGetQueryBufferObjecti64v",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }],
    t.void,
);

const glGetQueryBufferObjectiv = t.fn(
    LIB,
    "glGetQueryBufferObjectiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }],
    t.void,
);

const glGetQueryBufferObjectui64v = t.fn(
    LIB,
    "glGetQueryBufferObjectui64v",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }],
    t.void,
);

const glGetQueryBufferObjectuiv = t.fn(
    LIB,
    "glGetQueryBufferObjectuiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }],
    t.void,
);

const glGetQueryiv = t.fn(
    LIB,
    "glGetQueryiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetQueryObjecti64v = t.fn(
    LIB,
    "glGetQueryObjecti64v",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int64) }],
    t.void,
);

const glGetQueryObjectiv = t.fn(
    LIB,
    "glGetQueryObjectiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetQueryObjectui64v = t.fn(
    LIB,
    "glGetQueryObjectui64v",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.uint64) }],
    t.void,
);

const glGetQueryObjectuiv = t.fn(
    LIB,
    "glGetQueryObjectuiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glGetRenderbufferParameteriv = t.fn(
    LIB,
    "glGetRenderbufferParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetShaderiv = t.fn(
    LIB,
    "glGetShaderiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetShaderPrecisionFormat = t.fn(
    LIB,
    "glGetShaderPrecisionFormat",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.fixedArray(t.int32, 2)) }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetString = t.fn(LIB, "glGetString", [{ type: t.uint32 }], t.string("borrowed"));

const glGetStringi = t.fn(LIB, "glGetStringi", [{ type: t.uint32 }, { type: t.uint32 }], t.string("borrowed"));

const glGetSubroutineIndex = t.fn(
    LIB,
    "glGetSubroutineIndex",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.string("borrowed") }],
    t.uint32,
);

const glGetSubroutineUniformLocation = t.fn(
    LIB,
    "glGetSubroutineUniformLocation",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.string("borrowed") }],
    t.int32,
);

const glGetSynciv = t.fn(
    LIB,
    "glGetSynciv",
    [
        { type: t.struct("borrowed") },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.ref(t.int32) },
        { type: t.ref(t.sizedArray(t.int32, 2)) },
    ],
    t.void,
);

const glGetTexImage = t.fn(
    LIB,
    "glGetTexImage",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.blob }],
    t.void,
);

const glGetTextureImage = t.fn(
    LIB,
    "glGetTextureImage",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glGetTextureLevelParameterfv = t.fn(
    LIB,
    "glGetTextureLevelParameterfv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.ref(t.float32) }],
    t.void,
);

const glGetTextureLevelParameteriv = t.fn(
    LIB,
    "glGetTextureLevelParameteriv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetTextureParameterfv = t.fn(
    LIB,
    "glGetTextureParameterfv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.float32) }],
    t.void,
);

const glGetTextureParameterIiv = t.fn(
    LIB,
    "glGetTextureParameterIiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetTextureParameterIuiv = t.fn(
    LIB,
    "glGetTextureParameterIuiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glGetTextureParameteriv = t.fn(
    LIB,
    "glGetTextureParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetTextureSubImage = t.fn(
    LIB,
    "glGetTextureSubImage",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glGetTransformFeedbacki_v = t.fn(
    LIB,
    "glGetTransformFeedbacki_v",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetTransformFeedbacki64_v = t.fn(
    LIB,
    "glGetTransformFeedbacki64_v",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int64) }],
    t.void,
);

const glGetTransformFeedbackiv = t.fn(
    LIB,
    "glGetTransformFeedbackiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetUniformBlockIndex = t.fn(
    LIB,
    "glGetUniformBlockIndex",
    [{ type: t.uint32 }, { type: t.string("borrowed") }],
    t.uint32,
);

const glGetUniformLocation = t.fn(
    LIB,
    "glGetUniformLocation",
    [{ type: t.uint32 }, { type: t.string("borrowed") }],
    t.int32,
);

const glGetUniformSubroutineuiv = t.fn(
    LIB,
    "glGetUniformSubroutineuiv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glGetVertexArrayIndexed64iv = t.fn(
    LIB,
    "glGetVertexArrayIndexed64iv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int64) }],
    t.void,
);

const glGetVertexArrayIndexediv = t.fn(
    LIB,
    "glGetVertexArrayIndexediv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetVertexArrayiv = t.fn(
    LIB,
    "glGetVertexArrayiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetVertexAttribdv = t.fn(
    LIB,
    "glGetVertexAttribdv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.fixedArray(t.float64, 4)) }],
    t.void,
);

const glGetVertexAttribfv = t.fn(
    LIB,
    "glGetVertexAttribfv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.fixedArray(t.float32, 4)) }],
    t.void,
);

const glGetVertexAttribIiv = t.fn(
    LIB,
    "glGetVertexAttribIiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.int32) }],
    t.void,
);

const glGetVertexAttribIuiv = t.fn(
    LIB,
    "glGetVertexAttribIuiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glGetVertexAttribiv = t.fn(
    LIB,
    "glGetVertexAttribiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.ref(t.fixedArray(t.int32, 4)) }],
    t.void,
);

const glHint = t.fn(LIB, "glHint", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glInvalidateBufferData = t.fn(LIB, "glInvalidateBufferData", [{ type: t.uint32 }], t.void);

const glInvalidateBufferSubData = t.fn(
    LIB,
    "glInvalidateBufferSubData",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.int64 }],
    t.void,
);

const glInvalidateFramebuffer = t.fn(
    LIB,
    "glInvalidateFramebuffer",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glInvalidateNamedFramebufferData = t.fn(
    LIB,
    "glInvalidateNamedFramebufferData",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glInvalidateNamedFramebufferSubData = t.fn(
    LIB,
    "glInvalidateNamedFramebufferSubData",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.array(t.uint32) },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glInvalidateSubFramebuffer = t.fn(
    LIB,
    "glInvalidateSubFramebuffer",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.array(t.uint32) },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glInvalidateTexImage = t.fn(LIB, "glInvalidateTexImage", [{ type: t.uint32 }, { type: t.int32 }], t.void);

const glInvalidateTexSubImage = t.fn(
    LIB,
    "glInvalidateTexSubImage",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glIsBuffer = t.fn(LIB, "glIsBuffer", [{ type: t.uint32 }], t.uint8);

const glIsEnabled = t.fn(LIB, "glIsEnabled", [{ type: t.uint32 }], t.uint8);

const glIsEnabledi = t.fn(LIB, "glIsEnabledi", [{ type: t.uint32 }, { type: t.uint32 }], t.uint8);

const glIsFramebuffer = t.fn(LIB, "glIsFramebuffer", [{ type: t.uint32 }], t.uint8);

const glIsProgram = t.fn(LIB, "glIsProgram", [{ type: t.uint32 }], t.uint8);

const glIsProgramPipeline = t.fn(LIB, "glIsProgramPipeline", [{ type: t.uint32 }], t.uint8);

const glIsQuery = t.fn(LIB, "glIsQuery", [{ type: t.uint32 }], t.uint8);

const glIsRenderbuffer = t.fn(LIB, "glIsRenderbuffer", [{ type: t.uint32 }], t.uint8);

const glIsSampler = t.fn(LIB, "glIsSampler", [{ type: t.uint32 }], t.uint8);

const glIsShader = t.fn(LIB, "glIsShader", [{ type: t.uint32 }], t.uint8);

const glIsSync = t.fn(LIB, "glIsSync", [{ type: t.struct("borrowed") }], t.uint8);

const glIsTexture = t.fn(LIB, "glIsTexture", [{ type: t.uint32 }], t.uint8);

const glIsTransformFeedback = t.fn(LIB, "glIsTransformFeedback", [{ type: t.uint32 }], t.uint8);

const glIsVertexArray = t.fn(LIB, "glIsVertexArray", [{ type: t.uint32 }], t.uint8);

const glLineWidth = t.fn(LIB, "glLineWidth", [{ type: t.float32 }], t.void);

const glLinkProgram = t.fn(LIB, "glLinkProgram", [{ type: t.uint32 }], t.void);

const glLogicOp = t.fn(LIB, "glLogicOp", [{ type: t.uint32 }], t.void);

const glMapBuffer = t.fn(LIB, "glMapBuffer", [{ type: t.uint32 }, { type: t.uint32 }], t.struct("borrowed"));

const glMapBufferRange = t.fn(
    LIB,
    "glMapBufferRange",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.int64 }, { type: t.uint32 }],
    t.struct("borrowed"),
);

const glMapNamedBuffer = t.fn(LIB, "glMapNamedBuffer", [{ type: t.uint32 }, { type: t.uint32 }], t.struct("borrowed"));

const glMapNamedBufferRange = t.fn(
    LIB,
    "glMapNamedBufferRange",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.int64 }, { type: t.uint32 }],
    t.struct("borrowed"),
);

const glMemoryBarrier = t.fn(LIB, "glMemoryBarrier", [{ type: t.uint32 }], t.void);

const glMemoryBarrierByRegion = t.fn(LIB, "glMemoryBarrierByRegion", [{ type: t.uint32 }], t.void);

const glMinSampleShading = t.fn(LIB, "glMinSampleShading", [{ type: t.float32 }], t.void);

const glMultiDrawArrays = t.fn(
    LIB,
    "glMultiDrawArrays",
    [{ type: t.uint32 }, { type: t.array(t.int32) }, { type: t.array(t.int32) }, { type: t.int32 }],
    t.void,
);

const glMultiDrawArraysIndirect = t.fn(
    LIB,
    "glMultiDrawArraysIndirect",
    [{ type: t.uint32 }, { type: t.uint64 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glMultiDrawArraysIndirectCount = t.fn(
    LIB,
    "glMultiDrawArraysIndirectCount",
    [{ type: t.uint32 }, { type: t.blob }, { type: t.int64 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glMultiDrawElements = t.fn(
    LIB,
    "glMultiDrawElements",
    [
        { type: t.uint32 },
        { type: t.array(t.int32) },
        { type: t.uint32 },
        { type: t.array(t.uint64) },
        { type: t.int32 },
    ],
    t.void,
);

const glMultiDrawElementsBaseVertex = t.fn(
    LIB,
    "glMultiDrawElementsBaseVertex",
    [
        { type: t.uint32 },
        { type: t.array(t.int32) },
        { type: t.uint32 },
        { type: t.array(t.uint64) },
        { type: t.int32 },
        { type: t.array(t.int32) },
    ],
    t.void,
);

const glMultiDrawElementsIndirect = t.fn(
    LIB,
    "glMultiDrawElementsIndirect",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint64 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glMultiDrawElementsIndirectCount = t.fn(
    LIB,
    "glMultiDrawElementsIndirectCount",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.blob }, { type: t.int64 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glNamedBufferData = t.fn(
    LIB,
    "glNamedBufferData",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.blob }, { type: t.uint32 }],
    t.void,
);

const glNamedBufferStorage = t.fn(
    LIB,
    "glNamedBufferStorage",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.blob }, { type: t.uint32 }],
    t.void,
);

const glNamedBufferSubData = t.fn(
    LIB,
    "glNamedBufferSubData",
    [{ type: t.uint32 }, { type: t.int64 }, { type: t.int64 }, { type: t.blob }],
    t.void,
);

const glNamedFramebufferDrawBuffer = t.fn(
    LIB,
    "glNamedFramebufferDrawBuffer",
    [{ type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glNamedFramebufferDrawBuffers = t.fn(
    LIB,
    "glNamedFramebufferDrawBuffers",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glNamedFramebufferParameteri = t.fn(
    LIB,
    "glNamedFramebufferParameteri",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glNamedFramebufferReadBuffer = t.fn(
    LIB,
    "glNamedFramebufferReadBuffer",
    [{ type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glNamedFramebufferRenderbuffer = t.fn(
    LIB,
    "glNamedFramebufferRenderbuffer",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glNamedFramebufferTexture = t.fn(
    LIB,
    "glNamedFramebufferTexture",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glNamedFramebufferTextureLayer = t.fn(
    LIB,
    "glNamedFramebufferTextureLayer",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glNamedRenderbufferStorage = t.fn(
    LIB,
    "glNamedRenderbufferStorage",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glNamedRenderbufferStorageMultisample = t.fn(
    LIB,
    "glNamedRenderbufferStorageMultisample",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glObjectLabel = t.fn(
    LIB,
    "glObjectLabel",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.string("borrowed") }],
    t.void,
);

const glObjectPtrLabel = t.fn(
    LIB,
    "glObjectPtrLabel",
    [{ type: t.blob }, { type: t.int32 }, { type: t.string("borrowed") }],
    t.void,
);

const glPatchParameterfv = t.fn(LIB, "glPatchParameterfv", [{ type: t.uint32 }, { type: t.array(t.float32) }], t.void);

const glPatchParameteri = t.fn(LIB, "glPatchParameteri", [{ type: t.uint32 }, { type: t.int32 }], t.void);

const glPauseTransformFeedback = t.fn(LIB, "glPauseTransformFeedback", [], t.void);

const glPixelStoref = t.fn(LIB, "glPixelStoref", [{ type: t.uint32 }, { type: t.float32 }], t.void);

const glPixelStorei = t.fn(LIB, "glPixelStorei", [{ type: t.uint32 }, { type: t.int32 }], t.void);

const glPointParameterf = t.fn(LIB, "glPointParameterf", [{ type: t.uint32 }, { type: t.float32 }], t.void);

const glPointParameterfv = t.fn(LIB, "glPointParameterfv", [{ type: t.uint32 }, { type: t.array(t.float32) }], t.void);

const glPointParameteri = t.fn(LIB, "glPointParameteri", [{ type: t.uint32 }, { type: t.int32 }], t.void);

const glPointParameteriv = t.fn(LIB, "glPointParameteriv", [{ type: t.uint32 }, { type: t.array(t.int32) }], t.void);

const glPointSize = t.fn(LIB, "glPointSize", [{ type: t.float32 }], t.void);

const glPolygonMode = t.fn(LIB, "glPolygonMode", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glPolygonOffset = t.fn(LIB, "glPolygonOffset", [{ type: t.float32 }, { type: t.float32 }], t.void);

const glPolygonOffsetClamp = t.fn(
    LIB,
    "glPolygonOffsetClamp",
    [{ type: t.float32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glPopDebugGroup = t.fn(LIB, "glPopDebugGroup", [], t.void);

const glPrimitiveRestartIndex = t.fn(LIB, "glPrimitiveRestartIndex", [{ type: t.uint32 }], t.void);

const glProgramBinary = t.fn(
    LIB,
    "glProgramBinary",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.blob }, { type: t.int32 }],
    t.void,
);

const glProgramParameteri = t.fn(
    LIB,
    "glProgramParameteri",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glProgramUniform1d = t.fn(
    LIB,
    "glProgramUniform1d",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.float64 }],
    t.void,
);

const glProgramUniform1dv = t.fn(
    LIB,
    "glProgramUniform1dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniform1f = t.fn(
    LIB,
    "glProgramUniform1f",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.float32 }],
    t.void,
);

const glProgramUniform1fv = t.fn(
    LIB,
    "glProgramUniform1fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniform1i = t.fn(
    LIB,
    "glProgramUniform1i",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glProgramUniform1iv = t.fn(
    LIB,
    "glProgramUniform1iv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glProgramUniform1ui = t.fn(
    LIB,
    "glProgramUniform1ui",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }],
    t.void,
);

const glProgramUniform1uiv = t.fn(
    LIB,
    "glProgramUniform1uiv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glProgramUniform2d = t.fn(
    LIB,
    "glProgramUniform2d",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glProgramUniform2dv = t.fn(
    LIB,
    "glProgramUniform2dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniform2f = t.fn(
    LIB,
    "glProgramUniform2f",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glProgramUniform2fv = t.fn(
    LIB,
    "glProgramUniform2fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniform2i = t.fn(
    LIB,
    "glProgramUniform2i",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glProgramUniform2iv = t.fn(
    LIB,
    "glProgramUniform2iv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glProgramUniform2ui = t.fn(
    LIB,
    "glProgramUniform2ui",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glProgramUniform2uiv = t.fn(
    LIB,
    "glProgramUniform2uiv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glProgramUniform3d = t.fn(
    LIB,
    "glProgramUniform3d",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glProgramUniform3dv = t.fn(
    LIB,
    "glProgramUniform3dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniform3f = t.fn(
    LIB,
    "glProgramUniform3f",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glProgramUniform3fv = t.fn(
    LIB,
    "glProgramUniform3fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniform3i = t.fn(
    LIB,
    "glProgramUniform3i",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glProgramUniform3iv = t.fn(
    LIB,
    "glProgramUniform3iv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glProgramUniform3ui = t.fn(
    LIB,
    "glProgramUniform3ui",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glProgramUniform3uiv = t.fn(
    LIB,
    "glProgramUniform3uiv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glProgramUniform4d = t.fn(
    LIB,
    "glProgramUniform4d",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);

const glProgramUniform4dv = t.fn(
    LIB,
    "glProgramUniform4dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniform4f = t.fn(
    LIB,
    "glProgramUniform4f",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.float32 },
        { type: t.float32 },
        { type: t.float32 },
        { type: t.float32 },
    ],
    t.void,
);

const glProgramUniform4fv = t.fn(
    LIB,
    "glProgramUniform4fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniform4i = t.fn(
    LIB,
    "glProgramUniform4i",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glProgramUniform4iv = t.fn(
    LIB,
    "glProgramUniform4iv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glProgramUniform4ui = t.fn(
    LIB,
    "glProgramUniform4ui",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
    ],
    t.void,
);

const glProgramUniform4uiv = t.fn(
    LIB,
    "glProgramUniform4uiv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glProgramUniformMatrix2dv = t.fn(
    LIB,
    "glProgramUniformMatrix2dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniformMatrix2fv = t.fn(
    LIB,
    "glProgramUniformMatrix2fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniformMatrix2x3dv = t.fn(
    LIB,
    "glProgramUniformMatrix2x3dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniformMatrix2x3fv = t.fn(
    LIB,
    "glProgramUniformMatrix2x3fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniformMatrix2x4dv = t.fn(
    LIB,
    "glProgramUniformMatrix2x4dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniformMatrix2x4fv = t.fn(
    LIB,
    "glProgramUniformMatrix2x4fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniformMatrix3dv = t.fn(
    LIB,
    "glProgramUniformMatrix3dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniformMatrix3fv = t.fn(
    LIB,
    "glProgramUniformMatrix3fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniformMatrix3x2dv = t.fn(
    LIB,
    "glProgramUniformMatrix3x2dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniformMatrix3x2fv = t.fn(
    LIB,
    "glProgramUniformMatrix3x2fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniformMatrix3x4dv = t.fn(
    LIB,
    "glProgramUniformMatrix3x4dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniformMatrix3x4fv = t.fn(
    LIB,
    "glProgramUniformMatrix3x4fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniformMatrix4dv = t.fn(
    LIB,
    "glProgramUniformMatrix4dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniformMatrix4fv = t.fn(
    LIB,
    "glProgramUniformMatrix4fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniformMatrix4x2dv = t.fn(
    LIB,
    "glProgramUniformMatrix4x2dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniformMatrix4x2fv = t.fn(
    LIB,
    "glProgramUniformMatrix4x2fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glProgramUniformMatrix4x3dv = t.fn(
    LIB,
    "glProgramUniformMatrix4x3dv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glProgramUniformMatrix4x3fv = t.fn(
    LIB,
    "glProgramUniformMatrix4x3fv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glProvokingVertex = t.fn(LIB, "glProvokingVertex", [{ type: t.uint32 }], t.void);

const glPushDebugGroup = t.fn(
    LIB,
    "glPushDebugGroup",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.string("borrowed") }],
    t.void,
);

const glQueryCounter = t.fn(LIB, "glQueryCounter", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glReadBuffer = t.fn(LIB, "glReadBuffer", [{ type: t.uint32 }], t.void);

const glReadnPixels = t.fn(
    LIB,
    "glReadnPixels",
    [
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.blob },
    ],
    t.void,
);

const glReadPixels = t.fn(
    LIB,
    "glReadPixels",
    [
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glReleaseShaderCompiler = t.fn(LIB, "glReleaseShaderCompiler", [], t.void);

const glRenderbufferStorage = t.fn(
    LIB,
    "glRenderbufferStorage",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glRenderbufferStorageMultisample = t.fn(
    LIB,
    "glRenderbufferStorageMultisample",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glResumeTransformFeedback = t.fn(LIB, "glResumeTransformFeedback", [], t.void);

const glSampleCoverage = t.fn(LIB, "glSampleCoverage", [{ type: t.float32 }, { type: t.boolean }], t.void);

const glSampleMaski = t.fn(LIB, "glSampleMaski", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glSamplerParameterf = t.fn(
    LIB,
    "glSamplerParameterf",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.float32 }],
    t.void,
);

const glSamplerParameterfv = t.fn(
    LIB,
    "glSamplerParameterfv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.float32) }],
    t.void,
);

const glSamplerParameteri = t.fn(
    LIB,
    "glSamplerParameteri",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glSamplerParameterIiv = t.fn(
    LIB,
    "glSamplerParameterIiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.int32) }],
    t.void,
);

const glSamplerParameterIuiv = t.fn(
    LIB,
    "glSamplerParameterIuiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glSamplerParameteriv = t.fn(
    LIB,
    "glSamplerParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.int32) }],
    t.void,
);

const glScissor = t.fn(
    LIB,
    "glScissor",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glScissorArrayv = t.fn(
    LIB,
    "glScissorArrayv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glScissorIndexed = t.fn(
    LIB,
    "glScissorIndexed",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glScissorIndexedv = t.fn(LIB, "glScissorIndexedv", [{ type: t.uint32 }, { type: t.array(t.int32) }], t.void);

const glShaderBinary = t.fn(
    LIB,
    "glShaderBinary",
    [{ type: t.int32 }, { type: t.array(t.uint32) }, { type: t.uint32 }, { type: t.blob }, { type: t.int32 }],
    t.void,
);

const glShaderSource = t.fn(
    LIB,
    "glShaderSource",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.string("borrowed")) }, { type: t.array(t.int32) }],
    t.void,
);

const glShaderStorageBlockBinding = t.fn(
    LIB,
    "glShaderStorageBlockBinding",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glSpecializeShader = t.fn(
    LIB,
    "glSpecializeShader",
    [
        { type: t.uint32 },
        { type: t.string("borrowed") },
        { type: t.uint32 },
        { type: t.array(t.uint32) },
        { type: t.array(t.uint32) },
    ],
    t.void,
);

const glStencilFunc = t.fn(LIB, "glStencilFunc", [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }], t.void);

const glStencilFuncSeparate = t.fn(
    LIB,
    "glStencilFuncSeparate",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }],
    t.void,
);

const glStencilMask = t.fn(LIB, "glStencilMask", [{ type: t.uint32 }], t.void);

const glStencilMaskSeparate = t.fn(LIB, "glStencilMaskSeparate", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glStencilOp = t.fn(LIB, "glStencilOp", [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }], t.void);

const glStencilOpSeparate = t.fn(
    LIB,
    "glStencilOpSeparate",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glTexBuffer = t.fn(LIB, "glTexBuffer", [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }], t.void);

const glTexBufferRange = t.fn(
    LIB,
    "glTexBufferRange",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }, { type: t.int64 }],
    t.void,
);

const glTexImage1D = t.fn(
    LIB,
    "glTexImage1D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glTexImage2D = t.fn(
    LIB,
    "glTexImage2D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glTexImage2DMultisample = t.fn(
    LIB,
    "glTexImage2DMultisample",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.boolean },
    ],
    t.void,
);

const glTexImage3D = t.fn(
    LIB,
    "glTexImage3D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glTexImage3DMultisample = t.fn(
    LIB,
    "glTexImage3DMultisample",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.boolean },
    ],
    t.void,
);

const glTexParameterf = t.fn(
    LIB,
    "glTexParameterf",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.float32 }],
    t.void,
);

const glTexParameterfv = t.fn(
    LIB,
    "glTexParameterfv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.float32) }],
    t.void,
);

const glTexParameteri = t.fn(
    LIB,
    "glTexParameteri",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glTexParameterIiv = t.fn(
    LIB,
    "glTexParameterIiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.int32) }],
    t.void,
);

const glTexParameterIuiv = t.fn(
    LIB,
    "glTexParameterIuiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glTexParameteriv = t.fn(
    LIB,
    "glTexParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.int32) }],
    t.void,
);

const glTexStorage1D = t.fn(
    LIB,
    "glTexStorage1D",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glTexStorage2D = t.fn(
    LIB,
    "glTexStorage2D",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glTexStorage2DMultisample = t.fn(
    LIB,
    "glTexStorage2DMultisample",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.boolean },
    ],
    t.void,
);

const glTexStorage3D = t.fn(
    LIB,
    "glTexStorage3D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glTexStorage3DMultisample = t.fn(
    LIB,
    "glTexStorage3DMultisample",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.boolean },
    ],
    t.void,
);

const glTexSubImage1D = t.fn(
    LIB,
    "glTexSubImage1D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glTexSubImage2D = t.fn(
    LIB,
    "glTexSubImage2D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glTexSubImage3D = t.fn(
    LIB,
    "glTexSubImage3D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glTextureBarrier = t.fn(LIB, "glTextureBarrier", [], t.void);

const glTextureBuffer = t.fn(
    LIB,
    "glTextureBuffer",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glTextureBufferRange = t.fn(
    LIB,
    "glTextureBufferRange",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }, { type: t.int64 }],
    t.void,
);

const glTextureParameterf = t.fn(
    LIB,
    "glTextureParameterf",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.float32 }],
    t.void,
);

const glTextureParameterfv = t.fn(
    LIB,
    "glTextureParameterfv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.float32) }],
    t.void,
);

const glTextureParameteri = t.fn(
    LIB,
    "glTextureParameteri",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glTextureParameterIiv = t.fn(
    LIB,
    "glTextureParameterIiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.int32) }],
    t.void,
);

const glTextureParameterIuiv = t.fn(
    LIB,
    "glTextureParameterIuiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glTextureParameteriv = t.fn(
    LIB,
    "glTextureParameteriv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.array(t.int32) }],
    t.void,
);

const glTextureStorage1D = t.fn(
    LIB,
    "glTextureStorage1D",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.int32 }],
    t.void,
);

const glTextureStorage2D = t.fn(
    LIB,
    "glTextureStorage2D",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glTextureStorage2DMultisample = t.fn(
    LIB,
    "glTextureStorage2DMultisample",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.boolean },
    ],
    t.void,
);

const glTextureStorage3D = t.fn(
    LIB,
    "glTextureStorage3D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);

const glTextureStorage3DMultisample = t.fn(
    LIB,
    "glTextureStorage3DMultisample",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.boolean },
    ],
    t.void,
);

const glTextureSubImage1D = t.fn(
    LIB,
    "glTextureSubImage1D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glTextureSubImage2D = t.fn(
    LIB,
    "glTextureSubImage2D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glTextureSubImage3D = t.fn(
    LIB,
    "glTextureSubImage3D",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.blob },
    ],
    t.void,
);

const glTextureView = t.fn(
    LIB,
    "glTextureView",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.uint32 },
    ],
    t.void,
);

const glTransformFeedbackBufferBase = t.fn(
    LIB,
    "glTransformFeedbackBufferBase",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glTransformFeedbackBufferRange = t.fn(
    LIB,
    "glTransformFeedbackBufferRange",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }, { type: t.int64 }],
    t.void,
);

const glTransformFeedbackVaryings = t.fn(
    LIB,
    "glTransformFeedbackVaryings",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.string("borrowed")) }, { type: t.uint32 }],
    t.void,
);

const glUniform1d = t.fn(LIB, "glUniform1d", [{ type: t.int32 }, { type: t.float64 }], t.void);

const glUniform1dv = t.fn(
    LIB,
    "glUniform1dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.float64) }],
    t.void,
);

const glUniform1f = t.fn(LIB, "glUniform1f", [{ type: t.int32 }, { type: t.float32 }], t.void);

const glUniform1fv = t.fn(
    LIB,
    "glUniform1fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glUniform1i = t.fn(LIB, "glUniform1i", [{ type: t.int32 }, { type: t.int32 }], t.void);

const glUniform1iv = t.fn(
    LIB,
    "glUniform1iv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glUniform1ui = t.fn(LIB, "glUniform1ui", [{ type: t.int32 }, { type: t.uint32 }], t.void);

const glUniform1uiv = t.fn(
    LIB,
    "glUniform1uiv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glUniform2d = t.fn(LIB, "glUniform2d", [{ type: t.int32 }, { type: t.float64 }, { type: t.float64 }], t.void);

const glUniform2dv = t.fn(
    LIB,
    "glUniform2dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.float64) }],
    t.void,
);

const glUniform2f = t.fn(LIB, "glUniform2f", [{ type: t.int32 }, { type: t.float32 }, { type: t.float32 }], t.void);

const glUniform2fv = t.fn(
    LIB,
    "glUniform2fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glUniform2i = t.fn(LIB, "glUniform2i", [{ type: t.int32 }, { type: t.int32 }, { type: t.int32 }], t.void);

const glUniform2iv = t.fn(
    LIB,
    "glUniform2iv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glUniform2ui = t.fn(LIB, "glUniform2ui", [{ type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }], t.void);

const glUniform2uiv = t.fn(
    LIB,
    "glUniform2uiv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glUniform3d = t.fn(
    LIB,
    "glUniform3d",
    [{ type: t.int32 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glUniform3dv = t.fn(
    LIB,
    "glUniform3dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.float64) }],
    t.void,
);

const glUniform3f = t.fn(
    LIB,
    "glUniform3f",
    [{ type: t.int32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glUniform3fv = t.fn(
    LIB,
    "glUniform3fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glUniform3i = t.fn(
    LIB,
    "glUniform3i",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glUniform3iv = t.fn(
    LIB,
    "glUniform3iv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glUniform3ui = t.fn(
    LIB,
    "glUniform3ui",
    [{ type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glUniform3uiv = t.fn(
    LIB,
    "glUniform3uiv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glUniform4d = t.fn(
    LIB,
    "glUniform4d",
    [{ type: t.int32 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glUniform4dv = t.fn(
    LIB,
    "glUniform4dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.float64) }],
    t.void,
);

const glUniform4f = t.fn(
    LIB,
    "glUniform4f",
    [{ type: t.int32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glUniform4fv = t.fn(
    LIB,
    "glUniform4fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glUniform4i = t.fn(
    LIB,
    "glUniform4i",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glUniform4iv = t.fn(
    LIB,
    "glUniform4iv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.int32) }],
    t.void,
);

const glUniform4ui = t.fn(
    LIB,
    "glUniform4ui",
    [{ type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glUniform4uiv = t.fn(
    LIB,
    "glUniform4uiv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glUniformBlockBinding = t.fn(
    LIB,
    "glUniformBlockBinding",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glUniformMatrix2dv = t.fn(
    LIB,
    "glUniformMatrix2dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glUniformMatrix2fv = t.fn(
    LIB,
    "glUniformMatrix2fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glUniformMatrix2x3dv = t.fn(
    LIB,
    "glUniformMatrix2x3dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glUniformMatrix2x3fv = t.fn(
    LIB,
    "glUniformMatrix2x3fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glUniformMatrix2x4dv = t.fn(
    LIB,
    "glUniformMatrix2x4dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glUniformMatrix2x4fv = t.fn(
    LIB,
    "glUniformMatrix2x4fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glUniformMatrix3dv = t.fn(
    LIB,
    "glUniformMatrix3dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glUniformMatrix3fv = t.fn(
    LIB,
    "glUniformMatrix3fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glUniformMatrix3x2dv = t.fn(
    LIB,
    "glUniformMatrix3x2dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glUniformMatrix3x2fv = t.fn(
    LIB,
    "glUniformMatrix3x2fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glUniformMatrix3x4dv = t.fn(
    LIB,
    "glUniformMatrix3x4dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glUniformMatrix3x4fv = t.fn(
    LIB,
    "glUniformMatrix3x4fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glUniformMatrix4dv = t.fn(
    LIB,
    "glUniformMatrix4dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glUniformMatrix4fv = t.fn(
    LIB,
    "glUniformMatrix4fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glUniformMatrix4x2dv = t.fn(
    LIB,
    "glUniformMatrix4x2dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glUniformMatrix4x2fv = t.fn(
    LIB,
    "glUniformMatrix4x2fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glUniformMatrix4x3dv = t.fn(
    LIB,
    "glUniformMatrix4x3dv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float64) }],
    t.void,
);

const glUniformMatrix4x3fv = t.fn(
    LIB,
    "glUniformMatrix4x3fv",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.boolean }, { type: t.array(t.float32) }],
    t.void,
);

const glUniformSubroutinesuiv = t.fn(
    LIB,
    "glUniformSubroutinesuiv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.uint32) }],
    t.void,
);

const glUnmapBuffer = t.fn(LIB, "glUnmapBuffer", [{ type: t.uint32 }], t.uint8);

const glUnmapNamedBuffer = t.fn(LIB, "glUnmapNamedBuffer", [{ type: t.uint32 }], t.uint8);

const glUseProgram = t.fn(LIB, "glUseProgram", [{ type: t.uint32 }], t.void);

const glUseProgramStages = t.fn(
    LIB,
    "glUseProgramStages",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glValidateProgram = t.fn(LIB, "glValidateProgram", [{ type: t.uint32 }], t.void);

const glValidateProgramPipeline = t.fn(LIB, "glValidateProgramPipeline", [{ type: t.uint32 }], t.void);

const glVertexArrayAttribBinding = t.fn(
    LIB,
    "glVertexArrayAttribBinding",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glVertexArrayAttribFormat = t.fn(
    LIB,
    "glVertexArrayAttribFormat",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.boolean },
        { type: t.uint32 },
    ],
    t.void,
);

const glVertexArrayAttribIFormat = t.fn(
    LIB,
    "glVertexArrayAttribIFormat",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glVertexArrayAttribLFormat = t.fn(
    LIB,
    "glVertexArrayAttribLFormat",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glVertexArrayBindingDivisor = t.fn(
    LIB,
    "glVertexArrayBindingDivisor",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glVertexArrayElementBuffer = t.fn(
    LIB,
    "glVertexArrayElementBuffer",
    [{ type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glVertexArrayVertexBuffer = t.fn(
    LIB,
    "glVertexArrayVertexBuffer",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.int64 }, { type: t.int32 }],
    t.void,
);

const glVertexArrayVertexBuffers = t.fn(
    LIB,
    "glVertexArrayVertexBuffers",
    [
        { type: t.uint32 },
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.array(t.uint32) },
        { type: t.array(t.int64) },
        { type: t.array(t.int32) },
    ],
    t.void,
);

const glVertexAttrib1d = t.fn(LIB, "glVertexAttrib1d", [{ type: t.uint32 }, { type: t.float64 }], t.void);

const glVertexAttrib1dv = t.fn(LIB, "glVertexAttrib1dv", [{ type: t.uint32 }, { type: t.array(t.float64) }], t.void);

const glVertexAttrib1f = t.fn(LIB, "glVertexAttrib1f", [{ type: t.uint32 }, { type: t.float32 }], t.void);

const glVertexAttrib1fv = t.fn(LIB, "glVertexAttrib1fv", [{ type: t.uint32 }, { type: t.array(t.float32) }], t.void);

const glVertexAttrib1s = t.fn(LIB, "glVertexAttrib1s", [{ type: t.uint32 }, { type: t.int16 }], t.void);

const glVertexAttrib1sv = t.fn(LIB, "glVertexAttrib1sv", [{ type: t.uint32 }, { type: t.array(t.int16) }], t.void);

const glVertexAttrib2d = t.fn(
    LIB,
    "glVertexAttrib2d",
    [{ type: t.uint32 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glVertexAttrib2dv = t.fn(LIB, "glVertexAttrib2dv", [{ type: t.uint32 }, { type: t.array(t.float64) }], t.void);

const glVertexAttrib2f = t.fn(
    LIB,
    "glVertexAttrib2f",
    [{ type: t.uint32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glVertexAttrib2fv = t.fn(LIB, "glVertexAttrib2fv", [{ type: t.uint32 }, { type: t.array(t.float32) }], t.void);

const glVertexAttrib2s = t.fn(
    LIB,
    "glVertexAttrib2s",
    [{ type: t.uint32 }, { type: t.int16 }, { type: t.int16 }],
    t.void,
);

const glVertexAttrib2sv = t.fn(LIB, "glVertexAttrib2sv", [{ type: t.uint32 }, { type: t.array(t.int16) }], t.void);

const glVertexAttrib3d = t.fn(
    LIB,
    "glVertexAttrib3d",
    [{ type: t.uint32 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glVertexAttrib3dv = t.fn(LIB, "glVertexAttrib3dv", [{ type: t.uint32 }, { type: t.array(t.float64) }], t.void);

const glVertexAttrib3f = t.fn(
    LIB,
    "glVertexAttrib3f",
    [{ type: t.uint32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glVertexAttrib3fv = t.fn(LIB, "glVertexAttrib3fv", [{ type: t.uint32 }, { type: t.array(t.float32) }], t.void);

const glVertexAttrib3s = t.fn(
    LIB,
    "glVertexAttrib3s",
    [{ type: t.uint32 }, { type: t.int16 }, { type: t.int16 }, { type: t.int16 }],
    t.void,
);

const glVertexAttrib3sv = t.fn(LIB, "glVertexAttrib3sv", [{ type: t.uint32 }, { type: t.array(t.int16) }], t.void);

const glVertexAttrib4bv = t.fn(LIB, "glVertexAttrib4bv", [{ type: t.uint32 }, { type: t.array(t.int8) }], t.void);

const glVertexAttrib4d = t.fn(
    LIB,
    "glVertexAttrib4d",
    [{ type: t.uint32 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glVertexAttrib4dv = t.fn(LIB, "glVertexAttrib4dv", [{ type: t.uint32 }, { type: t.array(t.float64) }], t.void);

const glVertexAttrib4f = t.fn(
    LIB,
    "glVertexAttrib4f",
    [{ type: t.uint32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glVertexAttrib4fv = t.fn(LIB, "glVertexAttrib4fv", [{ type: t.uint32 }, { type: t.array(t.float32) }], t.void);

const glVertexAttrib4iv = t.fn(LIB, "glVertexAttrib4iv", [{ type: t.uint32 }, { type: t.array(t.int32) }], t.void);

const glVertexAttrib4Nbv = t.fn(LIB, "glVertexAttrib4Nbv", [{ type: t.uint32 }, { type: t.array(t.int8) }], t.void);

const glVertexAttrib4Niv = t.fn(LIB, "glVertexAttrib4Niv", [{ type: t.uint32 }, { type: t.array(t.int32) }], t.void);

const glVertexAttrib4Nsv = t.fn(LIB, "glVertexAttrib4Nsv", [{ type: t.uint32 }, { type: t.array(t.int16) }], t.void);

const glVertexAttrib4Nub = t.fn(
    LIB,
    "glVertexAttrib4Nub",
    [{ type: t.uint32 }, { type: t.uint8 }, { type: t.uint8 }, { type: t.uint8 }, { type: t.uint8 }],
    t.void,
);

const glVertexAttrib4Nubv = t.fn(LIB, "glVertexAttrib4Nubv", [{ type: t.uint32 }, { type: t.array(t.uint8) }], t.void);

const glVertexAttrib4Nuiv = t.fn(LIB, "glVertexAttrib4Nuiv", [{ type: t.uint32 }, { type: t.array(t.uint32) }], t.void);

const glVertexAttrib4Nusv = t.fn(LIB, "glVertexAttrib4Nusv", [{ type: t.uint32 }, { type: t.array(t.uint16) }], t.void);

const glVertexAttrib4s = t.fn(
    LIB,
    "glVertexAttrib4s",
    [{ type: t.uint32 }, { type: t.int16 }, { type: t.int16 }, { type: t.int16 }, { type: t.int16 }],
    t.void,
);

const glVertexAttrib4sv = t.fn(LIB, "glVertexAttrib4sv", [{ type: t.uint32 }, { type: t.array(t.int16) }], t.void);

const glVertexAttrib4ubv = t.fn(LIB, "glVertexAttrib4ubv", [{ type: t.uint32 }, { type: t.array(t.uint8) }], t.void);

const glVertexAttrib4uiv = t.fn(LIB, "glVertexAttrib4uiv", [{ type: t.uint32 }, { type: t.array(t.uint32) }], t.void);

const glVertexAttrib4usv = t.fn(LIB, "glVertexAttrib4usv", [{ type: t.uint32 }, { type: t.array(t.uint16) }], t.void);

const glVertexAttribBinding = t.fn(LIB, "glVertexAttribBinding", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glVertexAttribDivisor = t.fn(LIB, "glVertexAttribDivisor", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glVertexAttribFormat = t.fn(
    LIB,
    "glVertexAttribFormat",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.boolean }, { type: t.uint32 }],
    t.void,
);

const glVertexAttribI1i = t.fn(LIB, "glVertexAttribI1i", [{ type: t.uint32 }, { type: t.int32 }], t.void);

const glVertexAttribI1iv = t.fn(LIB, "glVertexAttribI1iv", [{ type: t.uint32 }, { type: t.array(t.int32) }], t.void);

const glVertexAttribI1ui = t.fn(LIB, "glVertexAttribI1ui", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glVertexAttribI1uiv = t.fn(LIB, "glVertexAttribI1uiv", [{ type: t.uint32 }, { type: t.array(t.uint32) }], t.void);

const glVertexAttribI2i = t.fn(
    LIB,
    "glVertexAttribI2i",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glVertexAttribI2iv = t.fn(LIB, "glVertexAttribI2iv", [{ type: t.uint32 }, { type: t.array(t.int32) }], t.void);

const glVertexAttribI2ui = t.fn(
    LIB,
    "glVertexAttribI2ui",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glVertexAttribI2uiv = t.fn(LIB, "glVertexAttribI2uiv", [{ type: t.uint32 }, { type: t.array(t.uint32) }], t.void);

const glVertexAttribI3i = t.fn(
    LIB,
    "glVertexAttribI3i",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glVertexAttribI3iv = t.fn(LIB, "glVertexAttribI3iv", [{ type: t.uint32 }, { type: t.array(t.int32) }], t.void);

const glVertexAttribI3ui = t.fn(
    LIB,
    "glVertexAttribI3ui",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glVertexAttribI3uiv = t.fn(LIB, "glVertexAttribI3uiv", [{ type: t.uint32 }, { type: t.array(t.uint32) }], t.void);

const glVertexAttribI4bv = t.fn(LIB, "glVertexAttribI4bv", [{ type: t.uint32 }, { type: t.array(t.int8) }], t.void);

const glVertexAttribI4i = t.fn(
    LIB,
    "glVertexAttribI4i",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glVertexAttribI4iv = t.fn(LIB, "glVertexAttribI4iv", [{ type: t.uint32 }, { type: t.array(t.int32) }], t.void);

const glVertexAttribI4sv = t.fn(LIB, "glVertexAttribI4sv", [{ type: t.uint32 }, { type: t.array(t.int16) }], t.void);

const glVertexAttribI4ubv = t.fn(LIB, "glVertexAttribI4ubv", [{ type: t.uint32 }, { type: t.array(t.uint8) }], t.void);

const glVertexAttribI4ui = t.fn(
    LIB,
    "glVertexAttribI4ui",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glVertexAttribI4uiv = t.fn(LIB, "glVertexAttribI4uiv", [{ type: t.uint32 }, { type: t.array(t.uint32) }], t.void);

const glVertexAttribI4usv = t.fn(LIB, "glVertexAttribI4usv", [{ type: t.uint32 }, { type: t.array(t.uint16) }], t.void);

const glVertexAttribIFormat = t.fn(
    LIB,
    "glVertexAttribIFormat",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glVertexAttribIPointer = t.fn(
    LIB,
    "glVertexAttribIPointer",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.uint64 }],
    t.void,
);

const glVertexAttribL1d = t.fn(LIB, "glVertexAttribL1d", [{ type: t.uint32 }, { type: t.float64 }], t.void);

const glVertexAttribL1dv = t.fn(LIB, "glVertexAttribL1dv", [{ type: t.uint32 }, { type: t.array(t.float64) }], t.void);

const glVertexAttribL2d = t.fn(
    LIB,
    "glVertexAttribL2d",
    [{ type: t.uint32 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glVertexAttribL2dv = t.fn(LIB, "glVertexAttribL2dv", [{ type: t.uint32 }, { type: t.array(t.float64) }], t.void);

const glVertexAttribL3d = t.fn(
    LIB,
    "glVertexAttribL3d",
    [{ type: t.uint32 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glVertexAttribL3dv = t.fn(LIB, "glVertexAttribL3dv", [{ type: t.uint32 }, { type: t.array(t.float64) }], t.void);

const glVertexAttribL4d = t.fn(
    LIB,
    "glVertexAttribL4d",
    [{ type: t.uint32 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);

const glVertexAttribL4dv = t.fn(LIB, "glVertexAttribL4dv", [{ type: t.uint32 }, { type: t.array(t.float64) }], t.void);

const glVertexAttribLFormat = t.fn(
    LIB,
    "glVertexAttribLFormat",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.uint32 }],
    t.void,
);

const glVertexAttribLPointer = t.fn(
    LIB,
    "glVertexAttribLPointer",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.uint32 }, { type: t.int32 }, { type: t.uint64 }],
    t.void,
);

const glVertexAttribP1ui = t.fn(
    LIB,
    "glVertexAttribP1ui",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.boolean }, { type: t.uint32 }],
    t.void,
);

const glVertexAttribP1uiv = t.fn(
    LIB,
    "glVertexAttribP1uiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.boolean }, { type: t.array(t.uint32) }],
    t.void,
);

const glVertexAttribP2ui = t.fn(
    LIB,
    "glVertexAttribP2ui",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.boolean }, { type: t.uint32 }],
    t.void,
);

const glVertexAttribP2uiv = t.fn(
    LIB,
    "glVertexAttribP2uiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.boolean }, { type: t.array(t.uint32) }],
    t.void,
);

const glVertexAttribP3ui = t.fn(
    LIB,
    "glVertexAttribP3ui",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.boolean }, { type: t.uint32 }],
    t.void,
);

const glVertexAttribP3uiv = t.fn(
    LIB,
    "glVertexAttribP3uiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.boolean }, { type: t.array(t.uint32) }],
    t.void,
);

const glVertexAttribP4ui = t.fn(
    LIB,
    "glVertexAttribP4ui",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.boolean }, { type: t.uint32 }],
    t.void,
);

const glVertexAttribP4uiv = t.fn(
    LIB,
    "glVertexAttribP4uiv",
    [{ type: t.uint32 }, { type: t.uint32 }, { type: t.boolean }, { type: t.array(t.uint32) }],
    t.void,
);

const glVertexAttribPointer = t.fn(
    LIB,
    "glVertexAttribPointer",
    [
        { type: t.uint32 },
        { type: t.int32 },
        { type: t.uint32 },
        { type: t.boolean },
        { type: t.int32 },
        { type: t.uint64 },
    ],
    t.void,
);

const glVertexBindingDivisor = t.fn(LIB, "glVertexBindingDivisor", [{ type: t.uint32 }, { type: t.uint32 }], t.void);

const glViewport = t.fn(
    LIB,
    "glViewport",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.void,
);

const glViewportArrayv = t.fn(
    LIB,
    "glViewportArrayv",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.array(t.float32) }],
    t.void,
);

const glViewportIndexedf = t.fn(
    LIB,
    "glViewportIndexedf",
    [{ type: t.uint32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }, { type: t.float32 }],
    t.void,
);

const glViewportIndexedfv = t.fn(
    LIB,
    "glViewportIndexedfv",
    [{ type: t.uint32 }, { type: t.array(t.float32) }],
    t.void,
);

const glWaitSync = t.fn(
    LIB,
    "glWaitSync",
    [{ type: t.struct("borrowed") }, { type: t.uint32 }, { type: t.uint64 }],
    t.void,
);

const glCreateBuffersSingle = t.fn(LIB, "glCreateBuffers", [{ type: t.int32 }, { type: t.ref(t.uint32) }], t.void);

const glCreateFramebuffersSingle = t.fn(
    LIB,
    "glCreateFramebuffers",
    [{ type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glCreateProgramPipelinesSingle = t.fn(
    LIB,
    "glCreateProgramPipelines",
    [{ type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glCreateQueriesSingle = t.fn(
    LIB,
    "glCreateQueries",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glCreateRenderbuffersSingle = t.fn(
    LIB,
    "glCreateRenderbuffers",
    [{ type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glCreateSamplersSingle = t.fn(LIB, "glCreateSamplers", [{ type: t.int32 }, { type: t.ref(t.uint32) }], t.void);

const glCreateTexturesSingle = t.fn(
    LIB,
    "glCreateTextures",
    [{ type: t.uint32 }, { type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glCreateTransformFeedbacksSingle = t.fn(
    LIB,
    "glCreateTransformFeedbacks",
    [{ type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glCreateVertexArraysSingle = t.fn(
    LIB,
    "glCreateVertexArrays",
    [{ type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glGenBuffersSingle = t.fn(LIB, "glGenBuffers", [{ type: t.int32 }, { type: t.ref(t.uint32) }], t.void);

const glGenFramebuffersSingle = t.fn(LIB, "glGenFramebuffers", [{ type: t.int32 }, { type: t.ref(t.uint32) }], t.void);

const glGenProgramPipelinesSingle = t.fn(
    LIB,
    "glGenProgramPipelines",
    [{ type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glGenQueriesSingle = t.fn(LIB, "glGenQueries", [{ type: t.int32 }, { type: t.ref(t.uint32) }], t.void);

const glGenRenderbuffersSingle = t.fn(
    LIB,
    "glGenRenderbuffers",
    [{ type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glGenSamplersSingle = t.fn(LIB, "glGenSamplers", [{ type: t.int32 }, { type: t.ref(t.uint32) }], t.void);

const glGenTexturesSingle = t.fn(LIB, "glGenTextures", [{ type: t.int32 }, { type: t.ref(t.uint32) }], t.void);

const glGenTransformFeedbacksSingle = t.fn(
    LIB,
    "glGenTransformFeedbacks",
    [{ type: t.int32 }, { type: t.ref(t.uint32) }],
    t.void,
);

const glGenVertexArraysSingle = t.fn(LIB, "glGenVertexArrays", [{ type: t.int32 }, { type: t.ref(t.uint32) }], t.void);

/**
 * `void glActiveShaderProgram(GLuint pipeline, GLuint program)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param pipeline - `GLuint`, object kind `program pipeline`
 * @param program - `GLuint`, object kind `program`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glActiveShaderProgram.xhtml
 */
export function activeShaderProgram(pipeline: GLuint, program: GLuint): void {
    glActiveShaderProgram(pipeline, program);
}

/**
 * `void glActiveTexture(GLenum texture)`
 *
 * Provided by `GL_VERSION_1_3`.
 *
 * @param texture - `GLenum`, group `TextureUnit`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glActiveTexture.xhtml
 */
export function activeTexture(texture: TextureUnit): void {
    glActiveTexture(texture);
}

/**
 * `void glAttachShader(GLuint program, GLuint shader)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param shader - `GLuint`, object kind `shader`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glAttachShader.xhtml
 */
export function attachShader(program: GLuint, shader: GLuint): void {
    glAttachShader(program, shader);
}

/**
 * `void glBeginConditionalRender(GLuint id, GLenum mode)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param id - `GLuint`
 * @param mode - `GLenum`, group `ConditionalRenderMode`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBeginConditionalRender.xhtml
 */
export function beginConditionalRender(id: GLuint, mode: ConditionalRenderMode): void {
    glBeginConditionalRender(id, mode);
}

/**
 * `void glBeginQuery(GLenum target, GLuint id)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param target - `GLenum`, group `QueryTarget`
 * @param id - `GLuint`, object kind `query`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBeginQuery.xhtml
 */
export function beginQuery(target: QueryTarget, id: GLuint): void {
    glBeginQuery(target, id);
}

/**
 * `void glBeginQueryIndexed(GLenum target, GLuint index, GLuint id)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param target - `GLenum`, group `QueryTarget`
 * @param index - `GLuint`
 * @param id - `GLuint`, object kind `query`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBeginQueryIndexed.xhtml
 */
export function beginQueryIndexed(target: QueryTarget, index: GLuint, id: GLuint): void {
    glBeginQueryIndexed(target, index, id);
}

/**
 * `void glBeginTransformFeedback(GLenum primitiveMode)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param primitiveMode - `GLenum`, group `PrimitiveType`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBeginTransformFeedback.xhtml
 */
export function beginTransformFeedback(primitiveMode: PrimitiveType): void {
    glBeginTransformFeedback(primitiveMode);
}

/**
 * `void glBindAttribLocation(GLuint program, GLuint index, const GLchar *name)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param index - `GLuint`
 * @param name - `const GLchar *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindAttribLocation.xhtml
 */
export function bindAttribLocation(program: GLuint, index: GLuint, name: string): void {
    glBindAttribLocation(program, index, name);
}

/**
 * `void glBindBuffer(GLenum target, GLuint buffer)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param buffer - `GLuint`, object kind `buffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindBuffer.xhtml
 */
export function bindBuffer(target: BufferTargetARB, buffer: GLuint): void {
    glBindBuffer(target, buffer);
}

/**
 * `void glBindBufferBase(GLenum target, GLuint index, GLuint buffer)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param index - `GLuint`
 * @param buffer - `GLuint`, object kind `buffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindBufferBase.xhtml
 */
export function bindBufferBase(target: BufferTargetARB, index: GLuint, buffer: GLuint): void {
    glBindBufferBase(target, index, buffer);
}

/**
 * `void glBindBufferRange(GLenum target, GLuint index, GLuint buffer, GLintptr offset, GLsizeiptr size)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param index - `GLuint`
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindBufferRange.xhtml
 */
export function bindBufferRange(
    target: BufferTargetARB,
    index: GLuint,
    buffer: GLuint,
    offset: GLintptr,
    size: GLsizeiptr,
): void {
    glBindBufferRange(target, index, buffer, offset, size);
}

/**
 * `void glBindBuffersBase(GLenum target, GLuint first, GLsizei count, const GLuint *buffers)`
 *
 * Provided by `GL_VERSION_4_4`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param first - `GLuint`
 * @param count - `GLsizei`
 * @param buffers - `const GLuint *`, length `count`, object kind `buffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindBuffersBase.xhtml
 */
export function bindBuffersBase(
    target: BufferTargetARB,
    first: GLuint,
    count: GLsizei,
    buffers: readonly GLuint[] | Uint32Array,
): void {
    glBindBuffersBase(target, first, count, buffers);
}

/**
 * `void glBindBuffersRange(GLenum target, GLuint first, GLsizei count, const GLuint *buffers, const GLintptr *offsets, const GLsizeiptr *sizes)`
 *
 * Provided by `GL_VERSION_4_4`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param first - `GLuint`
 * @param count - `GLsizei`
 * @param buffers - `const GLuint *`, length `count`, object kind `buffer`
 * @param offsets - `const GLintptr *`, length `count`
 * @param sizes - `const GLsizeiptr *`, length `count`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindBuffersRange.xhtml
 */
export function bindBuffersRange(
    target: BufferTargetARB,
    first: GLuint,
    count: GLsizei,
    buffers: readonly GLuint[] | Uint32Array,
    offsets: readonly GLintptr[],
    sizes: readonly GLsizeiptr[],
): void {
    glBindBuffersRange(target, first, count, buffers, offsets, sizes);
}

/**
 * `void glBindFragDataLocation(GLuint program, GLuint color, const GLchar *name)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param color - `GLuint`
 * @param name - `const GLchar *`, length `COMPSIZE(name)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindFragDataLocation.xhtml
 */
export function bindFragDataLocation(program: GLuint, color: GLuint, name: string): void {
    glBindFragDataLocation(program, color, name);
}

/**
 * `void glBindFragDataLocationIndexed(GLuint program, GLuint colorNumber, GLuint index, const GLchar *name)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param colorNumber - `GLuint`
 * @param index - `GLuint`
 * @param name - `const GLchar *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindFragDataLocationIndexed.xhtml
 */
export function bindFragDataLocationIndexed(program: GLuint, colorNumber: GLuint, index: GLuint, name: string): void {
    glBindFragDataLocationIndexed(program, colorNumber, index, name);
}

/**
 * `void glBindFramebuffer(GLenum target, GLuint framebuffer)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindFramebuffer.xhtml
 */
export function bindFramebuffer(target: FramebufferTarget, framebuffer: GLuint): void {
    glBindFramebuffer(target, framebuffer);
}

/**
 * `void glBindImageTexture(GLuint unit, GLuint texture, GLint level, GLboolean layered, GLint layer, GLenum access, GLenum format)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param unit - `GLuint`
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param layered - `GLboolean`
 * @param layer - `GLint`
 * @param access - `GLenum`, group `BufferAccessARB`
 * @param format - `GLenum`, group `InternalFormat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindImageTexture.xhtml
 */
export function bindImageTexture(
    unit: GLuint,
    texture: GLuint,
    level: GLint,
    layered: boolean,
    layer: GLint,
    access: BufferAccessARB,
    format: InternalFormat,
): void {
    glBindImageTexture(unit, texture, level, layered, layer, access, format);
}

/**
 * `void glBindImageTextures(GLuint first, GLsizei count, const GLuint *textures)`
 *
 * Provided by `GL_VERSION_4_4`.
 *
 * @param first - `GLuint`
 * @param count - `GLsizei`
 * @param textures - `const GLuint *`, length `count`, object kind `texture`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindImageTextures.xhtml
 */
export function bindImageTextures(first: GLuint, count: GLsizei, textures: readonly GLuint[] | Uint32Array): void {
    glBindImageTextures(first, count, textures);
}

/**
 * `void glBindProgramPipeline(GLuint pipeline)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param pipeline - `GLuint`, object kind `program pipeline`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindProgramPipeline.xhtml
 */
export function bindProgramPipeline(pipeline: GLuint): void {
    glBindProgramPipeline(pipeline);
}

/**
 * `void glBindRenderbuffer(GLenum target, GLuint renderbuffer)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `RenderbufferTarget`
 * @param renderbuffer - `GLuint`, object kind `renderbuffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindRenderbuffer.xhtml
 */
export function bindRenderbuffer(target: RenderbufferTarget, renderbuffer: GLuint): void {
    glBindRenderbuffer(target, renderbuffer);
}

/**
 * `void glBindSampler(GLuint unit, GLuint sampler)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param unit - `GLuint`
 * @param sampler - `GLuint`, object kind `sampler`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindSampler.xhtml
 */
export function bindSampler(unit: GLuint, sampler: GLuint): void {
    glBindSampler(unit, sampler);
}

/**
 * `void glBindSamplers(GLuint first, GLsizei count, const GLuint *samplers)`
 *
 * Provided by `GL_VERSION_4_4`.
 *
 * @param first - `GLuint`
 * @param count - `GLsizei`
 * @param samplers - `const GLuint *`, length `count`, object kind `sampler`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindSamplers.xhtml
 */
export function bindSamplers(first: GLuint, count: GLsizei, samplers: readonly GLuint[] | Uint32Array): void {
    glBindSamplers(first, count, samplers);
}

/**
 * `void glBindTexture(GLenum target, GLuint texture)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param texture - `GLuint`, object kind `texture`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindTexture.xhtml
 */
export function bindTexture(target: TextureTarget, texture: GLuint): void {
    glBindTexture(target, texture);
}

/**
 * `void glBindTextures(GLuint first, GLsizei count, const GLuint *textures)`
 *
 * Provided by `GL_VERSION_4_4`.
 *
 * @param first - `GLuint`
 * @param count - `GLsizei`
 * @param textures - `const GLuint *`, length `count`, object kind `texture`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindTextures.xhtml
 */
export function bindTextures(first: GLuint, count: GLsizei, textures: readonly GLuint[] | Uint32Array): void {
    glBindTextures(first, count, textures);
}

/**
 * `void glBindTextureUnit(GLuint unit, GLuint texture)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param unit - `GLuint`
 * @param texture - `GLuint`, object kind `texture`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindTextureUnit.xhtml
 */
export function bindTextureUnit(unit: GLuint, texture: GLuint): void {
    glBindTextureUnit(unit, texture);
}

/**
 * `void glBindTransformFeedback(GLenum target, GLuint id)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param target - `GLenum`, group `BindTransformFeedbackTarget`
 * @param id - `GLuint`, object kind `transform feedback`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindTransformFeedback.xhtml
 */
export function bindTransformFeedback(target: BindTransformFeedbackTarget, id: GLuint): void {
    glBindTransformFeedback(target, id);
}

/**
 * `void glBindVertexArray(GLuint array)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param array - `GLuint`, object kind `vertex array`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindVertexArray.xhtml
 */
export function bindVertexArray(array: GLuint): void {
    glBindVertexArray(array);
}

/**
 * `void glBindVertexBuffer(GLuint bindingindex, GLuint buffer, GLintptr offset, GLsizei stride)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param bindingindex - `GLuint`
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param stride - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindVertexBuffer.xhtml
 */
export function bindVertexBuffer(bindingindex: GLuint, buffer: GLuint, offset: GLintptr, stride: GLsizei): void {
    glBindVertexBuffer(bindingindex, buffer, offset, stride);
}

/**
 * `void glBindVertexBuffers(GLuint first, GLsizei count, const GLuint *buffers, const GLintptr *offsets, const GLsizei *strides)`
 *
 * Provided by `GL_VERSION_4_4`.
 *
 * @param first - `GLuint`
 * @param count - `GLsizei`
 * @param buffers - `const GLuint *`, length `count`, object kind `buffer`
 * @param offsets - `const GLintptr *`, length `count`
 * @param strides - `const GLsizei *`, length `count`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindVertexBuffers.xhtml
 */
export function bindVertexBuffers(
    first: GLuint,
    count: GLsizei,
    buffers: readonly GLuint[] | Uint32Array,
    offsets: readonly GLintptr[],
    strides: readonly GLsizei[] | Int32Array,
): void {
    glBindVertexBuffers(first, count, buffers, offsets, strides);
}

/**
 * `void glBlendColor(GLfloat red, GLfloat green, GLfloat blue, GLfloat alpha)`
 *
 * Provided by `GL_VERSION_1_4`.
 *
 * @param red - `GLfloat`
 * @param green - `GLfloat`
 * @param blue - `GLfloat`
 * @param alpha - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendColor.xhtml
 */
export function blendColor(red: GLfloat, green: GLfloat, blue: GLfloat, alpha: GLfloat): void {
    glBlendColor(red, green, blue, alpha);
}

/**
 * `void glBlendEquation(GLenum mode)`
 *
 * Provided by `GL_VERSION_1_4`.
 *
 * @param mode - `GLenum`, group `BlendEquationModeEXT`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendEquation.xhtml
 */
export function blendEquation(mode: BlendEquationModeEXT): void {
    glBlendEquation(mode);
}

/**
 * `void glBlendEquationi(GLuint buf, GLenum mode)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param buf - `GLuint`
 * @param mode - `GLenum`, group `BlendEquationModeEXT`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendEquationi.xhtml
 */
export function blendEquationi(buf: GLuint, mode: BlendEquationModeEXT): void {
    glBlendEquationi(buf, mode);
}

/**
 * `void glBlendEquationSeparate(GLenum modeRGB, GLenum modeAlpha)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param modeRGB - `GLenum`, group `BlendEquationModeEXT`
 * @param modeAlpha - `GLenum`, group `BlendEquationModeEXT`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendEquationSeparate.xhtml
 */
export function blendEquationSeparate(modeRGB: BlendEquationModeEXT, modeAlpha: BlendEquationModeEXT): void {
    glBlendEquationSeparate(modeRGB, modeAlpha);
}

/**
 * `void glBlendEquationSeparatei(GLuint buf, GLenum modeRGB, GLenum modeAlpha)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param buf - `GLuint`
 * @param modeRGB - `GLenum`, group `BlendEquationModeEXT`
 * @param modeAlpha - `GLenum`, group `BlendEquationModeEXT`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendEquationSeparatei.xhtml
 */
export function blendEquationSeparatei(
    buf: GLuint,
    modeRGB: BlendEquationModeEXT,
    modeAlpha: BlendEquationModeEXT,
): void {
    glBlendEquationSeparatei(buf, modeRGB, modeAlpha);
}

/**
 * `void glBlendFunc(GLenum sfactor, GLenum dfactor)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param sfactor - `GLenum`, group `BlendingFactor`
 * @param dfactor - `GLenum`, group `BlendingFactor`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFunc.xhtml
 */
export function blendFunc(sfactor: BlendingFactor, dfactor: BlendingFactor): void {
    glBlendFunc(sfactor, dfactor);
}

/**
 * `void glBlendFunci(GLuint buf, GLenum src, GLenum dst)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param buf - `GLuint`
 * @param src - `GLenum`, group `BlendingFactor`
 * @param dst - `GLenum`, group `BlendingFactor`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFunci.xhtml
 */
export function blendFunci(buf: GLuint, src: BlendingFactor, dst: BlendingFactor): void {
    glBlendFunci(buf, src, dst);
}

/**
 * `void glBlendFuncSeparate(GLenum sfactorRGB, GLenum dfactorRGB, GLenum sfactorAlpha, GLenum dfactorAlpha)`
 *
 * Provided by `GL_VERSION_1_4`.
 *
 * @param sfactorRGB - `GLenum`, group `BlendingFactor`
 * @param dfactorRGB - `GLenum`, group `BlendingFactor`
 * @param sfactorAlpha - `GLenum`, group `BlendingFactor`
 * @param dfactorAlpha - `GLenum`, group `BlendingFactor`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFuncSeparate.xhtml
 */
export function blendFuncSeparate(
    sfactorRGB: BlendingFactor,
    dfactorRGB: BlendingFactor,
    sfactorAlpha: BlendingFactor,
    dfactorAlpha: BlendingFactor,
): void {
    glBlendFuncSeparate(sfactorRGB, dfactorRGB, sfactorAlpha, dfactorAlpha);
}

/**
 * `void glBlendFuncSeparatei(GLuint buf, GLenum srcRGB, GLenum dstRGB, GLenum srcAlpha, GLenum dstAlpha)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param buf - `GLuint`
 * @param srcRGB - `GLenum`, group `BlendingFactor`
 * @param dstRGB - `GLenum`, group `BlendingFactor`
 * @param srcAlpha - `GLenum`, group `BlendingFactor`
 * @param dstAlpha - `GLenum`, group `BlendingFactor`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFuncSeparatei.xhtml
 */
export function blendFuncSeparatei(
    buf: GLuint,
    srcRGB: BlendingFactor,
    dstRGB: BlendingFactor,
    srcAlpha: BlendingFactor,
    dstAlpha: BlendingFactor,
): void {
    glBlendFuncSeparatei(buf, srcRGB, dstRGB, srcAlpha, dstAlpha);
}

/**
 * `void glBlitFramebuffer(GLint srcX0, GLint srcY0, GLint srcX1, GLint srcY1, GLint dstX0, GLint dstY0, GLint dstX1, GLint dstY1, GLbitfield mask, GLenum filter)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param srcX0 - `GLint`
 * @param srcY0 - `GLint`
 * @param srcX1 - `GLint`
 * @param srcY1 - `GLint`
 * @param dstX0 - `GLint`
 * @param dstY0 - `GLint`
 * @param dstX1 - `GLint`
 * @param dstY1 - `GLint`
 * @param mask - `GLbitfield`, group `ClearBufferMask`
 * @param filter - `GLenum`, group `BlitFramebufferFilter`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlitFramebuffer.xhtml
 */
export function blitFramebuffer(
    srcX0: GLint,
    srcY0: GLint,
    srcX1: GLint,
    srcY1: GLint,
    dstX0: GLint,
    dstY0: GLint,
    dstX1: GLint,
    dstY1: GLint,
    mask: ClearBufferMask,
    filter: BlitFramebufferFilter,
): void {
    glBlitFramebuffer(srcX0, srcY0, srcX1, srcY1, dstX0, dstY0, dstX1, dstY1, mask, filter);
}

/**
 * `void glBlitNamedFramebuffer(GLuint readFramebuffer, GLuint drawFramebuffer, GLint srcX0, GLint srcY0, GLint srcX1, GLint srcY1, GLint dstX0, GLint dstY0, GLint dstX1, GLint dstY1, GLbitfield mask, GLenum filter)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param readFramebuffer - `GLuint`, object kind `framebuffer`
 * @param drawFramebuffer - `GLuint`, object kind `framebuffer`
 * @param srcX0 - `GLint`
 * @param srcY0 - `GLint`
 * @param srcX1 - `GLint`
 * @param srcY1 - `GLint`
 * @param dstX0 - `GLint`
 * @param dstY0 - `GLint`
 * @param dstX1 - `GLint`
 * @param dstY1 - `GLint`
 * @param mask - `GLbitfield`, group `ClearBufferMask`
 * @param filter - `GLenum`, group `BlitFramebufferFilter`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlitNamedFramebuffer.xhtml
 */
export function blitNamedFramebuffer(
    readFramebuffer: GLuint,
    drawFramebuffer: GLuint,
    srcX0: GLint,
    srcY0: GLint,
    srcX1: GLint,
    srcY1: GLint,
    dstX0: GLint,
    dstY0: GLint,
    dstX1: GLint,
    dstY1: GLint,
    mask: ClearBufferMask,
    filter: BlitFramebufferFilter,
): void {
    glBlitNamedFramebuffer(
        readFramebuffer,
        drawFramebuffer,
        srcX0,
        srcY0,
        srcX1,
        srcY1,
        dstX0,
        dstY0,
        dstX1,
        dstY1,
        mask,
        filter,
    );
}

/**
 * `void glBufferData(GLenum target, GLsizeiptr size, const void *data, GLenum usage)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param size - `GLsizeiptr`
 * @param data - `const void *`, length `size`
 * @param usage - `GLenum`, group `BufferUsageARB`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBufferData.xhtml
 */
export function bufferData(
    target: BufferTargetARB,
    size: GLsizeiptr,
    data: ArrayBufferView | GLintptr | null,
    usage: BufferUsageARB,
): void {
    glBufferData(target, size, data, usage);
}

/**
 * `void glBufferStorage(GLenum target, GLsizeiptr size, const void *data, GLbitfield flags)`
 *
 * Provided by `GL_VERSION_4_4`.
 *
 * @param target - `GLenum`, group `BufferStorageTarget`
 * @param size - `GLsizeiptr`
 * @param data - `const void *`, length `size`
 * @param flags - `GLbitfield`, group `BufferStorageMask`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBufferStorage.xhtml
 */
export function bufferStorage(
    target: BufferStorageTarget,
    size: GLsizeiptr,
    data: ArrayBufferView | GLintptr | null,
    flags: BufferStorageMask,
): void {
    glBufferStorage(target, size, data, flags);
}

/**
 * `void glBufferSubData(GLenum target, GLintptr offset, GLsizeiptr size, const void *data)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param offset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @param data - `const void *`, length `size`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBufferSubData.xhtml
 */
export function bufferSubData(
    target: BufferTargetARB,
    offset: GLintptr,
    size: GLsizeiptr,
    data: ArrayBufferView | GLintptr | null,
): void {
    glBufferSubData(target, offset, size, data);
}

/**
 * `GLenum glCheckFramebufferStatus(GLenum target)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @returns `GLenum`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCheckFramebufferStatus.xhtml
 */
export function checkFramebufferStatus(target: FramebufferTarget): FramebufferStatus {
    return glCheckFramebufferStatus(target) as FramebufferStatus;
}

/**
 * `GLenum glCheckNamedFramebufferStatus(GLuint framebuffer, GLenum target)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param target - `GLenum`, group `FramebufferTarget`
 * @returns `GLenum`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCheckNamedFramebufferStatus.xhtml
 */
export function checkNamedFramebufferStatus(framebuffer: GLuint, target: FramebufferTarget): FramebufferStatus {
    return glCheckNamedFramebufferStatus(framebuffer, target) as FramebufferStatus;
}

/**
 * `void glClampColor(GLenum target, GLenum clamp)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `ClampColorTargetARB`
 * @param clamp - `GLenum`, group `ClampColorModeARB`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClampColor.xhtml
 */
export function clampColor(target: ClampColorTargetARB, clamp: ClampColorModeARB): void {
    glClampColor(target, clamp);
}

/**
 * `void glClear(GLbitfield mask)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param mask - `GLbitfield`, group `ClearBufferMask`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClear.xhtml
 */
export function clear(mask: ClearBufferMask): void {
    glClear(mask);
}

/**
 * `void glClearBufferData(GLenum target, GLenum internalformat, GLenum format, GLenum type, const void *data)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param target - `GLenum`, group `BufferStorageTarget`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param data - `const void *`, length `COMPSIZE(format,type)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearBufferData.xhtml
 */
export function clearBufferData(
    target: BufferStorageTarget,
    internalformat: SizedInternalFormat,
    format: PixelFormat,
    type: PixelType,
    data: ArrayBufferView | GLintptr | null,
): void {
    glClearBufferData(target, internalformat, format, type, data);
}

/**
 * `void glClearBufferfi(GLenum buffer, GLint drawbuffer, GLfloat depth, GLint stencil)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param buffer - `GLenum`, group `Buffer`
 * @param drawbuffer - `GLint`
 * @param depth - `GLfloat`
 * @param stencil - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearBufferfi.xhtml
 */
export function clearBufferfi(buffer: Buffer, drawbuffer: GLint, depth: GLfloat, stencil: GLint): void {
    glClearBufferfi(buffer, drawbuffer, depth, stencil);
}

/**
 * `void glClearBufferfv(GLenum buffer, GLint drawbuffer, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param buffer - `GLenum`, group `Buffer`
 * @param drawbuffer - `GLint`
 * @param value - `const GLfloat *`, length `COMPSIZE(buffer)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearBufferfv.xhtml
 */
export function clearBufferfv(buffer: Buffer, drawbuffer: GLint, value: readonly GLfloat[] | Float32Array): void {
    glClearBufferfv(buffer, drawbuffer, value);
}

/**
 * `void glClearBufferiv(GLenum buffer, GLint drawbuffer, const GLint *value)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param buffer - `GLenum`, group `Buffer`
 * @param drawbuffer - `GLint`
 * @param value - `const GLint *`, length `COMPSIZE(buffer)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearBufferiv.xhtml
 */
export function clearBufferiv(buffer: Buffer, drawbuffer: GLint, value: readonly GLint[] | Int32Array): void {
    glClearBufferiv(buffer, drawbuffer, value);
}

/**
 * `void glClearBufferSubData(GLenum target, GLenum internalformat, GLintptr offset, GLsizeiptr size, GLenum format, GLenum type, const void *data)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param offset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param data - `const void *`, length `COMPSIZE(format,type)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearBufferSubData.xhtml
 */
export function clearBufferSubData(
    target: BufferTargetARB,
    internalformat: SizedInternalFormat,
    offset: GLintptr,
    size: GLsizeiptr,
    format: PixelFormat,
    type: PixelType,
    data: ArrayBufferView | GLintptr | null,
): void {
    glClearBufferSubData(target, internalformat, offset, size, format, type, data);
}

/**
 * `void glClearBufferuiv(GLenum buffer, GLint drawbuffer, const GLuint *value)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param buffer - `GLenum`, group `Buffer`
 * @param drawbuffer - `GLint`
 * @param value - `const GLuint *`, length `COMPSIZE(buffer)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearBufferuiv.xhtml
 */
export function clearBufferuiv(buffer: Buffer, drawbuffer: GLint, value: readonly GLuint[] | Uint32Array): void {
    glClearBufferuiv(buffer, drawbuffer, value);
}

/**
 * `void glClearColor(GLfloat red, GLfloat green, GLfloat blue, GLfloat alpha)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param red - `GLfloat`
 * @param green - `GLfloat`
 * @param blue - `GLfloat`
 * @param alpha - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearColor.xhtml
 */
export function clearColor(red: GLfloat, green: GLfloat, blue: GLfloat, alpha: GLfloat): void {
    glClearColor(red, green, blue, alpha);
}

/**
 * `void glClearDepth(GLdouble depth)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param depth - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearDepth.xhtml
 */
export function clearDepth(depth: GLdouble): void {
    glClearDepth(depth);
}

/**
 * `void glClearDepthf(GLfloat d)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param d - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearDepthf.xhtml
 */
export function clearDepthf(d: GLfloat): void {
    glClearDepthf(d);
}

/**
 * `void glClearNamedBufferData(GLuint buffer, GLenum internalformat, GLenum format, GLenum type, const void *data)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param data - `const void *`, length `COMPSIZE(format,type)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearNamedBufferData.xhtml
 */
export function clearNamedBufferData(
    buffer: GLuint,
    internalformat: SizedInternalFormat,
    format: PixelFormat,
    type: PixelType,
    data: ArrayBufferView | GLintptr | null,
): void {
    glClearNamedBufferData(buffer, internalformat, format, type, data);
}

/**
 * `void glClearNamedBufferSubData(GLuint buffer, GLenum internalformat, GLintptr offset, GLsizeiptr size, GLenum format, GLenum type, const void *data)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param offset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param data - `const void *`, length `COMPSIZE(format,type)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearNamedBufferSubData.xhtml
 */
export function clearNamedBufferSubData(
    buffer: GLuint,
    internalformat: SizedInternalFormat,
    offset: GLintptr,
    size: GLsizeiptr,
    format: PixelFormat,
    type: PixelType,
    data: ArrayBufferView | GLintptr | null,
): void {
    glClearNamedBufferSubData(buffer, internalformat, offset, size, format, type, data);
}

/**
 * `void glClearNamedFramebufferfi(GLuint framebuffer, GLenum buffer, GLint drawbuffer, GLfloat depth, GLint stencil)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param buffer - `GLenum`, group `Buffer`
 * @param drawbuffer - `GLint`
 * @param depth - `GLfloat`
 * @param stencil - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearNamedFramebufferfi.xhtml
 */
export function clearNamedFramebufferfi(
    framebuffer: GLuint,
    buffer: Buffer,
    drawbuffer: GLint,
    depth: GLfloat,
    stencil: GLint,
): void {
    glClearNamedFramebufferfi(framebuffer, buffer, drawbuffer, depth, stencil);
}

/**
 * `void glClearNamedFramebufferfv(GLuint framebuffer, GLenum buffer, GLint drawbuffer, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param buffer - `GLenum`, group `Buffer`
 * @param drawbuffer - `GLint`
 * @param value - `const GLfloat *`, length `COMPSIZE(buffer)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearNamedFramebufferfv.xhtml
 */
export function clearNamedFramebufferfv(
    framebuffer: GLuint,
    buffer: Buffer,
    drawbuffer: GLint,
    value: readonly GLfloat[] | Float32Array,
): void {
    glClearNamedFramebufferfv(framebuffer, buffer, drawbuffer, value);
}

/**
 * `void glClearNamedFramebufferiv(GLuint framebuffer, GLenum buffer, GLint drawbuffer, const GLint *value)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param buffer - `GLenum`, group `Buffer`
 * @param drawbuffer - `GLint`
 * @param value - `const GLint *`, length `COMPSIZE(buffer)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearNamedFramebufferiv.xhtml
 */
export function clearNamedFramebufferiv(
    framebuffer: GLuint,
    buffer: Buffer,
    drawbuffer: GLint,
    value: readonly GLint[] | Int32Array,
): void {
    glClearNamedFramebufferiv(framebuffer, buffer, drawbuffer, value);
}

/**
 * `void glClearNamedFramebufferuiv(GLuint framebuffer, GLenum buffer, GLint drawbuffer, const GLuint *value)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param buffer - `GLenum`, group `Buffer`
 * @param drawbuffer - `GLint`
 * @param value - `const GLuint *`, length `COMPSIZE(buffer)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearNamedFramebufferuiv.xhtml
 */
export function clearNamedFramebufferuiv(
    framebuffer: GLuint,
    buffer: Buffer,
    drawbuffer: GLint,
    value: readonly GLuint[] | Uint32Array,
): void {
    glClearNamedFramebufferuiv(framebuffer, buffer, drawbuffer, value);
}

/**
 * `void glClearStencil(GLint s)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param s - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearStencil.xhtml
 */
export function clearStencil(s: GLint): void {
    glClearStencil(s);
}

/**
 * `void glClearTexImage(GLuint texture, GLint level, GLenum format, GLenum type, const void *data)`
 *
 * Provided by `GL_VERSION_4_4`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param data - `const void *`, length `COMPSIZE(format,type)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearTexImage.xhtml
 */
export function clearTexImage(
    texture: GLuint,
    level: GLint,
    format: PixelFormat,
    type: PixelType,
    data: ArrayBufferView | GLintptr | null,
): void {
    glClearTexImage(texture, level, format, type, data);
}

/**
 * `void glClearTexSubImage(GLuint texture, GLint level, GLint xoffset, GLint yoffset, GLint zoffset, GLsizei width, GLsizei height, GLsizei depth, GLenum format, GLenum type, const void *data)`
 *
 * Provided by `GL_VERSION_4_4`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param zoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param data - `const void *`, length `COMPSIZE(format,type)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearTexSubImage.xhtml
 */
export function clearTexSubImage(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    format: PixelFormat,
    type: PixelType,
    data: ArrayBufferView | GLintptr | null,
): void {
    glClearTexSubImage(texture, level, xoffset, yoffset, zoffset, width, height, depth, format, type, data);
}

/**
 * `GLenum glClientWaitSync(GLsync sync, GLbitfield flags, GLuint64 timeout)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param sync - `GLsync`, object kind `sync`
 * @param flags - `GLbitfield`, group `SyncObjectMask`
 * @param timeout - `GLuint64`
 * @returns `GLenum`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClientWaitSync.xhtml
 */
export function clientWaitSync(sync: GLsync, flags: SyncObjectMask, timeout: GLuint64): SyncStatus {
    return glClientWaitSync(sync, flags, timeout) as SyncStatus;
}

/**
 * `void glClipControl(GLenum origin, GLenum depth)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param origin - `GLenum`, group `ClipControlOrigin`
 * @param depth - `GLenum`, group `ClipControlDepth`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClipControl.xhtml
 */
export function clipControl(origin: ClipControlOrigin, depth: ClipControlDepth): void {
    glClipControl(origin, depth);
}

/**
 * `void glColorMask(GLboolean red, GLboolean green, GLboolean blue, GLboolean alpha)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param red - `GLboolean`
 * @param green - `GLboolean`
 * @param blue - `GLboolean`
 * @param alpha - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glColorMask.xhtml
 */
export function colorMask(red: boolean, green: boolean, blue: boolean, alpha: boolean): void {
    glColorMask(red, green, blue, alpha);
}

/**
 * `void glColorMaski(GLuint index, GLboolean r, GLboolean g, GLboolean b, GLboolean a)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param r - `GLboolean`
 * @param g - `GLboolean`
 * @param b - `GLboolean`
 * @param a - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glColorMaski.xhtml
 */
export function colorMaski(index: GLuint, r: boolean, g: boolean, b: boolean, a: boolean): void {
    glColorMaski(index, r, g, b, a);
}

/**
 * `void glCompileShader(GLuint shader)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param shader - `GLuint`, object kind `shader`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCompileShader.xhtml
 */
export function compileShader(shader: GLuint): void {
    glCompileShader(shader);
}

/**
 * `void glCompressedTexImage1D(GLenum target, GLint level, GLenum internalformat, GLsizei width, GLint border, GLsizei imageSize, const void *data)`
 *
 * Provided by `GL_VERSION_1_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param border - `GLint`
 * @param imageSize - `GLsizei`
 * @param data - `const void *`, length `imageSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCompressedTexImage1D.xhtml
 */
export function compressedTexImage1D(
    target: TextureTarget,
    level: GLint,
    internalformat: InternalFormat,
    width: GLsizei,
    border: GLint,
    imageSize: GLsizei,
    data: ArrayBufferView | GLintptr | null,
): void {
    glCompressedTexImage1D(target, level, internalformat, width, border, imageSize, data);
}

/**
 * `void glCompressedTexImage2D(GLenum target, GLint level, GLenum internalformat, GLsizei width, GLsizei height, GLint border, GLsizei imageSize, const void *data)`
 *
 * Provided by `GL_VERSION_1_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param border - `GLint`
 * @param imageSize - `GLsizei`
 * @param data - `const void *`, length `imageSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCompressedTexImage2D.xhtml
 */
export function compressedTexImage2D(
    target: TextureTarget,
    level: GLint,
    internalformat: InternalFormat,
    width: GLsizei,
    height: GLsizei,
    border: GLint,
    imageSize: GLsizei,
    data: ArrayBufferView | GLintptr | null,
): void {
    glCompressedTexImage2D(target, level, internalformat, width, height, border, imageSize, data);
}

/**
 * `void glCompressedTexImage3D(GLenum target, GLint level, GLenum internalformat, GLsizei width, GLsizei height, GLsizei depth, GLint border, GLsizei imageSize, const void *data)`
 *
 * Provided by `GL_VERSION_1_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param border - `GLint`
 * @param imageSize - `GLsizei`
 * @param data - `const void *`, length `imageSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCompressedTexImage3D.xhtml
 */
export function compressedTexImage3D(
    target: TextureTarget,
    level: GLint,
    internalformat: InternalFormat,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    border: GLint,
    imageSize: GLsizei,
    data: ArrayBufferView | GLintptr | null,
): void {
    glCompressedTexImage3D(target, level, internalformat, width, height, depth, border, imageSize, data);
}

/**
 * `void glCompressedTexSubImage1D(GLenum target, GLint level, GLint xoffset, GLsizei width, GLenum format, GLsizei imageSize, const void *data)`
 *
 * Provided by `GL_VERSION_1_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param width - `GLsizei`
 * @param format - `GLenum`, group `InternalFormat`
 * @param imageSize - `GLsizei`
 * @param data - `const void *`, length `imageSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCompressedTexSubImage1D.xhtml
 */
export function compressedTexSubImage1D(
    target: TextureTarget,
    level: GLint,
    xoffset: GLint,
    width: GLsizei,
    format: InternalFormat,
    imageSize: GLsizei,
    data: ArrayBufferView | GLintptr | null,
): void {
    glCompressedTexSubImage1D(target, level, xoffset, width, format, imageSize, data);
}

/**
 * `void glCompressedTexSubImage2D(GLenum target, GLint level, GLint xoffset, GLint yoffset, GLsizei width, GLsizei height, GLenum format, GLsizei imageSize, const void *data)`
 *
 * Provided by `GL_VERSION_1_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param format - `GLenum`, group `InternalFormat`
 * @param imageSize - `GLsizei`
 * @param data - `const void *`, length `imageSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCompressedTexSubImage2D.xhtml
 */
export function compressedTexSubImage2D(
    target: TextureTarget,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    format: InternalFormat,
    imageSize: GLsizei,
    data: ArrayBufferView | GLintptr | null,
): void {
    glCompressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, imageSize, data);
}

/**
 * `void glCompressedTexSubImage3D(GLenum target, GLint level, GLint xoffset, GLint yoffset, GLint zoffset, GLsizei width, GLsizei height, GLsizei depth, GLenum format, GLsizei imageSize, const void *data)`
 *
 * Provided by `GL_VERSION_1_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param zoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param format - `GLenum`, group `InternalFormat`
 * @param imageSize - `GLsizei`
 * @param data - `const void *`, length `imageSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCompressedTexSubImage3D.xhtml
 */
export function compressedTexSubImage3D(
    target: TextureTarget,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    format: InternalFormat,
    imageSize: GLsizei,
    data: ArrayBufferView | GLintptr | null,
): void {
    glCompressedTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, imageSize, data);
}

/**
 * `void glCompressedTextureSubImage1D(GLuint texture, GLint level, GLint xoffset, GLsizei width, GLenum format, GLsizei imageSize, const void *data)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param width - `GLsizei`
 * @param format - `GLenum`, group `InternalFormat`
 * @param imageSize - `GLsizei`
 * @param data - `const void *`, length `imageSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCompressedTextureSubImage1D.xhtml
 */
export function compressedTextureSubImage1D(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    width: GLsizei,
    format: InternalFormat,
    imageSize: GLsizei,
    data: ArrayBufferView | GLintptr | null,
): void {
    glCompressedTextureSubImage1D(texture, level, xoffset, width, format, imageSize, data);
}

/**
 * `void glCompressedTextureSubImage2D(GLuint texture, GLint level, GLint xoffset, GLint yoffset, GLsizei width, GLsizei height, GLenum format, GLsizei imageSize, const void *data)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param format - `GLenum`, group `InternalFormat`
 * @param imageSize - `GLsizei`
 * @param data - `const void *`, length `imageSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCompressedTextureSubImage2D.xhtml
 */
export function compressedTextureSubImage2D(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    format: InternalFormat,
    imageSize: GLsizei,
    data: ArrayBufferView | GLintptr | null,
): void {
    glCompressedTextureSubImage2D(texture, level, xoffset, yoffset, width, height, format, imageSize, data);
}

/**
 * `void glCompressedTextureSubImage3D(GLuint texture, GLint level, GLint xoffset, GLint yoffset, GLint zoffset, GLsizei width, GLsizei height, GLsizei depth, GLenum format, GLsizei imageSize, const void *data)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param zoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param format - `GLenum`, group `InternalFormat`
 * @param imageSize - `GLsizei`
 * @param data - `const void *`, length `imageSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCompressedTextureSubImage3D.xhtml
 */
export function compressedTextureSubImage3D(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    format: InternalFormat,
    imageSize: GLsizei,
    data: ArrayBufferView | GLintptr | null,
): void {
    glCompressedTextureSubImage3D(
        texture,
        level,
        xoffset,
        yoffset,
        zoffset,
        width,
        height,
        depth,
        format,
        imageSize,
        data,
    );
}

/**
 * `void glCopyBufferSubData(GLenum readTarget, GLenum writeTarget, GLintptr readOffset, GLintptr writeOffset, GLsizeiptr size)`
 *
 * Provided by `GL_VERSION_3_1`.
 *
 * @param readTarget - `GLenum`, group `CopyBufferSubDataTarget`
 * @param writeTarget - `GLenum`, group `CopyBufferSubDataTarget`
 * @param readOffset - `GLintptr`
 * @param writeOffset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyBufferSubData.xhtml
 */
export function copyBufferSubData(
    readTarget: CopyBufferSubDataTarget,
    writeTarget: CopyBufferSubDataTarget,
    readOffset: GLintptr,
    writeOffset: GLintptr,
    size: GLsizeiptr,
): void {
    glCopyBufferSubData(readTarget, writeTarget, readOffset, writeOffset, size);
}

/**
 * `void glCopyImageSubData(GLuint srcName, GLenum srcTarget, GLint srcLevel, GLint srcX, GLint srcY, GLint srcZ, GLuint dstName, GLenum dstTarget, GLint dstLevel, GLint dstX, GLint dstY, GLint dstZ, GLsizei srcWidth, GLsizei srcHeight, GLsizei srcDepth)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param srcName - `GLuint`
 * @param srcTarget - `GLenum`, group `CopyImageSubDataTarget`
 * @param srcLevel - `GLint`
 * @param srcX - `GLint`
 * @param srcY - `GLint`
 * @param srcZ - `GLint`
 * @param dstName - `GLuint`
 * @param dstTarget - `GLenum`, group `CopyImageSubDataTarget`
 * @param dstLevel - `GLint`
 * @param dstX - `GLint`
 * @param dstY - `GLint`
 * @param dstZ - `GLint`
 * @param srcWidth - `GLsizei`
 * @param srcHeight - `GLsizei`
 * @param srcDepth - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyImageSubData.xhtml
 */
export function copyImageSubData(
    srcName: GLuint,
    srcTarget: CopyImageSubDataTarget,
    srcLevel: GLint,
    srcX: GLint,
    srcY: GLint,
    srcZ: GLint,
    dstName: GLuint,
    dstTarget: CopyImageSubDataTarget,
    dstLevel: GLint,
    dstX: GLint,
    dstY: GLint,
    dstZ: GLint,
    srcWidth: GLsizei,
    srcHeight: GLsizei,
    srcDepth: GLsizei,
): void {
    glCopyImageSubData(
        srcName,
        srcTarget,
        srcLevel,
        srcX,
        srcY,
        srcZ,
        dstName,
        dstTarget,
        dstLevel,
        dstX,
        dstY,
        dstZ,
        srcWidth,
        srcHeight,
        srcDepth,
    );
}

/**
 * `void glCopyNamedBufferSubData(GLuint readBuffer, GLuint writeBuffer, GLintptr readOffset, GLintptr writeOffset, GLsizeiptr size)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param readBuffer - `GLuint`, object kind `buffer`
 * @param writeBuffer - `GLuint`, object kind `buffer`
 * @param readOffset - `GLintptr`
 * @param writeOffset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyNamedBufferSubData.xhtml
 */
export function copyNamedBufferSubData(
    readBuffer: GLuint,
    writeBuffer: GLuint,
    readOffset: GLintptr,
    writeOffset: GLintptr,
    size: GLsizeiptr,
): void {
    glCopyNamedBufferSubData(readBuffer, writeBuffer, readOffset, writeOffset, size);
}

/**
 * `void glCopyTexImage1D(GLenum target, GLint level, GLenum internalformat, GLint x, GLint y, GLsizei width, GLint border)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param border - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyTexImage1D.xhtml
 */
export function copyTexImage1D(
    target: TextureTarget,
    level: GLint,
    internalformat: InternalFormat,
    x: GLint,
    y: GLint,
    width: GLsizei,
    border: GLint,
): void {
    glCopyTexImage1D(target, level, internalformat, x, y, width, border);
}

/**
 * `void glCopyTexImage2D(GLenum target, GLint level, GLenum internalformat, GLint x, GLint y, GLsizei width, GLsizei height, GLint border)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param border - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyTexImage2D.xhtml
 */
export function copyTexImage2D(
    target: TextureTarget,
    level: GLint,
    internalformat: InternalFormat,
    x: GLint,
    y: GLint,
    width: GLsizei,
    height: GLsizei,
    border: GLint,
): void {
    glCopyTexImage2D(target, level, internalformat, x, y, width, height, border);
}

/**
 * `void glCopyTexSubImage1D(GLenum target, GLint level, GLint xoffset, GLint x, GLint y, GLsizei width)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyTexSubImage1D.xhtml
 */
export function copyTexSubImage1D(
    target: TextureTarget,
    level: GLint,
    xoffset: GLint,
    x: GLint,
    y: GLint,
    width: GLsizei,
): void {
    glCopyTexSubImage1D(target, level, xoffset, x, y, width);
}

/**
 * `void glCopyTexSubImage2D(GLenum target, GLint level, GLint xoffset, GLint yoffset, GLint x, GLint y, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyTexSubImage2D.xhtml
 */
export function copyTexSubImage2D(
    target: TextureTarget,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    x: GLint,
    y: GLint,
    width: GLsizei,
    height: GLsizei,
): void {
    glCopyTexSubImage2D(target, level, xoffset, yoffset, x, y, width, height);
}

/**
 * `void glCopyTexSubImage3D(GLenum target, GLint level, GLint xoffset, GLint yoffset, GLint zoffset, GLint x, GLint y, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_1_2`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param zoffset - `GLint`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyTexSubImage3D.xhtml
 */
export function copyTexSubImage3D(
    target: TextureTarget,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    x: GLint,
    y: GLint,
    width: GLsizei,
    height: GLsizei,
): void {
    glCopyTexSubImage3D(target, level, xoffset, yoffset, zoffset, x, y, width, height);
}

/**
 * `void glCopyTextureSubImage1D(GLuint texture, GLint level, GLint xoffset, GLint x, GLint y, GLsizei width)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyTextureSubImage1D.xhtml
 */
export function copyTextureSubImage1D(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    x: GLint,
    y: GLint,
    width: GLsizei,
): void {
    glCopyTextureSubImage1D(texture, level, xoffset, x, y, width);
}

/**
 * `void glCopyTextureSubImage2D(GLuint texture, GLint level, GLint xoffset, GLint yoffset, GLint x, GLint y, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyTextureSubImage2D.xhtml
 */
export function copyTextureSubImage2D(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    x: GLint,
    y: GLint,
    width: GLsizei,
    height: GLsizei,
): void {
    glCopyTextureSubImage2D(texture, level, xoffset, yoffset, x, y, width, height);
}

/**
 * `void glCopyTextureSubImage3D(GLuint texture, GLint level, GLint xoffset, GLint yoffset, GLint zoffset, GLint x, GLint y, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param zoffset - `GLint`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyTextureSubImage3D.xhtml
 */
export function copyTextureSubImage3D(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    x: GLint,
    y: GLint,
    width: GLsizei,
    height: GLsizei,
): void {
    glCopyTextureSubImage3D(texture, level, xoffset, yoffset, zoffset, x, y, width, height);
}

/**
 * `void glCreateBuffers(GLsizei n, GLuint *buffers)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param n - `GLsizei`
 * @returns `buffers` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateBuffers.xhtml
 */
export function createBuffers(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glCreateBuffers(n, out0);
    return out0.value;
}

/**
 * `void glCreateFramebuffers(GLsizei n, GLuint *framebuffers)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param n - `GLsizei`
 * @returns `framebuffers` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateFramebuffers.xhtml
 */
export function createFramebuffers(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glCreateFramebuffers(n, out0);
    return out0.value;
}

/**
 * `GLuint glCreateProgram()`
 *
 * Provided by `GL_VERSION_2_0`.
 * @returns `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateProgram.xhtml
 */
export function createProgram(): GLuint {
    return glCreateProgram() as GLuint;
}

/**
 * `void glCreateProgramPipelines(GLsizei n, GLuint *pipelines)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param n - `GLsizei`
 * @returns `pipelines` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateProgramPipelines.xhtml
 */
export function createProgramPipelines(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glCreateProgramPipelines(n, out0);
    return out0.value;
}

/**
 * `void glCreateQueries(GLenum target, GLsizei n, GLuint *ids)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param target - `GLenum`, group `QueryTarget`
 * @param n - `GLsizei`
 * @returns `ids` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateQueries.xhtml
 */
export function createQueries(target: QueryTarget, n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glCreateQueries(target, n, out0);
    return out0.value;
}

/**
 * `void glCreateRenderbuffers(GLsizei n, GLuint *renderbuffers)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param n - `GLsizei`
 * @returns `renderbuffers` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateRenderbuffers.xhtml
 */
export function createRenderbuffers(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glCreateRenderbuffers(n, out0);
    return out0.value;
}

/**
 * `void glCreateSamplers(GLsizei n, GLuint *samplers)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param n - `GLsizei`
 * @returns `samplers` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateSamplers.xhtml
 */
export function createSamplers(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glCreateSamplers(n, out0);
    return out0.value;
}

/**
 * `GLuint glCreateShader(GLenum type)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param type - `GLenum`, group `ShaderType`
 * @returns `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateShader.xhtml
 */
export function createShader(type: ShaderType): GLuint {
    return glCreateShader(type) as GLuint;
}

/**
 * `GLuint glCreateShaderProgramv(GLenum type, GLsizei count, const GLchar *const*strings)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param type - `GLenum`, group `ShaderType`
 * @param count - `GLsizei`
 * @param strings - `const GLchar *const*`, length `count`
 * @returns `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateShaderProgramv.xhtml
 */
export function createShaderProgramv(type: ShaderType, count: GLsizei, strings: readonly string[]): GLuint {
    return glCreateShaderProgramv(type, count, strings) as GLuint;
}

/**
 * `void glCreateTextures(GLenum target, GLsizei n, GLuint *textures)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param n - `GLsizei`
 * @returns `textures` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateTextures.xhtml
 */
export function createTextures(target: TextureTarget, n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glCreateTextures(target, n, out0);
    return out0.value;
}

/**
 * `void glCreateTransformFeedbacks(GLsizei n, GLuint *ids)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param n - `GLsizei`
 * @returns `ids` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateTransformFeedbacks.xhtml
 */
export function createTransformFeedbacks(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glCreateTransformFeedbacks(n, out0);
    return out0.value;
}

/**
 * `void glCreateVertexArrays(GLsizei n, GLuint *arrays)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param n - `GLsizei`
 * @returns `arrays` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateVertexArrays.xhtml
 */
export function createVertexArrays(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glCreateVertexArrays(n, out0);
    return out0.value;
}

/**
 * `void glCullFace(GLenum mode)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param mode - `GLenum`, group `TriangleFace`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCullFace.xhtml
 */
export function cullFace(mode: TriangleFace): void {
    glCullFace(mode);
}

/**
 * `void glDebugMessageControl(GLenum source, GLenum type, GLenum severity, GLsizei count, const GLuint *ids, GLboolean enabled)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param source - `GLenum`, group `DebugSource`
 * @param type - `GLenum`, group `DebugType`
 * @param severity - `GLenum`, group `DebugSeverity`
 * @param count - `GLsizei`
 * @param ids - `const GLuint *`, length `count`
 * @param enabled - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDebugMessageControl.xhtml
 */
export function debugMessageControl(
    source: DebugSource,
    type: DebugType,
    severity: DebugSeverity,
    count: GLsizei,
    ids: readonly GLuint[] | Uint32Array,
    enabled: boolean,
): void {
    glDebugMessageControl(source, type, severity, count, ids, enabled);
}

/**
 * `void glDebugMessageInsert(GLenum source, GLenum type, GLuint id, GLenum severity, GLsizei length, const GLchar *buf)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param source - `GLenum`, group `DebugSource`
 * @param type - `GLenum`, group `DebugType`
 * @param id - `GLuint`
 * @param severity - `GLenum`, group `DebugSeverity`
 * @param length - `GLsizei`
 * @param buf - `const GLchar *`, length `COMPSIZE(buf,length)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDebugMessageInsert.xhtml
 */
export function debugMessageInsert(
    source: DebugSource,
    type: DebugType,
    id: GLuint,
    severity: DebugSeverity,
    length: GLsizei,
    buf: string,
): void {
    glDebugMessageInsert(source, type, id, severity, length, buf);
}

/**
 * `void glDeleteBuffers(GLsizei n, const GLuint *buffers)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param n - `GLsizei`
 * @param buffers - `const GLuint *`, length `n`, object kind `buffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteBuffers.xhtml
 */
export function deleteBuffers(n: GLsizei, buffers: readonly GLuint[] | Uint32Array): void {
    glDeleteBuffers(n, buffers);
}

/**
 * `void glDeleteFramebuffers(GLsizei n, const GLuint *framebuffers)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param n - `GLsizei`
 * @param framebuffers - `const GLuint *`, length `n`, object kind `framebuffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteFramebuffers.xhtml
 */
export function deleteFramebuffers(n: GLsizei, framebuffers: readonly GLuint[] | Uint32Array): void {
    glDeleteFramebuffers(n, framebuffers);
}

/**
 * `void glDeleteProgram(GLuint program)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteProgram.xhtml
 */
export function deleteProgram(program: GLuint): void {
    glDeleteProgram(program);
}

/**
 * `void glDeleteProgramPipelines(GLsizei n, const GLuint *pipelines)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param n - `GLsizei`
 * @param pipelines - `const GLuint *`, length `n`, object kind `program pipeline`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteProgramPipelines.xhtml
 */
export function deleteProgramPipelines(n: GLsizei, pipelines: readonly GLuint[] | Uint32Array): void {
    glDeleteProgramPipelines(n, pipelines);
}

/**
 * `void glDeleteQueries(GLsizei n, const GLuint *ids)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param n - `GLsizei`
 * @param ids - `const GLuint *`, length `n`, object kind `query`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteQueries.xhtml
 */
export function deleteQueries(n: GLsizei, ids: readonly GLuint[] | Uint32Array): void {
    glDeleteQueries(n, ids);
}

/**
 * `void glDeleteRenderbuffers(GLsizei n, const GLuint *renderbuffers)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param n - `GLsizei`
 * @param renderbuffers - `const GLuint *`, length `n`, object kind `renderbuffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteRenderbuffers.xhtml
 */
export function deleteRenderbuffers(n: GLsizei, renderbuffers: readonly GLuint[] | Uint32Array): void {
    glDeleteRenderbuffers(n, renderbuffers);
}

/**
 * `void glDeleteSamplers(GLsizei count, const GLuint *samplers)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param count - `GLsizei`
 * @param samplers - `const GLuint *`, length `count`, object kind `sampler`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteSamplers.xhtml
 */
export function deleteSamplers(count: GLsizei, samplers: readonly GLuint[] | Uint32Array): void {
    glDeleteSamplers(count, samplers);
}

/**
 * `void glDeleteShader(GLuint shader)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param shader - `GLuint`, object kind `shader`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteShader.xhtml
 */
export function deleteShader(shader: GLuint): void {
    glDeleteShader(shader);
}

/**
 * `void glDeleteSync(GLsync sync)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param sync - `GLsync`, object kind `sync`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteSync.xhtml
 */
export function deleteSync(sync: GLsync): void {
    glDeleteSync(sync);
}

/**
 * `void glDeleteTextures(GLsizei n, const GLuint *textures)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param n - `GLsizei`
 * @param textures - `const GLuint *`, length `n`, object kind `texture`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteTextures.xhtml
 */
export function deleteTextures(n: GLsizei, textures: readonly GLuint[] | Uint32Array): void {
    glDeleteTextures(n, textures);
}

/**
 * `void glDeleteTransformFeedbacks(GLsizei n, const GLuint *ids)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param n - `GLsizei`
 * @param ids - `const GLuint *`, length `n`, object kind `transform feedback`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteTransformFeedbacks.xhtml
 */
export function deleteTransformFeedbacks(n: GLsizei, ids: readonly GLuint[] | Uint32Array): void {
    glDeleteTransformFeedbacks(n, ids);
}

/**
 * `void glDeleteVertexArrays(GLsizei n, const GLuint *arrays)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param n - `GLsizei`
 * @param arrays - `const GLuint *`, length `n`, object kind `vertex array`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteVertexArrays.xhtml
 */
export function deleteVertexArrays(n: GLsizei, arrays: readonly GLuint[] | Uint32Array): void {
    glDeleteVertexArrays(n, arrays);
}

/**
 * `void glDepthFunc(GLenum func)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param func - `GLenum`, group `DepthFunction`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDepthFunc.xhtml
 */
export function depthFunc(func: DepthFunction): void {
    glDepthFunc(func);
}

/**
 * `void glDepthMask(GLboolean flag)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param flag - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDepthMask.xhtml
 */
export function depthMask(flag: boolean): void {
    glDepthMask(flag);
}

/**
 * `void glDepthRange(GLdouble n, GLdouble f)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param n - `GLdouble`
 * @param f - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDepthRange.xhtml
 */
export function depthRange(n: GLdouble, f: GLdouble): void {
    glDepthRange(n, f);
}

/**
 * `void glDepthRangeArrayv(GLuint first, GLsizei count, const GLdouble *v)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param first - `GLuint`
 * @param count - `GLsizei`
 * @param v - `const GLdouble *`, length `COMPSIZE(count)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDepthRangeArrayv.xhtml
 */
export function depthRangeArrayv(first: GLuint, count: GLsizei, v: readonly GLdouble[] | Float64Array): void {
    glDepthRangeArrayv(first, count, v);
}

/**
 * `void glDepthRangef(GLfloat n, GLfloat f)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param n - `GLfloat`
 * @param f - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDepthRangef.xhtml
 */
export function depthRangef(n: GLfloat, f: GLfloat): void {
    glDepthRangef(n, f);
}

/**
 * `void glDepthRangeIndexed(GLuint index, GLdouble n, GLdouble f)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param n - `GLdouble`
 * @param f - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDepthRangeIndexed.xhtml
 */
export function depthRangeIndexed(index: GLuint, n: GLdouble, f: GLdouble): void {
    glDepthRangeIndexed(index, n, f);
}

/**
 * `void glDetachShader(GLuint program, GLuint shader)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param shader - `GLuint`, object kind `shader`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDetachShader.xhtml
 */
export function detachShader(program: GLuint, shader: GLuint): void {
    glDetachShader(program, shader);
}

/**
 * `void glDisable(GLenum cap)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param cap - `GLenum`, group `EnableCap`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDisable.xhtml
 */
export function disable(cap: EnableCap): void {
    glDisable(cap);
}

/**
 * `void glDisablei(GLenum target, GLuint index)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `EnableCap`
 * @param index - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDisablei.xhtml
 */
export function disablei(target: EnableCap, index: GLuint): void {
    glDisablei(target, index);
}

/**
 * `void glDisableVertexArrayAttrib(GLuint vaobj, GLuint index)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param index - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDisableVertexArrayAttrib.xhtml
 */
export function disableVertexArrayAttrib(vaobj: GLuint, index: GLuint): void {
    glDisableVertexArrayAttrib(vaobj, index);
}

/**
 * `void glDisableVertexAttribArray(GLuint index)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDisableVertexAttribArray.xhtml
 */
export function disableVertexAttribArray(index: GLuint): void {
    glDisableVertexAttribArray(index);
}

/**
 * `void glDispatchCompute(GLuint num_groups_x, GLuint num_groups_y, GLuint num_groups_z)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param num_groups_x - `GLuint`
 * @param num_groups_y - `GLuint`
 * @param num_groups_z - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDispatchCompute.xhtml
 */
export function dispatchCompute(num_groups_x: GLuint, num_groups_y: GLuint, num_groups_z: GLuint): void {
    glDispatchCompute(num_groups_x, num_groups_y, num_groups_z);
}

/**
 * `void glDispatchComputeIndirect(GLintptr indirect)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param indirect - `GLintptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDispatchComputeIndirect.xhtml
 */
export function dispatchComputeIndirect(indirect: GLintptr): void {
    glDispatchComputeIndirect(indirect);
}

/**
 * `void glDrawArrays(GLenum mode, GLint first, GLsizei count)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param first - `GLint`
 * @param count - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawArrays.xhtml
 */
export function drawArrays(mode: PrimitiveType, first: GLint, count: GLsizei): void {
    glDrawArrays(mode, first, count);
}

/**
 * `void glDrawArraysIndirect(GLenum mode, const void *indirect)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param indirect - `const void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawArraysIndirect.xhtml
 */
export function drawArraysIndirect(mode: PrimitiveType, indirect: GLintptr): void {
    glDrawArraysIndirect(mode, indirect);
}

/**
 * `void glDrawArraysInstanced(GLenum mode, GLint first, GLsizei count, GLsizei instancecount)`
 *
 * Provided by `GL_VERSION_3_1`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param first - `GLint`
 * @param count - `GLsizei`
 * @param instancecount - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawArraysInstanced.xhtml
 */
export function drawArraysInstanced(mode: PrimitiveType, first: GLint, count: GLsizei, instancecount: GLsizei): void {
    glDrawArraysInstanced(mode, first, count, instancecount);
}

/**
 * `void glDrawArraysInstancedBaseInstance(GLenum mode, GLint first, GLsizei count, GLsizei instancecount, GLuint baseinstance)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param first - `GLint`
 * @param count - `GLsizei`
 * @param instancecount - `GLsizei`
 * @param baseinstance - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawArraysInstancedBaseInstance.xhtml
 */
export function drawArraysInstancedBaseInstance(
    mode: PrimitiveType,
    first: GLint,
    count: GLsizei,
    instancecount: GLsizei,
    baseinstance: GLuint,
): void {
    glDrawArraysInstancedBaseInstance(mode, first, count, instancecount, baseinstance);
}

/**
 * `void glDrawBuffer(GLenum buf)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param buf - `GLenum`, group `DrawBufferMode`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawBuffer.xhtml
 */
export function drawBuffer(buf: DrawBufferMode): void {
    glDrawBuffer(buf);
}

/**
 * `void glDrawBuffers(GLsizei n, const GLenum *bufs)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param n - `GLsizei`
 * @param bufs - `const GLenum *`, group `DrawBufferMode`, length `n`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawBuffers.xhtml
 */
export function drawBuffers(n: GLsizei, bufs: readonly DrawBufferMode[] | Uint32Array): void {
    glDrawBuffers(n, bufs);
}

/**
 * `void glDrawElements(GLenum mode, GLsizei count, GLenum type, const void *indices)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param count - `GLsizei`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indices - `const void *`, length `COMPSIZE(count,type)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawElements.xhtml
 */
export function drawElements(mode: PrimitiveType, count: GLsizei, type: DrawElementsType, indices: GLintptr): void {
    glDrawElements(mode, count, type, indices);
}

/**
 * `void glDrawElementsBaseVertex(GLenum mode, GLsizei count, GLenum type, const void *indices, GLint basevertex)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param count - `GLsizei`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indices - `const void *`, length `COMPSIZE(count,type)`
 * @param basevertex - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawElementsBaseVertex.xhtml
 */
export function drawElementsBaseVertex(
    mode: PrimitiveType,
    count: GLsizei,
    type: DrawElementsType,
    indices: GLintptr,
    basevertex: GLint,
): void {
    glDrawElementsBaseVertex(mode, count, type, indices, basevertex);
}

/**
 * `void glDrawElementsIndirect(GLenum mode, GLenum type, const void *indirect)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indirect - `const void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawElementsIndirect.xhtml
 */
export function drawElementsIndirect(mode: PrimitiveType, type: DrawElementsType, indirect: GLintptr): void {
    glDrawElementsIndirect(mode, type, indirect);
}

/**
 * `void glDrawElementsInstanced(GLenum mode, GLsizei count, GLenum type, const void *indices, GLsizei instancecount)`
 *
 * Provided by `GL_VERSION_3_1`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param count - `GLsizei`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indices - `const void *`, length `COMPSIZE(count,type)`
 * @param instancecount - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawElementsInstanced.xhtml
 */
export function drawElementsInstanced(
    mode: PrimitiveType,
    count: GLsizei,
    type: DrawElementsType,
    indices: GLintptr,
    instancecount: GLsizei,
): void {
    glDrawElementsInstanced(mode, count, type, indices, instancecount);
}

/**
 * `void glDrawElementsInstancedBaseInstance(GLenum mode, GLsizei count, GLenum type, const void *indices, GLsizei instancecount, GLuint baseinstance)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param count - `GLsizei`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indices - `const void *`, length `count`
 * @param instancecount - `GLsizei`
 * @param baseinstance - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawElementsInstancedBaseInstance.xhtml
 */
export function drawElementsInstancedBaseInstance(
    mode: PrimitiveType,
    count: GLsizei,
    type: DrawElementsType,
    indices: GLintptr,
    instancecount: GLsizei,
    baseinstance: GLuint,
): void {
    glDrawElementsInstancedBaseInstance(mode, count, type, indices, instancecount, baseinstance);
}

/**
 * `void glDrawElementsInstancedBaseVertex(GLenum mode, GLsizei count, GLenum type, const void *indices, GLsizei instancecount, GLint basevertex)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param count - `GLsizei`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indices - `const void *`, length `COMPSIZE(count,type)`
 * @param instancecount - `GLsizei`
 * @param basevertex - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawElementsInstancedBaseVertex.xhtml
 */
export function drawElementsInstancedBaseVertex(
    mode: PrimitiveType,
    count: GLsizei,
    type: DrawElementsType,
    indices: GLintptr,
    instancecount: GLsizei,
    basevertex: GLint,
): void {
    glDrawElementsInstancedBaseVertex(mode, count, type, indices, instancecount, basevertex);
}

/**
 * `void glDrawElementsInstancedBaseVertexBaseInstance(GLenum mode, GLsizei count, GLenum type, const void *indices, GLsizei instancecount, GLint basevertex, GLuint baseinstance)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param count - `GLsizei`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indices - `const void *`, length `count`
 * @param instancecount - `GLsizei`
 * @param basevertex - `GLint`
 * @param baseinstance - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawElementsInstancedBaseVertexBaseInstance.xhtml
 */
export function drawElementsInstancedBaseVertexBaseInstance(
    mode: PrimitiveType,
    count: GLsizei,
    type: DrawElementsType,
    indices: GLintptr,
    instancecount: GLsizei,
    basevertex: GLint,
    baseinstance: GLuint,
): void {
    glDrawElementsInstancedBaseVertexBaseInstance(mode, count, type, indices, instancecount, basevertex, baseinstance);
}

/**
 * `void glDrawRangeElements(GLenum mode, GLuint start, GLuint end, GLsizei count, GLenum type, const void *indices)`
 *
 * Provided by `GL_VERSION_1_2`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param start - `GLuint`
 * @param end - `GLuint`
 * @param count - `GLsizei`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indices - `const void *`, length `COMPSIZE(count,type)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawRangeElements.xhtml
 */
export function drawRangeElements(
    mode: PrimitiveType,
    start: GLuint,
    end: GLuint,
    count: GLsizei,
    type: DrawElementsType,
    indices: GLintptr,
): void {
    glDrawRangeElements(mode, start, end, count, type, indices);
}

/**
 * `void glDrawRangeElementsBaseVertex(GLenum mode, GLuint start, GLuint end, GLsizei count, GLenum type, const void *indices, GLint basevertex)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param start - `GLuint`
 * @param end - `GLuint`
 * @param count - `GLsizei`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indices - `const void *`, length `COMPSIZE(count,type)`
 * @param basevertex - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawRangeElementsBaseVertex.xhtml
 */
export function drawRangeElementsBaseVertex(
    mode: PrimitiveType,
    start: GLuint,
    end: GLuint,
    count: GLsizei,
    type: DrawElementsType,
    indices: GLintptr,
    basevertex: GLint,
): void {
    glDrawRangeElementsBaseVertex(mode, start, end, count, type, indices, basevertex);
}

/**
 * `void glDrawTransformFeedback(GLenum mode, GLuint id)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param id - `GLuint`, object kind `transform feedback`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawTransformFeedback.xhtml
 */
export function drawTransformFeedback(mode: PrimitiveType, id: GLuint): void {
    glDrawTransformFeedback(mode, id);
}

/**
 * `void glDrawTransformFeedbackInstanced(GLenum mode, GLuint id, GLsizei instancecount)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param id - `GLuint`, object kind `transform feedback`
 * @param instancecount - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawTransformFeedbackInstanced.xhtml
 */
export function drawTransformFeedbackInstanced(mode: PrimitiveType, id: GLuint, instancecount: GLsizei): void {
    glDrawTransformFeedbackInstanced(mode, id, instancecount);
}

/**
 * `void glDrawTransformFeedbackStream(GLenum mode, GLuint id, GLuint stream)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param id - `GLuint`, object kind `transform feedback`
 * @param stream - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawTransformFeedbackStream.xhtml
 */
export function drawTransformFeedbackStream(mode: PrimitiveType, id: GLuint, stream: GLuint): void {
    glDrawTransformFeedbackStream(mode, id, stream);
}

/**
 * `void glDrawTransformFeedbackStreamInstanced(GLenum mode, GLuint id, GLuint stream, GLsizei instancecount)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param id - `GLuint`, object kind `transform feedback`
 * @param stream - `GLuint`
 * @param instancecount - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawTransformFeedbackStreamInstanced.xhtml
 */
export function drawTransformFeedbackStreamInstanced(
    mode: PrimitiveType,
    id: GLuint,
    stream: GLuint,
    instancecount: GLsizei,
): void {
    glDrawTransformFeedbackStreamInstanced(mode, id, stream, instancecount);
}

/**
 * `void glEnable(GLenum cap)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param cap - `GLenum`, group `EnableCap`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glEnable.xhtml
 */
export function enable(cap: EnableCap): void {
    glEnable(cap);
}

/**
 * `void glEnablei(GLenum target, GLuint index)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `EnableCap`
 * @param index - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glEnablei.xhtml
 */
export function enablei(target: EnableCap, index: GLuint): void {
    glEnablei(target, index);
}

/**
 * `void glEnableVertexArrayAttrib(GLuint vaobj, GLuint index)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param index - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glEnableVertexArrayAttrib.xhtml
 */
export function enableVertexArrayAttrib(vaobj: GLuint, index: GLuint): void {
    glEnableVertexArrayAttrib(vaobj, index);
}

/**
 * `void glEnableVertexAttribArray(GLuint index)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glEnableVertexAttribArray.xhtml
 */
export function enableVertexAttribArray(index: GLuint): void {
    glEnableVertexAttribArray(index);
}

/**
 * `void glEndConditionalRender()`
 *
 * Provided by `GL_VERSION_3_0`.
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glEndConditionalRender.xhtml
 */
export function endConditionalRender(): void {
    glEndConditionalRender();
}

/**
 * `void glEndQuery(GLenum target)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param target - `GLenum`, group `QueryTarget`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glEndQuery.xhtml
 */
export function endQuery(target: QueryTarget): void {
    glEndQuery(target);
}

/**
 * `void glEndQueryIndexed(GLenum target, GLuint index)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param target - `GLenum`, group `QueryTarget`
 * @param index - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glEndQueryIndexed.xhtml
 */
export function endQueryIndexed(target: QueryTarget, index: GLuint): void {
    glEndQueryIndexed(target, index);
}

/**
 * `void glEndTransformFeedback()`
 *
 * Provided by `GL_VERSION_3_0`.
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glEndTransformFeedback.xhtml
 */
export function endTransformFeedback(): void {
    glEndTransformFeedback();
}

/**
 * `GLsync glFenceSync(GLenum condition, GLbitfield flags)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param condition - `GLenum`, group `SyncCondition`
 * @param flags - `GLbitfield`, group `SyncBehaviorFlags`
 * @returns `GLsync`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFenceSync.xhtml
 */
export function fenceSync(condition: SyncCondition, flags: SyncBehaviorFlags): GLsync {
    return glFenceSync(condition, flags) as GLsync;
}

/**
 * `void glFinish()`
 *
 * Provided by `GL_VERSION_1_0`.
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFinish.xhtml
 */
export function finish(): void {
    glFinish();
}

/**
 * `void glFlush()`
 *
 * Provided by `GL_VERSION_1_0`.
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFlush.xhtml
 */
export function flush(): void {
    glFlush();
}

/**
 * `void glFlushMappedBufferRange(GLenum target, GLintptr offset, GLsizeiptr length)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param offset - `GLintptr`
 * @param length - `GLsizeiptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFlushMappedBufferRange.xhtml
 */
export function flushMappedBufferRange(target: BufferTargetARB, offset: GLintptr, length: GLsizeiptr): void {
    glFlushMappedBufferRange(target, offset, length);
}

/**
 * `void glFlushMappedNamedBufferRange(GLuint buffer, GLintptr offset, GLsizeiptr length)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param length - `GLsizeiptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFlushMappedNamedBufferRange.xhtml
 */
export function flushMappedNamedBufferRange(buffer: GLuint, offset: GLintptr, length: GLsizeiptr): void {
    glFlushMappedNamedBufferRange(buffer, offset, length);
}

/**
 * `void glFramebufferParameteri(GLenum target, GLenum pname, GLint param)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param pname - `GLenum`, group `FramebufferParameterName`
 * @param param - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferParameteri.xhtml
 */
export function framebufferParameteri(target: FramebufferTarget, pname: FramebufferParameterName, param: GLint): void {
    glFramebufferParameteri(target, pname, param);
}

/**
 * `void glFramebufferRenderbuffer(GLenum target, GLenum attachment, GLenum renderbuffertarget, GLuint renderbuffer)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param renderbuffertarget - `GLenum`, group `RenderbufferTarget`
 * @param renderbuffer - `GLuint`, object kind `renderbuffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferRenderbuffer.xhtml
 */
export function framebufferRenderbuffer(
    target: FramebufferTarget,
    attachment: FramebufferAttachment,
    renderbuffertarget: RenderbufferTarget,
    renderbuffer: GLuint,
): void {
    glFramebufferRenderbuffer(target, attachment, renderbuffertarget, renderbuffer);
}

/**
 * `void glFramebufferTexture(GLenum target, GLenum attachment, GLuint texture, GLint level)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferTexture.xhtml
 */
export function framebufferTexture(
    target: FramebufferTarget,
    attachment: FramebufferAttachment,
    texture: GLuint,
    level: GLint,
): void {
    glFramebufferTexture(target, attachment, texture, level);
}

/**
 * `void glFramebufferTexture1D(GLenum target, GLenum attachment, GLenum textarget, GLuint texture, GLint level)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param textarget - `GLenum`, group `TextureTarget`
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferTexture1D.xhtml
 */
export function framebufferTexture1D(
    target: FramebufferTarget,
    attachment: FramebufferAttachment,
    textarget: TextureTarget,
    texture: GLuint,
    level: GLint,
): void {
    glFramebufferTexture1D(target, attachment, textarget, texture, level);
}

/**
 * `void glFramebufferTexture2D(GLenum target, GLenum attachment, GLenum textarget, GLuint texture, GLint level)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param textarget - `GLenum`, group `TextureTarget`
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferTexture2D.xhtml
 */
export function framebufferTexture2D(
    target: FramebufferTarget,
    attachment: FramebufferAttachment,
    textarget: TextureTarget,
    texture: GLuint,
    level: GLint,
): void {
    glFramebufferTexture2D(target, attachment, textarget, texture, level);
}

/**
 * `void glFramebufferTexture3D(GLenum target, GLenum attachment, GLenum textarget, GLuint texture, GLint level, GLint zoffset)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param textarget - `GLenum`, group `TextureTarget`
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param zoffset - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferTexture3D.xhtml
 */
export function framebufferTexture3D(
    target: FramebufferTarget,
    attachment: FramebufferAttachment,
    textarget: TextureTarget,
    texture: GLuint,
    level: GLint,
    zoffset: GLint,
): void {
    glFramebufferTexture3D(target, attachment, textarget, texture, level, zoffset);
}

/**
 * `void glFramebufferTextureLayer(GLenum target, GLenum attachment, GLuint texture, GLint level, GLint layer)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param layer - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferTextureLayer.xhtml
 */
export function framebufferTextureLayer(
    target: FramebufferTarget,
    attachment: FramebufferAttachment,
    texture: GLuint,
    level: GLint,
    layer: GLint,
): void {
    glFramebufferTextureLayer(target, attachment, texture, level, layer);
}

/**
 * `void glFrontFace(GLenum mode)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param mode - `GLenum`, group `FrontFaceDirection`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFrontFace.xhtml
 */
export function frontFace(mode: FrontFaceDirection): void {
    glFrontFace(mode);
}

/**
 * `void glGenBuffers(GLsizei n, GLuint *buffers)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param n - `GLsizei`
 * @returns `buffers` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenBuffers.xhtml
 */
export function genBuffers(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glGenBuffers(n, out0);
    return out0.value;
}

/**
 * `void glGenerateMipmap(GLenum target)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenerateMipmap.xhtml
 */
export function generateMipmap(target: TextureTarget): void {
    glGenerateMipmap(target);
}

/**
 * `void glGenerateTextureMipmap(GLuint texture)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenerateTextureMipmap.xhtml
 */
export function generateTextureMipmap(texture: GLuint): void {
    glGenerateTextureMipmap(texture);
}

/**
 * `void glGenFramebuffers(GLsizei n, GLuint *framebuffers)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param n - `GLsizei`
 * @returns `framebuffers` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenFramebuffers.xhtml
 */
export function genFramebuffers(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glGenFramebuffers(n, out0);
    return out0.value;
}

/**
 * `void glGenProgramPipelines(GLsizei n, GLuint *pipelines)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param n - `GLsizei`
 * @returns `pipelines` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenProgramPipelines.xhtml
 */
export function genProgramPipelines(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glGenProgramPipelines(n, out0);
    return out0.value;
}

/**
 * `void glGenQueries(GLsizei n, GLuint *ids)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param n - `GLsizei`
 * @returns `ids` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenQueries.xhtml
 */
export function genQueries(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glGenQueries(n, out0);
    return out0.value;
}

/**
 * `void glGenRenderbuffers(GLsizei n, GLuint *renderbuffers)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param n - `GLsizei`
 * @returns `renderbuffers` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenRenderbuffers.xhtml
 */
export function genRenderbuffers(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glGenRenderbuffers(n, out0);
    return out0.value;
}

/**
 * `void glGenSamplers(GLsizei count, GLuint *samplers)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param count - `GLsizei`
 * @returns `samplers` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenSamplers.xhtml
 */
export function genSamplers(count: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(count).fill(0) };
    glGenSamplers(count, out0);
    return out0.value;
}

/**
 * `void glGenTextures(GLsizei n, GLuint *textures)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param n - `GLsizei`
 * @returns `textures` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenTextures.xhtml
 */
export function genTextures(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glGenTextures(n, out0);
    return out0.value;
}

/**
 * `void glGenTransformFeedbacks(GLsizei n, GLuint *ids)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param n - `GLsizei`
 * @returns `ids` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenTransformFeedbacks.xhtml
 */
export function genTransformFeedbacks(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glGenTransformFeedbacks(n, out0);
    return out0.value;
}

/**
 * `void glGenVertexArrays(GLsizei n, GLuint *arrays)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param n - `GLsizei`
 * @returns `arrays` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenVertexArrays.xhtml
 */
export function genVertexArrays(n: GLsizei): GLuint[] {
    const out0 = { value: new Array<number>(n).fill(0) };
    glGenVertexArrays(n, out0);
    return out0.value;
}

/**
 * `void glGetActiveAttrib(GLuint program, GLuint index, GLsizei bufSize, GLsizei *length, GLint *size, GLenum *type, GLchar *name)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param index - `GLuint`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `size` (`GLint *`), `type` (`GLenum *`), `name` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetActiveAttrib.xhtml
 */
export function getActiveAttrib(
    program: GLuint,
    index: GLuint,
    bufSize: GLsizei,
): [GLsizei, GLint, AttributeType, string] {
    const out0 = { value: 0 };
    const out1 = { value: 0 };
    const out2 = { value: 0 };
    const out3 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetActiveAttrib",
        [
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.int32) },
            { type: t.ref(t.uint32) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.void,
    );
    binding(program, index, bufSize, out0, out1, out2, out3);
    return [out0.value, out1.value, out2.value, out3.value];
}

/**
 * `void glGetActiveSubroutineName(GLuint program, GLenum shadertype, GLuint index, GLsizei bufSize, GLsizei *length, GLchar *name)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param shadertype - `GLenum`, group `ShaderType`
 * @param index - `GLuint`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `name` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetActiveSubroutineName.xhtml
 */
export function getActiveSubroutineName(
    program: GLuint,
    shadertype: ShaderType,
    index: GLuint,
    bufSize: GLsizei,
): [GLsizei, string] {
    const out0 = { value: 0 };
    const out1 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetActiveSubroutineName",
        [
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.void,
    );
    binding(program, shadertype, index, bufSize, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `void glGetActiveSubroutineUniformName(GLuint program, GLenum shadertype, GLuint index, GLsizei bufSize, GLsizei *length, GLchar *name)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param shadertype - `GLenum`, group `ShaderType`
 * @param index - `GLuint`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `name` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetActiveSubroutineUniformName.xhtml
 */
export function getActiveSubroutineUniformName(
    program: GLuint,
    shadertype: ShaderType,
    index: GLuint,
    bufSize: GLsizei,
): [GLsizei, string] {
    const out0 = { value: 0 };
    const out1 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetActiveSubroutineUniformName",
        [
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.void,
    );
    binding(program, shadertype, index, bufSize, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `void glGetActiveUniform(GLuint program, GLuint index, GLsizei bufSize, GLsizei *length, GLint *size, GLenum *type, GLchar *name)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param index - `GLuint`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `size` (`GLint *`), `type` (`GLenum *`), `name` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetActiveUniform.xhtml
 */
export function getActiveUniform(
    program: GLuint,
    index: GLuint,
    bufSize: GLsizei,
): [GLsizei, GLint, UniformType, string] {
    const out0 = { value: 0 };
    const out1 = { value: 0 };
    const out2 = { value: 0 };
    const out3 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetActiveUniform",
        [
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.int32) },
            { type: t.ref(t.uint32) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.void,
    );
    binding(program, index, bufSize, out0, out1, out2, out3);
    return [out0.value, out1.value, out2.value, out3.value];
}

/**
 * `void glGetActiveUniformBlockName(GLuint program, GLuint uniformBlockIndex, GLsizei bufSize, GLsizei *length, GLchar *uniformBlockName)`
 *
 * Provided by `GL_VERSION_3_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param uniformBlockIndex - `GLuint`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `uniformBlockName` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetActiveUniformBlockName.xhtml
 */
export function getActiveUniformBlockName(
    program: GLuint,
    uniformBlockIndex: GLuint,
    bufSize: GLsizei,
): [GLsizei, string] {
    const out0 = { value: 0 };
    const out1 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetActiveUniformBlockName",
        [
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.void,
    );
    binding(program, uniformBlockIndex, bufSize, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `void glGetActiveUniformName(GLuint program, GLuint uniformIndex, GLsizei bufSize, GLsizei *length, GLchar *uniformName)`
 *
 * Provided by `GL_VERSION_3_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param uniformIndex - `GLuint`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `uniformName` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetActiveUniformName.xhtml
 */
export function getActiveUniformName(program: GLuint, uniformIndex: GLuint, bufSize: GLsizei): [GLsizei, string] {
    const out0 = { value: 0 };
    const out1 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetActiveUniformName",
        [
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.void,
    );
    binding(program, uniformIndex, bufSize, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `void glGetAttachedShaders(GLuint program, GLsizei maxCount, GLsizei *count, GLuint *shaders)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param maxCount - `GLsizei`
 * @returns Tuple of `count` (`GLsizei *`), `shaders` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetAttachedShaders.xhtml
 */
export function getAttachedShaders(program: GLuint, maxCount: GLsizei): [GLsizei, GLuint[]] {
    const out0 = { value: 0 };
    const out1 = { value: new Array<number>(maxCount).fill(0) };
    glGetAttachedShaders(program, maxCount, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `GLint glGetAttribLocation(GLuint program, const GLchar *name)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param name - `const GLchar *`
 * @returns `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetAttribLocation.xhtml
 */
export function getAttribLocation(program: GLuint, name: string): GLint {
    return glGetAttribLocation(program, name) as GLint;
}

/**
 * `void glGetBufferParameteri64v(GLenum target, GLenum pname, GLint64 *params)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param pname - `GLenum`, group `BufferPNameARB`
 * @returns `params` (`GLint64 *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetBufferParameteri64v.xhtml
 */
export function getBufferParameteri64v(target: BufferTargetARB, pname: BufferPNameARB): GLint64 {
    const out0 = { value: 0 };
    glGetBufferParameteri64v(target, pname, out0);
    return out0.value;
}

/**
 * `void glGetBufferParameteriv(GLenum target, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param pname - `GLenum`, group `BufferPNameARB`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetBufferParameteriv.xhtml
 */
export function getBufferParameteriv(target: BufferTargetARB, pname: BufferPNameARB): GLint {
    const out0 = { value: 0 };
    glGetBufferParameteriv(target, pname, out0);
    return out0.value;
}

/**
 * `void glGetBufferSubData(GLenum target, GLintptr offset, GLsizeiptr size, void *data)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param offset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @param data - `void *`, length `size`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetBufferSubData.xhtml
 */
export function getBufferSubData(
    target: BufferTargetARB,
    offset: GLintptr,
    size: GLsizeiptr,
    data: ArrayBufferView | GLintptr | null,
): void {
    glGetBufferSubData(target, offset, size, data);
}

/**
 * `void glGetCompressedTexImage(GLenum target, GLint level, void *img)`
 *
 * Provided by `GL_VERSION_1_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param img - `void *`, length `COMPSIZE(target,level)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetCompressedTexImage.xhtml
 */
export function getCompressedTexImage(
    target: TextureTarget,
    level: GLint,
    img: ArrayBufferView | GLintptr | null,
): void {
    glGetCompressedTexImage(target, level, img);
}

/**
 * `void glGetCompressedTextureImage(GLuint texture, GLint level, GLsizei bufSize, void *pixels)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param bufSize - `GLsizei`
 * @param pixels - `void *`, length `bufSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetCompressedTextureImage.xhtml
 */
export function getCompressedTextureImage(
    texture: GLuint,
    level: GLint,
    bufSize: GLsizei,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glGetCompressedTextureImage(texture, level, bufSize, pixels);
}

/**
 * `void glGetCompressedTextureSubImage(GLuint texture, GLint level, GLint xoffset, GLint yoffset, GLint zoffset, GLsizei width, GLsizei height, GLsizei depth, GLsizei bufSize, void *pixels)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param zoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param bufSize - `GLsizei`
 * @param pixels - `void *`, length `bufSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetCompressedTextureSubImage.xhtml
 */
export function getCompressedTextureSubImage(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    bufSize: GLsizei,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glGetCompressedTextureSubImage(texture, level, xoffset, yoffset, zoffset, width, height, depth, bufSize, pixels);
}

/**
 * `GLuint glGetDebugMessageLog(GLuint count, GLsizei bufSize, GLenum *sources, GLenum *types, GLuint *ids, GLenum *severities, GLsizei *lengths, GLchar *messageLog)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param count - `GLuint`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `GLuint`, `sources` (`GLenum *`), `types` (`GLenum *`), `ids` (`GLuint *`), `severities` (`GLenum *`), `lengths` (`GLsizei *`), `messageLog` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetDebugMessageLog.xhtml
 */
export function getDebugMessageLog(
    count: GLuint,
    bufSize: GLsizei,
): [GLuint, GLenum[], GLenum[], GLuint[], GLenum[], GLsizei[], string] {
    const out0 = { value: new Array<number>(count).fill(0) };
    const out1 = { value: new Array<number>(count).fill(0) };
    const out2 = { value: new Array<number>(count).fill(0) };
    const out3 = { value: new Array<number>(count).fill(0) };
    const out4 = { value: new Array<number>(count).fill(0) };
    const out5 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetDebugMessageLog",
        [
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.sizedArray(t.uint32, 0)) },
            { type: t.ref(t.sizedArray(t.uint32, 0)) },
            { type: t.ref(t.sizedArray(t.uint32, 0)) },
            { type: t.ref(t.sizedArray(t.uint32, 0)) },
            { type: t.ref(t.sizedArray(t.int32, 0)) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.uint32,
    );
    const result = binding(count, bufSize, out0, out1, out2, out3, out4, out5);
    return [result as GLuint, out0.value, out1.value, out2.value, out3.value, out4.value, out5.value];
}

/**
 * `GLenum glGetError()`
 *
 * Provided by `GL_VERSION_1_0`.
 * @returns `GLenum`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetError.xhtml
 */
export function getError(): ErrorCode {
    return glGetError() as ErrorCode;
}

/**
 * `GLint glGetFragDataIndex(GLuint program, const GLchar *name)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param name - `const GLchar *`
 * @returns `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetFragDataIndex.xhtml
 */
export function getFragDataIndex(program: GLuint, name: string): GLint {
    return glGetFragDataIndex(program, name) as GLint;
}

/**
 * `GLint glGetFragDataLocation(GLuint program, const GLchar *name)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param name - `const GLchar *`, length `COMPSIZE(name)`
 * @returns `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetFragDataLocation.xhtml
 */
export function getFragDataLocation(program: GLuint, name: string): GLint {
    return glGetFragDataLocation(program, name) as GLint;
}

/**
 * `void glGetFramebufferAttachmentParameteriv(GLenum target, GLenum attachment, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param pname - `GLenum`, group `FramebufferAttachmentParameterName`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetFramebufferAttachmentParameteriv.xhtml
 */
export function getFramebufferAttachmentParameteriv(
    target: FramebufferTarget,
    attachment: FramebufferAttachment,
    pname: FramebufferAttachmentParameterName,
): GLint {
    const out0 = { value: 0 };
    glGetFramebufferAttachmentParameteriv(target, attachment, pname, out0);
    return out0.value;
}

/**
 * `void glGetFramebufferParameteriv(GLenum target, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param pname - `GLenum`, group `FramebufferAttachmentParameterName`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetFramebufferParameteriv.xhtml
 */
export function getFramebufferParameteriv(target: FramebufferTarget, pname: FramebufferAttachmentParameterName): GLint {
    const out0 = { value: 0 };
    glGetFramebufferParameteriv(target, pname, out0);
    return out0.value;
}

/**
 * `GLenum glGetGraphicsResetStatus()`
 *
 * Provided by `GL_VERSION_4_5`.
 * @returns `GLenum`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetGraphicsResetStatus.xhtml
 */
export function getGraphicsResetStatus(): GraphicsResetStatus {
    return glGetGraphicsResetStatus() as GraphicsResetStatus;
}

/**
 * `void glGetInternalformati64v(GLenum target, GLenum internalformat, GLenum pname, GLsizei count, GLint64 *params)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param pname - `GLenum`, group `InternalFormatPName`
 * @param count - `GLsizei`
 * @returns `params` (`GLint64 *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetInternalformati64v.xhtml
 */
export function getInternalformati64v(
    target: TextureTarget,
    internalformat: InternalFormat,
    pname: InternalFormatPName,
    count: GLsizei,
): GLint64[] {
    const out0 = { value: new Array<number>(count).fill(0) };
    glGetInternalformati64v(target, internalformat, pname, count, out0);
    return out0.value;
}

/**
 * `void glGetInternalformativ(GLenum target, GLenum internalformat, GLenum pname, GLsizei count, GLint *params)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param pname - `GLenum`, group `InternalFormatPName`
 * @param count - `GLsizei`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetInternalformativ.xhtml
 */
export function getInternalformativ(
    target: TextureTarget,
    internalformat: InternalFormat,
    pname: InternalFormatPName,
    count: GLsizei,
): GLint[] {
    const out0 = { value: new Array<number>(count).fill(0) };
    glGetInternalformativ(target, internalformat, pname, count, out0);
    return out0.value;
}

/**
 * `void glGetNamedBufferParameteri64v(GLuint buffer, GLenum pname, GLint64 *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param pname - `GLenum`, group `BufferPNameARB`
 * @returns `params` (`GLint64 *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetNamedBufferParameteri64v.xhtml
 */
export function getNamedBufferParameteri64v(buffer: GLuint, pname: BufferPNameARB): GLint64 {
    const out0 = { value: 0 };
    glGetNamedBufferParameteri64v(buffer, pname, out0);
    return out0.value;
}

/**
 * `void glGetNamedBufferParameteriv(GLuint buffer, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param pname - `GLenum`, group `BufferPNameARB`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetNamedBufferParameteriv.xhtml
 */
export function getNamedBufferParameteriv(buffer: GLuint, pname: BufferPNameARB): GLint {
    const out0 = { value: 0 };
    glGetNamedBufferParameteriv(buffer, pname, out0);
    return out0.value;
}

/**
 * `void glGetNamedBufferSubData(GLuint buffer, GLintptr offset, GLsizeiptr size, void *data)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @param data - `void *`, length `size`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetNamedBufferSubData.xhtml
 */
export function getNamedBufferSubData(
    buffer: GLuint,
    offset: GLintptr,
    size: GLsizeiptr,
    data: ArrayBufferView | GLintptr | null,
): void {
    glGetNamedBufferSubData(buffer, offset, size, data);
}

/**
 * `void glGetNamedFramebufferAttachmentParameteriv(GLuint framebuffer, GLenum attachment, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param pname - `GLenum`, group `FramebufferAttachmentParameterName`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetNamedFramebufferAttachmentParameteriv.xhtml
 */
export function getNamedFramebufferAttachmentParameteriv(
    framebuffer: GLuint,
    attachment: FramebufferAttachment,
    pname: FramebufferAttachmentParameterName,
): GLint {
    const out0 = { value: 0 };
    glGetNamedFramebufferAttachmentParameteriv(framebuffer, attachment, pname, out0);
    return out0.value;
}

/**
 * `void glGetNamedFramebufferParameteriv(GLuint framebuffer, GLenum pname, GLint *param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param pname - `GLenum`, group `GetFramebufferParameter`
 * @returns `param` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetNamedFramebufferParameteriv.xhtml
 */
export function getNamedFramebufferParameteriv(framebuffer: GLuint, pname: GetFramebufferParameter): GLint {
    const out0 = { value: 0 };
    glGetNamedFramebufferParameteriv(framebuffer, pname, out0);
    return out0.value;
}

/**
 * `void glGetNamedRenderbufferParameteriv(GLuint renderbuffer, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param renderbuffer - `GLuint`, object kind `renderbuffer`
 * @param pname - `GLenum`, group `RenderbufferParameterName`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetNamedRenderbufferParameteriv.xhtml
 */
export function getNamedRenderbufferParameteriv(renderbuffer: GLuint, pname: RenderbufferParameterName): GLint {
    const out0 = { value: 0 };
    glGetNamedRenderbufferParameteriv(renderbuffer, pname, out0);
    return out0.value;
}

/**
 * `void glGetnCompressedTexImage(GLenum target, GLint lod, GLsizei bufSize, void *pixels)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param lod - `GLint`
 * @param bufSize - `GLsizei`
 * @param pixels - `void *`, length `bufSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetnCompressedTexImage.xhtml
 */
export function getnCompressedTexImage(
    target: TextureTarget,
    lod: GLint,
    bufSize: GLsizei,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glGetnCompressedTexImage(target, lod, bufSize, pixels);
}

/**
 * `void glGetnTexImage(GLenum target, GLint level, GLenum format, GLenum type, GLsizei bufSize, void *pixels)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param bufSize - `GLsizei`
 * @param pixels - `void *`, length `bufSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetnTexImage.xhtml
 */
export function getnTexImage(
    target: TextureTarget,
    level: GLint,
    format: PixelFormat,
    type: PixelType,
    bufSize: GLsizei,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glGetnTexImage(target, level, format, type, bufSize, pixels);
}

/**
 * `void glGetObjectLabel(GLenum identifier, GLuint name, GLsizei bufSize, GLsizei *length, GLchar *label)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param identifier - `GLenum`, group `ObjectIdentifier`
 * @param name - `GLuint`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `label` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetObjectLabel.xhtml
 */
export function getObjectLabel(identifier: ObjectIdentifier, name: GLuint, bufSize: GLsizei): [GLsizei, string] {
    const out0 = { value: 0 };
    const out1 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetObjectLabel",
        [
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.void,
    );
    binding(identifier, name, bufSize, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `void glGetObjectPtrLabel(const void *ptr, GLsizei bufSize, GLsizei *length, GLchar *label)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param ptr - `const void *`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `label` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetObjectPtrLabel.xhtml
 */
export function getObjectPtrLabel(ptr: ArrayBufferView | GLintptr | null, bufSize: GLsizei): [GLsizei, string] {
    const out0 = { value: 0 };
    const out1 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetObjectPtrLabel",
        [{ type: t.blob }, { type: t.int32 }, { type: t.ref(t.int32) }, { type: t.ref(t.string("borrowed", bufSize)) }],
        t.void,
    );
    binding(ptr, bufSize, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `void glGetProgramBinary(GLuint program, GLsizei bufSize, GLsizei *length, GLenum *binaryFormat, void *binary)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param bufSize - `GLsizei`
 * @param binary - `void *`, length `bufSize`
 * @returns Tuple of `length` (`GLsizei *`), `binaryFormat` (`GLenum *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetProgramBinary.xhtml
 */
export function getProgramBinary(
    program: GLuint,
    bufSize: GLsizei,
    binary: ArrayBufferView | GLintptr | null,
): [GLsizei, GLenum] {
    const out0 = { value: 0 };
    const out1 = { value: 0 };
    glGetProgramBinary(program, bufSize, out0, out1, binary);
    return [out0.value, out1.value];
}

/**
 * `void glGetProgramiv(GLuint program, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param pname - `GLenum`, group `ProgramPropertyARB`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetProgramiv.xhtml
 */
export function getProgramiv(program: GLuint, pname: ProgramPropertyARB): GLint {
    const out0 = { value: 0 };
    glGetProgramiv(program, pname, out0);
    return out0.value;
}

/**
 * `void glGetProgramPipelineiv(GLuint pipeline, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param pipeline - `GLuint`, object kind `program pipeline`
 * @param pname - `GLenum`, group `PipelineParameterName`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetProgramPipelineiv.xhtml
 */
export function getProgramPipelineiv(pipeline: GLuint, pname: PipelineParameterName): GLint {
    const out0 = { value: 0 };
    glGetProgramPipelineiv(pipeline, pname, out0);
    return out0.value;
}

/**
 * `GLuint glGetProgramResourceIndex(GLuint program, GLenum programInterface, const GLchar *name)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param programInterface - `GLenum`, group `ProgramInterface`
 * @param name - `const GLchar *`, length `COMPSIZE(name)`
 * @returns `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetProgramResourceIndex.xhtml
 */
export function getProgramResourceIndex(program: GLuint, programInterface: ProgramInterface, name: string): GLuint {
    return glGetProgramResourceIndex(program, programInterface, name) as GLuint;
}

/**
 * `void glGetProgramResourceiv(GLuint program, GLenum programInterface, GLuint index, GLsizei propCount, const GLenum *props, GLsizei count, GLsizei *length, GLint *params)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param programInterface - `GLenum`, group `ProgramInterface`
 * @param index - `GLuint`
 * @param propCount - `GLsizei`
 * @param props - `const GLenum *`, group `ProgramResourceProperty`, length `propCount`
 * @param count - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetProgramResourceiv.xhtml
 */
export function getProgramResourceiv(
    program: GLuint,
    programInterface: ProgramInterface,
    index: GLuint,
    propCount: GLsizei,
    props: readonly ProgramResourceProperty[] | Uint32Array,
    count: GLsizei,
): [GLsizei, GLint[]] {
    const out0 = { value: 0 };
    const out1 = { value: new Array<number>(count).fill(0) };
    glGetProgramResourceiv(program, programInterface, index, propCount, props, count, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `GLint glGetProgramResourceLocation(GLuint program, GLenum programInterface, const GLchar *name)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param programInterface - `GLenum`, group `ProgramInterface`
 * @param name - `const GLchar *`, length `COMPSIZE(name)`
 * @returns `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetProgramResourceLocation.xhtml
 */
export function getProgramResourceLocation(program: GLuint, programInterface: ProgramInterface, name: string): GLint {
    return glGetProgramResourceLocation(program, programInterface, name) as GLint;
}

/**
 * `GLint glGetProgramResourceLocationIndex(GLuint program, GLenum programInterface, const GLchar *name)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param programInterface - `GLenum`, group `ProgramInterface`
 * @param name - `const GLchar *`, length `COMPSIZE(name)`
 * @returns `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetProgramResourceLocationIndex.xhtml
 */
export function getProgramResourceLocationIndex(
    program: GLuint,
    programInterface: ProgramInterface,
    name: string,
): GLint {
    return glGetProgramResourceLocationIndex(program, programInterface, name) as GLint;
}

/**
 * `void glGetProgramResourceName(GLuint program, GLenum programInterface, GLuint index, GLsizei bufSize, GLsizei *length, GLchar *name)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param programInterface - `GLenum`, group `ProgramInterface`
 * @param index - `GLuint`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `name` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetProgramResourceName.xhtml
 */
export function getProgramResourceName(
    program: GLuint,
    programInterface: ProgramInterface,
    index: GLuint,
    bufSize: GLsizei,
): [GLsizei, string] {
    const out0 = { value: 0 };
    const out1 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetProgramResourceName",
        [
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.void,
    );
    binding(program, programInterface, index, bufSize, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `void glGetProgramStageiv(GLuint program, GLenum shadertype, GLenum pname, GLint *values)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param shadertype - `GLenum`, group `ShaderType`
 * @param pname - `GLenum`, group `ProgramStagePName`
 * @returns `values` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetProgramStageiv.xhtml
 */
export function getProgramStageiv(program: GLuint, shadertype: ShaderType, pname: ProgramStagePName): GLint {
    const out0 = { value: 0 };
    glGetProgramStageiv(program, shadertype, pname, out0);
    return out0.value;
}

/**
 * `void glGetQueryBufferObjecti64v(GLuint id, GLuint buffer, GLenum pname, GLintptr offset)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param id - `GLuint`, object kind `query`
 * @param buffer - `GLuint`, object kind `buffer`
 * @param pname - `GLenum`, group `QueryObjectParameterName`
 * @param offset - `GLintptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetQueryBufferObjecti64v.xhtml
 */
export function getQueryBufferObjecti64v(
    id: GLuint,
    buffer: GLuint,
    pname: QueryObjectParameterName,
    offset: GLintptr,
): void {
    glGetQueryBufferObjecti64v(id, buffer, pname, offset);
}

/**
 * `void glGetQueryBufferObjectiv(GLuint id, GLuint buffer, GLenum pname, GLintptr offset)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param id - `GLuint`, object kind `query`
 * @param buffer - `GLuint`, object kind `buffer`
 * @param pname - `GLenum`, group `QueryObjectParameterName`
 * @param offset - `GLintptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetQueryBufferObjectiv.xhtml
 */
export function getQueryBufferObjectiv(
    id: GLuint,
    buffer: GLuint,
    pname: QueryObjectParameterName,
    offset: GLintptr,
): void {
    glGetQueryBufferObjectiv(id, buffer, pname, offset);
}

/**
 * `void glGetQueryBufferObjectui64v(GLuint id, GLuint buffer, GLenum pname, GLintptr offset)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param id - `GLuint`, object kind `query`
 * @param buffer - `GLuint`, object kind `buffer`
 * @param pname - `GLenum`, group `QueryObjectParameterName`
 * @param offset - `GLintptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetQueryBufferObjectui64v.xhtml
 */
export function getQueryBufferObjectui64v(
    id: GLuint,
    buffer: GLuint,
    pname: QueryObjectParameterName,
    offset: GLintptr,
): void {
    glGetQueryBufferObjectui64v(id, buffer, pname, offset);
}

/**
 * `void glGetQueryBufferObjectuiv(GLuint id, GLuint buffer, GLenum pname, GLintptr offset)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param id - `GLuint`, object kind `query`
 * @param buffer - `GLuint`, object kind `buffer`
 * @param pname - `GLenum`, group `QueryObjectParameterName`
 * @param offset - `GLintptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetQueryBufferObjectuiv.xhtml
 */
export function getQueryBufferObjectuiv(
    id: GLuint,
    buffer: GLuint,
    pname: QueryObjectParameterName,
    offset: GLintptr,
): void {
    glGetQueryBufferObjectuiv(id, buffer, pname, offset);
}

/**
 * `void glGetQueryiv(GLenum target, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param target - `GLenum`, group `QueryTarget`
 * @param pname - `GLenum`, group `QueryParameterName`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetQueryiv.xhtml
 */
export function getQueryiv(target: QueryTarget, pname: QueryParameterName): GLint {
    const out0 = { value: 0 };
    glGetQueryiv(target, pname, out0);
    return out0.value;
}

/**
 * `void glGetQueryObjecti64v(GLuint id, GLenum pname, GLint64 *params)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param id - `GLuint`, object kind `query`
 * @param pname - `GLenum`, group `QueryObjectParameterName`
 * @returns `params` (`GLint64 *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetQueryObjecti64v.xhtml
 */
export function getQueryObjecti64v(id: GLuint, pname: QueryObjectParameterName): GLint64 {
    const out0 = { value: 0 };
    glGetQueryObjecti64v(id, pname, out0);
    return out0.value;
}

/**
 * `void glGetQueryObjectiv(GLuint id, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param id - `GLuint`, object kind `query`
 * @param pname - `GLenum`, group `QueryObjectParameterName`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetQueryObjectiv.xhtml
 */
export function getQueryObjectiv(id: GLuint, pname: QueryObjectParameterName): GLint {
    const out0 = { value: 0 };
    glGetQueryObjectiv(id, pname, out0);
    return out0.value;
}

/**
 * `void glGetQueryObjectui64v(GLuint id, GLenum pname, GLuint64 *params)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param id - `GLuint`, object kind `query`
 * @param pname - `GLenum`, group `QueryObjectParameterName`
 * @returns `params` (`GLuint64 *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetQueryObjectui64v.xhtml
 */
export function getQueryObjectui64v(id: GLuint, pname: QueryObjectParameterName): GLuint64 {
    const out0 = { value: 0 };
    glGetQueryObjectui64v(id, pname, out0);
    return out0.value;
}

/**
 * `void glGetQueryObjectuiv(GLuint id, GLenum pname, GLuint *params)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param id - `GLuint`, object kind `query`
 * @param pname - `GLenum`, group `QueryObjectParameterName`
 * @returns `params` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetQueryObjectuiv.xhtml
 */
export function getQueryObjectuiv(id: GLuint, pname: QueryObjectParameterName): GLuint {
    const out0 = { value: 0 };
    glGetQueryObjectuiv(id, pname, out0);
    return out0.value;
}

/**
 * `void glGetRenderbufferParameteriv(GLenum target, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `RenderbufferTarget`
 * @param pname - `GLenum`, group `RenderbufferParameterName`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetRenderbufferParameteriv.xhtml
 */
export function getRenderbufferParameteriv(target: RenderbufferTarget, pname: RenderbufferParameterName): GLint {
    const out0 = { value: 0 };
    glGetRenderbufferParameteriv(target, pname, out0);
    return out0.value;
}

/**
 * `void glGetShaderiv(GLuint shader, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param shader - `GLuint`, object kind `shader`
 * @param pname - `GLenum`, group `ShaderParameterName`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetShaderiv.xhtml
 */
export function getShaderiv(shader: GLuint, pname: ShaderParameterName): GLint {
    const out0 = { value: 0 };
    glGetShaderiv(shader, pname, out0);
    return out0.value;
}

/**
 * `void glGetShaderPrecisionFormat(GLenum shadertype, GLenum precisiontype, GLint *range, GLint *precision)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param shadertype - `GLenum`, group `ShaderType`
 * @param precisiontype - `GLenum`, group `PrecisionType`
 * @returns Tuple of `range` (`GLint *`), `precision` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetShaderPrecisionFormat.xhtml
 */
export function getShaderPrecisionFormat(shadertype: ShaderType, precisiontype: PrecisionType): [GLint[], GLint] {
    const out0 = { value: new Array<number>(2).fill(0) };
    const out1 = { value: 0 };
    glGetShaderPrecisionFormat(shadertype, precisiontype, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `void glGetShaderSource(GLuint shader, GLsizei bufSize, GLsizei *length, GLchar *source)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param shader - `GLuint`, object kind `shader`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `source` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetShaderSource.xhtml
 */
export function getShaderSource(shader: GLuint, bufSize: GLsizei): [GLsizei, string] {
    const out0 = { value: 0 };
    const out1 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetShaderSource",
        [
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.void,
    );
    binding(shader, bufSize, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `const GLubyte * glGetString(GLenum name)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param name - `GLenum`, group `StringName`
 * @returns `const GLubyte *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetString.xhtml
 */
export function getString(name: StringName): string {
    return glGetString(name) as string;
}

/**
 * `const GLubyte * glGetStringi(GLenum name, GLuint index)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param name - `GLenum`, group `StringName`
 * @param index - `GLuint`
 * @returns `const GLubyte *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetStringi.xhtml
 */
export function getStringi(name: StringName, index: GLuint): string {
    return glGetStringi(name, index) as string;
}

/**
 * `GLuint glGetSubroutineIndex(GLuint program, GLenum shadertype, const GLchar *name)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param shadertype - `GLenum`, group `ShaderType`
 * @param name - `const GLchar *`
 * @returns `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetSubroutineIndex.xhtml
 */
export function getSubroutineIndex(program: GLuint, shadertype: ShaderType, name: string): GLuint {
    return glGetSubroutineIndex(program, shadertype, name) as GLuint;
}

/**
 * `GLint glGetSubroutineUniformLocation(GLuint program, GLenum shadertype, const GLchar *name)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param shadertype - `GLenum`, group `ShaderType`
 * @param name - `const GLchar *`
 * @returns `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetSubroutineUniformLocation.xhtml
 */
export function getSubroutineUniformLocation(program: GLuint, shadertype: ShaderType, name: string): GLint {
    return glGetSubroutineUniformLocation(program, shadertype, name) as GLint;
}

/**
 * `void glGetSynciv(GLsync sync, GLenum pname, GLsizei count, GLsizei *length, GLint *values)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param sync - `GLsync`, object kind `sync`
 * @param pname - `GLenum`, group `SyncParameterName`
 * @param count - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `values` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetSynciv.xhtml
 */
export function getSynciv(sync: GLsync, pname: SyncParameterName, count: GLsizei): [GLsizei, GLint[]] {
    const out0 = { value: 0 };
    const out1 = { value: new Array<number>(count).fill(0) };
    glGetSynciv(sync, pname, count, out0, out1);
    return [out0.value, out1.value];
}

/**
 * `void glGetTexImage(GLenum target, GLint level, GLenum format, GLenum type, void *pixels)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `void *`, length `COMPSIZE(target,level,format,type)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTexImage.xhtml
 */
export function getTexImage(
    target: TextureTarget,
    level: GLint,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glGetTexImage(target, level, format, type, pixels);
}

/**
 * `void glGetTextureImage(GLuint texture, GLint level, GLenum format, GLenum type, GLsizei bufSize, void *pixels)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param bufSize - `GLsizei`
 * @param pixels - `void *`, length `bufSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTextureImage.xhtml
 */
export function getTextureImage(
    texture: GLuint,
    level: GLint,
    format: PixelFormat,
    type: PixelType,
    bufSize: GLsizei,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glGetTextureImage(texture, level, format, type, bufSize, pixels);
}

/**
 * `void glGetTextureLevelParameterfv(GLuint texture, GLint level, GLenum pname, GLfloat *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param pname - `GLenum`, group `GetTextureParameter`
 * @returns `params` (`GLfloat *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTextureLevelParameterfv.xhtml
 */
export function getTextureLevelParameterfv(texture: GLuint, level: GLint, pname: GetTextureParameter): GLfloat {
    const out0 = { value: 0 };
    glGetTextureLevelParameterfv(texture, level, pname, out0);
    return out0.value;
}

/**
 * `void glGetTextureLevelParameteriv(GLuint texture, GLint level, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param pname - `GLenum`, group `GetTextureParameter`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTextureLevelParameteriv.xhtml
 */
export function getTextureLevelParameteriv(texture: GLuint, level: GLint, pname: GetTextureParameter): GLint {
    const out0 = { value: 0 };
    glGetTextureLevelParameteriv(texture, level, pname, out0);
    return out0.value;
}

/**
 * `void glGetTextureParameterfv(GLuint texture, GLenum pname, GLfloat *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param pname - `GLenum`, group `GetTextureParameter`
 * @returns `params` (`GLfloat *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTextureParameterfv.xhtml
 */
export function getTextureParameterfv(texture: GLuint, pname: GetTextureParameter): GLfloat {
    const out0 = { value: 0 };
    glGetTextureParameterfv(texture, pname, out0);
    return out0.value;
}

/**
 * `void glGetTextureParameterIiv(GLuint texture, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param pname - `GLenum`, group `GetTextureParameter`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTextureParameterIiv.xhtml
 */
export function getTextureParameterIiv(texture: GLuint, pname: GetTextureParameter): GLint {
    const out0 = { value: 0 };
    glGetTextureParameterIiv(texture, pname, out0);
    return out0.value;
}

/**
 * `void glGetTextureParameterIuiv(GLuint texture, GLenum pname, GLuint *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param pname - `GLenum`, group `GetTextureParameter`
 * @returns `params` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTextureParameterIuiv.xhtml
 */
export function getTextureParameterIuiv(texture: GLuint, pname: GetTextureParameter): GLuint {
    const out0 = { value: 0 };
    glGetTextureParameterIuiv(texture, pname, out0);
    return out0.value;
}

/**
 * `void glGetTextureParameteriv(GLuint texture, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param pname - `GLenum`, group `GetTextureParameter`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTextureParameteriv.xhtml
 */
export function getTextureParameteriv(texture: GLuint, pname: GetTextureParameter): GLint {
    const out0 = { value: 0 };
    glGetTextureParameteriv(texture, pname, out0);
    return out0.value;
}

/**
 * `void glGetTextureSubImage(GLuint texture, GLint level, GLint xoffset, GLint yoffset, GLint zoffset, GLsizei width, GLsizei height, GLsizei depth, GLenum format, GLenum type, GLsizei bufSize, void *pixels)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param zoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param bufSize - `GLsizei`
 * @param pixels - `void *`, length `bufSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTextureSubImage.xhtml
 */
export function getTextureSubImage(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    format: PixelFormat,
    type: PixelType,
    bufSize: GLsizei,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glGetTextureSubImage(
        texture,
        level,
        xoffset,
        yoffset,
        zoffset,
        width,
        height,
        depth,
        format,
        type,
        bufSize,
        pixels,
    );
}

/**
 * `void glGetTransformFeedbacki_v(GLuint xfb, GLenum pname, GLuint index, GLint *param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param xfb - `GLuint`, object kind `transform feedback`
 * @param pname - `GLenum`, group `TransformFeedbackPName`
 * @param index - `GLuint`
 * @returns `param` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTransformFeedbacki_v.xhtml
 */
export function getTransformFeedbacki_v(xfb: GLuint, pname: TransformFeedbackPName, index: GLuint): GLint {
    const out0 = { value: 0 };
    glGetTransformFeedbacki_v(xfb, pname, index, out0);
    return out0.value;
}

/**
 * `void glGetTransformFeedbacki64_v(GLuint xfb, GLenum pname, GLuint index, GLint64 *param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param xfb - `GLuint`, object kind `transform feedback`
 * @param pname - `GLenum`, group `TransformFeedbackPName`
 * @param index - `GLuint`
 * @returns `param` (`GLint64 *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTransformFeedbacki64_v.xhtml
 */
export function getTransformFeedbacki64_v(xfb: GLuint, pname: TransformFeedbackPName, index: GLuint): GLint64 {
    const out0 = { value: 0 };
    glGetTransformFeedbacki64_v(xfb, pname, index, out0);
    return out0.value;
}

/**
 * `void glGetTransformFeedbackiv(GLuint xfb, GLenum pname, GLint *param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param xfb - `GLuint`, object kind `transform feedback`
 * @param pname - `GLenum`, group `TransformFeedbackPName`
 * @returns `param` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTransformFeedbackiv.xhtml
 */
export function getTransformFeedbackiv(xfb: GLuint, pname: TransformFeedbackPName): GLint {
    const out0 = { value: 0 };
    glGetTransformFeedbackiv(xfb, pname, out0);
    return out0.value;
}

/**
 * `void glGetTransformFeedbackVarying(GLuint program, GLuint index, GLsizei bufSize, GLsizei *length, GLsizei *size, GLenum *type, GLchar *name)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param index - `GLuint`
 * @param bufSize - `GLsizei`
 * @returns Tuple of `length` (`GLsizei *`), `size` (`GLsizei *`), `type` (`GLenum *`), `name` (`GLchar *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetTransformFeedbackVarying.xhtml
 */
export function getTransformFeedbackVarying(
    program: GLuint,
    index: GLuint,
    bufSize: GLsizei,
): [GLsizei, GLsizei, AttributeType, string] {
    const out0 = { value: 0 };
    const out1 = { value: 0 };
    const out2 = { value: 0 };
    const out3 = { value: "" };
    const binding = t.fn(
        LIB,
        "glGetTransformFeedbackVarying",
        [
            { type: t.uint32 },
            { type: t.uint32 },
            { type: t.int32 },
            { type: t.ref(t.int32) },
            { type: t.ref(t.int32) },
            { type: t.ref(t.uint32) },
            { type: t.ref(t.string("borrowed", bufSize)) },
        ],
        t.void,
    );
    binding(program, index, bufSize, out0, out1, out2, out3);
    return [out0.value, out1.value, out2.value, out3.value];
}

/**
 * `GLuint glGetUniformBlockIndex(GLuint program, const GLchar *uniformBlockName)`
 *
 * Provided by `GL_VERSION_3_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param uniformBlockName - `const GLchar *`, length `COMPSIZE()`
 * @returns `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetUniformBlockIndex.xhtml
 */
export function getUniformBlockIndex(program: GLuint, uniformBlockName: string): GLuint {
    return glGetUniformBlockIndex(program, uniformBlockName) as GLuint;
}

/**
 * `GLint glGetUniformLocation(GLuint program, const GLchar *name)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param name - `const GLchar *`
 * @returns `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetUniformLocation.xhtml
 */
export function getUniformLocation(program: GLuint, name: string): GLint {
    return glGetUniformLocation(program, name) as GLint;
}

/**
 * `void glGetUniformSubroutineuiv(GLenum shadertype, GLint location, GLuint *params)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param shadertype - `GLenum`, group `ShaderType`
 * @param location - `GLint`
 * @returns `params` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetUniformSubroutineuiv.xhtml
 */
export function getUniformSubroutineuiv(shadertype: ShaderType, location: GLint): GLuint {
    const out0 = { value: 0 };
    glGetUniformSubroutineuiv(shadertype, location, out0);
    return out0.value;
}

/**
 * `void glGetVertexArrayIndexed64iv(GLuint vaobj, GLuint index, GLenum pname, GLint64 *param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param index - `GLuint`
 * @param pname - `GLenum`, group `VertexArrayPName`
 * @returns `param` (`GLint64 *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetVertexArrayIndexed64iv.xhtml
 */
export function getVertexArrayIndexed64iv(vaobj: GLuint, index: GLuint, pname: VertexArrayPName): GLint64 {
    const out0 = { value: 0 };
    glGetVertexArrayIndexed64iv(vaobj, index, pname, out0);
    return out0.value;
}

/**
 * `void glGetVertexArrayIndexediv(GLuint vaobj, GLuint index, GLenum pname, GLint *param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param index - `GLuint`
 * @param pname - `GLenum`, group `VertexArrayPName`
 * @returns `param` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetVertexArrayIndexediv.xhtml
 */
export function getVertexArrayIndexediv(vaobj: GLuint, index: GLuint, pname: VertexArrayPName): GLint {
    const out0 = { value: 0 };
    glGetVertexArrayIndexediv(vaobj, index, pname, out0);
    return out0.value;
}

/**
 * `void glGetVertexArrayiv(GLuint vaobj, GLenum pname, GLint *param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param pname - `GLenum`, group `VertexArrayPName`
 * @returns `param` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetVertexArrayiv.xhtml
 */
export function getVertexArrayiv(vaobj: GLuint, pname: VertexArrayPName): GLint {
    const out0 = { value: 0 };
    glGetVertexArrayiv(vaobj, pname, out0);
    return out0.value;
}

/**
 * `void glGetVertexAttribdv(GLuint index, GLenum pname, GLdouble *params)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param pname - `GLenum`, group `VertexAttribPropertyARB`
 * @returns `params` (`GLdouble *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetVertexAttribdv.xhtml
 */
export function getVertexAttribdv(index: GLuint, pname: VertexAttribPropertyARB): GLdouble[] {
    const out0 = { value: new Array<number>(4).fill(0) };
    glGetVertexAttribdv(index, pname, out0);
    return out0.value;
}

/**
 * `void glGetVertexAttribfv(GLuint index, GLenum pname, GLfloat *params)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param pname - `GLenum`, group `VertexAttribPropertyARB`
 * @returns `params` (`GLfloat *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetVertexAttribfv.xhtml
 */
export function getVertexAttribfv(index: GLuint, pname: VertexAttribPropertyARB): GLfloat[] {
    const out0 = { value: new Array<number>(4).fill(0) };
    glGetVertexAttribfv(index, pname, out0);
    return out0.value;
}

/**
 * `void glGetVertexAttribIiv(GLuint index, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param pname - `GLenum`, group `VertexAttribEnum`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetVertexAttribIiv.xhtml
 */
export function getVertexAttribIiv(index: GLuint, pname: VertexAttribEnum): GLint {
    const out0 = { value: 0 };
    glGetVertexAttribIiv(index, pname, out0);
    return out0.value;
}

/**
 * `void glGetVertexAttribIuiv(GLuint index, GLenum pname, GLuint *params)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param pname - `GLenum`, group `VertexAttribEnum`
 * @returns `params` (`GLuint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetVertexAttribIuiv.xhtml
 */
export function getVertexAttribIuiv(index: GLuint, pname: VertexAttribEnum): GLuint {
    const out0 = { value: 0 };
    glGetVertexAttribIuiv(index, pname, out0);
    return out0.value;
}

/**
 * `void glGetVertexAttribiv(GLuint index, GLenum pname, GLint *params)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param pname - `GLenum`, group `VertexAttribPropertyARB`
 * @returns `params` (`GLint *`)
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetVertexAttribiv.xhtml
 */
export function getVertexAttribiv(index: GLuint, pname: VertexAttribPropertyARB): GLint[] {
    const out0 = { value: new Array<number>(4).fill(0) };
    glGetVertexAttribiv(index, pname, out0);
    return out0.value;
}

/**
 * `void glHint(GLenum target, GLenum mode)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param target - `GLenum`, group `HintTarget`
 * @param mode - `GLenum`, group `HintMode`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glHint.xhtml
 */
export function hint(target: HintTarget, mode: HintMode): void {
    glHint(target, mode);
}

/**
 * `void glInvalidateBufferData(GLuint buffer)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glInvalidateBufferData.xhtml
 */
export function invalidateBufferData(buffer: GLuint): void {
    glInvalidateBufferData(buffer);
}

/**
 * `void glInvalidateBufferSubData(GLuint buffer, GLintptr offset, GLsizeiptr length)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param length - `GLsizeiptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glInvalidateBufferSubData.xhtml
 */
export function invalidateBufferSubData(buffer: GLuint, offset: GLintptr, length: GLsizeiptr): void {
    glInvalidateBufferSubData(buffer, offset, length);
}

/**
 * `void glInvalidateFramebuffer(GLenum target, GLsizei numAttachments, const GLenum *attachments)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param numAttachments - `GLsizei`
 * @param attachments - `const GLenum *`, group `InvalidateFramebufferAttachment`, length `numAttachments`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glInvalidateFramebuffer.xhtml
 */
export function invalidateFramebuffer(
    target: FramebufferTarget,
    numAttachments: GLsizei,
    attachments: readonly InvalidateFramebufferAttachment[] | Uint32Array,
): void {
    glInvalidateFramebuffer(target, numAttachments, attachments);
}

/**
 * `void glInvalidateNamedFramebufferData(GLuint framebuffer, GLsizei numAttachments, const GLenum *attachments)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param numAttachments - `GLsizei`
 * @param attachments - `const GLenum *`, group `FramebufferAttachment`, length `numAttachments`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glInvalidateNamedFramebufferData.xhtml
 */
export function invalidateNamedFramebufferData(
    framebuffer: GLuint,
    numAttachments: GLsizei,
    attachments: readonly FramebufferAttachment[] | Uint32Array,
): void {
    glInvalidateNamedFramebufferData(framebuffer, numAttachments, attachments);
}

/**
 * `void glInvalidateNamedFramebufferSubData(GLuint framebuffer, GLsizei numAttachments, const GLenum *attachments, GLint x, GLint y, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param numAttachments - `GLsizei`
 * @param attachments - `const GLenum *`, group `FramebufferAttachment`, length `numAttachments`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glInvalidateNamedFramebufferSubData.xhtml
 */
export function invalidateNamedFramebufferSubData(
    framebuffer: GLuint,
    numAttachments: GLsizei,
    attachments: readonly FramebufferAttachment[] | Uint32Array,
    x: GLint,
    y: GLint,
    width: GLsizei,
    height: GLsizei,
): void {
    glInvalidateNamedFramebufferSubData(framebuffer, numAttachments, attachments, x, y, width, height);
}

/**
 * `void glInvalidateSubFramebuffer(GLenum target, GLsizei numAttachments, const GLenum *attachments, GLint x, GLint y, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param target - `GLenum`, group `FramebufferTarget`
 * @param numAttachments - `GLsizei`
 * @param attachments - `const GLenum *`, group `InvalidateFramebufferAttachment`, length `numAttachments`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glInvalidateSubFramebuffer.xhtml
 */
export function invalidateSubFramebuffer(
    target: FramebufferTarget,
    numAttachments: GLsizei,
    attachments: readonly InvalidateFramebufferAttachment[] | Uint32Array,
    x: GLint,
    y: GLint,
    width: GLsizei,
    height: GLsizei,
): void {
    glInvalidateSubFramebuffer(target, numAttachments, attachments, x, y, width, height);
}

/**
 * `void glInvalidateTexImage(GLuint texture, GLint level)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glInvalidateTexImage.xhtml
 */
export function invalidateTexImage(texture: GLuint, level: GLint): void {
    glInvalidateTexImage(texture, level);
}

/**
 * `void glInvalidateTexSubImage(GLuint texture, GLint level, GLint xoffset, GLint yoffset, GLint zoffset, GLsizei width, GLsizei height, GLsizei depth)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param zoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glInvalidateTexSubImage.xhtml
 */
export function invalidateTexSubImage(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
): void {
    glInvalidateTexSubImage(texture, level, xoffset, yoffset, zoffset, width, height, depth);
}

/**
 * `GLboolean glIsBuffer(GLuint buffer)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsBuffer.xhtml
 */
export function isBuffer(buffer: GLuint): boolean {
    return (glIsBuffer(buffer) as number) !== 0;
}

/**
 * `GLboolean glIsEnabled(GLenum cap)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param cap - `GLenum`, group `EnableCap`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsEnabled.xhtml
 */
export function isEnabled(cap: EnableCap): boolean {
    return (glIsEnabled(cap) as number) !== 0;
}

/**
 * `GLboolean glIsEnabledi(GLenum target, GLuint index)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `EnableCap`
 * @param index - `GLuint`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsEnabledi.xhtml
 */
export function isEnabledi(target: EnableCap, index: GLuint): boolean {
    return (glIsEnabledi(target, index) as number) !== 0;
}

/**
 * `GLboolean glIsFramebuffer(GLuint framebuffer)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsFramebuffer.xhtml
 */
export function isFramebuffer(framebuffer: GLuint): boolean {
    return (glIsFramebuffer(framebuffer) as number) !== 0;
}

/**
 * `GLboolean glIsProgram(GLuint program)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsProgram.xhtml
 */
export function isProgram(program: GLuint): boolean {
    return (glIsProgram(program) as number) !== 0;
}

/**
 * `GLboolean glIsProgramPipeline(GLuint pipeline)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param pipeline - `GLuint`, object kind `program pipeline`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsProgramPipeline.xhtml
 */
export function isProgramPipeline(pipeline: GLuint): boolean {
    return (glIsProgramPipeline(pipeline) as number) !== 0;
}

/**
 * `GLboolean glIsQuery(GLuint id)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param id - `GLuint`, object kind `query`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsQuery.xhtml
 */
export function isQuery(id: GLuint): boolean {
    return (glIsQuery(id) as number) !== 0;
}

/**
 * `GLboolean glIsRenderbuffer(GLuint renderbuffer)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param renderbuffer - `GLuint`, object kind `renderbuffer`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsRenderbuffer.xhtml
 */
export function isRenderbuffer(renderbuffer: GLuint): boolean {
    return (glIsRenderbuffer(renderbuffer) as number) !== 0;
}

/**
 * `GLboolean glIsSampler(GLuint sampler)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param sampler - `GLuint`, object kind `sampler`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsSampler.xhtml
 */
export function isSampler(sampler: GLuint): boolean {
    return (glIsSampler(sampler) as number) !== 0;
}

/**
 * `GLboolean glIsShader(GLuint shader)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param shader - `GLuint`, object kind `shader`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsShader.xhtml
 */
export function isShader(shader: GLuint): boolean {
    return (glIsShader(shader) as number) !== 0;
}

/**
 * `GLboolean glIsSync(GLsync sync)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param sync - `GLsync`, object kind `sync`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsSync.xhtml
 */
export function isSync(sync: GLsync): boolean {
    return (glIsSync(sync) as number) !== 0;
}

/**
 * `GLboolean glIsTexture(GLuint texture)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsTexture.xhtml
 */
export function isTexture(texture: GLuint): boolean {
    return (glIsTexture(texture) as number) !== 0;
}

/**
 * `GLboolean glIsTransformFeedback(GLuint id)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param id - `GLuint`, object kind `transform feedback`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsTransformFeedback.xhtml
 */
export function isTransformFeedback(id: GLuint): boolean {
    return (glIsTransformFeedback(id) as number) !== 0;
}

/**
 * `GLboolean glIsVertexArray(GLuint array)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param array - `GLuint`, object kind `vertex array`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glIsVertexArray.xhtml
 */
export function isVertexArray(array: GLuint): boolean {
    return (glIsVertexArray(array) as number) !== 0;
}

/**
 * `void glLineWidth(GLfloat width)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param width - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glLineWidth.xhtml
 */
export function lineWidth(width: GLfloat): void {
    glLineWidth(width);
}

/**
 * `void glLinkProgram(GLuint program)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glLinkProgram.xhtml
 */
export function linkProgram(program: GLuint): void {
    glLinkProgram(program);
}

/**
 * `void glLogicOp(GLenum opcode)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param opcode - `GLenum`, group `LogicOp`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glLogicOp.xhtml
 */
export function logicOp(opcode: LogicOp): void {
    glLogicOp(opcode);
}

/**
 * `void * glMapBuffer(GLenum target, GLenum access)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param access - `GLenum`, group `BufferAccessARB`
 * @returns `void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMapBuffer.xhtml
 */
export function mapBuffer(target: BufferTargetARB, access: BufferAccessARB): GLpointer {
    return glMapBuffer(target, access) as GLpointer;
}

/**
 * `void * glMapBufferRange(GLenum target, GLintptr offset, GLsizeiptr length, GLbitfield access)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @param offset - `GLintptr`
 * @param length - `GLsizeiptr`
 * @param access - `GLbitfield`, group `MapBufferAccessMask`
 * @returns `void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMapBufferRange.xhtml
 */
export function mapBufferRange(
    target: BufferTargetARB,
    offset: GLintptr,
    length: GLsizeiptr,
    access: MapBufferAccessMask,
): GLpointer {
    return glMapBufferRange(target, offset, length, access) as GLpointer;
}

/**
 * `void * glMapNamedBuffer(GLuint buffer, GLenum access)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param access - `GLenum`, group `BufferAccessARB`
 * @returns `void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMapNamedBuffer.xhtml
 */
export function mapNamedBuffer(buffer: GLuint, access: BufferAccessARB): GLpointer {
    return glMapNamedBuffer(buffer, access) as GLpointer;
}

/**
 * `void * glMapNamedBufferRange(GLuint buffer, GLintptr offset, GLsizeiptr length, GLbitfield access)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param length - `GLsizeiptr`
 * @param access - `GLbitfield`, group `MapBufferAccessMask`
 * @returns `void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMapNamedBufferRange.xhtml
 */
export function mapNamedBufferRange(
    buffer: GLuint,
    offset: GLintptr,
    length: GLsizeiptr,
    access: MapBufferAccessMask,
): GLpointer {
    return glMapNamedBufferRange(buffer, offset, length, access) as GLpointer;
}

/**
 * `void glMemoryBarrier(GLbitfield barriers)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param barriers - `GLbitfield`, group `MemoryBarrierMask`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMemoryBarrier.xhtml
 */
export function memoryBarrier(barriers: MemoryBarrierMask): void {
    glMemoryBarrier(barriers);
}

/**
 * `void glMemoryBarrierByRegion(GLbitfield barriers)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param barriers - `GLbitfield`, group `MemoryBarrierMask`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMemoryBarrierByRegion.xhtml
 */
export function memoryBarrierByRegion(barriers: MemoryBarrierMask): void {
    glMemoryBarrierByRegion(barriers);
}

/**
 * `void glMinSampleShading(GLfloat value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param value - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMinSampleShading.xhtml
 */
export function minSampleShading(value: GLfloat): void {
    glMinSampleShading(value);
}

/**
 * `void glMultiDrawArrays(GLenum mode, const GLint *first, const GLsizei *count, GLsizei drawcount)`
 *
 * Provided by `GL_VERSION_1_4`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param first - `const GLint *`, length `drawcount`
 * @param count - `const GLsizei *`, length `drawcount`
 * @param drawcount - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMultiDrawArrays.xhtml
 */
export function multiDrawArrays(
    mode: PrimitiveType,
    first: readonly GLint[] | Int32Array,
    count: readonly GLsizei[] | Int32Array,
    drawcount: GLsizei,
): void {
    glMultiDrawArrays(mode, first, count, drawcount);
}

/**
 * `void glMultiDrawArraysIndirect(GLenum mode, const void *indirect, GLsizei drawcount, GLsizei stride)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param indirect - `const void *`, length `COMPSIZE(drawcount,stride)`
 * @param drawcount - `GLsizei`
 * @param stride - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMultiDrawArraysIndirect.xhtml
 */
export function multiDrawArraysIndirect(
    mode: PrimitiveType,
    indirect: GLintptr,
    drawcount: GLsizei,
    stride: GLsizei,
): void {
    glMultiDrawArraysIndirect(mode, indirect, drawcount, stride);
}

/**
 * `void glMultiDrawArraysIndirectCount(GLenum mode, const void *indirect, GLintptr drawcount, GLsizei maxdrawcount, GLsizei stride)`
 *
 * Provided by `GL_VERSION_4_6`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param indirect - `const void *`
 * @param drawcount - `GLintptr`
 * @param maxdrawcount - `GLsizei`
 * @param stride - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMultiDrawArraysIndirectCount.xhtml
 */
export function multiDrawArraysIndirectCount(
    mode: PrimitiveType,
    indirect: ArrayBufferView | GLintptr | null,
    drawcount: GLintptr,
    maxdrawcount: GLsizei,
    stride: GLsizei,
): void {
    glMultiDrawArraysIndirectCount(mode, indirect, drawcount, maxdrawcount, stride);
}

/**
 * `void glMultiDrawElements(GLenum mode, const GLsizei *count, GLenum type, const void *const*indices, GLsizei drawcount)`
 *
 * Provided by `GL_VERSION_1_4`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param count - `const GLsizei *`, length `drawcount`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indices - `const void *const*`, length `drawcount`
 * @param drawcount - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMultiDrawElements.xhtml
 */
export function multiDrawElements(
    mode: PrimitiveType,
    count: readonly GLsizei[] | Int32Array,
    type: DrawElementsType,
    indices: readonly GLintptr[],
    drawcount: GLsizei,
): void {
    glMultiDrawElements(mode, count, type, indices, drawcount);
}

/**
 * `void glMultiDrawElementsBaseVertex(GLenum mode, const GLsizei *count, GLenum type, const void *const*indices, GLsizei drawcount, const GLint *basevertex)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param count - `const GLsizei *`, length `drawcount`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indices - `const void *const*`, length `drawcount`
 * @param drawcount - `GLsizei`
 * @param basevertex - `const GLint *`, length `drawcount`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMultiDrawElementsBaseVertex.xhtml
 */
export function multiDrawElementsBaseVertex(
    mode: PrimitiveType,
    count: readonly GLsizei[] | Int32Array,
    type: DrawElementsType,
    indices: readonly GLintptr[],
    drawcount: GLsizei,
    basevertex: readonly GLint[] | Int32Array,
): void {
    glMultiDrawElementsBaseVertex(mode, count, type, indices, drawcount, basevertex);
}

/**
 * `void glMultiDrawElementsIndirect(GLenum mode, GLenum type, const void *indirect, GLsizei drawcount, GLsizei stride)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indirect - `const void *`, length `COMPSIZE(drawcount,stride)`
 * @param drawcount - `GLsizei`
 * @param stride - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMultiDrawElementsIndirect.xhtml
 */
export function multiDrawElementsIndirect(
    mode: PrimitiveType,
    type: DrawElementsType,
    indirect: GLintptr,
    drawcount: GLsizei,
    stride: GLsizei,
): void {
    glMultiDrawElementsIndirect(mode, type, indirect, drawcount, stride);
}

/**
 * `void glMultiDrawElementsIndirectCount(GLenum mode, GLenum type, const void *indirect, GLintptr drawcount, GLsizei maxdrawcount, GLsizei stride)`
 *
 * Provided by `GL_VERSION_4_6`.
 *
 * @param mode - `GLenum`, group `PrimitiveType`
 * @param type - `GLenum`, group `DrawElementsType`
 * @param indirect - `const void *`
 * @param drawcount - `GLintptr`
 * @param maxdrawcount - `GLsizei`
 * @param stride - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMultiDrawElementsIndirectCount.xhtml
 */
export function multiDrawElementsIndirectCount(
    mode: PrimitiveType,
    type: DrawElementsType,
    indirect: ArrayBufferView | GLintptr | null,
    drawcount: GLintptr,
    maxdrawcount: GLsizei,
    stride: GLsizei,
): void {
    glMultiDrawElementsIndirectCount(mode, type, indirect, drawcount, maxdrawcount, stride);
}

/**
 * `void glNamedBufferData(GLuint buffer, GLsizeiptr size, const void *data, GLenum usage)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param size - `GLsizeiptr`
 * @param data - `const void *`, length `size`
 * @param usage - `GLenum`, group `BufferUsageARB`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedBufferData.xhtml
 */
export function namedBufferData(
    buffer: GLuint,
    size: GLsizeiptr,
    data: ArrayBufferView | GLintptr | null,
    usage: BufferUsageARB,
): void {
    glNamedBufferData(buffer, size, data, usage);
}

/**
 * `void glNamedBufferStorage(GLuint buffer, GLsizeiptr size, const void *data, GLbitfield flags)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param size - `GLsizeiptr`
 * @param data - `const void *`, length `size`
 * @param flags - `GLbitfield`, group `BufferStorageMask`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedBufferStorage.xhtml
 */
export function namedBufferStorage(
    buffer: GLuint,
    size: GLsizeiptr,
    data: ArrayBufferView | GLintptr | null,
    flags: BufferStorageMask,
): void {
    glNamedBufferStorage(buffer, size, data, flags);
}

/**
 * `void glNamedBufferSubData(GLuint buffer, GLintptr offset, GLsizeiptr size, const void *data)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @param data - `const void *`, length `size`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedBufferSubData.xhtml
 */
export function namedBufferSubData(
    buffer: GLuint,
    offset: GLintptr,
    size: GLsizeiptr,
    data: ArrayBufferView | GLintptr | null,
): void {
    glNamedBufferSubData(buffer, offset, size, data);
}

/**
 * `void glNamedFramebufferDrawBuffer(GLuint framebuffer, GLenum buf)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param buf - `GLenum`, group `ColorBuffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedFramebufferDrawBuffer.xhtml
 */
export function namedFramebufferDrawBuffer(framebuffer: GLuint, buf: ColorBuffer): void {
    glNamedFramebufferDrawBuffer(framebuffer, buf);
}

/**
 * `void glNamedFramebufferDrawBuffers(GLuint framebuffer, GLsizei n, const GLenum *bufs)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param n - `GLsizei`
 * @param bufs - `const GLenum *`, group `ColorBuffer`, length `n`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedFramebufferDrawBuffers.xhtml
 */
export function namedFramebufferDrawBuffers(
    framebuffer: GLuint,
    n: GLsizei,
    bufs: readonly ColorBuffer[] | Uint32Array,
): void {
    glNamedFramebufferDrawBuffers(framebuffer, n, bufs);
}

/**
 * `void glNamedFramebufferParameteri(GLuint framebuffer, GLenum pname, GLint param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param pname - `GLenum`, group `FramebufferParameterName`
 * @param param - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedFramebufferParameteri.xhtml
 */
export function namedFramebufferParameteri(framebuffer: GLuint, pname: FramebufferParameterName, param: GLint): void {
    glNamedFramebufferParameteri(framebuffer, pname, param);
}

/**
 * `void glNamedFramebufferReadBuffer(GLuint framebuffer, GLenum src)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param src - `GLenum`, group `ColorBuffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedFramebufferReadBuffer.xhtml
 */
export function namedFramebufferReadBuffer(framebuffer: GLuint, src: ColorBuffer): void {
    glNamedFramebufferReadBuffer(framebuffer, src);
}

/**
 * `void glNamedFramebufferRenderbuffer(GLuint framebuffer, GLenum attachment, GLenum renderbuffertarget, GLuint renderbuffer)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param renderbuffertarget - `GLenum`, group `RenderbufferTarget`
 * @param renderbuffer - `GLuint`, object kind `renderbuffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedFramebufferRenderbuffer.xhtml
 */
export function namedFramebufferRenderbuffer(
    framebuffer: GLuint,
    attachment: FramebufferAttachment,
    renderbuffertarget: RenderbufferTarget,
    renderbuffer: GLuint,
): void {
    glNamedFramebufferRenderbuffer(framebuffer, attachment, renderbuffertarget, renderbuffer);
}

/**
 * `void glNamedFramebufferTexture(GLuint framebuffer, GLenum attachment, GLuint texture, GLint level)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedFramebufferTexture.xhtml
 */
export function namedFramebufferTexture(
    framebuffer: GLuint,
    attachment: FramebufferAttachment,
    texture: GLuint,
    level: GLint,
): void {
    glNamedFramebufferTexture(framebuffer, attachment, texture, level);
}

/**
 * `void glNamedFramebufferTextureLayer(GLuint framebuffer, GLenum attachment, GLuint texture, GLint level, GLint layer)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param framebuffer - `GLuint`, object kind `framebuffer`
 * @param attachment - `GLenum`, group `FramebufferAttachment`
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param layer - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedFramebufferTextureLayer.xhtml
 */
export function namedFramebufferTextureLayer(
    framebuffer: GLuint,
    attachment: FramebufferAttachment,
    texture: GLuint,
    level: GLint,
    layer: GLint,
): void {
    glNamedFramebufferTextureLayer(framebuffer, attachment, texture, level, layer);
}

/**
 * `void glNamedRenderbufferStorage(GLuint renderbuffer, GLenum internalformat, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param renderbuffer - `GLuint`, object kind `renderbuffer`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedRenderbufferStorage.xhtml
 */
export function namedRenderbufferStorage(
    renderbuffer: GLuint,
    internalformat: InternalFormat,
    width: GLsizei,
    height: GLsizei,
): void {
    glNamedRenderbufferStorage(renderbuffer, internalformat, width, height);
}

/**
 * `void glNamedRenderbufferStorageMultisample(GLuint renderbuffer, GLsizei samples, GLenum internalformat, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param renderbuffer - `GLuint`, object kind `renderbuffer`
 * @param samples - `GLsizei`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glNamedRenderbufferStorageMultisample.xhtml
 */
export function namedRenderbufferStorageMultisample(
    renderbuffer: GLuint,
    samples: GLsizei,
    internalformat: InternalFormat,
    width: GLsizei,
    height: GLsizei,
): void {
    glNamedRenderbufferStorageMultisample(renderbuffer, samples, internalformat, width, height);
}

/**
 * `void glObjectLabel(GLenum identifier, GLuint name, GLsizei length, const GLchar *label)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param identifier - `GLenum`, group `ObjectIdentifier`
 * @param name - `GLuint`
 * @param length - `GLsizei`
 * @param label - `const GLchar *`, length `COMPSIZE(label,length)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glObjectLabel.xhtml
 */
export function objectLabel(identifier: ObjectIdentifier, name: GLuint, length: GLsizei, label: string): void {
    glObjectLabel(identifier, name, length, label);
}

/**
 * `void glObjectPtrLabel(const void *ptr, GLsizei length, const GLchar *label)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param ptr - `const void *`
 * @param length - `GLsizei`
 * @param label - `const GLchar *`, length `COMPSIZE(label,length)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glObjectPtrLabel.xhtml
 */
export function objectPtrLabel(ptr: ArrayBufferView | GLintptr | null, length: GLsizei, label: string): void {
    glObjectPtrLabel(ptr, length, label);
}

/**
 * `void glPatchParameterfv(GLenum pname, const GLfloat *values)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param pname - `GLenum`, group `PatchParameterName`
 * @param values - `const GLfloat *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPatchParameterfv.xhtml
 */
export function patchParameterfv(pname: PatchParameterName, values: readonly GLfloat[] | Float32Array): void {
    glPatchParameterfv(pname, values);
}

/**
 * `void glPatchParameteri(GLenum pname, GLint value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param pname - `GLenum`, group `PatchParameterName`
 * @param value - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPatchParameteri.xhtml
 */
export function patchParameteri(pname: PatchParameterName, value: GLint): void {
    glPatchParameteri(pname, value);
}

/**
 * `void glPauseTransformFeedback()`
 *
 * Provided by `GL_VERSION_4_0`.
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPauseTransformFeedback.xhtml
 */
export function pauseTransformFeedback(): void {
    glPauseTransformFeedback();
}

/**
 * `void glPixelStoref(GLenum pname, GLfloat param)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param pname - `GLenum`, group `PixelStoreParameter`
 * @param param - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPixelStoref.xhtml
 */
export function pixelStoref(pname: PixelStoreParameter, param: GLfloat): void {
    glPixelStoref(pname, param);
}

/**
 * `void glPixelStorei(GLenum pname, GLint param)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param pname - `GLenum`, group `PixelStoreParameter`
 * @param param - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPixelStorei.xhtml
 */
export function pixelStorei(pname: PixelStoreParameter, param: GLint): void {
    glPixelStorei(pname, param);
}

/**
 * `void glPointParameterf(GLenum pname, GLfloat param)`
 *
 * Provided by `GL_VERSION_1_4`.
 *
 * @param pname - `GLenum`, group `PointParameterNameARB`
 * @param param - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPointParameterf.xhtml
 */
export function pointParameterf(pname: PointParameterNameARB, param: GLfloat): void {
    glPointParameterf(pname, param);
}

/**
 * `void glPointParameterfv(GLenum pname, const GLfloat *params)`
 *
 * Provided by `GL_VERSION_1_4`.
 *
 * @param pname - `GLenum`, group `PointParameterNameARB`
 * @param params - `const GLfloat *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPointParameterfv.xhtml
 */
export function pointParameterfv(pname: PointParameterNameARB, params: readonly GLfloat[] | Float32Array): void {
    glPointParameterfv(pname, params);
}

/**
 * `void glPointParameteri(GLenum pname, GLint param)`
 *
 * Provided by `GL_VERSION_1_4`.
 *
 * @param pname - `GLenum`, group `PointParameterNameARB`
 * @param param - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPointParameteri.xhtml
 */
export function pointParameteri(pname: PointParameterNameARB, param: GLint): void {
    glPointParameteri(pname, param);
}

/**
 * `void glPointParameteriv(GLenum pname, const GLint *params)`
 *
 * Provided by `GL_VERSION_1_4`.
 *
 * @param pname - `GLenum`, group `PointParameterNameARB`
 * @param params - `const GLint *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPointParameteriv.xhtml
 */
export function pointParameteriv(pname: PointParameterNameARB, params: readonly GLint[] | Int32Array): void {
    glPointParameteriv(pname, params);
}

/**
 * `void glPointSize(GLfloat size)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param size - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPointSize.xhtml
 */
export function pointSize(size: GLfloat): void {
    glPointSize(size);
}

/**
 * `void glPolygonMode(GLenum face, GLenum mode)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param face - `GLenum`, group `TriangleFace`
 * @param mode - `GLenum`, group `PolygonMode`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPolygonMode.xhtml
 */
export function polygonMode(face: TriangleFace, mode: PolygonMode): void {
    glPolygonMode(face, mode);
}

/**
 * `void glPolygonOffset(GLfloat factor, GLfloat units)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param factor - `GLfloat`
 * @param units - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPolygonOffset.xhtml
 */
export function polygonOffset(factor: GLfloat, units: GLfloat): void {
    glPolygonOffset(factor, units);
}

/**
 * `void glPolygonOffsetClamp(GLfloat factor, GLfloat units, GLfloat clamp)`
 *
 * Provided by `GL_VERSION_4_6`.
 *
 * @param factor - `GLfloat`
 * @param units - `GLfloat`
 * @param clamp - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPolygonOffsetClamp.xhtml
 */
export function polygonOffsetClamp(factor: GLfloat, units: GLfloat, clamp: GLfloat): void {
    glPolygonOffsetClamp(factor, units, clamp);
}

/**
 * `void glPopDebugGroup()`
 *
 * Provided by `GL_VERSION_4_3`.
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPopDebugGroup.xhtml
 */
export function popDebugGroup(): void {
    glPopDebugGroup();
}

/**
 * `void glPrimitiveRestartIndex(GLuint index)`
 *
 * Provided by `GL_VERSION_3_1`.
 *
 * @param index - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPrimitiveRestartIndex.xhtml
 */
export function primitiveRestartIndex(index: GLuint): void {
    glPrimitiveRestartIndex(index);
}

/**
 * `void glProgramBinary(GLuint program, GLenum binaryFormat, const void *binary, GLsizei length)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param binaryFormat - `GLenum`
 * @param binary - `const void *`, length `length`
 * @param length - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramBinary.xhtml
 */
export function programBinary(
    program: GLuint,
    binaryFormat: GLenum,
    binary: ArrayBufferView | GLintptr | null,
    length: GLsizei,
): void {
    glProgramBinary(program, binaryFormat, binary, length);
}

/**
 * `void glProgramParameteri(GLuint program, GLenum pname, GLint value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param pname - `GLenum`, group `ProgramParameterPName`
 * @param value - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramParameteri.xhtml
 */
export function programParameteri(program: GLuint, pname: ProgramParameterPName, value: GLint): void {
    glProgramParameteri(program, pname, value);
}

/**
 * `void glProgramUniform1d(GLuint program, GLint location, GLdouble v0)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform1d.xhtml
 */
export function programUniform1d(program: GLuint, location: GLint, v0: GLdouble): void {
    glProgramUniform1d(program, location, v0);
}

/**
 * `void glProgramUniform1dv(GLuint program, GLint location, GLsizei count, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLdouble *`, length `count`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform1dv.xhtml
 */
export function programUniform1dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniform1dv(program, location, count, value);
}

/**
 * `void glProgramUniform1f(GLuint program, GLint location, GLfloat v0)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform1f.xhtml
 */
export function programUniform1f(program: GLuint, location: GLint, v0: GLfloat): void {
    glProgramUniform1f(program, location, v0);
}

/**
 * `void glProgramUniform1fv(GLuint program, GLint location, GLsizei count, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLfloat *`, length `count`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform1fv.xhtml
 */
export function programUniform1fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniform1fv(program, location, count, value);
}

/**
 * `void glProgramUniform1i(GLuint program, GLint location, GLint v0)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform1i.xhtml
 */
export function programUniform1i(program: GLuint, location: GLint, v0: GLint): void {
    glProgramUniform1i(program, location, v0);
}

/**
 * `void glProgramUniform1iv(GLuint program, GLint location, GLsizei count, const GLint *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLint *`, length `count`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform1iv.xhtml
 */
export function programUniform1iv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLint[] | Int32Array,
): void {
    glProgramUniform1iv(program, location, count, value);
}

/**
 * `void glProgramUniform1ui(GLuint program, GLint location, GLuint v0)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform1ui.xhtml
 */
export function programUniform1ui(program: GLuint, location: GLint, v0: GLuint): void {
    glProgramUniform1ui(program, location, v0);
}

/**
 * `void glProgramUniform1uiv(GLuint program, GLint location, GLsizei count, const GLuint *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLuint *`, length `count`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform1uiv.xhtml
 */
export function programUniform1uiv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLuint[] | Uint32Array,
): void {
    glProgramUniform1uiv(program, location, count, value);
}

/**
 * `void glProgramUniform2d(GLuint program, GLint location, GLdouble v0, GLdouble v1)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLdouble`
 * @param v1 - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform2d.xhtml
 */
export function programUniform2d(program: GLuint, location: GLint, v0: GLdouble, v1: GLdouble): void {
    glProgramUniform2d(program, location, v0, v1);
}

/**
 * `void glProgramUniform2dv(GLuint program, GLint location, GLsizei count, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLdouble *`, length `count*2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform2dv.xhtml
 */
export function programUniform2dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniform2dv(program, location, count, value);
}

/**
 * `void glProgramUniform2f(GLuint program, GLint location, GLfloat v0, GLfloat v1)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLfloat`
 * @param v1 - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform2f.xhtml
 */
export function programUniform2f(program: GLuint, location: GLint, v0: GLfloat, v1: GLfloat): void {
    glProgramUniform2f(program, location, v0, v1);
}

/**
 * `void glProgramUniform2fv(GLuint program, GLint location, GLsizei count, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLfloat *`, length `count*2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform2fv.xhtml
 */
export function programUniform2fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniform2fv(program, location, count, value);
}

/**
 * `void glProgramUniform2i(GLuint program, GLint location, GLint v0, GLint v1)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLint`
 * @param v1 - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform2i.xhtml
 */
export function programUniform2i(program: GLuint, location: GLint, v0: GLint, v1: GLint): void {
    glProgramUniform2i(program, location, v0, v1);
}

/**
 * `void glProgramUniform2iv(GLuint program, GLint location, GLsizei count, const GLint *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLint *`, length `count*2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform2iv.xhtml
 */
export function programUniform2iv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLint[] | Int32Array,
): void {
    glProgramUniform2iv(program, location, count, value);
}

/**
 * `void glProgramUniform2ui(GLuint program, GLint location, GLuint v0, GLuint v1)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLuint`
 * @param v1 - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform2ui.xhtml
 */
export function programUniform2ui(program: GLuint, location: GLint, v0: GLuint, v1: GLuint): void {
    glProgramUniform2ui(program, location, v0, v1);
}

/**
 * `void glProgramUniform2uiv(GLuint program, GLint location, GLsizei count, const GLuint *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLuint *`, length `count*2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform2uiv.xhtml
 */
export function programUniform2uiv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLuint[] | Uint32Array,
): void {
    glProgramUniform2uiv(program, location, count, value);
}

/**
 * `void glProgramUniform3d(GLuint program, GLint location, GLdouble v0, GLdouble v1, GLdouble v2)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLdouble`
 * @param v1 - `GLdouble`
 * @param v2 - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform3d.xhtml
 */
export function programUniform3d(program: GLuint, location: GLint, v0: GLdouble, v1: GLdouble, v2: GLdouble): void {
    glProgramUniform3d(program, location, v0, v1, v2);
}

/**
 * `void glProgramUniform3dv(GLuint program, GLint location, GLsizei count, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLdouble *`, length `count*3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform3dv.xhtml
 */
export function programUniform3dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniform3dv(program, location, count, value);
}

/**
 * `void glProgramUniform3f(GLuint program, GLint location, GLfloat v0, GLfloat v1, GLfloat v2)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLfloat`
 * @param v1 - `GLfloat`
 * @param v2 - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform3f.xhtml
 */
export function programUniform3f(program: GLuint, location: GLint, v0: GLfloat, v1: GLfloat, v2: GLfloat): void {
    glProgramUniform3f(program, location, v0, v1, v2);
}

/**
 * `void glProgramUniform3fv(GLuint program, GLint location, GLsizei count, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLfloat *`, length `count*3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform3fv.xhtml
 */
export function programUniform3fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniform3fv(program, location, count, value);
}

/**
 * `void glProgramUniform3i(GLuint program, GLint location, GLint v0, GLint v1, GLint v2)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLint`
 * @param v1 - `GLint`
 * @param v2 - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform3i.xhtml
 */
export function programUniform3i(program: GLuint, location: GLint, v0: GLint, v1: GLint, v2: GLint): void {
    glProgramUniform3i(program, location, v0, v1, v2);
}

/**
 * `void glProgramUniform3iv(GLuint program, GLint location, GLsizei count, const GLint *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLint *`, length `count*3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform3iv.xhtml
 */
export function programUniform3iv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLint[] | Int32Array,
): void {
    glProgramUniform3iv(program, location, count, value);
}

/**
 * `void glProgramUniform3ui(GLuint program, GLint location, GLuint v0, GLuint v1, GLuint v2)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLuint`
 * @param v1 - `GLuint`
 * @param v2 - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform3ui.xhtml
 */
export function programUniform3ui(program: GLuint, location: GLint, v0: GLuint, v1: GLuint, v2: GLuint): void {
    glProgramUniform3ui(program, location, v0, v1, v2);
}

/**
 * `void glProgramUniform3uiv(GLuint program, GLint location, GLsizei count, const GLuint *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLuint *`, length `count*3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform3uiv.xhtml
 */
export function programUniform3uiv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLuint[] | Uint32Array,
): void {
    glProgramUniform3uiv(program, location, count, value);
}

/**
 * `void glProgramUniform4d(GLuint program, GLint location, GLdouble v0, GLdouble v1, GLdouble v2, GLdouble v3)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLdouble`
 * @param v1 - `GLdouble`
 * @param v2 - `GLdouble`
 * @param v3 - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform4d.xhtml
 */
export function programUniform4d(
    program: GLuint,
    location: GLint,
    v0: GLdouble,
    v1: GLdouble,
    v2: GLdouble,
    v3: GLdouble,
): void {
    glProgramUniform4d(program, location, v0, v1, v2, v3);
}

/**
 * `void glProgramUniform4dv(GLuint program, GLint location, GLsizei count, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLdouble *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform4dv.xhtml
 */
export function programUniform4dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniform4dv(program, location, count, value);
}

/**
 * `void glProgramUniform4f(GLuint program, GLint location, GLfloat v0, GLfloat v1, GLfloat v2, GLfloat v3)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLfloat`
 * @param v1 - `GLfloat`
 * @param v2 - `GLfloat`
 * @param v3 - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform4f.xhtml
 */
export function programUniform4f(
    program: GLuint,
    location: GLint,
    v0: GLfloat,
    v1: GLfloat,
    v2: GLfloat,
    v3: GLfloat,
): void {
    glProgramUniform4f(program, location, v0, v1, v2, v3);
}

/**
 * `void glProgramUniform4fv(GLuint program, GLint location, GLsizei count, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLfloat *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform4fv.xhtml
 */
export function programUniform4fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniform4fv(program, location, count, value);
}

/**
 * `void glProgramUniform4i(GLuint program, GLint location, GLint v0, GLint v1, GLint v2, GLint v3)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLint`
 * @param v1 - `GLint`
 * @param v2 - `GLint`
 * @param v3 - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform4i.xhtml
 */
export function programUniform4i(program: GLuint, location: GLint, v0: GLint, v1: GLint, v2: GLint, v3: GLint): void {
    glProgramUniform4i(program, location, v0, v1, v2, v3);
}

/**
 * `void glProgramUniform4iv(GLuint program, GLint location, GLsizei count, const GLint *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLint *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform4iv.xhtml
 */
export function programUniform4iv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLint[] | Int32Array,
): void {
    glProgramUniform4iv(program, location, count, value);
}

/**
 * `void glProgramUniform4ui(GLuint program, GLint location, GLuint v0, GLuint v1, GLuint v2, GLuint v3)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param v0 - `GLuint`
 * @param v1 - `GLuint`
 * @param v2 - `GLuint`
 * @param v3 - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform4ui.xhtml
 */
export function programUniform4ui(
    program: GLuint,
    location: GLint,
    v0: GLuint,
    v1: GLuint,
    v2: GLuint,
    v3: GLuint,
): void {
    glProgramUniform4ui(program, location, v0, v1, v2, v3);
}

/**
 * `void glProgramUniform4uiv(GLuint program, GLint location, GLsizei count, const GLuint *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLuint *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniform4uiv.xhtml
 */
export function programUniform4uiv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    value: readonly GLuint[] | Uint32Array,
): void {
    glProgramUniform4uiv(program, location, count, value);
}

/**
 * `void glProgramUniformMatrix2dv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix2dv.xhtml
 */
export function programUniformMatrix2dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniformMatrix2dv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix2fv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix2fv.xhtml
 */
export function programUniformMatrix2fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniformMatrix2fv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix2x3dv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*6`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix2x3dv.xhtml
 */
export function programUniformMatrix2x3dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniformMatrix2x3dv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix2x3fv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*6`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix2x3fv.xhtml
 */
export function programUniformMatrix2x3fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniformMatrix2x3fv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix2x4dv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*8`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix2x4dv.xhtml
 */
export function programUniformMatrix2x4dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniformMatrix2x4dv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix2x4fv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*8`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix2x4fv.xhtml
 */
export function programUniformMatrix2x4fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniformMatrix2x4fv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix3dv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*9`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix3dv.xhtml
 */
export function programUniformMatrix3dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniformMatrix3dv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix3fv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*9`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix3fv.xhtml
 */
export function programUniformMatrix3fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniformMatrix3fv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix3x2dv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*6`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix3x2dv.xhtml
 */
export function programUniformMatrix3x2dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniformMatrix3x2dv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix3x2fv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*6`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix3x2fv.xhtml
 */
export function programUniformMatrix3x2fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniformMatrix3x2fv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix3x4dv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*12`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix3x4dv.xhtml
 */
export function programUniformMatrix3x4dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniformMatrix3x4dv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix3x4fv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*12`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix3x4fv.xhtml
 */
export function programUniformMatrix3x4fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniformMatrix3x4fv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix4dv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*16`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix4dv.xhtml
 */
export function programUniformMatrix4dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniformMatrix4dv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix4fv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*16`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix4fv.xhtml
 */
export function programUniformMatrix4fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniformMatrix4fv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix4x2dv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*8`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix4x2dv.xhtml
 */
export function programUniformMatrix4x2dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniformMatrix4x2dv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix4x2fv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*8`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix4x2fv.xhtml
 */
export function programUniformMatrix4x2fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniformMatrix4x2fv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix4x3dv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*12`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix4x3dv.xhtml
 */
export function programUniformMatrix4x3dv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glProgramUniformMatrix4x3dv(program, location, count, transpose, value);
}

/**
 * `void glProgramUniformMatrix4x3fv(GLuint program, GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*12`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProgramUniformMatrix4x3fv.xhtml
 */
export function programUniformMatrix4x3fv(
    program: GLuint,
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glProgramUniformMatrix4x3fv(program, location, count, transpose, value);
}

/**
 * `void glProvokingVertex(GLenum mode)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param mode - `GLenum`, group `VertexProvokingMode`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glProvokingVertex.xhtml
 */
export function provokingVertex(mode: VertexProvokingMode): void {
    glProvokingVertex(mode);
}

/**
 * `void glPushDebugGroup(GLenum source, GLuint id, GLsizei length, const GLchar *message)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param source - `GLenum`, group `DebugSource`
 * @param id - `GLuint`
 * @param length - `GLsizei`
 * @param message - `const GLchar *`, length `COMPSIZE(message,length)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPushDebugGroup.xhtml
 */
export function pushDebugGroup(source: DebugSource, id: GLuint, length: GLsizei, message: string): void {
    glPushDebugGroup(source, id, length, message);
}

/**
 * `void glQueryCounter(GLuint id, GLenum target)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param id - `GLuint`, object kind `query`
 * @param target - `GLenum`, group `QueryCounterTarget`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glQueryCounter.xhtml
 */
export function queryCounter(id: GLuint, target: QueryCounterTarget): void {
    glQueryCounter(id, target);
}

/**
 * `void glReadBuffer(GLenum src)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param src - `GLenum`, group `ReadBufferMode`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glReadBuffer.xhtml
 */
export function readBuffer(src: ReadBufferMode): void {
    glReadBuffer(src);
}

/**
 * `void glReadnPixels(GLint x, GLint y, GLsizei width, GLsizei height, GLenum format, GLenum type, GLsizei bufSize, void *data)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param bufSize - `GLsizei`
 * @param data - `void *`, length `bufSize`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glReadnPixels.xhtml
 */
export function readnPixels(
    x: GLint,
    y: GLint,
    width: GLsizei,
    height: GLsizei,
    format: PixelFormat,
    type: PixelType,
    bufSize: GLsizei,
    data: ArrayBufferView | GLintptr | null,
): void {
    glReadnPixels(x, y, width, height, format, type, bufSize, data);
}

/**
 * `void glReadPixels(GLint x, GLint y, GLsizei width, GLsizei height, GLenum format, GLenum type, void *pixels)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `void *`, length `COMPSIZE(format,type,width,height)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glReadPixels.xhtml
 */
export function readPixels(
    x: GLint,
    y: GLint,
    width: GLsizei,
    height: GLsizei,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glReadPixels(x, y, width, height, format, type, pixels);
}

/**
 * `void glReleaseShaderCompiler()`
 *
 * Provided by `GL_VERSION_4_1`.
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glReleaseShaderCompiler.xhtml
 */
export function releaseShaderCompiler(): void {
    glReleaseShaderCompiler();
}

/**
 * `void glRenderbufferStorage(GLenum target, GLenum internalformat, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `RenderbufferTarget`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glRenderbufferStorage.xhtml
 */
export function renderbufferStorage(
    target: RenderbufferTarget,
    internalformat: InternalFormat,
    width: GLsizei,
    height: GLsizei,
): void {
    glRenderbufferStorage(target, internalformat, width, height);
}

/**
 * `void glRenderbufferStorageMultisample(GLenum target, GLsizei samples, GLenum internalformat, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `RenderbufferTarget`
 * @param samples - `GLsizei`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glRenderbufferStorageMultisample.xhtml
 */
export function renderbufferStorageMultisample(
    target: RenderbufferTarget,
    samples: GLsizei,
    internalformat: InternalFormat,
    width: GLsizei,
    height: GLsizei,
): void {
    glRenderbufferStorageMultisample(target, samples, internalformat, width, height);
}

/**
 * `void glResumeTransformFeedback()`
 *
 * Provided by `GL_VERSION_4_0`.
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glResumeTransformFeedback.xhtml
 */
export function resumeTransformFeedback(): void {
    glResumeTransformFeedback();
}

/**
 * `void glSampleCoverage(GLfloat value, GLboolean invert)`
 *
 * Provided by `GL_VERSION_1_3`.
 *
 * @param value - `GLfloat`
 * @param invert - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glSampleCoverage.xhtml
 */
export function sampleCoverage(value: GLfloat, invert: boolean): void {
    glSampleCoverage(value, invert);
}

/**
 * `void glSampleMaski(GLuint maskNumber, GLbitfield mask)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param maskNumber - `GLuint`
 * @param mask - `GLbitfield`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glSampleMaski.xhtml
 */
export function sampleMaski(maskNumber: GLuint, mask: GLbitfield): void {
    glSampleMaski(maskNumber, mask);
}

/**
 * `void glSamplerParameterf(GLuint sampler, GLenum pname, GLfloat param)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param sampler - `GLuint`, object kind `sampler`
 * @param pname - `GLenum`, group `SamplerParameterF`
 * @param param - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glSamplerParameterf.xhtml
 */
export function samplerParameterf(sampler: GLuint, pname: SamplerParameterF, param: GLfloat): void {
    glSamplerParameterf(sampler, pname, param);
}

/**
 * `void glSamplerParameterfv(GLuint sampler, GLenum pname, const GLfloat *param)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param sampler - `GLuint`, object kind `sampler`
 * @param pname - `GLenum`, group `SamplerParameterF`
 * @param param - `const GLfloat *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glSamplerParameterfv.xhtml
 */
export function samplerParameterfv(
    sampler: GLuint,
    pname: SamplerParameterF,
    param: readonly GLfloat[] | Float32Array,
): void {
    glSamplerParameterfv(sampler, pname, param);
}

/**
 * `void glSamplerParameteri(GLuint sampler, GLenum pname, GLint param)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param sampler - `GLuint`, object kind `sampler`
 * @param pname - `GLenum`, group `SamplerParameterI`
 * @param param - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glSamplerParameteri.xhtml
 */
export function samplerParameteri(sampler: GLuint, pname: SamplerParameterI, param: GLint): void {
    glSamplerParameteri(sampler, pname, param);
}

/**
 * `void glSamplerParameterIiv(GLuint sampler, GLenum pname, const GLint *param)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param sampler - `GLuint`, object kind `sampler`
 * @param pname - `GLenum`, group `SamplerParameterI`
 * @param param - `const GLint *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glSamplerParameterIiv.xhtml
 */
export function samplerParameterIiv(
    sampler: GLuint,
    pname: SamplerParameterI,
    param: readonly GLint[] | Int32Array,
): void {
    glSamplerParameterIiv(sampler, pname, param);
}

/**
 * `void glSamplerParameterIuiv(GLuint sampler, GLenum pname, const GLuint *param)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param sampler - `GLuint`, object kind `sampler`
 * @param pname - `GLenum`, group `SamplerParameterI`
 * @param param - `const GLuint *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glSamplerParameterIuiv.xhtml
 */
export function samplerParameterIuiv(
    sampler: GLuint,
    pname: SamplerParameterI,
    param: readonly GLuint[] | Uint32Array,
): void {
    glSamplerParameterIuiv(sampler, pname, param);
}

/**
 * `void glSamplerParameteriv(GLuint sampler, GLenum pname, const GLint *param)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param sampler - `GLuint`, object kind `sampler`
 * @param pname - `GLenum`, group `SamplerParameterI`
 * @param param - `const GLint *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glSamplerParameteriv.xhtml
 */
export function samplerParameteriv(
    sampler: GLuint,
    pname: SamplerParameterI,
    param: readonly GLint[] | Int32Array,
): void {
    glSamplerParameteriv(sampler, pname, param);
}

/**
 * `void glScissor(GLint x, GLint y, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glScissor.xhtml
 */
export function scissor(x: GLint, y: GLint, width: GLsizei, height: GLsizei): void {
    glScissor(x, y, width, height);
}

/**
 * `void glScissorArrayv(GLuint first, GLsizei count, const GLint *v)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param first - `GLuint`
 * @param count - `GLsizei`
 * @param v - `const GLint *`, length `COMPSIZE(count)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glScissorArrayv.xhtml
 */
export function scissorArrayv(first: GLuint, count: GLsizei, v: readonly GLint[] | Int32Array): void {
    glScissorArrayv(first, count, v);
}

/**
 * `void glScissorIndexed(GLuint index, GLint left, GLint bottom, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param left - `GLint`
 * @param bottom - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glScissorIndexed.xhtml
 */
export function scissorIndexed(index: GLuint, left: GLint, bottom: GLint, width: GLsizei, height: GLsizei): void {
    glScissorIndexed(index, left, bottom, width, height);
}

/**
 * `void glScissorIndexedv(GLuint index, const GLint *v)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param v - `const GLint *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glScissorIndexedv.xhtml
 */
export function scissorIndexedv(index: GLuint, v: readonly GLint[] | Int32Array): void {
    glScissorIndexedv(index, v);
}

/**
 * `void glShaderBinary(GLsizei count, const GLuint *shaders, GLenum binaryFormat, const void *binary, GLsizei length)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param count - `GLsizei`
 * @param shaders - `const GLuint *`, length `count`, object kind `shader`
 * @param binaryFormat - `GLenum`, group `ShaderBinaryFormat`
 * @param binary - `const void *`, length `length`
 * @param length - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glShaderBinary.xhtml
 */
export function shaderBinary(
    count: GLsizei,
    shaders: readonly GLuint[] | Uint32Array,
    binaryFormat: ShaderBinaryFormat,
    binary: ArrayBufferView | GLintptr | null,
    length: GLsizei,
): void {
    glShaderBinary(count, shaders, binaryFormat, binary, length);
}

/**
 * `void glShaderSource(GLuint shader, GLsizei count, const GLchar *const*string, const GLint *length)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param shader - `GLuint`, object kind `shader`
 * @param count - `GLsizei`
 * @param string - `const GLchar *const*`, length `count`
 * @param length - `const GLint *`, length `count`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glShaderSource.xhtml
 */
export function shaderSource(
    shader: GLuint,
    count: GLsizei,
    string: readonly string[],
    length: readonly GLint[] | Int32Array,
): void {
    glShaderSource(shader, count, string, length);
}

/**
 * `void glShaderStorageBlockBinding(GLuint program, GLuint storageBlockIndex, GLuint storageBlockBinding)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param storageBlockIndex - `GLuint`
 * @param storageBlockBinding - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glShaderStorageBlockBinding.xhtml
 */
export function shaderStorageBlockBinding(
    program: GLuint,
    storageBlockIndex: GLuint,
    storageBlockBinding: GLuint,
): void {
    glShaderStorageBlockBinding(program, storageBlockIndex, storageBlockBinding);
}

/**
 * `void glSpecializeShader(GLuint shader, const GLchar *pEntryPoint, GLuint numSpecializationConstants, const GLuint *pConstantIndex, const GLuint *pConstantValue)`
 *
 * Provided by `GL_VERSION_4_6`.
 *
 * @param shader - `GLuint`, object kind `shader`
 * @param pEntryPoint - `const GLchar *`
 * @param numSpecializationConstants - `GLuint`
 * @param pConstantIndex - `const GLuint *`, length `numSpecializationConstants`
 * @param pConstantValue - `const GLuint *`, length `numSpecializationConstants`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glSpecializeShader.xhtml
 */
export function specializeShader(
    shader: GLuint,
    pEntryPoint: string,
    numSpecializationConstants: GLuint,
    pConstantIndex: readonly GLuint[] | Uint32Array,
    pConstantValue: readonly GLuint[] | Uint32Array,
): void {
    glSpecializeShader(shader, pEntryPoint, numSpecializationConstants, pConstantIndex, pConstantValue);
}

/**
 * `void glStencilFunc(GLenum func, GLint ref, GLuint mask)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param func - `GLenum`, group `StencilFunction`
 * @param ref - `GLint`
 * @param mask - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glStencilFunc.xhtml
 */
export function stencilFunc(func: StencilFunction, ref: GLint, mask: GLuint): void {
    glStencilFunc(func, ref, mask);
}

/**
 * `void glStencilFuncSeparate(GLenum face, GLenum func, GLint ref, GLuint mask)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param face - `GLenum`, group `TriangleFace`
 * @param func - `GLenum`, group `StencilFunction`
 * @param ref - `GLint`
 * @param mask - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glStencilFuncSeparate.xhtml
 */
export function stencilFuncSeparate(face: TriangleFace, func: StencilFunction, ref: GLint, mask: GLuint): void {
    glStencilFuncSeparate(face, func, ref, mask);
}

/**
 * `void glStencilMask(GLuint mask)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param mask - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glStencilMask.xhtml
 */
export function stencilMask(mask: GLuint): void {
    glStencilMask(mask);
}

/**
 * `void glStencilMaskSeparate(GLenum face, GLuint mask)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param face - `GLenum`, group `TriangleFace`
 * @param mask - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glStencilMaskSeparate.xhtml
 */
export function stencilMaskSeparate(face: TriangleFace, mask: GLuint): void {
    glStencilMaskSeparate(face, mask);
}

/**
 * `void glStencilOp(GLenum fail, GLenum zfail, GLenum zpass)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param fail - `GLenum`, group `StencilOp`
 * @param zfail - `GLenum`, group `StencilOp`
 * @param zpass - `GLenum`, group `StencilOp`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glStencilOp.xhtml
 */
export function stencilOp(fail: StencilOp, zfail: StencilOp, zpass: StencilOp): void {
    glStencilOp(fail, zfail, zpass);
}

/**
 * `void glStencilOpSeparate(GLenum face, GLenum sfail, GLenum dpfail, GLenum dppass)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param face - `GLenum`, group `TriangleFace`
 * @param sfail - `GLenum`, group `StencilOp`
 * @param dpfail - `GLenum`, group `StencilOp`
 * @param dppass - `GLenum`, group `StencilOp`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glStencilOpSeparate.xhtml
 */
export function stencilOpSeparate(face: TriangleFace, sfail: StencilOp, dpfail: StencilOp, dppass: StencilOp): void {
    glStencilOpSeparate(face, sfail, dpfail, dppass);
}

/**
 * `void glTexBuffer(GLenum target, GLenum internalformat, GLuint buffer)`
 *
 * Provided by `GL_VERSION_3_1`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param buffer - `GLuint`, object kind `buffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexBuffer.xhtml
 */
export function texBuffer(target: TextureTarget, internalformat: SizedInternalFormat, buffer: GLuint): void {
    glTexBuffer(target, internalformat, buffer);
}

/**
 * `void glTexBufferRange(GLenum target, GLenum internalformat, GLuint buffer, GLintptr offset, GLsizeiptr size)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexBufferRange.xhtml
 */
export function texBufferRange(
    target: TextureTarget,
    internalformat: SizedInternalFormat,
    buffer: GLuint,
    offset: GLintptr,
    size: GLsizeiptr,
): void {
    glTexBufferRange(target, internalformat, buffer, offset, size);
}

/**
 * `void glTexImage1D(GLenum target, GLint level, GLint internalformat, GLsizei width, GLint border, GLenum format, GLenum type, const void *pixels)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param internalformat - `GLint`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param border - `GLint`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `const void *`, length `COMPSIZE(format,type,width)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage1D.xhtml
 */
export function texImage1D(
    target: TextureTarget,
    level: GLint,
    internalformat: GLint,
    width: GLsizei,
    border: GLint,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glTexImage1D(target, level, internalformat, width, border, format, type, pixels);
}

/**
 * `void glTexImage2D(GLenum target, GLint level, GLint internalformat, GLsizei width, GLsizei height, GLint border, GLenum format, GLenum type, const void *pixels)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param internalformat - `GLint`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param border - `GLint`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `const void *`, length `COMPSIZE(format,type,width,height)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2D.xhtml
 */
export function texImage2D(
    target: TextureTarget,
    level: GLint,
    internalformat: GLint,
    width: GLsizei,
    height: GLsizei,
    border: GLint,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glTexImage2D(target, level, internalformat, width, height, border, format, type, pixels);
}

/**
 * `void glTexImage2DMultisample(GLenum target, GLsizei samples, GLenum internalformat, GLsizei width, GLsizei height, GLboolean fixedsamplelocations)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param samples - `GLsizei`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param fixedsamplelocations - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2DMultisample.xhtml
 */
export function texImage2DMultisample(
    target: TextureTarget,
    samples: GLsizei,
    internalformat: InternalFormat,
    width: GLsizei,
    height: GLsizei,
    fixedsamplelocations: boolean,
): void {
    glTexImage2DMultisample(target, samples, internalformat, width, height, fixedsamplelocations);
}

/**
 * `void glTexImage3D(GLenum target, GLint level, GLint internalformat, GLsizei width, GLsizei height, GLsizei depth, GLint border, GLenum format, GLenum type, const void *pixels)`
 *
 * Provided by `GL_VERSION_1_2`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param internalformat - `GLint`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param border - `GLint`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `const void *`, length `COMPSIZE(format,type,width,height,depth)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage3D.xhtml
 */
export function texImage3D(
    target: TextureTarget,
    level: GLint,
    internalformat: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    border: GLint,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glTexImage3D(target, level, internalformat, width, height, depth, border, format, type, pixels);
}

/**
 * `void glTexImage3DMultisample(GLenum target, GLsizei samples, GLenum internalformat, GLsizei width, GLsizei height, GLsizei depth, GLboolean fixedsamplelocations)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param samples - `GLsizei`
 * @param internalformat - `GLenum`, group `InternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param fixedsamplelocations - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage3DMultisample.xhtml
 */
export function texImage3DMultisample(
    target: TextureTarget,
    samples: GLsizei,
    internalformat: InternalFormat,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    fixedsamplelocations: boolean,
): void {
    glTexImage3DMultisample(target, samples, internalformat, width, height, depth, fixedsamplelocations);
}

/**
 * `void glTexParameterf(GLenum target, GLenum pname, GLfloat param)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param param - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexParameterf.xhtml
 */
export function texParameterf(target: TextureTarget, pname: TextureParameterName, param: GLfloat): void {
    glTexParameterf(target, pname, param);
}

/**
 * `void glTexParameterfv(GLenum target, GLenum pname, const GLfloat *params)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param params - `const GLfloat *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexParameterfv.xhtml
 */
export function texParameterfv(
    target: TextureTarget,
    pname: TextureParameterName,
    params: readonly GLfloat[] | Float32Array,
): void {
    glTexParameterfv(target, pname, params);
}

/**
 * `void glTexParameteri(GLenum target, GLenum pname, GLint param)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param param - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexParameteri.xhtml
 */
export function texParameteri(target: TextureTarget, pname: TextureParameterName, param: GLint): void {
    glTexParameteri(target, pname, param);
}

/**
 * `void glTexParameterIiv(GLenum target, GLenum pname, const GLint *params)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param params - `const GLint *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexParameterIiv.xhtml
 */
export function texParameterIiv(
    target: TextureTarget,
    pname: TextureParameterName,
    params: readonly GLint[] | Int32Array,
): void {
    glTexParameterIiv(target, pname, params);
}

/**
 * `void glTexParameterIuiv(GLenum target, GLenum pname, const GLuint *params)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param params - `const GLuint *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexParameterIuiv.xhtml
 */
export function texParameterIuiv(
    target: TextureTarget,
    pname: TextureParameterName,
    params: readonly GLuint[] | Uint32Array,
): void {
    glTexParameterIuiv(target, pname, params);
}

/**
 * `void glTexParameteriv(GLenum target, GLenum pname, const GLint *params)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param params - `const GLint *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexParameteriv.xhtml
 */
export function texParameteriv(
    target: TextureTarget,
    pname: TextureParameterName,
    params: readonly GLint[] | Int32Array,
): void {
    glTexParameteriv(target, pname, params);
}

/**
 * `void glTexStorage1D(GLenum target, GLsizei levels, GLenum internalformat, GLsizei width)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param levels - `GLsizei`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param width - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexStorage1D.xhtml
 */
export function texStorage1D(
    target: TextureTarget,
    levels: GLsizei,
    internalformat: SizedInternalFormat,
    width: GLsizei,
): void {
    glTexStorage1D(target, levels, internalformat, width);
}

/**
 * `void glTexStorage2D(GLenum target, GLsizei levels, GLenum internalformat, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param levels - `GLsizei`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexStorage2D.xhtml
 */
export function texStorage2D(
    target: TextureTarget,
    levels: GLsizei,
    internalformat: SizedInternalFormat,
    width: GLsizei,
    height: GLsizei,
): void {
    glTexStorage2D(target, levels, internalformat, width, height);
}

/**
 * `void glTexStorage2DMultisample(GLenum target, GLsizei samples, GLenum internalformat, GLsizei width, GLsizei height, GLboolean fixedsamplelocations)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param samples - `GLsizei`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param fixedsamplelocations - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexStorage2DMultisample.xhtml
 */
export function texStorage2DMultisample(
    target: TextureTarget,
    samples: GLsizei,
    internalformat: SizedInternalFormat,
    width: GLsizei,
    height: GLsizei,
    fixedsamplelocations: boolean,
): void {
    glTexStorage2DMultisample(target, samples, internalformat, width, height, fixedsamplelocations);
}

/**
 * `void glTexStorage3D(GLenum target, GLsizei levels, GLenum internalformat, GLsizei width, GLsizei height, GLsizei depth)`
 *
 * Provided by `GL_VERSION_4_2`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param levels - `GLsizei`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexStorage3D.xhtml
 */
export function texStorage3D(
    target: TextureTarget,
    levels: GLsizei,
    internalformat: SizedInternalFormat,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
): void {
    glTexStorage3D(target, levels, internalformat, width, height, depth);
}

/**
 * `void glTexStorage3DMultisample(GLenum target, GLsizei samples, GLenum internalformat, GLsizei width, GLsizei height, GLsizei depth, GLboolean fixedsamplelocations)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param samples - `GLsizei`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param fixedsamplelocations - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexStorage3DMultisample.xhtml
 */
export function texStorage3DMultisample(
    target: TextureTarget,
    samples: GLsizei,
    internalformat: SizedInternalFormat,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    fixedsamplelocations: boolean,
): void {
    glTexStorage3DMultisample(target, samples, internalformat, width, height, depth, fixedsamplelocations);
}

/**
 * `void glTexSubImage1D(GLenum target, GLint level, GLint xoffset, GLsizei width, GLenum format, GLenum type, const void *pixels)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param width - `GLsizei`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `const void *`, length `COMPSIZE(format,type,width)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexSubImage1D.xhtml
 */
export function texSubImage1D(
    target: TextureTarget,
    level: GLint,
    xoffset: GLint,
    width: GLsizei,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glTexSubImage1D(target, level, xoffset, width, format, type, pixels);
}

/**
 * `void glTexSubImage2D(GLenum target, GLint level, GLint xoffset, GLint yoffset, GLsizei width, GLsizei height, GLenum format, GLenum type, const void *pixels)`
 *
 * Provided by `GL_VERSION_1_1`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `const void *`, length `COMPSIZE(format,type,width,height)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexSubImage2D.xhtml
 */
export function texSubImage2D(
    target: TextureTarget,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glTexSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels);
}

/**
 * `void glTexSubImage3D(GLenum target, GLint level, GLint xoffset, GLint yoffset, GLint zoffset, GLsizei width, GLsizei height, GLsizei depth, GLenum format, GLenum type, const void *pixels)`
 *
 * Provided by `GL_VERSION_1_2`.
 *
 * @param target - `GLenum`, group `TextureTarget`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param zoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `const void *`, length `COMPSIZE(format,type,width,height,depth)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexSubImage3D.xhtml
 */
export function texSubImage3D(
    target: TextureTarget,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, pixels);
}

/**
 * `void glTextureBarrier()`
 *
 * Provided by `GL_VERSION_4_5`.
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureBarrier.xhtml
 */
export function textureBarrier(): void {
    glTextureBarrier();
}

/**
 * `void glTextureBuffer(GLuint texture, GLenum internalformat, GLuint buffer)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param buffer - `GLuint`, object kind `buffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureBuffer.xhtml
 */
export function textureBuffer(texture: GLuint, internalformat: SizedInternalFormat, buffer: GLuint): void {
    glTextureBuffer(texture, internalformat, buffer);
}

/**
 * `void glTextureBufferRange(GLuint texture, GLenum internalformat, GLuint buffer, GLintptr offset, GLsizeiptr size)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureBufferRange.xhtml
 */
export function textureBufferRange(
    texture: GLuint,
    internalformat: SizedInternalFormat,
    buffer: GLuint,
    offset: GLintptr,
    size: GLsizeiptr,
): void {
    glTextureBufferRange(texture, internalformat, buffer, offset, size);
}

/**
 * `void glTextureParameterf(GLuint texture, GLenum pname, GLfloat param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param param - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureParameterf.xhtml
 */
export function textureParameterf(texture: GLuint, pname: TextureParameterName, param: GLfloat): void {
    glTextureParameterf(texture, pname, param);
}

/**
 * `void glTextureParameterfv(GLuint texture, GLenum pname, const GLfloat *param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param param - `const GLfloat *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureParameterfv.xhtml
 */
export function textureParameterfv(
    texture: GLuint,
    pname: TextureParameterName,
    param: readonly GLfloat[] | Float32Array,
): void {
    glTextureParameterfv(texture, pname, param);
}

/**
 * `void glTextureParameteri(GLuint texture, GLenum pname, GLint param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param param - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureParameteri.xhtml
 */
export function textureParameteri(texture: GLuint, pname: TextureParameterName, param: GLint): void {
    glTextureParameteri(texture, pname, param);
}

/**
 * `void glTextureParameterIiv(GLuint texture, GLenum pname, const GLint *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param params - `const GLint *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureParameterIiv.xhtml
 */
export function textureParameterIiv(
    texture: GLuint,
    pname: TextureParameterName,
    params: readonly GLint[] | Int32Array,
): void {
    glTextureParameterIiv(texture, pname, params);
}

/**
 * `void glTextureParameterIuiv(GLuint texture, GLenum pname, const GLuint *params)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param params - `const GLuint *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureParameterIuiv.xhtml
 */
export function textureParameterIuiv(
    texture: GLuint,
    pname: TextureParameterName,
    params: readonly GLuint[] | Uint32Array,
): void {
    glTextureParameterIuiv(texture, pname, params);
}

/**
 * `void glTextureParameteriv(GLuint texture, GLenum pname, const GLint *param)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param pname - `GLenum`, group `TextureParameterName`
 * @param param - `const GLint *`, length `COMPSIZE(pname)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureParameteriv.xhtml
 */
export function textureParameteriv(
    texture: GLuint,
    pname: TextureParameterName,
    param: readonly GLint[] | Int32Array,
): void {
    glTextureParameteriv(texture, pname, param);
}

/**
 * `void glTextureStorage1D(GLuint texture, GLsizei levels, GLenum internalformat, GLsizei width)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param levels - `GLsizei`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param width - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureStorage1D.xhtml
 */
export function textureStorage1D(
    texture: GLuint,
    levels: GLsizei,
    internalformat: SizedInternalFormat,
    width: GLsizei,
): void {
    glTextureStorage1D(texture, levels, internalformat, width);
}

/**
 * `void glTextureStorage2D(GLuint texture, GLsizei levels, GLenum internalformat, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param levels - `GLsizei`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureStorage2D.xhtml
 */
export function textureStorage2D(
    texture: GLuint,
    levels: GLsizei,
    internalformat: SizedInternalFormat,
    width: GLsizei,
    height: GLsizei,
): void {
    glTextureStorage2D(texture, levels, internalformat, width, height);
}

/**
 * `void glTextureStorage2DMultisample(GLuint texture, GLsizei samples, GLenum internalformat, GLsizei width, GLsizei height, GLboolean fixedsamplelocations)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param samples - `GLsizei`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param fixedsamplelocations - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureStorage2DMultisample.xhtml
 */
export function textureStorage2DMultisample(
    texture: GLuint,
    samples: GLsizei,
    internalformat: SizedInternalFormat,
    width: GLsizei,
    height: GLsizei,
    fixedsamplelocations: boolean,
): void {
    glTextureStorage2DMultisample(texture, samples, internalformat, width, height, fixedsamplelocations);
}

/**
 * `void glTextureStorage3D(GLuint texture, GLsizei levels, GLenum internalformat, GLsizei width, GLsizei height, GLsizei depth)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param levels - `GLsizei`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureStorage3D.xhtml
 */
export function textureStorage3D(
    texture: GLuint,
    levels: GLsizei,
    internalformat: SizedInternalFormat,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
): void {
    glTextureStorage3D(texture, levels, internalformat, width, height, depth);
}

/**
 * `void glTextureStorage3DMultisample(GLuint texture, GLsizei samples, GLenum internalformat, GLsizei width, GLsizei height, GLsizei depth, GLboolean fixedsamplelocations)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param samples - `GLsizei`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param fixedsamplelocations - `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureStorage3DMultisample.xhtml
 */
export function textureStorage3DMultisample(
    texture: GLuint,
    samples: GLsizei,
    internalformat: SizedInternalFormat,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    fixedsamplelocations: boolean,
): void {
    glTextureStorage3DMultisample(texture, samples, internalformat, width, height, depth, fixedsamplelocations);
}

/**
 * `void glTextureSubImage1D(GLuint texture, GLint level, GLint xoffset, GLsizei width, GLenum format, GLenum type, const void *pixels)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param width - `GLsizei`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `const void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureSubImage1D.xhtml
 */
export function textureSubImage1D(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    width: GLsizei,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glTextureSubImage1D(texture, level, xoffset, width, format, type, pixels);
}

/**
 * `void glTextureSubImage2D(GLuint texture, GLint level, GLint xoffset, GLint yoffset, GLsizei width, GLsizei height, GLenum format, GLenum type, const void *pixels)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `const void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureSubImage2D.xhtml
 */
export function textureSubImage2D(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glTextureSubImage2D(texture, level, xoffset, yoffset, width, height, format, type, pixels);
}

/**
 * `void glTextureSubImage3D(GLuint texture, GLint level, GLint xoffset, GLint yoffset, GLint zoffset, GLsizei width, GLsizei height, GLsizei depth, GLenum format, GLenum type, const void *pixels)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param level - `GLint`
 * @param xoffset - `GLint`
 * @param yoffset - `GLint`
 * @param zoffset - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @param depth - `GLsizei`
 * @param format - `GLenum`, group `PixelFormat`
 * @param type - `GLenum`, group `PixelType`
 * @param pixels - `const void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureSubImage3D.xhtml
 */
export function textureSubImage3D(
    texture: GLuint,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    format: PixelFormat,
    type: PixelType,
    pixels: ArrayBufferView | GLintptr | null,
): void {
    glTextureSubImage3D(texture, level, xoffset, yoffset, zoffset, width, height, depth, format, type, pixels);
}

/**
 * `void glTextureView(GLuint texture, GLenum target, GLuint origtexture, GLenum internalformat, GLuint minlevel, GLuint numlevels, GLuint minlayer, GLuint numlayers)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param texture - `GLuint`, object kind `texture`
 * @param target - `GLenum`, group `TextureTarget`
 * @param origtexture - `GLuint`, object kind `texture`
 * @param internalformat - `GLenum`, group `SizedInternalFormat`
 * @param minlevel - `GLuint`
 * @param numlevels - `GLuint`
 * @param minlayer - `GLuint`
 * @param numlayers - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTextureView.xhtml
 */
export function textureView(
    texture: GLuint,
    target: TextureTarget,
    origtexture: GLuint,
    internalformat: SizedInternalFormat,
    minlevel: GLuint,
    numlevels: GLuint,
    minlayer: GLuint,
    numlayers: GLuint,
): void {
    glTextureView(texture, target, origtexture, internalformat, minlevel, numlevels, minlayer, numlayers);
}

/**
 * `void glTransformFeedbackBufferBase(GLuint xfb, GLuint index, GLuint buffer)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param xfb - `GLuint`, object kind `transform feedback`
 * @param index - `GLuint`
 * @param buffer - `GLuint`, object kind `buffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTransformFeedbackBufferBase.xhtml
 */
export function transformFeedbackBufferBase(xfb: GLuint, index: GLuint, buffer: GLuint): void {
    glTransformFeedbackBufferBase(xfb, index, buffer);
}

/**
 * `void glTransformFeedbackBufferRange(GLuint xfb, GLuint index, GLuint buffer, GLintptr offset, GLsizeiptr size)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param xfb - `GLuint`, object kind `transform feedback`
 * @param index - `GLuint`
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param size - `GLsizeiptr`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTransformFeedbackBufferRange.xhtml
 */
export function transformFeedbackBufferRange(
    xfb: GLuint,
    index: GLuint,
    buffer: GLuint,
    offset: GLintptr,
    size: GLsizeiptr,
): void {
    glTransformFeedbackBufferRange(xfb, index, buffer, offset, size);
}

/**
 * `void glTransformFeedbackVaryings(GLuint program, GLsizei count, const GLchar *const*varyings, GLenum bufferMode)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param count - `GLsizei`
 * @param varyings - `const GLchar *const*`, length `count`
 * @param bufferMode - `GLenum`, group `TransformFeedbackBufferMode`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTransformFeedbackVaryings.xhtml
 */
export function transformFeedbackVaryings(
    program: GLuint,
    count: GLsizei,
    varyings: readonly string[],
    bufferMode: TransformFeedbackBufferMode,
): void {
    glTransformFeedbackVaryings(program, count, varyings, bufferMode);
}

/**
 * `void glUniform1d(GLint location, GLdouble x)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param x - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform1d.xhtml
 */
export function uniform1d(location: GLint, x: GLdouble): void {
    glUniform1d(location, x);
}

/**
 * `void glUniform1dv(GLint location, GLsizei count, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLdouble *`, length `count*1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform1dv.xhtml
 */
export function uniform1dv(location: GLint, count: GLsizei, value: readonly GLdouble[] | Float64Array): void {
    glUniform1dv(location, count, value);
}

/**
 * `void glUniform1f(GLint location, GLfloat v0)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform1f.xhtml
 */
export function uniform1f(location: GLint, v0: GLfloat): void {
    glUniform1f(location, v0);
}

/**
 * `void glUniform1fv(GLint location, GLsizei count, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLfloat *`, length `count*1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform1fv.xhtml
 */
export function uniform1fv(location: GLint, count: GLsizei, value: readonly GLfloat[] | Float32Array): void {
    glUniform1fv(location, count, value);
}

/**
 * `void glUniform1i(GLint location, GLint v0)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform1i.xhtml
 */
export function uniform1i(location: GLint, v0: GLint): void {
    glUniform1i(location, v0);
}

/**
 * `void glUniform1iv(GLint location, GLsizei count, const GLint *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLint *`, length `count*1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform1iv.xhtml
 */
export function uniform1iv(location: GLint, count: GLsizei, value: readonly GLint[] | Int32Array): void {
    glUniform1iv(location, count, value);
}

/**
 * `void glUniform1ui(GLint location, GLuint v0)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform1ui.xhtml
 */
export function uniform1ui(location: GLint, v0: GLuint): void {
    glUniform1ui(location, v0);
}

/**
 * `void glUniform1uiv(GLint location, GLsizei count, const GLuint *value)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLuint *`, length `count*1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform1uiv.xhtml
 */
export function uniform1uiv(location: GLint, count: GLsizei, value: readonly GLuint[] | Uint32Array): void {
    glUniform1uiv(location, count, value);
}

/**
 * `void glUniform2d(GLint location, GLdouble x, GLdouble y)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param x - `GLdouble`
 * @param y - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform2d.xhtml
 */
export function uniform2d(location: GLint, x: GLdouble, y: GLdouble): void {
    glUniform2d(location, x, y);
}

/**
 * `void glUniform2dv(GLint location, GLsizei count, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLdouble *`, length `count*2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform2dv.xhtml
 */
export function uniform2dv(location: GLint, count: GLsizei, value: readonly GLdouble[] | Float64Array): void {
    glUniform2dv(location, count, value);
}

/**
 * `void glUniform2f(GLint location, GLfloat v0, GLfloat v1)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLfloat`
 * @param v1 - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform2f.xhtml
 */
export function uniform2f(location: GLint, v0: GLfloat, v1: GLfloat): void {
    glUniform2f(location, v0, v1);
}

/**
 * `void glUniform2fv(GLint location, GLsizei count, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLfloat *`, length `count*2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform2fv.xhtml
 */
export function uniform2fv(location: GLint, count: GLsizei, value: readonly GLfloat[] | Float32Array): void {
    glUniform2fv(location, count, value);
}

/**
 * `void glUniform2i(GLint location, GLint v0, GLint v1)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLint`
 * @param v1 - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform2i.xhtml
 */
export function uniform2i(location: GLint, v0: GLint, v1: GLint): void {
    glUniform2i(location, v0, v1);
}

/**
 * `void glUniform2iv(GLint location, GLsizei count, const GLint *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLint *`, length `count*2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform2iv.xhtml
 */
export function uniform2iv(location: GLint, count: GLsizei, value: readonly GLint[] | Int32Array): void {
    glUniform2iv(location, count, value);
}

/**
 * `void glUniform2ui(GLint location, GLuint v0, GLuint v1)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLuint`
 * @param v1 - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform2ui.xhtml
 */
export function uniform2ui(location: GLint, v0: GLuint, v1: GLuint): void {
    glUniform2ui(location, v0, v1);
}

/**
 * `void glUniform2uiv(GLint location, GLsizei count, const GLuint *value)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLuint *`, length `count*2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform2uiv.xhtml
 */
export function uniform2uiv(location: GLint, count: GLsizei, value: readonly GLuint[] | Uint32Array): void {
    glUniform2uiv(location, count, value);
}

/**
 * `void glUniform3d(GLint location, GLdouble x, GLdouble y, GLdouble z)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param x - `GLdouble`
 * @param y - `GLdouble`
 * @param z - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform3d.xhtml
 */
export function uniform3d(location: GLint, x: GLdouble, y: GLdouble, z: GLdouble): void {
    glUniform3d(location, x, y, z);
}

/**
 * `void glUniform3dv(GLint location, GLsizei count, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLdouble *`, length `count*3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform3dv.xhtml
 */
export function uniform3dv(location: GLint, count: GLsizei, value: readonly GLdouble[] | Float64Array): void {
    glUniform3dv(location, count, value);
}

/**
 * `void glUniform3f(GLint location, GLfloat v0, GLfloat v1, GLfloat v2)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLfloat`
 * @param v1 - `GLfloat`
 * @param v2 - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform3f.xhtml
 */
export function uniform3f(location: GLint, v0: GLfloat, v1: GLfloat, v2: GLfloat): void {
    glUniform3f(location, v0, v1, v2);
}

/**
 * `void glUniform3fv(GLint location, GLsizei count, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLfloat *`, length `count*3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform3fv.xhtml
 */
export function uniform3fv(location: GLint, count: GLsizei, value: readonly GLfloat[] | Float32Array): void {
    glUniform3fv(location, count, value);
}

/**
 * `void glUniform3i(GLint location, GLint v0, GLint v1, GLint v2)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLint`
 * @param v1 - `GLint`
 * @param v2 - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform3i.xhtml
 */
export function uniform3i(location: GLint, v0: GLint, v1: GLint, v2: GLint): void {
    glUniform3i(location, v0, v1, v2);
}

/**
 * `void glUniform3iv(GLint location, GLsizei count, const GLint *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLint *`, length `count*3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform3iv.xhtml
 */
export function uniform3iv(location: GLint, count: GLsizei, value: readonly GLint[] | Int32Array): void {
    glUniform3iv(location, count, value);
}

/**
 * `void glUniform3ui(GLint location, GLuint v0, GLuint v1, GLuint v2)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLuint`
 * @param v1 - `GLuint`
 * @param v2 - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform3ui.xhtml
 */
export function uniform3ui(location: GLint, v0: GLuint, v1: GLuint, v2: GLuint): void {
    glUniform3ui(location, v0, v1, v2);
}

/**
 * `void glUniform3uiv(GLint location, GLsizei count, const GLuint *value)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLuint *`, length `count*3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform3uiv.xhtml
 */
export function uniform3uiv(location: GLint, count: GLsizei, value: readonly GLuint[] | Uint32Array): void {
    glUniform3uiv(location, count, value);
}

/**
 * `void glUniform4d(GLint location, GLdouble x, GLdouble y, GLdouble z, GLdouble w)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param x - `GLdouble`
 * @param y - `GLdouble`
 * @param z - `GLdouble`
 * @param w - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform4d.xhtml
 */
export function uniform4d(location: GLint, x: GLdouble, y: GLdouble, z: GLdouble, w: GLdouble): void {
    glUniform4d(location, x, y, z, w);
}

/**
 * `void glUniform4dv(GLint location, GLsizei count, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLdouble *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform4dv.xhtml
 */
export function uniform4dv(location: GLint, count: GLsizei, value: readonly GLdouble[] | Float64Array): void {
    glUniform4dv(location, count, value);
}

/**
 * `void glUniform4f(GLint location, GLfloat v0, GLfloat v1, GLfloat v2, GLfloat v3)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLfloat`
 * @param v1 - `GLfloat`
 * @param v2 - `GLfloat`
 * @param v3 - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform4f.xhtml
 */
export function uniform4f(location: GLint, v0: GLfloat, v1: GLfloat, v2: GLfloat, v3: GLfloat): void {
    glUniform4f(location, v0, v1, v2, v3);
}

/**
 * `void glUniform4fv(GLint location, GLsizei count, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLfloat *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform4fv.xhtml
 */
export function uniform4fv(location: GLint, count: GLsizei, value: readonly GLfloat[] | Float32Array): void {
    glUniform4fv(location, count, value);
}

/**
 * `void glUniform4i(GLint location, GLint v0, GLint v1, GLint v2, GLint v3)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLint`
 * @param v1 - `GLint`
 * @param v2 - `GLint`
 * @param v3 - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform4i.xhtml
 */
export function uniform4i(location: GLint, v0: GLint, v1: GLint, v2: GLint, v3: GLint): void {
    glUniform4i(location, v0, v1, v2, v3);
}

/**
 * `void glUniform4iv(GLint location, GLsizei count, const GLint *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLint *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform4iv.xhtml
 */
export function uniform4iv(location: GLint, count: GLsizei, value: readonly GLint[] | Int32Array): void {
    glUniform4iv(location, count, value);
}

/**
 * `void glUniform4ui(GLint location, GLuint v0, GLuint v1, GLuint v2, GLuint v3)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param location - `GLint`
 * @param v0 - `GLuint`
 * @param v1 - `GLuint`
 * @param v2 - `GLuint`
 * @param v3 - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform4ui.xhtml
 */
export function uniform4ui(location: GLint, v0: GLuint, v1: GLuint, v2: GLuint, v3: GLuint): void {
    glUniform4ui(location, v0, v1, v2, v3);
}

/**
 * `void glUniform4uiv(GLint location, GLsizei count, const GLuint *value)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param value - `const GLuint *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform4uiv.xhtml
 */
export function uniform4uiv(location: GLint, count: GLsizei, value: readonly GLuint[] | Uint32Array): void {
    glUniform4uiv(location, count, value);
}

/**
 * `void glUniformBlockBinding(GLuint program, GLuint uniformBlockIndex, GLuint uniformBlockBinding)`
 *
 * Provided by `GL_VERSION_3_1`.
 *
 * @param program - `GLuint`, object kind `program`
 * @param uniformBlockIndex - `GLuint`
 * @param uniformBlockBinding - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformBlockBinding.xhtml
 */
export function uniformBlockBinding(program: GLuint, uniformBlockIndex: GLuint, uniformBlockBinding: GLuint): void {
    glUniformBlockBinding(program, uniformBlockIndex, uniformBlockBinding);
}

/**
 * `void glUniformMatrix2dv(GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix2dv.xhtml
 */
export function uniformMatrix2dv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glUniformMatrix2dv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix2fv(GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix2fv.xhtml
 */
export function uniformMatrix2fv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glUniformMatrix2fv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix2x3dv(GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*6`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix2x3dv.xhtml
 */
export function uniformMatrix2x3dv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glUniformMatrix2x3dv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix2x3fv(GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_1`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*6`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix2x3fv.xhtml
 */
export function uniformMatrix2x3fv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glUniformMatrix2x3fv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix2x4dv(GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*8`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix2x4dv.xhtml
 */
export function uniformMatrix2x4dv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glUniformMatrix2x4dv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix2x4fv(GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_1`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*8`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix2x4fv.xhtml
 */
export function uniformMatrix2x4fv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glUniformMatrix2x4fv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix3dv(GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*9`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix3dv.xhtml
 */
export function uniformMatrix3dv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glUniformMatrix3dv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix3fv(GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*9`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix3fv.xhtml
 */
export function uniformMatrix3fv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glUniformMatrix3fv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix3x2dv(GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*6`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix3x2dv.xhtml
 */
export function uniformMatrix3x2dv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glUniformMatrix3x2dv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix3x2fv(GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_1`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*6`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix3x2fv.xhtml
 */
export function uniformMatrix3x2fv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glUniformMatrix3x2fv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix3x4dv(GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*12`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix3x4dv.xhtml
 */
export function uniformMatrix3x4dv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glUniformMatrix3x4dv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix3x4fv(GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_1`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*12`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix3x4fv.xhtml
 */
export function uniformMatrix3x4fv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glUniformMatrix3x4fv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix4dv(GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*16`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix4dv.xhtml
 */
export function uniformMatrix4dv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glUniformMatrix4dv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix4fv(GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*16`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix4fv.xhtml
 */
export function uniformMatrix4fv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glUniformMatrix4fv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix4x2dv(GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*8`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix4x2dv.xhtml
 */
export function uniformMatrix4x2dv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glUniformMatrix4x2dv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix4x2fv(GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_1`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*8`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix4x2fv.xhtml
 */
export function uniformMatrix4x2fv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glUniformMatrix4x2fv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix4x3dv(GLint location, GLsizei count, GLboolean transpose, const GLdouble *value)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLdouble *`, length `count*12`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix4x3dv.xhtml
 */
export function uniformMatrix4x3dv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLdouble[] | Float64Array,
): void {
    glUniformMatrix4x3dv(location, count, transpose, value);
}

/**
 * `void glUniformMatrix4x3fv(GLint location, GLsizei count, GLboolean transpose, const GLfloat *value)`
 *
 * Provided by `GL_VERSION_2_1`.
 *
 * @param location - `GLint`
 * @param count - `GLsizei`
 * @param transpose - `GLboolean`
 * @param value - `const GLfloat *`, length `count*12`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformMatrix4x3fv.xhtml
 */
export function uniformMatrix4x3fv(
    location: GLint,
    count: GLsizei,
    transpose: boolean,
    value: readonly GLfloat[] | Float32Array,
): void {
    glUniformMatrix4x3fv(location, count, transpose, value);
}

/**
 * `void glUniformSubroutinesuiv(GLenum shadertype, GLsizei count, const GLuint *indices)`
 *
 * Provided by `GL_VERSION_4_0`.
 *
 * @param shadertype - `GLenum`, group `ShaderType`
 * @param count - `GLsizei`
 * @param indices - `const GLuint *`, length `count`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformSubroutinesuiv.xhtml
 */
export function uniformSubroutinesuiv(
    shadertype: ShaderType,
    count: GLsizei,
    indices: readonly GLuint[] | Uint32Array,
): void {
    glUniformSubroutinesuiv(shadertype, count, indices);
}

/**
 * `GLboolean glUnmapBuffer(GLenum target)`
 *
 * Provided by `GL_VERSION_1_5`.
 *
 * @param target - `GLenum`, group `BufferTargetARB`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUnmapBuffer.xhtml
 */
export function unmapBuffer(target: BufferTargetARB): boolean {
    return (glUnmapBuffer(target) as number) !== 0;
}

/**
 * `GLboolean glUnmapNamedBuffer(GLuint buffer)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param buffer - `GLuint`, object kind `buffer`
 * @returns `GLboolean`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUnmapNamedBuffer.xhtml
 */
export function unmapNamedBuffer(buffer: GLuint): boolean {
    return (glUnmapNamedBuffer(buffer) as number) !== 0;
}

/**
 * `void glUseProgram(GLuint program)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUseProgram.xhtml
 */
export function useProgram(program: GLuint): void {
    glUseProgram(program);
}

/**
 * `void glUseProgramStages(GLuint pipeline, GLbitfield stages, GLuint program)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param pipeline - `GLuint`, object kind `program pipeline`
 * @param stages - `GLbitfield`, group `UseProgramStageMask`
 * @param program - `GLuint`, object kind `program`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUseProgramStages.xhtml
 */
export function useProgramStages(pipeline: GLuint, stages: UseProgramStageMask, program: GLuint): void {
    glUseProgramStages(pipeline, stages, program);
}

/**
 * `void glValidateProgram(GLuint program)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param program - `GLuint`, object kind `program`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glValidateProgram.xhtml
 */
export function validateProgram(program: GLuint): void {
    glValidateProgram(program);
}

/**
 * `void glValidateProgramPipeline(GLuint pipeline)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param pipeline - `GLuint`, object kind `program pipeline`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glValidateProgramPipeline.xhtml
 */
export function validateProgramPipeline(pipeline: GLuint): void {
    glValidateProgramPipeline(pipeline);
}

/**
 * `void glVertexArrayAttribBinding(GLuint vaobj, GLuint attribindex, GLuint bindingindex)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param attribindex - `GLuint`
 * @param bindingindex - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexArrayAttribBinding.xhtml
 */
export function vertexArrayAttribBinding(vaobj: GLuint, attribindex: GLuint, bindingindex: GLuint): void {
    glVertexArrayAttribBinding(vaobj, attribindex, bindingindex);
}

/**
 * `void glVertexArrayAttribFormat(GLuint vaobj, GLuint attribindex, GLint size, GLenum type, GLboolean normalized, GLuint relativeoffset)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param attribindex - `GLuint`
 * @param size - `GLint`
 * @param type - `GLenum`, group `VertexAttribType`
 * @param normalized - `GLboolean`
 * @param relativeoffset - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexArrayAttribFormat.xhtml
 */
export function vertexArrayAttribFormat(
    vaobj: GLuint,
    attribindex: GLuint,
    size: GLint,
    type: VertexAttribType,
    normalized: boolean,
    relativeoffset: GLuint,
): void {
    glVertexArrayAttribFormat(vaobj, attribindex, size, type, normalized, relativeoffset);
}

/**
 * `void glVertexArrayAttribIFormat(GLuint vaobj, GLuint attribindex, GLint size, GLenum type, GLuint relativeoffset)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param attribindex - `GLuint`
 * @param size - `GLint`
 * @param type - `GLenum`, group `VertexAttribIType`
 * @param relativeoffset - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexArrayAttribIFormat.xhtml
 */
export function vertexArrayAttribIFormat(
    vaobj: GLuint,
    attribindex: GLuint,
    size: GLint,
    type: VertexAttribIType,
    relativeoffset: GLuint,
): void {
    glVertexArrayAttribIFormat(vaobj, attribindex, size, type, relativeoffset);
}

/**
 * `void glVertexArrayAttribLFormat(GLuint vaobj, GLuint attribindex, GLint size, GLenum type, GLuint relativeoffset)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param attribindex - `GLuint`
 * @param size - `GLint`
 * @param type - `GLenum`, group `VertexAttribLType`
 * @param relativeoffset - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexArrayAttribLFormat.xhtml
 */
export function vertexArrayAttribLFormat(
    vaobj: GLuint,
    attribindex: GLuint,
    size: GLint,
    type: VertexAttribLType,
    relativeoffset: GLuint,
): void {
    glVertexArrayAttribLFormat(vaobj, attribindex, size, type, relativeoffset);
}

/**
 * `void glVertexArrayBindingDivisor(GLuint vaobj, GLuint bindingindex, GLuint divisor)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param bindingindex - `GLuint`
 * @param divisor - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexArrayBindingDivisor.xhtml
 */
export function vertexArrayBindingDivisor(vaobj: GLuint, bindingindex: GLuint, divisor: GLuint): void {
    glVertexArrayBindingDivisor(vaobj, bindingindex, divisor);
}

/**
 * `void glVertexArrayElementBuffer(GLuint vaobj, GLuint buffer)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param buffer - `GLuint`, object kind `buffer`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexArrayElementBuffer.xhtml
 */
export function vertexArrayElementBuffer(vaobj: GLuint, buffer: GLuint): void {
    glVertexArrayElementBuffer(vaobj, buffer);
}

/**
 * `void glVertexArrayVertexBuffer(GLuint vaobj, GLuint bindingindex, GLuint buffer, GLintptr offset, GLsizei stride)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param bindingindex - `GLuint`
 * @param buffer - `GLuint`, object kind `buffer`
 * @param offset - `GLintptr`
 * @param stride - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexArrayVertexBuffer.xhtml
 */
export function vertexArrayVertexBuffer(
    vaobj: GLuint,
    bindingindex: GLuint,
    buffer: GLuint,
    offset: GLintptr,
    stride: GLsizei,
): void {
    glVertexArrayVertexBuffer(vaobj, bindingindex, buffer, offset, stride);
}

/**
 * `void glVertexArrayVertexBuffers(GLuint vaobj, GLuint first, GLsizei count, const GLuint *buffers, const GLintptr *offsets, const GLsizei *strides)`
 *
 * Provided by `GL_VERSION_4_5`.
 *
 * @param vaobj - `GLuint`, object kind `vertex array`
 * @param first - `GLuint`
 * @param count - `GLsizei`
 * @param buffers - `const GLuint *`, length `count`, object kind `buffer`
 * @param offsets - `const GLintptr *`, length `count`
 * @param strides - `const GLsizei *`, length `count`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexArrayVertexBuffers.xhtml
 */
export function vertexArrayVertexBuffers(
    vaobj: GLuint,
    first: GLuint,
    count: GLsizei,
    buffers: readonly GLuint[] | Uint32Array,
    offsets: readonly GLintptr[],
    strides: readonly GLsizei[] | Int32Array,
): void {
    glVertexArrayVertexBuffers(vaobj, first, count, buffers, offsets, strides);
}

/**
 * `void glVertexAttrib1d(GLuint index, GLdouble x)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib1d.xhtml
 */
export function vertexAttrib1d(index: GLuint, x: GLdouble): void {
    glVertexAttrib1d(index, x);
}

/**
 * `void glVertexAttrib1dv(GLuint index, const GLdouble *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLdouble *`, length `1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib1dv.xhtml
 */
export function vertexAttrib1dv(index: GLuint, v: readonly GLdouble[] | Float64Array): void {
    glVertexAttrib1dv(index, v);
}

/**
 * `void glVertexAttrib1f(GLuint index, GLfloat x)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib1f.xhtml
 */
export function vertexAttrib1f(index: GLuint, x: GLfloat): void {
    glVertexAttrib1f(index, x);
}

/**
 * `void glVertexAttrib1fv(GLuint index, const GLfloat *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLfloat *`, length `1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib1fv.xhtml
 */
export function vertexAttrib1fv(index: GLuint, v: readonly GLfloat[] | Float32Array): void {
    glVertexAttrib1fv(index, v);
}

/**
 * `void glVertexAttrib1s(GLuint index, GLshort x)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLshort`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib1s.xhtml
 */
export function vertexAttrib1s(index: GLuint, x: GLshort): void {
    glVertexAttrib1s(index, x);
}

/**
 * `void glVertexAttrib1sv(GLuint index, const GLshort *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLshort *`, length `1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib1sv.xhtml
 */
export function vertexAttrib1sv(index: GLuint, v: readonly GLshort[] | Int16Array): void {
    glVertexAttrib1sv(index, v);
}

/**
 * `void glVertexAttrib2d(GLuint index, GLdouble x, GLdouble y)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLdouble`
 * @param y - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib2d.xhtml
 */
export function vertexAttrib2d(index: GLuint, x: GLdouble, y: GLdouble): void {
    glVertexAttrib2d(index, x, y);
}

/**
 * `void glVertexAttrib2dv(GLuint index, const GLdouble *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLdouble *`, length `2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib2dv.xhtml
 */
export function vertexAttrib2dv(index: GLuint, v: readonly GLdouble[] | Float64Array): void {
    glVertexAttrib2dv(index, v);
}

/**
 * `void glVertexAttrib2f(GLuint index, GLfloat x, GLfloat y)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLfloat`
 * @param y - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib2f.xhtml
 */
export function vertexAttrib2f(index: GLuint, x: GLfloat, y: GLfloat): void {
    glVertexAttrib2f(index, x, y);
}

/**
 * `void glVertexAttrib2fv(GLuint index, const GLfloat *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLfloat *`, length `2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib2fv.xhtml
 */
export function vertexAttrib2fv(index: GLuint, v: readonly GLfloat[] | Float32Array): void {
    glVertexAttrib2fv(index, v);
}

/**
 * `void glVertexAttrib2s(GLuint index, GLshort x, GLshort y)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLshort`
 * @param y - `GLshort`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib2s.xhtml
 */
export function vertexAttrib2s(index: GLuint, x: GLshort, y: GLshort): void {
    glVertexAttrib2s(index, x, y);
}

/**
 * `void glVertexAttrib2sv(GLuint index, const GLshort *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLshort *`, length `2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib2sv.xhtml
 */
export function vertexAttrib2sv(index: GLuint, v: readonly GLshort[] | Int16Array): void {
    glVertexAttrib2sv(index, v);
}

/**
 * `void glVertexAttrib3d(GLuint index, GLdouble x, GLdouble y, GLdouble z)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLdouble`
 * @param y - `GLdouble`
 * @param z - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib3d.xhtml
 */
export function vertexAttrib3d(index: GLuint, x: GLdouble, y: GLdouble, z: GLdouble): void {
    glVertexAttrib3d(index, x, y, z);
}

/**
 * `void glVertexAttrib3dv(GLuint index, const GLdouble *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLdouble *`, length `3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib3dv.xhtml
 */
export function vertexAttrib3dv(index: GLuint, v: readonly GLdouble[] | Float64Array): void {
    glVertexAttrib3dv(index, v);
}

/**
 * `void glVertexAttrib3f(GLuint index, GLfloat x, GLfloat y, GLfloat z)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLfloat`
 * @param y - `GLfloat`
 * @param z - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib3f.xhtml
 */
export function vertexAttrib3f(index: GLuint, x: GLfloat, y: GLfloat, z: GLfloat): void {
    glVertexAttrib3f(index, x, y, z);
}

/**
 * `void glVertexAttrib3fv(GLuint index, const GLfloat *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLfloat *`, length `3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib3fv.xhtml
 */
export function vertexAttrib3fv(index: GLuint, v: readonly GLfloat[] | Float32Array): void {
    glVertexAttrib3fv(index, v);
}

/**
 * `void glVertexAttrib3s(GLuint index, GLshort x, GLshort y, GLshort z)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLshort`
 * @param y - `GLshort`
 * @param z - `GLshort`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib3s.xhtml
 */
export function vertexAttrib3s(index: GLuint, x: GLshort, y: GLshort, z: GLshort): void {
    glVertexAttrib3s(index, x, y, z);
}

/**
 * `void glVertexAttrib3sv(GLuint index, const GLshort *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLshort *`, length `3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib3sv.xhtml
 */
export function vertexAttrib3sv(index: GLuint, v: readonly GLshort[] | Int16Array): void {
    glVertexAttrib3sv(index, v);
}

/**
 * `void glVertexAttrib4bv(GLuint index, const GLbyte *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLbyte *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4bv.xhtml
 */
export function vertexAttrib4bv(index: GLuint, v: readonly GLbyte[] | Int8Array): void {
    glVertexAttrib4bv(index, v);
}

/**
 * `void glVertexAttrib4d(GLuint index, GLdouble x, GLdouble y, GLdouble z, GLdouble w)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLdouble`
 * @param y - `GLdouble`
 * @param z - `GLdouble`
 * @param w - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4d.xhtml
 */
export function vertexAttrib4d(index: GLuint, x: GLdouble, y: GLdouble, z: GLdouble, w: GLdouble): void {
    glVertexAttrib4d(index, x, y, z, w);
}

/**
 * `void glVertexAttrib4dv(GLuint index, const GLdouble *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLdouble *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4dv.xhtml
 */
export function vertexAttrib4dv(index: GLuint, v: readonly GLdouble[] | Float64Array): void {
    glVertexAttrib4dv(index, v);
}

/**
 * `void glVertexAttrib4f(GLuint index, GLfloat x, GLfloat y, GLfloat z, GLfloat w)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLfloat`
 * @param y - `GLfloat`
 * @param z - `GLfloat`
 * @param w - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4f.xhtml
 */
export function vertexAttrib4f(index: GLuint, x: GLfloat, y: GLfloat, z: GLfloat, w: GLfloat): void {
    glVertexAttrib4f(index, x, y, z, w);
}

/**
 * `void glVertexAttrib4fv(GLuint index, const GLfloat *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLfloat *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4fv.xhtml
 */
export function vertexAttrib4fv(index: GLuint, v: readonly GLfloat[] | Float32Array): void {
    glVertexAttrib4fv(index, v);
}

/**
 * `void glVertexAttrib4iv(GLuint index, const GLint *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLint *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4iv.xhtml
 */
export function vertexAttrib4iv(index: GLuint, v: readonly GLint[] | Int32Array): void {
    glVertexAttrib4iv(index, v);
}

/**
 * `void glVertexAttrib4Nbv(GLuint index, const GLbyte *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLbyte *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4Nbv.xhtml
 */
export function vertexAttrib4Nbv(index: GLuint, v: readonly GLbyte[] | Int8Array): void {
    glVertexAttrib4Nbv(index, v);
}

/**
 * `void glVertexAttrib4Niv(GLuint index, const GLint *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLint *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4Niv.xhtml
 */
export function vertexAttrib4Niv(index: GLuint, v: readonly GLint[] | Int32Array): void {
    glVertexAttrib4Niv(index, v);
}

/**
 * `void glVertexAttrib4Nsv(GLuint index, const GLshort *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLshort *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4Nsv.xhtml
 */
export function vertexAttrib4Nsv(index: GLuint, v: readonly GLshort[] | Int16Array): void {
    glVertexAttrib4Nsv(index, v);
}

/**
 * `void glVertexAttrib4Nub(GLuint index, GLubyte x, GLubyte y, GLubyte z, GLubyte w)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLubyte`
 * @param y - `GLubyte`
 * @param z - `GLubyte`
 * @param w - `GLubyte`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4Nub.xhtml
 */
export function vertexAttrib4Nub(index: GLuint, x: GLubyte, y: GLubyte, z: GLubyte, w: GLubyte): void {
    glVertexAttrib4Nub(index, x, y, z, w);
}

/**
 * `void glVertexAttrib4Nubv(GLuint index, const GLubyte *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLubyte *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4Nubv.xhtml
 */
export function vertexAttrib4Nubv(index: GLuint, v: readonly GLubyte[] | Uint8Array): void {
    glVertexAttrib4Nubv(index, v);
}

/**
 * `void glVertexAttrib4Nuiv(GLuint index, const GLuint *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLuint *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4Nuiv.xhtml
 */
export function vertexAttrib4Nuiv(index: GLuint, v: readonly GLuint[] | Uint32Array): void {
    glVertexAttrib4Nuiv(index, v);
}

/**
 * `void glVertexAttrib4Nusv(GLuint index, const GLushort *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLushort *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4Nusv.xhtml
 */
export function vertexAttrib4Nusv(index: GLuint, v: readonly GLushort[] | Uint16Array): void {
    glVertexAttrib4Nusv(index, v);
}

/**
 * `void glVertexAttrib4s(GLuint index, GLshort x, GLshort y, GLshort z, GLshort w)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLshort`
 * @param y - `GLshort`
 * @param z - `GLshort`
 * @param w - `GLshort`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4s.xhtml
 */
export function vertexAttrib4s(index: GLuint, x: GLshort, y: GLshort, z: GLshort, w: GLshort): void {
    glVertexAttrib4s(index, x, y, z, w);
}

/**
 * `void glVertexAttrib4sv(GLuint index, const GLshort *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLshort *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4sv.xhtml
 */
export function vertexAttrib4sv(index: GLuint, v: readonly GLshort[] | Int16Array): void {
    glVertexAttrib4sv(index, v);
}

/**
 * `void glVertexAttrib4ubv(GLuint index, const GLubyte *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLubyte *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4ubv.xhtml
 */
export function vertexAttrib4ubv(index: GLuint, v: readonly GLubyte[] | Uint8Array): void {
    glVertexAttrib4ubv(index, v);
}

/**
 * `void glVertexAttrib4uiv(GLuint index, const GLuint *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLuint *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4uiv.xhtml
 */
export function vertexAttrib4uiv(index: GLuint, v: readonly GLuint[] | Uint32Array): void {
    glVertexAttrib4uiv(index, v);
}

/**
 * `void glVertexAttrib4usv(GLuint index, const GLushort *v)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLushort *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttrib4usv.xhtml
 */
export function vertexAttrib4usv(index: GLuint, v: readonly GLushort[] | Uint16Array): void {
    glVertexAttrib4usv(index, v);
}

/**
 * `void glVertexAttribBinding(GLuint attribindex, GLuint bindingindex)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param attribindex - `GLuint`
 * @param bindingindex - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribBinding.xhtml
 */
export function vertexAttribBinding(attribindex: GLuint, bindingindex: GLuint): void {
    glVertexAttribBinding(attribindex, bindingindex);
}

/**
 * `void glVertexAttribDivisor(GLuint index, GLuint divisor)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param index - `GLuint`
 * @param divisor - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribDivisor.xhtml
 */
export function vertexAttribDivisor(index: GLuint, divisor: GLuint): void {
    glVertexAttribDivisor(index, divisor);
}

/**
 * `void glVertexAttribFormat(GLuint attribindex, GLint size, GLenum type, GLboolean normalized, GLuint relativeoffset)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param attribindex - `GLuint`
 * @param size - `GLint`
 * @param type - `GLenum`, group `VertexAttribType`
 * @param normalized - `GLboolean`
 * @param relativeoffset - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribFormat.xhtml
 */
export function vertexAttribFormat(
    attribindex: GLuint,
    size: GLint,
    type: VertexAttribType,
    normalized: boolean,
    relativeoffset: GLuint,
): void {
    glVertexAttribFormat(attribindex, size, type, normalized, relativeoffset);
}

/**
 * `void glVertexAttribI1i(GLuint index, GLint x)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI1i.xhtml
 */
export function vertexAttribI1i(index: GLuint, x: GLint): void {
    glVertexAttribI1i(index, x);
}

/**
 * `void glVertexAttribI1iv(GLuint index, const GLint *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLint *`, length `1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI1iv.xhtml
 */
export function vertexAttribI1iv(index: GLuint, v: readonly GLint[] | Int32Array): void {
    glVertexAttribI1iv(index, v);
}

/**
 * `void glVertexAttribI1ui(GLuint index, GLuint x)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI1ui.xhtml
 */
export function vertexAttribI1ui(index: GLuint, x: GLuint): void {
    glVertexAttribI1ui(index, x);
}

/**
 * `void glVertexAttribI1uiv(GLuint index, const GLuint *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLuint *`, length `1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI1uiv.xhtml
 */
export function vertexAttribI1uiv(index: GLuint, v: readonly GLuint[] | Uint32Array): void {
    glVertexAttribI1uiv(index, v);
}

/**
 * `void glVertexAttribI2i(GLuint index, GLint x, GLint y)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLint`
 * @param y - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI2i.xhtml
 */
export function vertexAttribI2i(index: GLuint, x: GLint, y: GLint): void {
    glVertexAttribI2i(index, x, y);
}

/**
 * `void glVertexAttribI2iv(GLuint index, const GLint *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLint *`, length `2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI2iv.xhtml
 */
export function vertexAttribI2iv(index: GLuint, v: readonly GLint[] | Int32Array): void {
    glVertexAttribI2iv(index, v);
}

/**
 * `void glVertexAttribI2ui(GLuint index, GLuint x, GLuint y)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLuint`
 * @param y - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI2ui.xhtml
 */
export function vertexAttribI2ui(index: GLuint, x: GLuint, y: GLuint): void {
    glVertexAttribI2ui(index, x, y);
}

/**
 * `void glVertexAttribI2uiv(GLuint index, const GLuint *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLuint *`, length `2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI2uiv.xhtml
 */
export function vertexAttribI2uiv(index: GLuint, v: readonly GLuint[] | Uint32Array): void {
    glVertexAttribI2uiv(index, v);
}

/**
 * `void glVertexAttribI3i(GLuint index, GLint x, GLint y, GLint z)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param z - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI3i.xhtml
 */
export function vertexAttribI3i(index: GLuint, x: GLint, y: GLint, z: GLint): void {
    glVertexAttribI3i(index, x, y, z);
}

/**
 * `void glVertexAttribI3iv(GLuint index, const GLint *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLint *`, length `3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI3iv.xhtml
 */
export function vertexAttribI3iv(index: GLuint, v: readonly GLint[] | Int32Array): void {
    glVertexAttribI3iv(index, v);
}

/**
 * `void glVertexAttribI3ui(GLuint index, GLuint x, GLuint y, GLuint z)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLuint`
 * @param y - `GLuint`
 * @param z - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI3ui.xhtml
 */
export function vertexAttribI3ui(index: GLuint, x: GLuint, y: GLuint, z: GLuint): void {
    glVertexAttribI3ui(index, x, y, z);
}

/**
 * `void glVertexAttribI3uiv(GLuint index, const GLuint *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLuint *`, length `3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI3uiv.xhtml
 */
export function vertexAttribI3uiv(index: GLuint, v: readonly GLuint[] | Uint32Array): void {
    glVertexAttribI3uiv(index, v);
}

/**
 * `void glVertexAttribI4bv(GLuint index, const GLbyte *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLbyte *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI4bv.xhtml
 */
export function vertexAttribI4bv(index: GLuint, v: readonly GLbyte[] | Int8Array): void {
    glVertexAttribI4bv(index, v);
}

/**
 * `void glVertexAttribI4i(GLuint index, GLint x, GLint y, GLint z, GLint w)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLint`
 * @param y - `GLint`
 * @param z - `GLint`
 * @param w - `GLint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI4i.xhtml
 */
export function vertexAttribI4i(index: GLuint, x: GLint, y: GLint, z: GLint, w: GLint): void {
    glVertexAttribI4i(index, x, y, z, w);
}

/**
 * `void glVertexAttribI4iv(GLuint index, const GLint *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLint *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI4iv.xhtml
 */
export function vertexAttribI4iv(index: GLuint, v: readonly GLint[] | Int32Array): void {
    glVertexAttribI4iv(index, v);
}

/**
 * `void glVertexAttribI4sv(GLuint index, const GLshort *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLshort *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI4sv.xhtml
 */
export function vertexAttribI4sv(index: GLuint, v: readonly GLshort[] | Int16Array): void {
    glVertexAttribI4sv(index, v);
}

/**
 * `void glVertexAttribI4ubv(GLuint index, const GLubyte *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLubyte *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI4ubv.xhtml
 */
export function vertexAttribI4ubv(index: GLuint, v: readonly GLubyte[] | Uint8Array): void {
    glVertexAttribI4ubv(index, v);
}

/**
 * `void glVertexAttribI4ui(GLuint index, GLuint x, GLuint y, GLuint z, GLuint w)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param x - `GLuint`
 * @param y - `GLuint`
 * @param z - `GLuint`
 * @param w - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI4ui.xhtml
 */
export function vertexAttribI4ui(index: GLuint, x: GLuint, y: GLuint, z: GLuint, w: GLuint): void {
    glVertexAttribI4ui(index, x, y, z, w);
}

/**
 * `void glVertexAttribI4uiv(GLuint index, const GLuint *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLuint *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI4uiv.xhtml
 */
export function vertexAttribI4uiv(index: GLuint, v: readonly GLuint[] | Uint32Array): void {
    glVertexAttribI4uiv(index, v);
}

/**
 * `void glVertexAttribI4usv(GLuint index, const GLushort *v)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param v - `const GLushort *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribI4usv.xhtml
 */
export function vertexAttribI4usv(index: GLuint, v: readonly GLushort[] | Uint16Array): void {
    glVertexAttribI4usv(index, v);
}

/**
 * `void glVertexAttribIFormat(GLuint attribindex, GLint size, GLenum type, GLuint relativeoffset)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param attribindex - `GLuint`
 * @param size - `GLint`
 * @param type - `GLenum`, group `VertexAttribIType`
 * @param relativeoffset - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribIFormat.xhtml
 */
export function vertexAttribIFormat(
    attribindex: GLuint,
    size: GLint,
    type: VertexAttribIType,
    relativeoffset: GLuint,
): void {
    glVertexAttribIFormat(attribindex, size, type, relativeoffset);
}

/**
 * `void glVertexAttribIPointer(GLuint index, GLint size, GLenum type, GLsizei stride, const void *pointer)`
 *
 * Provided by `GL_VERSION_3_0`.
 *
 * @param index - `GLuint`
 * @param size - `GLint`
 * @param type - `GLenum`, group `VertexAttribIType`
 * @param stride - `GLsizei`
 * @param pointer - `const void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribIPointer.xhtml
 */
export function vertexAttribIPointer(
    index: GLuint,
    size: GLint,
    type: VertexAttribIType,
    stride: GLsizei,
    pointer: GLintptr,
): void {
    glVertexAttribIPointer(index, size, type, stride, pointer);
}

/**
 * `void glVertexAttribL1d(GLuint index, GLdouble x)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param x - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribL1d.xhtml
 */
export function vertexAttribL1d(index: GLuint, x: GLdouble): void {
    glVertexAttribL1d(index, x);
}

/**
 * `void glVertexAttribL1dv(GLuint index, const GLdouble *v)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param v - `const GLdouble *`, length `1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribL1dv.xhtml
 */
export function vertexAttribL1dv(index: GLuint, v: readonly GLdouble[] | Float64Array): void {
    glVertexAttribL1dv(index, v);
}

/**
 * `void glVertexAttribL2d(GLuint index, GLdouble x, GLdouble y)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param x - `GLdouble`
 * @param y - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribL2d.xhtml
 */
export function vertexAttribL2d(index: GLuint, x: GLdouble, y: GLdouble): void {
    glVertexAttribL2d(index, x, y);
}

/**
 * `void glVertexAttribL2dv(GLuint index, const GLdouble *v)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param v - `const GLdouble *`, length `2`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribL2dv.xhtml
 */
export function vertexAttribL2dv(index: GLuint, v: readonly GLdouble[] | Float64Array): void {
    glVertexAttribL2dv(index, v);
}

/**
 * `void glVertexAttribL3d(GLuint index, GLdouble x, GLdouble y, GLdouble z)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param x - `GLdouble`
 * @param y - `GLdouble`
 * @param z - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribL3d.xhtml
 */
export function vertexAttribL3d(index: GLuint, x: GLdouble, y: GLdouble, z: GLdouble): void {
    glVertexAttribL3d(index, x, y, z);
}

/**
 * `void glVertexAttribL3dv(GLuint index, const GLdouble *v)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param v - `const GLdouble *`, length `3`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribL3dv.xhtml
 */
export function vertexAttribL3dv(index: GLuint, v: readonly GLdouble[] | Float64Array): void {
    glVertexAttribL3dv(index, v);
}

/**
 * `void glVertexAttribL4d(GLuint index, GLdouble x, GLdouble y, GLdouble z, GLdouble w)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param x - `GLdouble`
 * @param y - `GLdouble`
 * @param z - `GLdouble`
 * @param w - `GLdouble`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribL4d.xhtml
 */
export function vertexAttribL4d(index: GLuint, x: GLdouble, y: GLdouble, z: GLdouble, w: GLdouble): void {
    glVertexAttribL4d(index, x, y, z, w);
}

/**
 * `void glVertexAttribL4dv(GLuint index, const GLdouble *v)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param v - `const GLdouble *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribL4dv.xhtml
 */
export function vertexAttribL4dv(index: GLuint, v: readonly GLdouble[] | Float64Array): void {
    glVertexAttribL4dv(index, v);
}

/**
 * `void glVertexAttribLFormat(GLuint attribindex, GLint size, GLenum type, GLuint relativeoffset)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param attribindex - `GLuint`
 * @param size - `GLint`
 * @param type - `GLenum`, group `VertexAttribLType`
 * @param relativeoffset - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribLFormat.xhtml
 */
export function vertexAttribLFormat(
    attribindex: GLuint,
    size: GLint,
    type: VertexAttribLType,
    relativeoffset: GLuint,
): void {
    glVertexAttribLFormat(attribindex, size, type, relativeoffset);
}

/**
 * `void glVertexAttribLPointer(GLuint index, GLint size, GLenum type, GLsizei stride, const void *pointer)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param size - `GLint`
 * @param type - `GLenum`, group `VertexAttribLType`
 * @param stride - `GLsizei`
 * @param pointer - `const void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribLPointer.xhtml
 */
export function vertexAttribLPointer(
    index: GLuint,
    size: GLint,
    type: VertexAttribLType,
    stride: GLsizei,
    pointer: GLintptr,
): void {
    glVertexAttribLPointer(index, size, type, stride, pointer);
}

/**
 * `void glVertexAttribP1ui(GLuint index, GLenum type, GLboolean normalized, GLuint value)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param index - `GLuint`
 * @param type - `GLenum`, group `VertexAttribPointerType`
 * @param normalized - `GLboolean`
 * @param value - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribP1ui.xhtml
 */
export function vertexAttribP1ui(
    index: GLuint,
    type: VertexAttribPointerType,
    normalized: boolean,
    value: GLuint,
): void {
    glVertexAttribP1ui(index, type, normalized, value);
}

/**
 * `void glVertexAttribP1uiv(GLuint index, GLenum type, GLboolean normalized, const GLuint *value)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param index - `GLuint`
 * @param type - `GLenum`, group `VertexAttribPointerType`
 * @param normalized - `GLboolean`
 * @param value - `const GLuint *`, length `1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribP1uiv.xhtml
 */
export function vertexAttribP1uiv(
    index: GLuint,
    type: VertexAttribPointerType,
    normalized: boolean,
    value: readonly GLuint[] | Uint32Array,
): void {
    glVertexAttribP1uiv(index, type, normalized, value);
}

/**
 * `void glVertexAttribP2ui(GLuint index, GLenum type, GLboolean normalized, GLuint value)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param index - `GLuint`
 * @param type - `GLenum`, group `VertexAttribPointerType`
 * @param normalized - `GLboolean`
 * @param value - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribP2ui.xhtml
 */
export function vertexAttribP2ui(
    index: GLuint,
    type: VertexAttribPointerType,
    normalized: boolean,
    value: GLuint,
): void {
    glVertexAttribP2ui(index, type, normalized, value);
}

/**
 * `void glVertexAttribP2uiv(GLuint index, GLenum type, GLboolean normalized, const GLuint *value)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param index - `GLuint`
 * @param type - `GLenum`, group `VertexAttribPointerType`
 * @param normalized - `GLboolean`
 * @param value - `const GLuint *`, length `1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribP2uiv.xhtml
 */
export function vertexAttribP2uiv(
    index: GLuint,
    type: VertexAttribPointerType,
    normalized: boolean,
    value: readonly GLuint[] | Uint32Array,
): void {
    glVertexAttribP2uiv(index, type, normalized, value);
}

/**
 * `void glVertexAttribP3ui(GLuint index, GLenum type, GLboolean normalized, GLuint value)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param index - `GLuint`
 * @param type - `GLenum`, group `VertexAttribPointerType`
 * @param normalized - `GLboolean`
 * @param value - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribP3ui.xhtml
 */
export function vertexAttribP3ui(
    index: GLuint,
    type: VertexAttribPointerType,
    normalized: boolean,
    value: GLuint,
): void {
    glVertexAttribP3ui(index, type, normalized, value);
}

/**
 * `void glVertexAttribP3uiv(GLuint index, GLenum type, GLboolean normalized, const GLuint *value)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param index - `GLuint`
 * @param type - `GLenum`, group `VertexAttribPointerType`
 * @param normalized - `GLboolean`
 * @param value - `const GLuint *`, length `1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribP3uiv.xhtml
 */
export function vertexAttribP3uiv(
    index: GLuint,
    type: VertexAttribPointerType,
    normalized: boolean,
    value: readonly GLuint[] | Uint32Array,
): void {
    glVertexAttribP3uiv(index, type, normalized, value);
}

/**
 * `void glVertexAttribP4ui(GLuint index, GLenum type, GLboolean normalized, GLuint value)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param index - `GLuint`
 * @param type - `GLenum`, group `VertexAttribPointerType`
 * @param normalized - `GLboolean`
 * @param value - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribP4ui.xhtml
 */
export function vertexAttribP4ui(
    index: GLuint,
    type: VertexAttribPointerType,
    normalized: boolean,
    value: GLuint,
): void {
    glVertexAttribP4ui(index, type, normalized, value);
}

/**
 * `void glVertexAttribP4uiv(GLuint index, GLenum type, GLboolean normalized, const GLuint *value)`
 *
 * Provided by `GL_VERSION_3_3`.
 *
 * @param index - `GLuint`
 * @param type - `GLenum`, group `VertexAttribPointerType`
 * @param normalized - `GLboolean`
 * @param value - `const GLuint *`, length `1`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribP4uiv.xhtml
 */
export function vertexAttribP4uiv(
    index: GLuint,
    type: VertexAttribPointerType,
    normalized: boolean,
    value: readonly GLuint[] | Uint32Array,
): void {
    glVertexAttribP4uiv(index, type, normalized, value);
}

/**
 * `void glVertexAttribPointer(GLuint index, GLint size, GLenum type, GLboolean normalized, GLsizei stride, const void *pointer)`
 *
 * Provided by `GL_VERSION_2_0`.
 *
 * @param index - `GLuint`
 * @param size - `GLint`
 * @param type - `GLenum`, group `VertexAttribPointerType`
 * @param normalized - `GLboolean`
 * @param stride - `GLsizei`
 * @param pointer - `const void *`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribPointer.xhtml
 */
export function vertexAttribPointer(
    index: GLuint,
    size: GLint,
    type: VertexAttribPointerType,
    normalized: boolean,
    stride: GLsizei,
    pointer: GLintptr,
): void {
    glVertexAttribPointer(index, size, type, normalized, stride, pointer);
}

/**
 * `void glVertexBindingDivisor(GLuint bindingindex, GLuint divisor)`
 *
 * Provided by `GL_VERSION_4_3`.
 *
 * @param bindingindex - `GLuint`
 * @param divisor - `GLuint`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexBindingDivisor.xhtml
 */
export function vertexBindingDivisor(bindingindex: GLuint, divisor: GLuint): void {
    glVertexBindingDivisor(bindingindex, divisor);
}

/**
 * `void glViewport(GLint x, GLint y, GLsizei width, GLsizei height)`
 *
 * Provided by `GL_VERSION_1_0`.
 *
 * @param x - `GLint`
 * @param y - `GLint`
 * @param width - `GLsizei`
 * @param height - `GLsizei`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glViewport.xhtml
 */
export function viewport(x: GLint, y: GLint, width: GLsizei, height: GLsizei): void {
    glViewport(x, y, width, height);
}

/**
 * `void glViewportArrayv(GLuint first, GLsizei count, const GLfloat *v)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param first - `GLuint`
 * @param count - `GLsizei`
 * @param v - `const GLfloat *`, length `COMPSIZE(count)`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glViewportArrayv.xhtml
 */
export function viewportArrayv(first: GLuint, count: GLsizei, v: readonly GLfloat[] | Float32Array): void {
    glViewportArrayv(first, count, v);
}

/**
 * `void glViewportIndexedf(GLuint index, GLfloat x, GLfloat y, GLfloat w, GLfloat h)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param x - `GLfloat`
 * @param y - `GLfloat`
 * @param w - `GLfloat`
 * @param h - `GLfloat`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glViewportIndexedf.xhtml
 */
export function viewportIndexedf(index: GLuint, x: GLfloat, y: GLfloat, w: GLfloat, h: GLfloat): void {
    glViewportIndexedf(index, x, y, w, h);
}

/**
 * `void glViewportIndexedfv(GLuint index, const GLfloat *v)`
 *
 * Provided by `GL_VERSION_4_1`.
 *
 * @param index - `GLuint`
 * @param v - `const GLfloat *`, length `4`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glViewportIndexedfv.xhtml
 */
export function viewportIndexedfv(index: GLuint, v: readonly GLfloat[] | Float32Array): void {
    glViewportIndexedfv(index, v);
}

/**
 * `void glWaitSync(GLsync sync, GLbitfield flags, GLuint64 timeout)`
 *
 * Provided by `GL_VERSION_3_2`.
 *
 * @param sync - `GLsync`, object kind `sync`
 * @param flags - `GLbitfield`, group `SyncBehaviorFlags`
 * @param timeout - `GLuint64`
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glWaitSync.xhtml
 */
export function waitSync(sync: GLsync, flags: SyncBehaviorFlags, timeout: GLuint64): void {
    glWaitSync(sync, flags, timeout);
}

/**
 * Returns one buffer object name via `glCreateBuffers(1, ...)`.
 *
 * Provided by `GL_VERSION_4_5`.
 * @returns The new buffer object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateBuffers.xhtml
 */
export function createBuffer(): GLuint {
    const out = { value: 0 };
    glCreateBuffersSingle(1, out);
    return out.value;
}

/**
 * Returns one framebuffer object name via `glCreateFramebuffers(1, ...)`.
 *
 * Provided by `GL_VERSION_4_5`.
 * @returns The new framebuffer object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateFramebuffers.xhtml
 */
export function createFramebuffer(): GLuint {
    const out = { value: 0 };
    glCreateFramebuffersSingle(1, out);
    return out.value;
}

/**
 * Returns one program pipeline object name via `glCreateProgramPipelines(1, ...)`.
 *
 * Provided by `GL_VERSION_4_5`.
 * @returns The new program pipeline object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateProgramPipelines.xhtml
 */
export function createProgramPipeline(): GLuint {
    const out = { value: 0 };
    glCreateProgramPipelinesSingle(1, out);
    return out.value;
}

/**
 * Returns one query object name via `glCreateQueries(..., 1, ...)`.
 *
 * Provided by `GL_VERSION_4_5`.
 * @param target - `GLenum`, group `QueryTarget`
 * @returns The new query object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateQueries.xhtml
 */
export function createQuery(target: QueryTarget): GLuint {
    const out = { value: 0 };
    glCreateQueriesSingle(target, 1, out);
    return out.value;
}

/**
 * Returns one renderbuffer object name via `glCreateRenderbuffers(1, ...)`.
 *
 * Provided by `GL_VERSION_4_5`.
 * @returns The new renderbuffer object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateRenderbuffers.xhtml
 */
export function createRenderbuffer(): GLuint {
    const out = { value: 0 };
    glCreateRenderbuffersSingle(1, out);
    return out.value;
}

/**
 * Returns one sampler object name via `glCreateSamplers(1, ...)`.
 *
 * Provided by `GL_VERSION_4_5`.
 * @returns The new sampler object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateSamplers.xhtml
 */
export function createSampler(): GLuint {
    const out = { value: 0 };
    glCreateSamplersSingle(1, out);
    return out.value;
}

/**
 * Returns one texture object name via `glCreateTextures(..., 1, ...)`.
 *
 * Provided by `GL_VERSION_4_5`.
 * @param target - `GLenum`, group `TextureTarget`
 * @returns The new texture object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateTextures.xhtml
 */
export function createTexture(target: TextureTarget): GLuint {
    const out = { value: 0 };
    glCreateTexturesSingle(target, 1, out);
    return out.value;
}

/**
 * Returns one transform feedback object name via `glCreateTransformFeedbacks(1, ...)`.
 *
 * Provided by `GL_VERSION_4_5`.
 * @returns The new transform feedback object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateTransformFeedbacks.xhtml
 */
export function createTransformFeedback(): GLuint {
    const out = { value: 0 };
    glCreateTransformFeedbacksSingle(1, out);
    return out.value;
}

/**
 * Returns one vertex array object name via `glCreateVertexArrays(1, ...)`.
 *
 * Provided by `GL_VERSION_4_5`.
 * @returns The new vertex array object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCreateVertexArrays.xhtml
 */
export function createVertexArray(): GLuint {
    const out = { value: 0 };
    glCreateVertexArraysSingle(1, out);
    return out.value;
}

/**
 * Deletes one buffer object name via `glDeleteBuffers(1, ...)`.
 *
 * Provided by `GL_VERSION_1_5`.
 * @param name - The buffer object name to delete
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteBuffers.xhtml
 */
export function deleteBuffer(name: GLuint): void {
    glDeleteBuffers(1, [name]);
}

/**
 * Deletes one framebuffer object name via `glDeleteFramebuffers(1, ...)`.
 *
 * Provided by `GL_VERSION_3_0`.
 * @param name - The framebuffer object name to delete
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteFramebuffers.xhtml
 */
export function deleteFramebuffer(name: GLuint): void {
    glDeleteFramebuffers(1, [name]);
}

/**
 * Deletes one program pipeline object name via `glDeleteProgramPipelines(1, ...)`.
 *
 * Provided by `GL_VERSION_4_1`.
 * @param name - The program pipeline object name to delete
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteProgramPipelines.xhtml
 */
export function deleteProgramPipeline(name: GLuint): void {
    glDeleteProgramPipelines(1, [name]);
}

/**
 * Deletes one query object name via `glDeleteQueries(1, ...)`.
 *
 * Provided by `GL_VERSION_1_5`.
 * @param name - The query object name to delete
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteQueries.xhtml
 */
export function deleteQuery(name: GLuint): void {
    glDeleteQueries(1, [name]);
}

/**
 * Deletes one renderbuffer object name via `glDeleteRenderbuffers(1, ...)`.
 *
 * Provided by `GL_VERSION_3_0`.
 * @param name - The renderbuffer object name to delete
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteRenderbuffers.xhtml
 */
export function deleteRenderbuffer(name: GLuint): void {
    glDeleteRenderbuffers(1, [name]);
}

/**
 * Deletes one sampler object name via `glDeleteSamplers(1, ...)`.
 *
 * Provided by `GL_VERSION_3_3`.
 * @param name - The sampler object name to delete
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteSamplers.xhtml
 */
export function deleteSampler(name: GLuint): void {
    glDeleteSamplers(1, [name]);
}

/**
 * Deletes one texture object name via `glDeleteTextures(1, ...)`.
 *
 * Provided by `GL_VERSION_1_1`.
 * @param name - The texture object name to delete
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteTextures.xhtml
 */
export function deleteTexture(name: GLuint): void {
    glDeleteTextures(1, [name]);
}

/**
 * Deletes one transform feedback object name via `glDeleteTransformFeedbacks(1, ...)`.
 *
 * Provided by `GL_VERSION_4_0`.
 * @param name - The transform feedback object name to delete
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteTransformFeedbacks.xhtml
 */
export function deleteTransformFeedback(name: GLuint): void {
    glDeleteTransformFeedbacks(1, [name]);
}

/**
 * Deletes one vertex array object name via `glDeleteVertexArrays(1, ...)`.
 *
 * Provided by `GL_VERSION_3_0`.
 * @param name - The vertex array object name to delete
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDeleteVertexArrays.xhtml
 */
export function deleteVertexArray(name: GLuint): void {
    glDeleteVertexArrays(1, [name]);
}

/**
 * Returns one buffer object name via `glGenBuffers(1, ...)`.
 *
 * Provided by `GL_VERSION_1_5`.
 * @returns The new buffer object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenBuffers.xhtml
 */
export function genBuffer(): GLuint {
    const out = { value: 0 };
    glGenBuffersSingle(1, out);
    return out.value;
}

/**
 * Returns one framebuffer object name via `glGenFramebuffers(1, ...)`.
 *
 * Provided by `GL_VERSION_3_0`.
 * @returns The new framebuffer object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenFramebuffers.xhtml
 */
export function genFramebuffer(): GLuint {
    const out = { value: 0 };
    glGenFramebuffersSingle(1, out);
    return out.value;
}

/**
 * Returns one program pipeline object name via `glGenProgramPipelines(1, ...)`.
 *
 * Provided by `GL_VERSION_4_1`.
 * @returns The new program pipeline object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenProgramPipelines.xhtml
 */
export function genProgramPipeline(): GLuint {
    const out = { value: 0 };
    glGenProgramPipelinesSingle(1, out);
    return out.value;
}

/**
 * Returns one query object name via `glGenQueries(1, ...)`.
 *
 * Provided by `GL_VERSION_1_5`.
 * @returns The new query object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenQueries.xhtml
 */
export function genQuery(): GLuint {
    const out = { value: 0 };
    glGenQueriesSingle(1, out);
    return out.value;
}

/**
 * Returns one renderbuffer object name via `glGenRenderbuffers(1, ...)`.
 *
 * Provided by `GL_VERSION_3_0`.
 * @returns The new renderbuffer object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenRenderbuffers.xhtml
 */
export function genRenderbuffer(): GLuint {
    const out = { value: 0 };
    glGenRenderbuffersSingle(1, out);
    return out.value;
}

/**
 * Returns one sampler object name via `glGenSamplers(1, ...)`.
 *
 * Provided by `GL_VERSION_3_3`.
 * @returns The new sampler object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenSamplers.xhtml
 */
export function genSampler(): GLuint {
    const out = { value: 0 };
    glGenSamplersSingle(1, out);
    return out.value;
}

/**
 * Returns one texture object name via `glGenTextures(1, ...)`.
 *
 * Provided by `GL_VERSION_1_1`.
 * @returns The new texture object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenTextures.xhtml
 */
export function genTexture(): GLuint {
    const out = { value: 0 };
    glGenTexturesSingle(1, out);
    return out.value;
}

/**
 * Returns one transform feedback object name via `glGenTransformFeedbacks(1, ...)`.
 *
 * Provided by `GL_VERSION_4_0`.
 * @returns The new transform feedback object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenTransformFeedbacks.xhtml
 */
export function genTransformFeedback(): GLuint {
    const out = { value: 0 };
    glGenTransformFeedbacksSingle(1, out);
    return out.value;
}

/**
 * Returns one vertex array object name via `glGenVertexArrays(1, ...)`.
 *
 * Provided by `GL_VERSION_3_0`.
 * @returns The new vertex array object name
 * @see https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenVertexArrays.xhtml
 */
export function genVertexArray(): GLuint {
    const out = { value: 0 };
    glGenVertexArraysSingle(1, out);
    return out.value;
}
