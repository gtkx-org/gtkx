import { connect, type Socket } from "node:net";

type WireGlobal = { name: number; version: number };
type PendingCallback = { resolve: () => void; reject: (error: Error) => void };

type WireState = {
    socket: Socket;
    globals: Map<string, WireGlobal>;
    pending: Map<number, PendingCallback>;
    inbox: Buffer;
    nextId: number;
};

const DISPLAY_ID = 1;
const REGISTRY_ID = 2;
const FIRST_CLIENT_ID = 3;
const HEADER_SIZE = 8;
const WORD_SIZE = 4;
const OPCODE_MASK = 0xFF_FF;
const DISPLAY_ERROR = 0;
const DISPLAY_SYNC = 0;
const DISPLAY_GET_REGISTRY = 1;
const REGISTRY_GLOBAL = 0;
const REGISTRY_BIND = 0;
const CREATE_DEVICE = 0;
const SEAT_INTERFACE = "wl_seat";
const KEYBOARD_MANAGER_INTERFACE = "zwp_virtual_keyboard_manager_v1";
const POINTER_MANAGER_INTERFACE = "zwlr_virtual_pointer_manager_v1";

const align4 = (size: number): number => (size + 3) & ~3;

const encodeString = (value: string): Buffer => {
    const bytes = Buffer.from(`${value}\0`, "utf8");
    const encoded = Buffer.alloc(WORD_SIZE + align4(bytes.length));
    encoded.writeUInt32LE(bytes.length, 0);
    bytes.copy(encoded, WORD_SIZE);

    return encoded;
};

const encodeArgument = (argument: number | string): Buffer => {
    if (typeof argument === "string") {
        return encodeString(argument);
    }

    const encoded = Buffer.alloc(WORD_SIZE);
    encoded.writeUInt32LE(argument, 0);

    return encoded;
};

const sendRequest = (state: WireState, objectId: number, opcode: number, args: (number | string)[]): void => {
    const body = Buffer.concat(args.map((argument) => encodeArgument(argument)));
    const header = Buffer.alloc(HEADER_SIZE);
    header.writeUInt32LE(objectId, 0);
    header.writeUInt32LE(((body.length + HEADER_SIZE) << 16) | opcode, WORD_SIZE);
    state.socket.write(Buffer.concat([header, body]));
};

const readString = (body: Buffer, offset: number): string => {
    const length = body.readUInt32LE(offset);

    return body.subarray(offset + WORD_SIZE, offset + WORD_SIZE + length - 1).toString("utf8");
};

const allocateId = (state: WireState): number => {
    const id = state.nextId;
    state.nextId += 1;

    return id;
};

const storeGlobal = (state: WireState, body: Buffer): void => {
    const name = body.readUInt32LE(0);
    const interfaceName = readString(body, WORD_SIZE);
    const versionOffset = WORD_SIZE + WORD_SIZE + align4(interfaceName.length + 1);
    state.globals.set(interfaceName, { name, version: body.readUInt32LE(versionOffset) });
};

const rejectPending = (state: WireState, error: Error): void => {
    for (const callback of state.pending.values()) {
        callback.reject(error);
    }

    state.pending.clear();
};

const settlePending = (state: WireState, objectId: number): void => {
    const callback = state.pending.get(objectId);

    if (callback === undefined) {
        return;
    }

    state.pending.delete(objectId);
    callback.resolve();
};

const handleEvent = (state: WireState, objectId: number, opcode: number, body: Buffer): void => {
    if (objectId === DISPLAY_ID && opcode === DISPLAY_ERROR) {
        rejectPending(state, new Error(`virtual seat request rejected: ${readString(body, HEADER_SIZE)}`));

        return;
    }

    if (objectId === REGISTRY_ID && opcode === REGISTRY_GLOBAL) {
        storeGlobal(state, body);

        return;
    }

    settlePending(state, objectId);
};

const consumeMessages = (state: WireState): void => {
    while (state.inbox.length >= HEADER_SIZE) {
        const objectId = state.inbox.readUInt32LE(0);
        const word = state.inbox.readUInt32LE(WORD_SIZE);
        const size = word >>> 16;

        if (size < HEADER_SIZE || state.inbox.length < size) {
            return;
        }

        handleEvent(state, objectId, word & OPCODE_MASK, state.inbox.subarray(HEADER_SIZE, size));
        state.inbox = state.inbox.subarray(size);
    }
};

const receive = (state: WireState, chunk: Buffer): void => {
    state.inbox = Buffer.concat([state.inbox, chunk]);
    consumeMessages(state);
};

const attachHandlers = (state: WireState, onOpen: () => void, onFailure: (error: Error) => void): void => {
    state.socket.on("data", (chunk: Buffer) => {
        receive(state, chunk);
    });

    state.socket.on("error", onFailure);

    state.socket.on("close", () => {
        onFailure(new Error("the compositor closed the virtual seat connection"));
    });

    state.socket.once("connect", onOpen);
};

const openConnection = (socketPath: string): Promise<WireState> =>
    new Promise((resolve, reject) => {
        const socket = connect(socketPath);

        const state: WireState = {
            socket,
            globals: new Map(),
            pending: new Map(),
            inbox: Buffer.alloc(0),
            nextId: FIRST_CLIENT_ID,
        };

        attachHandlers(
            state,
            () => {
                resolve(state);
            },
            (error) => {
                reject(error);
                rejectPending(state, error);
            },
        );
    });

const roundtrip = (state: WireState): Promise<void> =>
    new Promise((resolve, reject) => {
        const callbackId = allocateId(state);
        state.pending.set(callbackId, { resolve, reject });
        sendRequest(state, DISPLAY_ID, DISPLAY_SYNC, [callbackId]);
    });

const bindGlobal = (state: WireState, interfaceName: string, version: number): number => {
    const entry = state.globals.get(interfaceName);

    if (entry === undefined) {
        throw new Error(`the headless compositor does not implement ${interfaceName}`);
    }

    const id = allocateId(state);
    sendRequest(state, REGISTRY_ID, REGISTRY_BIND, [entry.name, interfaceName, Math.min(version, entry.version), id]);

    return id;
};

const createDevices = (state: WireState): void => {
    const seat = bindGlobal(state, SEAT_INTERFACE, 1);
    const keyboardManager = bindGlobal(state, KEYBOARD_MANAGER_INTERFACE, 1);
    const pointerManager = bindGlobal(state, POINTER_MANAGER_INTERFACE, 1);
    sendRequest(state, keyboardManager, CREATE_DEVICE, [seat, allocateId(state)]);
    sendRequest(state, pointerManager, CREATE_DEVICE, [seat, allocateId(state)]);
};

const startVirtualSeat = async (socketPath: string): Promise<() => void> => {
    const state = await openConnection(socketPath);
    sendRequest(state, DISPLAY_ID, DISPLAY_GET_REGISTRY, [REGISTRY_ID]);
    await roundtrip(state);
    createDevices(state);
    await roundtrip(state);
    state.socket.unref();

    return () => {
        state.socket.destroy();
    };
};

export { startVirtualSeat };
