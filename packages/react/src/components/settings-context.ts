import type * as Gio from "@gtkx/gi/gio";
import { offSignal, onSignal, type SignalHandler } from "@gtkx/runtime";
import { type Context, createContext, use } from "react";
import type { SettingsSchema } from "../utils/settings.js";

type SettingsStore = {
    subscribe: (key: string, listener: () => void) => () => void;
    read: <T>(key: string, get: () => T) => T;
};

type SettingsScope = {
    id: string;
    path: string | null;
    settings: Gio.Settings;
    store: SettingsStore;
    parent: SettingsScope | null;
};

type KeySubscription = { listeners: Set<() => void>; handler: SignalHandler };

const SettingsContext: Context<SettingsScope | null> = createContext<SettingsScope | null>(null);

const createSettingsStore = (settings: Gio.Settings): SettingsStore => {
    const values = new Map<string, unknown>();
    const subscriptions = new Map<string, KeySubscription>();

    const connect = (key: string): KeySubscription => {
        const listeners = new Set<() => void>();
        const handler: SignalHandler = () => {
            values.delete(key);

            for (const listener of [...listeners]) {
                listener();
            }
        };
        const subscription = { listeners, handler };

        subscriptions.set(key, subscription);
        onSignal(settings, `changed::${key}`, handler);
        values.delete(key);

        return subscription;
    };

    return {
        subscribe: (key, listener) => {
            const subscription = subscriptions.get(key) ?? connect(key);

            subscription.listeners.add(listener);

            return () => {
                subscription.listeners.delete(listener);

                if (subscription.listeners.size === 0 && subscriptions.get(key) === subscription) {
                    subscriptions.delete(key);
                    offSignal(settings, `changed::${key}`, subscription.handler);
                    values.delete(key);
                }
            };
        },
        read: <T>(key: string, get: () => T): T => {
            if (values.has(key)) {
                return values.get(key) as T;
            }

            const value = get();

            values.set(key, value);

            return value;
        },
    };
};

const describeSchema = (schema: Pick<SettingsSchema, "id" | "path">): string =>
    schema.path === null ? `"${schema.id}"` : `"${schema.id}" at "${schema.path}"`;

const useSettingsScope = (schema: Pick<SettingsSchema, "id" | "path">): SettingsScope => {
    for (let scope = use(SettingsContext); scope !== null; scope = scope.parent) {
        if (scope.id === schema.id && scope.path === schema.path) {
            return scope;
        }
    }

    throw new Error(`No SettingsProvider for schema ${describeSchema(schema)} is rendered above this component`);
};

export { createSettingsStore, SettingsContext, type SettingsScope, useSettingsScope };
