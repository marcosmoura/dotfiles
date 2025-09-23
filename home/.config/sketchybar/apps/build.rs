fn main() {
    // Link the Carbon framework (for old Carbon types) and SkyLight private framework.
    println!("cargo:rustc-link-lib=framework=Carbon");
    // SkyLight is a private framework; link path is typically /System/Library/PrivateFrameworks
    // Use framework search mode so the linker can resolve the framework
    println!("cargo:rustc-link-search=framework=/System/Library/PrivateFrameworks");
    println!("cargo:rustc-link-lib=framework=SkyLight");
}
