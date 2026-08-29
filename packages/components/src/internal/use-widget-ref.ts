import type { Ref } from "react";
import { useMergedRef } from "@gtkx/react/internal";
import { useState } from "react";

const useWidgetRef = <T>(external: Ref<T | null> | null | undefined): [T | null, Ref<T | null>] => {
    const [widget, setWidget] = useState<T | null>(null);

    return [widget, useMergedRef<T | null>(external, setWidget)];
};

export { useWidgetRef };
