import { uniqBy as uniqueItems } from "es-toolkit";

function uniqBy<T>(arr: T[], mapper: (item: T, index: number, array: T[]) => unknown): T[] {
    return uniqueItems(arr, (item, index) => mapper(item, index, arr));
}

export { uniqBy };
