import * as Gio from "@gtkx/gi/gio";
import { type SettingsSchema, type SettingsSchemaKeys, type SettingValue, useSetting } from "@gtkx/react";
import { act, renderHook, waitFor } from "@gtkx/testing";
import { expect } from "vitest";

const resetSettingsKey = (schemaId: string, key: string): void => {
    const settings = Gio.Settings.new(schemaId);

    if (settings.isWritable(key)) {
        settings.reset(key);
    }
};

const expectSettingRoundTrip = async <K extends SettingsSchemaKeys, P extends keyof K>(
    schema: SettingsSchema<K>,
    key: P & string,
    initial: SettingValue<K, P>,
    next: SettingValue<K, P>,
): Promise<void> => {
    resetSettingsKey(schema.id, key);
    const { result } = await renderHook(() => useSetting(schema, key));
    expect(result.current[0]).toEqual(initial);

    await act(() => {
        result.current[1](next);
    });

    await waitFor(() => {
        expect(result.current[0]).toEqual(next);
    });
};

export { resetSettingsKey, expectSettingRoundTrip };
