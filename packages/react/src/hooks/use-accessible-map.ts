import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { drain } from "@gtkx/utils";
import { type Ref, type RefObject, useCallback } from "react";
import type { Props } from "../reconciler/registry.js";
import { applyAccessibleProps, hasAccessibleProps } from "../utils/accessible-props.js";
import { useLatestRef } from "./use-latest-ref.js";

type AccessibleMapTarget = {
    object: Gtk.Widget;
    props: RefObject<Props>;
};

const pendingMap: Set<AccessibleMapTarget> = new Set();

const settleAccessible = (): void => {
    drain(pendingMap, ({ object, props }) => {
        if (object.getMapped()) {
            applyAccessibleProps(object, null, props.current);
        }
    });
};

const useAccessibleMap = (props: Props): Ref<GObject.Object> | undefined => {
    const latestProps = useLatestRef(props);
    const isActive = hasAccessibleProps(props);
    const attach = useCallback((object: GObject.Object | null) => {
        if (!(object instanceof Gtk.Widget)) {
            return;
        }

        const target: AccessibleMapTarget = { object, props: latestProps };
        const onMapped = (): undefined => {
            pendingMap.add(target);
            setTimeout(settleAccessible, 0);
        };

        object.on("map", onMapped);

        return () => {
            object.off("map", onMapped);
            pendingMap.delete(target);
        };
    }, [latestProps]);

    return isActive ? attach : undefined;
};

export { settleAccessible, useAccessibleMap };
