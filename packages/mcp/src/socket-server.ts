import * as fs from "node:fs";
import * as net from "node:net";
import type { ConnectionRegistry } from "./connection-registry.js";
import { DEFAULT_SOCKET_PATH } from "./protocol/types.js";

const isSocketLive = (socketPath: string): Promise<boolean> =>
    new Promise((resolve) => {
        const probe = net.connect(socketPath);
        probe.once("connect", () => {
            probe.destroy();
            resolve(true);
        });
        probe.once("error", () => resolve(false));
    });

export class SocketServer {
    private server: net.Server | null = null;
    private socketPath: string;
    private registry: ConnectionRegistry;

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

        this.registry.dispose("Server stopping");

        return new Promise((resolve) => {
            this.server?.close(() => {
                this.server = null;
                if (fs.existsSync(this.socketPath)) {
                    fs.unlinkSync(this.socketPath);
                }
                resolve();
            });
        });
    }
}
