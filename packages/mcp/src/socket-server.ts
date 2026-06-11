import * as fs from "node:fs";
import * as net from "node:net";
import type { ConnectionRegistry } from "./connection-registry.js";
import { DEFAULT_SOCKET_PATH } from "./protocol/types.js";

/**
 * Returns whether a live server currently accepts connections on
 * `socketPath`. A leftover file from a crashed server refuses the probe
 * connection, distinguishing it from an owned socket.
 *
 * @param socketPath - The Unix-domain socket path to probe.
 */
const isSocketLive = (socketPath: string): Promise<boolean> =>
    new Promise((resolve) => {
        const probe = net.connect(socketPath);
        probe.once("connect", () => {
            probe.destroy();
            resolve(true);
        });
        probe.once("error", () => resolve(false));
    });

/**
 * Unix-domain socket server that accepts GTKX-app connections and registers
 * each on a {@link ConnectionRegistry}. The server is intentionally narrow:
 * it owns the listening socket and the socket file's lifecycle, nothing
 * else. Connection tracking, framing, and request routing all live on the
 * registry it was constructed with.
 *
 * The socket path has a single owner: starting while another live server
 * holds it fails, so concurrent MCP sessions surface an explicit error
 * instead of silently splitting app registrations across servers. A stale
 * socket file left by a crashed server is removed and the path re-bound.
 */
export class SocketServer {
    private server: net.Server | null = null;
    private readonly socketPath: string;
    private readonly registry: ConnectionRegistry;

    constructor(registry: ConnectionRegistry, socketPath: string = DEFAULT_SOCKET_PATH) {
        this.registry = registry;
        this.socketPath = socketPath;
    }

    async start(): Promise<void> {
        if (this.server) return;

        if (fs.existsSync(this.socketPath)) {
            if (await isSocketLive(this.socketPath)) {
                throw new Error(
                    `Another GTKX MCP server already owns ${this.socketPath}. ` +
                        "Stop the other server (for example, the gtkx MCP server of another active session) and reconnect.",
                );
            }
            fs.unlinkSync(this.socketPath);
        }

        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => this.registry.register(socket));

            let listening = false;
            this.server.on("error", (error) => {
                this.registry.emit("error", error);
                if (!listening) reject(error);
            });

            this.server.listen(this.socketPath, () => {
                listening = true;
                resolve();
            });
        });
    }

    async stop(): Promise<void> {
        if (!this.server) return;

        this.registry.closeAll("Server stopping");

        return new Promise((resolve) => {
            this.server?.close(() => {
                this.server = null;
                if (fs.existsSync(this.socketPath)) {
                    fs.unlinkSync(this.socketPath);
                }
                this.registry.clear();
                resolve();
            });
        });
    }
}
