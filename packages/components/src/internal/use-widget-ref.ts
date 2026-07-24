import { useMergedRef } from "@gtkx/react/internal";
import type { Ref, RefCallback } from "react";
import { useState } from "react";

export const useWidgetRef = <T>(external: Ref<T | null> | null | undefined): [T | null, RefCallback<T | null>] => {
    const [widget, setWidget] = useState<T | null>(null);
    return [widget, useMergedRef<T | null>(external, setWidget)];
};
