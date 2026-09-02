export {
    invalidRequestError,
    isConnectionClosedError,
    methodNotFoundError,
    propertyNotFoundError,
    widgetNotFoundError,
} from "./protocol/errors.js";
export {
    DEFAULT_SUBTREE_DEPTH,
    MAX_SUBTREE_WIDGETS,
    type ParamsSchema,
    type SerializedProperty,
    type SerializedWidget,
    type ServerInitiatedMethod,
    type ServerRequestParams,
    ServerRequestParamsSchemas,
} from "./protocol/schemas.js";
export {
    MCP_SOCKET_PATH_ENV,
    resolveMcpSocketPath,
} from "./socket-path.js";
export { ProtocolConnection } from "./transport.js";
export type { JSONRPCRequest, Result } from "@modelcontextprotocol/sdk/types.js";
