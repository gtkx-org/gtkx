export {
    invalidRequestError,
    McpError,
    McpErrorCode,
    methodNotFoundError,
    widgetNotFoundError,
} from "./protocol/errors.js";
export {
    DEFAULT_SOCKET_PATH,
    type IpcMethod,
    type IpcRequest,
    type SerializedWidget,
    type ServerInitiatedMethod,
    type ServerRequestParams,
    ServerRequestParamsSchemas,
    type WireParamsSchema,
} from "./protocol/types.js";
export { JsonStreamTransport, TransportClosedError } from "./transport.js";
