type Registration = { key: bigint; token: symbol };
type Entry = Registration & { reference: WeakRef<object> };

const wrappers = new Map<bigint, Entry>();
const registrations = new WeakMap<object, Entry>();
const finalizers = new FinalizationRegistry<Registration>(({ key, token }) => {
    if (wrappers.get(key)?.token === token) {
        wrappers.delete(key);
    }
});

function getFundamentalWrapper(key: bigint): object | undefined {
    return wrappers.get(key)?.reference.deref();
}

function forgetFundamentalWrapper(wrapper: object): void {
    const entry = registrations.get(wrapper);

    if (entry === undefined) {
        return;
    }

    if (wrappers.get(entry.key)?.token === entry.token) {
        wrappers.delete(entry.key);
    }
    finalizers.unregister(entry);
    registrations.delete(wrapper);
}

function setFundamentalWrapper(key: bigint, wrapper: object): void {
    forgetFundamentalWrapper(wrapper);
    const token = Symbol();
    const entry = { key, token, reference: new WeakRef(wrapper) };
    wrappers.set(key, entry);
    registrations.set(wrapper, entry);
    finalizers.register(wrapper, { key, token }, entry);
}

export { forgetFundamentalWrapper, getFundamentalWrapper, setFundamentalWrapper };
