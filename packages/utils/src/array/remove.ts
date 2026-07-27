/**
 * Removes the first strictly-equal (`===`) occurrence of `value` from `arr` in place.
 *
 * @template T - The type of the array elements.
 * @param arr - The array to mutate.
 * @param value - The value to remove.
 *
 * @example
 * const items = ["a", "b", "c"];
 * remove(items, "b"); // items is now ["a", "c"]
 */
function remove<T>(arr: T[], value: T): void {
    const index = arr.indexOf(value);

    if (index !== -1) {
        arr.splice(index, 1);
    }
}

export { remove };
