

#[macro_use]
mod macros;
mod arg;
mod boxed;
mod callback;
mod gvariant;
mod cif;
mod gtk_dispatch;
mod js_dispatch;
mod module;
mod object;
mod queue;
mod state;
mod types;
mod value;

#[cfg(test)]
mod test_utils;

use neon::prelude::*;

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("start", module::start)?;
    cx.export_function("stop", module::stop)?;
    cx.export_function("call", module::call)?;
    cx.export_function("batchCall", module::batch_call)?;
    cx.export_function("read", module::read)?;
    cx.export_function("write", module::write)?;
    cx.export_function("alloc", module::alloc)?;
    cx.export_function("getObjectId", module::get_object_id)?;
    cx.export_function("poll", module::poll)?;
    Ok(())
}
