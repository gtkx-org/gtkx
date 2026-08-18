const scenarios = {
    edge,
    fullPodContainer,
    gerror,
    happy,
    invalidInlinePodArray,
    lifecycleTransferFull,
    opaqueContainer,
    outputCleanup,
    transferFull,
    transferFullReturn,
};

function arrayPodValues(pods) {
    return pods.map(({ number, ratio }) => ({ number, ratio }));
}

function containerSnapshots(api, initial, changed) {
    api.setArrayPods(...initial);
    const borrowed = api.getBorrowedPods();
    const container = api.createContainerPods();
    api.setArrayPods(...changed);

    return {
        borrowed: arrayPodValues(borrowed),
        container: arrayPodValues(container),
    };
}

function inlinePodArrayInputs(api, values) {
    const pods = [
        new api.Pod({ number: values[0], ratio: values[1] }),
        new api.Pod({ number: values[2], ratio: values[3] }),
    ];

    return {
        container: api.sumPodArrayContainer(pods),
        full: api.sumPodArrayFull(pods),
        none: api.sumPodArrayNone(pods),
    };
}

function lifecyclePodValue(api, values) {
    const pod = new api.LifecyclePod({ number: values[0], ratio: values[1] });

    return { number: pod.number, ratio: pod.ratio, text: pod.text };
}

function edge(api) {
    const pod = new api.Pod({ number: -2_147_483_648, ratio: -1.5 });
    const callerAllocatedNone = api.fillPodNone(-2_147_483_648, -1.5);
    const callerAllocatedFull = api.fillPodFull(2_147_483_647, 0);
    api.setStaticPod(-2_147_483_648, -1.5);
    const snapshot = api.getStaticPod();
    api.setStaticPod(0, 0);
    api.setStaticTextPod(2, -2_147_483_648);
    const textSnapshot = api.getStaticTextPod();
    api.setStaticTextPod(1, 0);
    api.setStaticNumberUnion(-2_147_483_648);
    const unionSnapshot = api.getStaticNumberUnion();
    api.setStaticNumberUnion(0);

    return {
        arrays: containerSnapshots(api, [-2_147_483_648, -1.5, 2_147_483_647, 0], [0, 0, -1, -0.25]),
        callerAllocated: {
            full: { number: callerAllocatedFull.number, ratio: callerAllocatedFull.ratio },
            none: { number: callerAllocatedNone.number, ratio: callerAllocatedNone.ratio },
        },
        emptyOpaque: api.createEmptyOpaqueContainer(),
        inlineArrays: inlinePodArrayInputs(api, [-2_147_483_648, 0, 2_147_483_647, 0]),
        lifecyclePod: lifecyclePodValue(api, [-2_147_483_648, -1.5]),
        nullRecords: { full: api.getNullFullPod(), opaque: api.getNullOpaque() },
        pod: { number: pod.number, ratio: pod.ratio },
        snapshot: { number: snapshot.number, ratio: snapshot.ratio },
        sum: api.scalarAdd(2_147_483_647, 0),
        textSnapshot: { number: textSnapshot.number, text: textSnapshot.text },
        unionSnapshot: { number: unionSnapshot.number },
        validated: api.requireNonnegative(0),
    };
}

function gerror(api) {
    return api.requireNonnegative(-1);
}

function fullPodContainer(api) {
    if (typeof api.createFullPods !== "function") {
        return false;
    }

    return api.createFullPods();
}

function happy(api) {
    const pod = new api.Pod({ number: 40, ratio: 0.5 });
    const callerAllocatedNone = api.fillPodNone(13, 0.75);
    const callerAllocatedFull = api.fillPodFull(17, 1.25);
    pod.number += 2;
    pod.ratio *= 4;
    api.setStaticPod(7, 0.25);
    const snapshot = api.getStaticPod();
    api.setStaticPod(99, 8);
    api.setStaticTextPod(0, 17);
    const textSnapshot = api.getStaticTextPod();
    api.setStaticTextPod(1, 99);
    api.setStaticNumberUnion(73);
    const unionSnapshot = api.getStaticNumberUnion();
    api.setStaticNumberUnion(99);

    return {
        arrays: containerSnapshots(api, [3, 0.125, 5, 0.25], [30, 1.25, 50, 2.5]),
        callerAllocated: {
            full: { number: callerAllocatedFull.number, ratio: callerAllocatedFull.ratio },
            none: { number: callerAllocatedNone.number, ratio: callerAllocatedNone.ratio },
        },
        checksum: api.checksumPod(pod),
        emptyOpaque: api.createEmptyOpaqueContainer(),
        inlineArrays: inlinePodArrayInputs(api, [10, 0.25, 20, 0.5]),
        lifecyclePod: lifecyclePodValue(api, [23, 1.25]),
        nullRecords: { full: api.getNullFullPod(), opaque: api.getNullOpaque() },
        pod: { number: pod.number, ratio: pod.ratio },
        snapshot: { number: snapshot.number, ratio: snapshot.ratio },
        sum: api.scalarAdd(19, 23),
        textSnapshot: { number: textSnapshot.number, text: textSnapshot.text },
        unionSnapshot: { number: unionSnapshot.number },
        validated: api.requireNonnegative(6),
    };
}

function invalidInlinePodArray(api) {
    if (typeof api.sumPodArrayNone !== "function") {
        return false;
    }

    return api.sumPodArrayNone([new api.Pod({ number: 1, ratio: 1 }), 1]);
}

function lifecycleTransferFull(api) {
    if (typeof api.consumeLifecyclePod !== "function" || typeof api.LifecyclePod !== "function") {
        return false;
    }

    const pod = new api.LifecyclePod({ number: 1, ratio: 1 });

    if (pod.number !== 1 || pod.ratio !== 1 || pod.text !== null) {
        return false;
    }

    return api.consumeLifecyclePod(pod);
}

function opaqueContainer(api) {
    if (typeof api.createOpaqueContainer !== "function") {
        return false;
    }

    return api.createOpaqueContainer();
}

function outputCleanup(api) {
    let didReject = false;

    try {
        api.createRejectedThenOwned();
    } catch {
        didReject = true;
    }

    if (!didReject) {
        return false;
    }

    let cleanupCount;

    try {
        cleanupCount = api.getOutputCleanupCount();
    } catch {
        return false;
    }

    if (cleanupCount !== 1) {
        return false;
    }

    throw new Error("The rejected output released later owned values");
}

function runScenario(api, name) {
    const scenario = scenarios[name];

    if (scenario === undefined) {
        throw new Error(`Unknown conformance scenario: ${name}`);
    }

    return scenario(api);
}

function transferFull(api) {
    if (typeof api.consumePod !== "function") {
        return false;
    }

    return api.consumePod(new api.Pod({ number: 1, ratio: 1 }));
}

function transferFullReturn(api) {
    if (typeof api.createFullPod !== "function") {
        return false;
    }

    return api.createFullPod();
}

export { runScenario };
