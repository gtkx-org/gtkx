import type * as Gio from "@gtkx/gi/gio";
import type { SettingsSchema, SettingsSchemaKeys, SettingValue } from "@gtkx/react/internal";
import type { RenderHookResult } from "@gtkx/testing";
import { GSettings } from "@gtkx/jsx/gio";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useSetting } from "@gtkx/react";
import { act, render, renderHook, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { expect } from "vitest";

const renderSettings = async (schemaId: string, path?: string | null): Promise<Gio.Settings> => {
    const ref = createRef<Gio.Settings>();
    await render(
        <GtkBox>
            {createPortal(<GSettings ref={ref} schemaId={schemaId} path={path ?? undefined} />, rootElement)}
            <GtkLabel label="Settings" />
        </GtkBox>,
    );
    if (ref.current === null) {
        throw new Error("Settings did not mount");
    }

    return ref.current;
};

const resetSettingsKey = async (schemaId: string, key: string): Promise<void> => {
    const settings = await renderSettings(schemaId);

    settings.reset(key);
};

const renderSetting = async <K extends SettingsSchemaKeys, P extends keyof K>(
    schema: SettingsSchema<K>,
    key: P & string,
): Promise<RenderHookResult<[SettingValue<K, P>, (value: SettingValue<K, P>) => void], undefined>> => {
    const settings = await renderSettings(schema.id, schema.path);

    return renderHook(() => useSetting<K, P>(settings, schema, key));
};

const expectSettingRoundTrip = async <K extends SettingsSchemaKeys, P extends keyof K>(
    schema: SettingsSchema<K>,
    key: P & string,
    initial: SettingValue<K, P>,
    next: SettingValue<K, P>,
): Promise<void> => {
    await resetSettingsKey(schema.id, key);
    const { result } = await renderSetting(schema, key);
    expect(result.current[0]).toEqual(initial);

    await act(() => {
        result.current[1](next);
    });

    await waitFor(() => {
        expect(result.current[0]).toEqual(next);
    });
};

export { renderSettings, renderSetting, resetSettingsKey, expectSettingRoundTrip };
