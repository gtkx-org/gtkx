import type { Ref } from "react";
import { useMergeRefs } from "react-merge-refs";

type PossibleRef<T> = Ref<T> | undefined;

const useMergedRef = <T>(first: PossibleRef<T>, second: PossibleRef<T>): Ref<T> => useMergeRefs([first, second]);

export { useMergedRef };
