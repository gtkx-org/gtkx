type Widget = {
    label: string;
};

function makeWidget(label: string): Widget {
    return { label };
}

export { makeWidget, type Widget };
