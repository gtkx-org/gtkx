export {
    invalidRequestError,
    isConnectionClosedError,
    methodNotFoundError,
    propertyNotFoundError,
    widgetNotFoundError,
} from "./protocol/errors.js";
export {
    DEFAULT_SOCKET_PATH,
    DEFAULT_SUBTREE_DEPTH,
    MAX_SUBTREE_WIDGETS,
    type ParamsSchema,
    type SerializedProperty,
    type SerializedWidget,
    type ServerInitiatedMethod,
    type ServerRequestParams,
    ServerRequestParamsSchemas,
} from "./protocol/schemas.js";
export { ProtocolConnection } from "./transport.js";
export type { JSONRPCRequest, Result } from "@modelcontextprotocol/sdk/types.js";
