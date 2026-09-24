import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, runNativeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.socketaddress", libraries: ["Gio-2.0"],' +
    " agents: { reference: false, rules: false } };";
const IMPORTS = 'import * as Gio from "@gtkx/gi/gio";\n';
const ACCEPTED = IMPORTS + `import * as GLib from "@gtkx/gi/glib";

export const bytesResult = (bytes: GLib.Bytes): ReturnType<Gio.Socket["receiveBytesFrom"]> => [bytes, null];
export const messageResult: ReturnType<Gio.Socket["receiveMessage"]> = [0, null, null, 0];
export const readFamily = (socket: Gio.Socket): Gio.SocketFamily | null => {
    const [, address] = socket.receiveBytesFrom(1, 1_000_000n, null);
    return address === null ? null : address.getFamily();
};
`;
const CONTROL = IMPORTS + `export const listenerAddress = (
    listener: Gio.SocketListener, address: Gio.SocketAddress,
): Gio.SocketAddress => listener.addAddress(address, Gio.SocketType.STREAM, Gio.SocketProtocol.TCP, null)[1];
`;
const REJECTED = {
    "nonnull-bytes-address.ts": IMPORTS + "export const read = (socket: Gio.Socket): Gio.SocketAddress => " +
        "socket.receiveBytesFrom(1, 1_000_000n, null)[1];",
    "nonnull-message-address.ts": IMPORTS + "export const read = (socket: Gio.Socket): Gio.SocketAddress => " +
        "socket.receiveMessage([], 0, null)[1];",
};
const CONSUMER = IMPORTS + `import assert from "node:assert/strict";
import { quit } from "@gtkx/runtime";

try {
    using sockets = new DisposableStack();
    const ownSocket = (socket: Gio.Socket): Gio.Socket => {
        sockets.adopt(socket, value => { value.close(); });
        socket.setTimeout(5);
        return socket;
    };
    const listener = ownSocket(Gio.Socket.new(Gio.SocketFamily.IPV4, Gio.SocketType.STREAM, Gio.SocketProtocol.TCP));
    const loopback = Gio.InetSocketAddress.new(Gio.InetAddress.newLoopback(Gio.SocketFamily.IPV4), 0);
    assert.equal(listener.bind(loopback, false), true);
    assert.equal(listener.listen(), true);
    const client = ownSocket(Gio.Socket.new(Gio.SocketFamily.IPV4, Gio.SocketType.STREAM, Gio.SocketProtocol.TCP));
    assert.equal(client.connect(listener.getLocalAddress(), null), true);
    const receiver = ownSocket(listener.accept(null));

    const cancelled = Gio.Cancellable.new();
    cancelled.cancel();
    assert.throws(() => receiver.receiveBytesFrom(1, 1_000_000n, cancelled));

    assert.equal(client.send([0x41], null), 1);
    const [bytes, address] = receiver.receiveBytesFrom(1, 1_000_000n, null);
    assert.deepEqual(Array.from(bytes.getData() ?? []), [0x41]);
    assert.equal(address, null);

    assert.equal(client.shutdown(false, true), true);
    const [eof, eofAddress] = receiver.receiveBytesFrom(1, 1_000_000n, null);
    assert.equal(eof.getSize(), 0);
    assert.equal(eofAddress, null);
    assert.deepEqual(Array.from(bytes.getData() ?? []), [0x41]);
} finally {
    quit();
}
`;

describe("generated socket receive address nullability", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-socket-address-types-",
            config: CONFIG,
            files: { "accepted.ts": ACCEPTED, "control.ts": CONTROL, "probe.ts": CONSUMER, ...REJECTED },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves non-null listener addresses", () => {
        expect(typecheckFile(project, "control.ts")).toBe(0);
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it("accepts absent receive addresses and narrowed readers", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects non-null assumptions in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents both nullable receive addresses", () => {
        const reference = loadApiReference({
            libraries: ["Gio-2.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        const page = reference.lookup("Gio.Socket", "class");
        expect(page.outcome).toBe("page");
        expect(page).toHaveProperty("markdown", expect.stringContaining(
            "receiveBytesFrom(size: number, timeoutUs: bigint | number, cancellable: Gio.Cancellable | null): " +
            "[GLib.Bytes, Gio.SocketAddress | null]",
        ));
        expect(page).toHaveProperty("markdown", expect.stringContaining(
            "receiveMessage(vectors: Gio.InputVector[], flags: number, cancellable: Gio.Cancellable | null): " +
            "[number, Gio.SocketAddress | null, Gio.SocketControlMessage[] | null, number]",
        ));
    });

    it("receives connected TCP data and EOF after a cancelled receive", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-socket-address-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});
