use std::cell::Cell;
use std::ffi::c_void;

use libffi::middle as libffi;

use super::storage::FfiStorage;
use crate::trampoline::TrampolineState;

#[derive(Debug)]
#[non_exhaustive]
pub enum FfiValue {
    U8(u8),
    I8(i8),
    U16(u16),
    I16(i16),
    U32(u32),
    I32(i32),
    U64(u64),
    I64(i64),
    F32(f32),
    F64(f64),
    Ptr(*mut c_void),
    Storage(FfiStorage),
    Trampoline(TrampolineValue),
    Void,
}

pub struct TrampolineValue {
    fn_ptr: *mut c_void,
    state_ptr: *mut c_void,
    destroy_ptr: Option<*mut c_void>,
    _owned_state: Option<Box<TrampolineState>>,
    armed_state: Cell<Option<Box<TrampolineState>>>,
}

impl TrampolineValue {
    #[must_use]
    pub fn new(
        fn_ptr: *mut c_void,
        state_ptr: *mut c_void,
        destroy_ptr: Option<*mut c_void>,
        owned_state: Option<Box<TrampolineState>>,
    ) -> Self {
        Self {
            fn_ptr,
            state_ptr,
            destroy_ptr,
            _owned_state: owned_state,
            armed_state: Cell::new(None),
        }
    }

    /// Builds a trampoline value whose state's ownership is pending transfer
    /// to the native callee.
    ///
    /// The state stays armed and drops with the value — freeing the libffi
    /// closure, the captured data, and its JS reference — unless the native
    /// call actually happens and [`Self::disarm_pending_transfer`] hands the
    /// state over to the callee's lifetime protocol (a destroy notify, the
    /// one-shot self-free, or process lifetime).
    #[must_use]
    pub fn new_armed(
        fn_ptr: *mut c_void,
        destroy_ptr: Option<*mut c_void>,
        state: Box<TrampolineState>,
    ) -> Self {
        let state_ptr = std::ptr::from_ref::<TrampolineState>(&state) as *mut c_void;
        Self {
            fn_ptr,
            state_ptr,
            destroy_ptr,
            _owned_state: None,
            armed_state: Cell::new(Some(state)),
        }
    }

    /// Hands the armed state to the native callee once the call has actually
    /// happened. From here the callee's lifetime protocol owns the state.
    pub fn disarm_pending_transfer(&self) {
        if let Some(state) = self.armed_state.take() {
            let _ = Box::into_raw(state);
        }
    }

    #[must_use]
    pub fn fn_ptr(&self) -> *mut c_void {
        self.fn_ptr
    }

    #[must_use]
    pub fn state_ptr(&self) -> *mut c_void {
        self.state_ptr
    }

    #[must_use]
    pub fn destroy_ptr(&self) -> Option<*mut c_void> {
        self.destroy_ptr
    }
}

impl std::fmt::Debug for TrampolineValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TrampolineValue")
            .field("fn_ptr", &self.fn_ptr)
            .field("state_ptr", &self.state_ptr)
            .field("destroy_ptr", &self.destroy_ptr)
            .finish_non_exhaustive()
    }
}

macro_rules! ffi_numeric_with {
    ($($rest:pat_param)|*) => {
        Self::U8(_)
            | Self::I8(_)
            | Self::U16(_)
            | Self::I16(_)
            | Self::U32(_)
            | Self::I32(_)
            | Self::U64(_)
            | Self::I64(_)
            | Self::F32(_)
            | Self::F64(_)
            $(| $rest)*
    };
}

impl FfiValue {
    /// Hands any armed transfer-full ownership to the callee once the native
    /// call has actually happened. See
    /// [`FfiStorage::disarm_pending_transfer`] and
    /// [`TrampolineValue::disarm_pending_transfer`].
    pub fn disarm_pending_transfer(&self) {
        match self {
            Self::Storage(storage) => storage.disarm_pending_transfer(),
            Self::Trampoline(trampoline) => trampoline.disarm_pending_transfer(),
            _ => {}
        }
    }

