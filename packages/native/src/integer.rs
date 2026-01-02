use crate::cif;
use crate::types::{IntegerSign, IntegerSize, IntegerType};

pub fn read(int_type: &IntegerType, ptr: *const u8) -> f64 {
    match (int_type.size, int_type.sign) {
        (IntegerSize::_8, IntegerSign::Unsigned) => unsafe { ptr.cast::<u8>().read_unaligned() as f64 },
        (IntegerSize::_8, IntegerSign::Signed) => unsafe { ptr.cast::<i8>().read_unaligned() as f64 },
        (IntegerSize::_16, IntegerSign::Unsigned) => unsafe { ptr.cast::<u16>().read_unaligned() as f64 },
        (IntegerSize::_16, IntegerSign::Signed) => unsafe { ptr.cast::<i16>().read_unaligned() as f64 },
        (IntegerSize::_32, IntegerSign::Unsigned) => unsafe { ptr.cast::<u32>().read_unaligned() as f64 },
        (IntegerSize::_32, IntegerSign::Signed) => unsafe { ptr.cast::<i32>().read_unaligned() as f64 },
        (IntegerSize::_64, IntegerSign::Unsigned) => unsafe { ptr.cast::<u64>().read_unaligned() as f64 },
        (IntegerSize::_64, IntegerSign::Signed) => unsafe { ptr.cast::<i64>().read_unaligned() as f64 },
    }
}

pub fn write(int_type: &IntegerType, ptr: *mut u8, value: f64) {
    match (int_type.size, int_type.sign) {
        (IntegerSize::_8, IntegerSign::Unsigned) => unsafe {
            ptr.cast::<u8>().write_unaligned(value as u8)
        },
        (IntegerSize::_8, IntegerSign::Signed) => unsafe {
            ptr.cast::<i8>().write_unaligned(value as i8)
        },
        (IntegerSize::_16, IntegerSign::Unsigned) => unsafe {
            ptr.cast::<u16>().write_unaligned(value as u16)
        },
        (IntegerSize::_16, IntegerSign::Signed) => unsafe {
            ptr.cast::<i16>().write_unaligned(value as i16)
        },
        (IntegerSize::_32, IntegerSign::Unsigned) => unsafe {
            ptr.cast::<u32>().write_unaligned(value as u32)
        },
        (IntegerSize::_32, IntegerSign::Signed) => unsafe {
            ptr.cast::<i32>().write_unaligned(value as i32)
        },
        (IntegerSize::_64, IntegerSign::Unsigned) => unsafe {
            ptr.cast::<u64>().write_unaligned(value as u64)
        },
        (IntegerSize::_64, IntegerSign::Signed) => unsafe {
            ptr.cast::<i64>().write_unaligned(value as i64)
        },
    }
}

pub fn to_cif(int_type: &IntegerType, value: f64) -> cif::Value {
    match (int_type.size, int_type.sign) {
        (IntegerSize::_8, IntegerSign::Unsigned) => cif::Value::U8(value as u8),
        (IntegerSize::_8, IntegerSign::Signed) => cif::Value::I8(value as i8),
        (IntegerSize::_16, IntegerSign::Unsigned) => cif::Value::U16(value as u16),
        (IntegerSize::_16, IntegerSign::Signed) => cif::Value::I16(value as i16),
        (IntegerSize::_32, IntegerSign::Unsigned) => cif::Value::U32(value as u32),
        (IntegerSize::_32, IntegerSign::Signed) => cif::Value::I32(value as i32),
        (IntegerSize::_64, IntegerSign::Unsigned) => cif::Value::U64(value as u64),
        (IntegerSize::_64, IntegerSign::Signed) => cif::Value::I64(value as i64),
    }
}

pub fn vec_to_f64(int_type: &IntegerType, owned_ptr: &cif::OwnedPtr) -> anyhow::Result<Vec<f64>> {
    macro_rules! downcast_and_convert {
        ($type:ty) => {{
            let vec = owned_ptr
                .value
                .downcast_ref::<Vec<$type>>()
                .ok_or_else(|| {
                    anyhow::anyhow!(
                        "Failed to downcast array items to Vec<{}>",
                        stringify!($type)
                    )
                })?;
            Ok(vec.iter().map(|v| *v as f64).collect())
        }};
    }

    match (int_type.size, int_type.sign) {
        (IntegerSize::_8, IntegerSign::Unsigned) => downcast_and_convert!(u8),
        (IntegerSize::_8, IntegerSign::Signed) => downcast_and_convert!(i8),
        (IntegerSize::_16, IntegerSign::Unsigned) => downcast_and_convert!(u16),
        (IntegerSize::_16, IntegerSign::Signed) => downcast_and_convert!(i16),
        (IntegerSize::_32, IntegerSign::Unsigned) => downcast_and_convert!(u32),
        (IntegerSize::_32, IntegerSign::Signed) => downcast_and_convert!(i32),
        (IntegerSize::_64, IntegerSign::Unsigned) => downcast_and_convert!(u64),
        (IntegerSize::_64, IntegerSign::Signed) => downcast_and_convert!(i64),
    }
}

pub fn f64_to_vec(int_type: &IntegerType, values: &[f64]) -> cif::OwnedPtr {
    match (int_type.size, int_type.sign) {
        (IntegerSize::_8, IntegerSign::Unsigned) => {
            let values: Vec<u8> = values.iter().map(|&v| v as u8).collect();
            cif::OwnedPtr::from_vec(values)
        }
        (IntegerSize::_8, IntegerSign::Signed) => {
            let values: Vec<i8> = values.iter().map(|&v| v as i8).collect();
            cif::OwnedPtr::from_vec(values)
        }
        (IntegerSize::_16, IntegerSign::Unsigned) => {
            let values: Vec<u16> = values.iter().map(|&v| v as u16).collect();
            cif::OwnedPtr::from_vec(values)
        }
        (IntegerSize::_16, IntegerSign::Signed) => {
            let values: Vec<i16> = values.iter().map(|&v| v as i16).collect();
            cif::OwnedPtr::from_vec(values)
        }
        (IntegerSize::_32, IntegerSign::Unsigned) => {
            let values: Vec<u32> = values.iter().map(|&v| v as u32).collect();
            cif::OwnedPtr::from_vec(values)
        }
        (IntegerSize::_32, IntegerSign::Signed) => {
            let values: Vec<i32> = values.iter().map(|&v| v as i32).collect();
            cif::OwnedPtr::from_vec(values)
        }
        (IntegerSize::_64, IntegerSign::Unsigned) => {
            let values: Vec<u64> = values.iter().map(|&v| v as u64).collect();
            cif::OwnedPtr::from_vec(values)
        }
        (IntegerSize::_64, IntegerSign::Signed) => {
            let values: Vec<i64> = values.iter().map(|&v| v as i64).collect();
            cif::OwnedPtr::from_vec(values)
        }
    }
}
