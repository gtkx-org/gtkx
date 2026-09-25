import "@homebridge/dbus-native";

/* TODO: Remove this augmentation once dbus-native ships its implemented server API declarations.
 * https://github.com/gtkx-org/gtkx/issues/731
 */
declare module "@homebridge/dbus-native" {
    export type InterfaceDescriptor = {
        name: string;
        methods: Record<string, [string, string, string[], string[]]>;
        signals?: Record<string, [string, ...string[]]>;
        properties?: Record<string, string>;
    };

    export type ReplyError = {
        name?: string;
        message?: string;
        body?: unknown[];
    };

    interface MessageBus {
        exportInterface(implementation: object, path: string, descriptor: InterfaceDescriptor): void;
        requestName(name: string, flags: number, callback: (error: ReplyError | null, result?: number) => void): void;
    }

    export function sessionBus(options?: { busAddress?: string }): MessageBus;
}
