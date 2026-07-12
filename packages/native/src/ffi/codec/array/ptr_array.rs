use super::super::prelude::*;
use super::ArrayCodec;
use super::container::ArrayContainer;

#[derive(Debug, Clone)]
pub(crate) struct GPtrArrayCodec;

impl ArrayContainer for GPtrArrayCodec {
    fn decode<'e>(
        &self,
        codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
    ) -> anyhow::Result<Unknown<'e>> {
        let Some(ptr) = stash.as_non_null_ptr("GPtrArray")? else {
            return super::build_js_array(env, Vec::new());
        };

        let ptr_array = ptr as *mut glib::ffi::GPtrArray;
        let len = unsafe { (*ptr_array).len as usize };
        let pdata = unsafe { (*ptr_array).pdata };
        let items = (0..len).map(move |i| unsafe { *pdata.add(i) });

        let is_full = codec.ownership.is_full();
        codec.decode_ptr_iter(env, items, move || {
            if is_full {
                unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
            }
        })
    }

    fn name(&self) -> &'static str {
        "GPtrArray"
    }
}
