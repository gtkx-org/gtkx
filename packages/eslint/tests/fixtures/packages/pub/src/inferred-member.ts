class InternalState {
    value = "ready";
}

class PublicContainer {
    state = new InternalState();
}

class WrappedState {
    value = "ready";
}

class PublicWrapper {
    data = { state: new WrappedState() };
}

class ReturnedState {
    value = "ready";
}

const createState = () => ({ state: new ReturnedState() });

class SpreadState {
    value = "ready";
}

const spreadSource = { state: new SpreadState() };
const createSpreadState = () => ({ ...spreadSource });

class AnonymousState {
    value = "ready";
}

const createAnonymousState = () => new class {
    state = new AnonymousState();
}();

function wrap<T>(value: T) {
    return () => value;
}

class FirstState {
    value = "first";
}

class SecondState {
    value = "second";
}

const first = wrap(new FirstState());
const second = wrap(new SecondState());

export { createAnonymousState, createSpreadState, createState, first, PublicContainer, PublicWrapper, second };
