mod arg;
mod async_callback;
mod boxed;
mod cif;
mod module;
mod object;
mod state;
mod types;
mod value;

use module::{alloc, call, read, start, stop, write};
use neon::prelude::*;

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("start", start)?;
    cx.export_function("stop", stop)?;
    cx.export_function("call", call)?;
    cx.export_function("read", read)?;
    cx.export_function("write", write)?;
    cx.export_function("alloc", alloc)?;
    Ok(())
}
