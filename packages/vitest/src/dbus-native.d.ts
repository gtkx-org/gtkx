import "@homebridge/dbus-native";

declare module "@homebridge/dbus-native" {
    export type InterfaceDescriptor = {
        name: string;
        methods: Record<string, [string, string, string[], string[]]>;
        signals?: Record<string, [string, ...string[]]>;
        properties?: Record<string, string>;
    };

    interface MessageBus {
        exportInterface(implementation: object, path: string, descriptor: InterfaceDescriptor): void;
        requestName(name: string, flags: number, callback: (error: Error | null, result?: number) => void): void;
    }

    export function sessionBus(options?: { busAddress?: string }): MessageBus;
}
