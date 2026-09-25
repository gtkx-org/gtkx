import "./bootstrap.js";
import { addLogListener, removeLogListener } from "./index.js";

const onLog = (listener) => {
    const id = addLogListener(listener);

    return {
        unsubscribe: () => {
            removeLogListener(id);
        },
    };
};

export {
    alloc,
    allocField,
    ArrayKind,
    bind,
    bindField,
    bindFunctionPointer,
    bindVfunc,
    call,
    CallbackScope,
    copy,
    DestroyNotifyKind,
    ElementOwnership,
    getFundamentalWrapper,
    getMatchInfoBase,
    getMatchInfoType,
    getType,
    getTypeClass,
    getWrapper,
    init,
    keepAlive,
    newObject,
    Ownership,
    ownMatchInfo,
    quit,
    read,
    readField,
    readFunctionPointer,
    registerClass,
    resolveFunction,
    resolveType,
    setFundamentalWrapper,
    setWrapper,
    setWrapperBorrow,
    write,
    writeField,
} from "./index.js";
export { onLog };
