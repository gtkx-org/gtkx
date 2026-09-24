import * as Soup from "@gtkx/gi/soup";
import { expect, it } from "vitest";

type Sniffed = [contentType: string, params: Map<string, string>];

const createMessage = (): Soup.Message => {
    const message = Soup.Message.new("GET", "http://127.0.0.1/");
    if (message === null) {
        throw new Error("The local HTTP URI must create a message");
    }

    return message;
};

it("emits string parameters and preserves the callback copy", () => {
    const message = createMessage();
    const received: Sniffed[] = [];
    const handler = (...args: Sniffed): void => {
        received.push(args);
    };
    message.on("content-sniffed", handler);

    try {
        const params = new Map([["charset", "utf8"], ["title", "café ♥"], ["empty", ""]]);
        message.emit("content-sniffed", "text/plain", params);
        expect(received).toEqual([
            ["text/plain", new Map([["charset", "utf8"], ["title", "café ♥"], ["empty", ""]])],
        ]);

        params.clear();
        params.set("charset", "ascii");
        expect(received).toEqual([
            ["text/plain", new Map([["charset", "utf8"], ["title", "café ♥"], ["empty", ""]])],
        ]);
    } finally {
        message.off("content-sniffed", handler);
    }
});

it("emits an empty parameter map", () => {
    const message = createMessage();
    const received: Sniffed[] = [];
    const handler = (...args: Sniffed): void => {
        received.push(args);
    };
    message.on("content-sniffed", handler);

    try {
        message.emit("content-sniffed", "text/plain", new Map());
        expect(received).toEqual([["text/plain", new Map()]]);
    } finally {
        message.off("content-sniffed", handler);
    }
});

it.each([
    { name: "key", params: new Map([["bad\0key", "utf8"]]) },
    { name: "value", params: new Map([["charset", "bad\0value"]]) },
])("rejects a NUL-bearing $name before delivery and recovers", ({ params }) => {
    const message = createMessage();
    const received: Sniffed[] = [];
    const handler = (...args: Sniffed): void => {
        received.push(args);
    };
    message.on("content-sniffed", handler);

    try {
        expect(() => {
            message.emit("content-sniffed", "text/plain", params);
        }).toThrow();
        expect(received).toEqual([]);

        message.emit("content-sniffed", "text/plain", new Map([["charset", "utf8"]]));
        expect(received).toEqual([["text/plain", new Map([["charset", "utf8"]])]]);
    } finally {
        message.off("content-sniffed", handler);
    }
});
