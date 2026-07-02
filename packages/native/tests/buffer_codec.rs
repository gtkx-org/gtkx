use std::ffi::c_void;

use libffi::middle;
use native::ffi::Stash;
use native::ffi::codec::{BufferCodec, Decoder, Encoder as _};
use native::ffi::value::{BufferView, BufferViewKind, Value};

fn encode(value: &Value) -> anyhow::Result<Stash> {
    BufferCodec.encode(value)
}

fn encoded_address(value: &Value) -> usize {
    let encoded = encode(value).expect("buffer value should encode");
    let Stash::Ptr(ptr) = encoded else {
        panic!("expected a pointer, got {encoded:?}");
    };
    ptr as usize
}

#[test]
fn buffer_encodes_a_view_as_its_backing_pointer() {
    let mut data = vec![0u8; 8];
    let view = BufferView::new(
        data.as_mut_ptr() as *mut c_void,
        8,
        8,
        BufferViewKind::Uint8,
    );
    assert_eq!(
        encoded_address(&Value::BufferView(view)),
        data.as_mut_ptr() as usize
    );
}

#[test]
fn buffer_encodes_a_number_as_an_address() {
    assert_eq!(encoded_address(&Value::Number(4096.0)), 4096);
    assert_eq!(encoded_address(&Value::Number(0.0)), 0);
    assert_eq!(
        encoded_address(&Value::Number(9_007_199_254_740_992.0)),
        9_007_199_254_740_992
    );
}

#[test]
fn buffer_encodes_null_and_undefined_as_null() {
    assert_eq!(encoded_address(&Value::Null), 0);
    assert_eq!(encoded_address(&Value::Undefined), 0);
}

#[test]
fn buffer_cannot_be_decoded() {
    assert!(Decoder::decode(&BufferCodec, &Stash::Void).is_err());
}

extern "C" fn ret_unit() {}

#[test]
fn buffer_cannot_be_a_return_type() {
    let cif = middle::Cif::new(Vec::new(), middle::Type::void());
    let err = BufferCodec
        .call_cif(&cif, middle::CodePtr(ret_unit as *mut c_void), &[])
        .expect_err("a buffer return slot must fail");
    assert!(
        err.to_string()
            .contains("Buffer codec cannot be return codecs")
    );
}
