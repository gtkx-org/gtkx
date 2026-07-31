function remove<T>(arr: T[], value: T): void {
    const index = arr.indexOf(value);

    if (index !== -1) {
        arr.splice(index, 1);
    }
}

export { remove };
