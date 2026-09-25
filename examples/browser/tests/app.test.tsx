import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { configure, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/app.js";

type LocalServer = {
    close: () => Promise<void>;
    port: number;
};

const servers: Set<LocalServer> = new Set();

configure({ asyncUtilTimeout: 5000 });

const startServer = async (): Promise<LocalServer> => {
    const worker = new Worker(
        `
            const { createServer } = require("node:http");
            const { parentPort } = require("node:worker_threads");
            const sockets = new Set();
            const server = createServer();
            server.on("connection", (socket) => {
                sockets.add(socket);
                socket.on("close", () => {
                    sockets.delete(socket);
                });
            });
            server.listen(0, "127.0.0.1", () => parentPort.postMessage(server.address().port));
            parentPort.on("message", () => {
                server.close(() => parentPort.close());
                for (const socket of sockets) {
                    socket.destroy();
                }
            });
        `,
        { eval: true },
    );
    const exited = once(worker, "exit");
    const port = await new Promise<number>((resolve, reject) => {
        worker.once("message", (value: unknown) => {
            if (typeof value === "number") {
                resolve(value);
            } else {
                reject(new TypeError("the local server has no TCP port"));
            }
        });
        worker.once("error", reject);
    });
    let isClosed = false;
    const server: LocalServer = {
        close: async () => {
            if (isClosed) {
                return;
            }

            isClosed = true;
            worker.postMessage("close");
            await exited;
            servers.delete(server);
        },
        port,
    };
    servers.add(server);

    return server;
};

const navigate = async (entry: Gtk.Entry, url: string): Promise<void> => {
    await userEvent.clear(entry);
    await userEvent.type(entry, url);
    await userEvent.keyboard(entry, "{Enter}");
};

const waitForLoadedUrl = async (entry: Gtk.Entry, url: string): Promise<void> => {
    await waitFor(() => {
        expect(entry).toHaveDisplayValue(url);
    });
    await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Reload" });
};

afterEach(async () => {
    await Promise.all([...servers].map((server) => server.close()));
});

describe("App", () => {
    it("loads pages and follows initial URL changes", async () => {
        const firstUrl = "data:text/html,First";
        const secondUrl = "data:text/html,Second";
        const rendered = await render(<App initialUrl={` ${firstUrl} `} />, { container: rootElement });
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
            name: "Web address",
            as: Gtk.Entry,
        });
        await waitForLoadedUrl(entry, firstUrl);
        expect(screen.queryByRole(Gtk.AccessibleRole.PROGRESS_BAR, { name: "Page loading progress" })).toBeNull();
        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go back" })).toBeDisabled();
        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go forward" })).toBeDisabled();

        await rendered.rerender(<App initialUrl={` ${secondUrl} `} />);
        await waitForLoadedUrl(entry, secondUrl);

        const typedUrl = "data:text/html,Typed";
        await navigate(entry, ` ${typedUrl} `);
        await waitForLoadedUrl(entry, typedUrl);
    });

    it("loads its initial page in Strict Mode", async () => {
        const url = "data:text/html,Strict";
        await render(<App initialUrl={` ${url} `} />, { container: rootElement, isReactStrictMode: true });
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
            name: "Web address",
            as: Gtk.Entry,
        });

        await waitForLoadedUrl(entry, url);
        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go back" })).toBeDisabled();
        expect(screen.queryByRole(Gtk.AccessibleRole.PROGRESS_BAR, { name: "Page loading progress" })).toBeNull();
    });

    it("clears loading state after failure", async () => {
        const server = await startServer();
        await server.close();
        const failedUrl = `https://localhost:${String(server.port)}/failure`;
        await render(<App initialUrl={failedUrl} />, { container: rootElement });
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
            name: "Web address",
            as: Gtk.Entry,
        });

        await waitForLoadedUrl(entry, failedUrl);
        expect(screen.queryByRole(Gtk.AccessibleRole.PROGRESS_BAR, { name: "Page loading progress" })).toBeNull();
    });
});
