export {
    IpcError,
    IpcErrorCode,
    invalidRequestError,
    methodNotFoundError,
    widgetNotFoundError,
} from "./protocol/errors.js";
export {
    DEFAULT_SOCKET_PATH,
    type IpcRequest,
    type SerializedWidget,
    type ServerInitiatedMethod,
    type ServerRequestParams,
    ServerRequestParamsSchemas,
    type WireParamsSchema,
} from "./protocol/types.js";
export { JsonStreamConnection } from "./transport.js";