    /// Writes the scalar payload of an inline numeric variant into the
    /// out-parameter slot at `slot`, the seed value a `Ref` scalar
    /// out-parameter carries into a native call.
    ///
    /// Pointer-, storage-, trampoline-, and void-shaped values have no scalar
    /// payload and are rejected with an error.
    ///
    /// # Safety
    ///
    /// `slot` must be valid for writes of at least the payload's size. No
    /// alignment is required; the write is unaligned.
    pub unsafe fn write_scalar_to(&self, slot: *mut c_void) -> anyhow::Result<()> {
        // SAFETY: The caller guarantees `slot` is writable at the payload's
        // size; every write below is unaligned-tolerant. The arms differ
        // only in payload width.
        match self {
            // SAFETY: See the match-level comment.
            Self::U8(value) => unsafe { slot.cast::<u8>().write_unaligned(*value) },
            // SAFETY: See the match-level comment.
            Self::I8(value) => unsafe { slot.cast::<i8>().write_unaligned(*value) },
            // SAFETY: See the match-level comment.
            Self::U16(value) => unsafe { slot.cast::<u16>().write_unaligned(*value) },
            // SAFETY: See the match-level comment.
            Self::I16(value) => unsafe { slot.cast::<i16>().write_unaligned(*value) },
            // SAFETY: See the match-level comment.
            Self::U32(value) => unsafe { slot.cast::<u32>().write_unaligned(*value) },
            // SAFETY: See the match-level comment.
            Self::I32(value) => unsafe { slot.cast::<i32>().write_unaligned(*value) },
            // SAFETY: See the match-level comment.
            Self::U64(value) => unsafe { slot.cast::<u64>().write_unaligned(*value) },
            // SAFETY: See the match-level comment.
            Self::I64(value) => unsafe { slot.cast::<i64>().write_unaligned(*value) },
            // SAFETY: See the match-level comment.
            Self::F32(value) => unsafe { slot.cast::<f32>().write_unaligned(*value) },
            // SAFETY: See the match-level comment.
            Self::F64(value) => unsafe { slot.cast::<f64>().write_unaligned(*value) },
            Self::Ptr(_) | Self::Storage(_) | Self::Trampoline(_) | Self::Void => {
                anyhow::bail!("{self:?} has no scalar payload for an out-parameter slot")
            }
        }
        Ok(())
    }

    pub fn as_ptr(&self, type_name: &str) -> anyhow::Result<*mut c_void> {
        match self {
            Self::Ptr(ptr) => Ok(*ptr),
            Self::Storage(storage) => Ok(storage.ptr()),
            ffi_numeric_with!(Self::Trampoline(_) | Self::Void) => {
                anyhow::bail!("Expected a pointer FfiValue for {type_name}, got {self:?}")
            }
        }
    }

    pub fn as_non_null_ptr(&self, type_name: &str) -> anyhow::Result<Option<*mut c_void>> {
        let ptr = self.as_ptr(type_name)?;
        Ok(if ptr.is_null() { None } else { Some(ptr) })
    }

    pub fn to_number(&self) -> anyhow::Result<f64> {
        match self {
            Self::I8(v) => Ok(*v as f64),
            Self::U8(v) => Ok(*v as f64),
            Self::I16(v) => Ok(*v as f64),
            Self::U16(v) => Ok(*v as f64),
            Self::I32(v) => Ok(*v as f64),
            Self::U32(v) => Ok(*v as f64),
            Self::I64(v) => Ok(*v as f64),
            Self::U64(v) => Ok(*v as f64),
            Self::F32(v) => Ok(*v as f64),
            Self::F64(v) => Ok(*v),
            Self::Ptr(_) | Self::Storage(_) | Self::Trampoline(_) | Self::Void => {
                anyhow::bail!("Expected a numeric FfiValue, got {self:?}")
            }
        }
    }

    pub fn append_libffi_args<'a>(&'a self, args: &mut Vec<libffi::Arg<'a>>) {
        match self {
            Self::Trampoline(tv) => {
                args.push(libffi::arg(&tv.fn_ptr));
                args.push(libffi::arg(&tv.state_ptr));
                if let Some(destroy_ptr) = &tv.destroy_ptr {
                    args.push(libffi::arg(destroy_ptr));
                }
            }
            ffi_numeric_with!(Self::Ptr(_) | Self::Storage(_) | Self::Void) => {
                args.push(self.into());
            }
        }
    }
}

impl<'a> From<&'a FfiValue> for libffi::Arg<'a> {
    fn from(arg: &'a FfiValue) -> Self {
        match arg {
            FfiValue::U8(value) => libffi::arg(value),
            FfiValue::I8(value) => libffi::arg(value),
            FfiValue::U16(value) => libffi::arg(value),
            FfiValue::I16(value) => libffi::arg(value),
            FfiValue::U32(value) => libffi::arg(value),
            FfiValue::I32(value) => libffi::arg(value),
            FfiValue::U64(value) => libffi::arg(value),
            FfiValue::I64(value) => libffi::arg(value),
            FfiValue::F32(value) => libffi::arg(value),
            FfiValue::F64(value) => libffi::arg(value),
            FfiValue::Ptr(ptr) => libffi::arg(ptr),
            FfiValue::Storage(storage) => libffi::arg(storage.ptr_ref()),
            FfiValue::Trampoline(_) => {
                unreachable!("Trampoline requires append_libffi_args for multiple arguments")
            }
            FfiValue::Void => libffi::arg(&()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disarm_pending_transfer_covers_every_variant_shape() {
        let trampoline =
            TrampolineValue::new(std::ptr::null_mut(), std::ptr::null_mut(), None, None);
        FfiValue::Trampoline(trampoline).disarm_pending_transfer();
        FfiValue::I32(1).disarm_pending_transfer();
        FfiValue::Storage(FfiStorage::unit(std::ptr::null_mut())).disarm_pending_transfer();
    }
}
