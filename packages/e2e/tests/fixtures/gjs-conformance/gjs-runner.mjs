import GtkxConformance from "gi://GtkxConformance?version=1.0";
import { runScenario } from "./scenario-suite.mjs";

const [scenario] = ARGV;

const api = {
    LifecyclePod: GtkxConformance.LifecyclePod,
    Pod: GtkxConformance.Pod,
    checksumPod: GtkxConformance.checksum_pod,
    consumeLifecyclePod: GtkxConformance.consume_lifecycle_pod,
    createEmptyOpaqueFlat: GtkxConformance.create_empty_opaque_flat,
    createContainerPods: GtkxConformance.create_container_pods,
    createEmptyOpaqueContainer: GtkxConformance.create_empty_opaque_container,
    consumePod: GtkxConformance.consume_pod,
    createContainerFlatPods: GtkxConformance.create_container_flat_pods,
    createRejectedThenOwned: GtkxConformance.create_rejected_then_owned,
    createFullFlatPods: GtkxConformance.create_full_flat_pods,
    createFullPod: GtkxConformance.create_full_pod,
    createFullPods: GtkxConformance.create_full_pods,
    createOpaqueContainer: GtkxConformance.create_opaque_container,
    fillPodFull: GtkxConformance.fill_pod_full,
    fillPodNone: GtkxConformance.fill_pod_none,
    fillOpaque: GtkxConformance.fill_opaque,
    getBorrowedFlatPods: GtkxConformance.get_borrowed_flat_pods,
    getBorrowedPods: GtkxConformance.get_borrowed_pods,
    getCallerAllocatedOpaqueCount: GtkxConformance.get_caller_allocated_opaque_count,
    getFullInoutCount: GtkxConformance.get_full_inout_count,
    getNullFullPod: GtkxConformance.get_null_full_pod,
    getNullOpaque: GtkxConformance.get_null_opaque,
    getOutputCleanupCount: GtkxConformance.get_output_cleanup_count,
    getStaticNumberUnion: GtkxConformance.get_static_number_union,
    getStaticPod: GtkxConformance.get_static_pod,
    getStaticTextPod: GtkxConformance.get_static_text_pod,
    requireNonnegative: GtkxConformance.require_nonnegative,
    replacePod: GtkxConformance.replace_pod,
    replacePodFull: GtkxConformance.replace_pod_full,
    scalarAdd: GtkxConformance.scalar_add,
    setArrayPods: GtkxConformance.set_array_pods,
    setReplacementPod: GtkxConformance.set_replacement_pod,
    setStaticNumberUnion: GtkxConformance.set_static_number_union,
    setStaticPod: GtkxConformance.set_static_pod,
    setStaticTextPod: GtkxConformance.set_static_text_pod,
    sumPodArrayContainer: GtkxConformance.sum_pod_array_container,
    sumPodArrayFull: GtkxConformance.sum_pod_array_full,
    sumPodArrayNone: GtkxConformance.sum_pod_array_none,
    sumPodGarrayContainer: GtkxConformance.sum_pod_garray_container,
    sumPodGarrayFull: GtkxConformance.sum_pod_garray_full,
    sumPodGarrayNone: GtkxConformance.sum_pod_garray_none,
};

const result = runScenario(api, scenario);

console.log(`GTKX_CONFORMANCE_RESULT:${JSON.stringify(result)}`);
