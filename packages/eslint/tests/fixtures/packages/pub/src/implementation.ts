type LocalState = {
    value: string;
};

function publicFunction(): void {
    const state: LocalState = { value: "ready" };
    JSON.stringify(state);
}

export { publicFunction };
