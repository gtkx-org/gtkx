fn main() {
    napi_build::setup();
    println!("cargo::rustc-link-arg=-Wl,--export-dynamic");
}
