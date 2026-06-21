import * as Gio from "@gtkx/gi/gio";
import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveAccessor } from "../utils/settings-accessor.js";
import { useSignal } from "./use-signal.js";

export interface SchemaRef<K extends object = Record<string, unknown>> {
    id: string;
    path: string | null;
    keys: { [P in keyof K]: string };
    __keys__?: K;
}

export interface RelocatableSchemaRef<K extends object = Record<string, unknown>> {
    id: string;
    keys: { [P in keyof K]: string };
    __keys__?: K;
    at(path: string): SchemaRef<K>;
}

export function useSetting<K extends object, P extends keyof K & string>(
    schema: SchemaRef<K>,
    key: P,
): [K[P], (value: K[P]) => void];
export function useSetting(schema: SchemaRef, key: string): [unknown, (value: unknown) => void] {
    const { id: schemaId, path } = schema;
    const accessor = resolveAccessor(schema.keys[key], key, schemaId);

    const settings = useMemo(
        () => (path === null ? Gio.Settings.new(schemaId) : new Gio.Settings({ schemaId, path })),
        [schemaId, path],
    );
    const [value, setValue] = useState<unknown>(() => accessor.read(settings, key));

    useEffect(() => {
        setValue(accessor.read(settings, key));
    }, [accessor, settings, key]);

    useSignal(settings, `changed::${key}`, () => {
        setValue(accessor.read(settings, key));
    });

    const set = useCallback(
        (newValue: unknown) => {
            accessor.write(settings, key, newValue);
        },
        [accessor, settings, key],
    );

    return [value, set];
}
