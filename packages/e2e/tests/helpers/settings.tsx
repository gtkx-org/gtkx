import type * as Gio from "@gtkx/gi/gio";
import type { SettingsSchemaKeys, SettingsSchemaValues, SettingValue } from "@gtkx/react/internal";
import type { RenderHookResult } from "@gtkx/testing";
import { GSettings } from "@gtkx/jsx/gio";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { createPortal, rootElement, SettingsProvider, type SettingsSchema, useSetting } from "@gtkx/react";
import { act, render, renderHook, waitFor } from "@gtkx/testing";
import { createRef, type ReactNode } from "react";
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

const settingsWrapper =
    (...schemas: SettingsSchema[]) =>
    ({ children }: { children: ReactNode }): ReactNode =>
        schemas.reduceRight<ReactNode>(
            (node, schema) => <SettingsProvider schema={schema}>{node}</SettingsProvider>,
            children,
        );

const resetSettingsKey = async (schemaId: string, key: string): Promise<void> => {
    const settings = await renderSettings(schemaId);

    settings.reset(key);
};

const renderSetting = async <K extends SettingsSchemaKeys, P extends keyof K, V extends SettingsSchemaValues>(
    schema: SettingsSchema<K, V>,
    key: P & string,
): Promise<RenderHookResult<[SettingValue<K, P, V>, (value: SettingValue<K, P, V>) => void], undefined>> =>
    renderHook(() => useSetting(schema, key), { wrapper: settingsWrapper(schema) });

const renderHookWithSettings = async <Result,>(
    schema: SettingsSchema,
    callback: () => Result,
): Promise<RenderHookResult<Result, undefined> & { settings: Gio.Settings }> => {
    const ref = createRef<Gio.Settings>();
    const rendered = await renderHook(callback, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <SettingsProvider schema={schema} ref={ref}>
                {children}
            </SettingsProvider>
        ),
    });

    if (ref.current === null) {
        throw new Error("Settings did not mount");
    }

    return { ...rendered, settings: ref.current };
};

const expectSettingRoundTrip = async <K extends SettingsSchemaKeys, P extends keyof K, V extends SettingsSchemaValues>(
    schema: SettingsSchema<K, V>,
    key: P & string,
    initial: SettingValue<K, P, V>,
    next: SettingValue<K, P, V>,
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

export {
    expectSettingRoundTrip,
    renderHookWithSettings,
    renderSetting,
    renderSettings,
    resetSettingsKey,
    settingsWrapper,
};
