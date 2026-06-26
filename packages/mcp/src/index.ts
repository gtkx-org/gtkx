export {
    ErrorCode,
    invalidRequestError,
    methodNotFoundError,
    ProtocolError,
    widgetNotFoundError,
} from "./protocol/errors.js";
export {
    DEFAULT_SOCKET_PATH,
    type ParamsSchema,
    type Request,
    type SerializedWidget,
    type ServerInitiatedMethod,
    type ServerRequestParams,
    ServerRequestParamsSchemas,
} from "./protocol/types.js";
export { ProtocolConnection } from "./transport.js";
