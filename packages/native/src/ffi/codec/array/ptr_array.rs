use super::super::prelude::*;
use super::ArrayCodec;
use super::container::ArrayContainer;

#[derive(Debug, Clone)]
pub(crate) struct GPtrArrayCodec;

impl ArrayContainer for GPtrArrayCodec {
    fn decode(&self, codec: &ArrayCodec, stash: &ffi::Stash) -> anyhow::Result<value::Value> {
        let Some(ptr) = stash.as_non_null_ptr("GPtrArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let ptr_array = ptr as *mut glib::ffi::GPtrArray;
        let len = unsafe { (*ptr_array).len as usize };
        let pdata = unsafe { (*ptr_array).pdata };
        let items = (0..len).map(move |i| unsafe { *pdata.add(i) });

        let is_full = codec.ownership.is_full();
        codec.decode_ptr_iter(items, move || {
            if is_full {
                unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
            }
        })
    }

    fn name(&self) -> &'static str {
        "GPtrArray"
    }
}
