import * as Gio from "@gtkx/gi/gio";
import { type ReactNode, type Ref, use, useCallback, useMemo, useState } from "react";
import type { SettingsSchema } from "../utils/settings.js";
import { useMergedRef } from "../hooks/use-merged-refs.js";
import { rootElement } from "../reconciler/root-element.js";
import { createPortal } from "../reconciler/root.js";
import { createElementComponent } from "./element.js";
import { createSettingsStore, SettingsContext, type SettingsScope } from "./settings-context.js";

type SettingsElementProps = { schemaId: string; path?: string | undefined; ref?: Ref<Gio.Settings> | undefined };

type MountedSettings = { settings: Gio.Settings; id: string; path: string | null };

/** Props of {@link SettingsProvider}. */
type SettingsProviderProps = {
    /**
     * Schema to instantiate: a module GTKX generates from a `.gschema.xml` import, one path of a relocatable
     * schema obtained from its `at(path)`, or a hand-written object describing a schema installed on the system.
     */
    schema: SettingsSchema;
    /** Receives the `Gio.Settings` instance, for calls the hooks do not cover such as `reset` and `createAction`. */
    ref?: Ref<Gio.Settings>;
    /** Rendered once the instance exists. */
    children?: ReactNode;
};

const Settings = createElementComponent<SettingsElementProps>("GSettings", Gio.Settings);

/**
 * Owns the `Gio.Settings` instance of a schema and gives it to the `useSetting` and `useBindSetting` calls
 * below that name the same schema. Providers nest, one per schema or relocatable path.
 *
 * The children render once the instance exists, and are remounted when `schema` names another id or path.
 */
function SettingsProvider({ schema, ref, children }: SettingsProviderProps): ReactNode {
    const { id, path } = schema;
    const parent = use(SettingsContext);
    const [mounted, setMounted] = useState<MountedSettings | null>(null);
    const capture = useCallback(
        (settings: Gio.Settings | null): void => {
            setMounted(settings === null ? null : { settings, id, path });
        },
        [id, path],
    );
    const settingsRef = useMergedRef(ref, capture);
    const scope = useMemo((): SettingsScope | null => {
        if (mounted === null || mounted.id !== id || mounted.path !== path) {
            return null;
        }

        return { id, path, settings: mounted.settings, store: createSettingsStore(mounted.settings), parent };
    }, [mounted, id, path, parent]);

    return (
        <>
            {createPortal(
                <Settings key={`${id}:${path ?? ""}`} ref={settingsRef} schemaId={id} path={path ?? undefined} />,
                rootElement,
            )}
            {scope !== null && <SettingsContext value={scope}>{children}</SettingsContext>}
        </>
    );
}

export { SettingsProvider, type SettingsProviderProps };
