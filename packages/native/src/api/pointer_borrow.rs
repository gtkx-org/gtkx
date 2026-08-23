use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::handle_memory_ptr;
use crate::handle::Handle;

/// Clones a raw pointer borrow into a distinct JavaScript external that shares its invalidation
/// state, rejecting handles with any other ownership or lifetime.
#[napi(catch_unwind)]
pub fn clone_pointer_borrow(handle: &External<Handle>) -> Result<External<Handle>> {
    let Some(cloned) = handle.clone_pointer_borrow() else {
        return Err(Error::new(
            Status::InvalidArg,
            "Only a borrowed pointer handle can be cloned as a borrow",
        ));
    };

    Ok(External::new_with_size_hint(cloned, 0))
}

/// Ends a raw pointer borrow without freeing the memory behind it, invalidating every clone of
/// the handle. Repeating the operation on the same borrow has no further effect.
#[napi(catch_unwind)]
pub fn end_pointer_borrow(handle: &External<Handle>) -> Result<()> {
    if handle.end_pointer_borrow() {
        return Ok(());
    }

    Err(Error::new(
        Status::InvalidArg,
        "Only a borrowed pointer handle can end its borrow",
    ))
}

/// Returns whether two valid handles point to the same native memory.
#[napi(catch_unwind)]
pub fn handles_point_to_same_memory(
    first: &External<Handle>,
    second: &External<Handle>,
) -> Result<bool> {
    let first_ptr = handle_memory_ptr(first, "handles_point_to_same_memory: first")?;
    let second_ptr = handle_memory_ptr(second, "handles_point_to_same_memory: second")?;

    Ok(first_ptr == second_ptr)
}
