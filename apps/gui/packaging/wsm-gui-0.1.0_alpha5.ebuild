# Copyright 2026 Gentoo Authors
# Distributed under the terms of the GNU General Public License v2
EAPI=8
RUST_MIN_VER="1.91"
inherit cargo desktop
MY_P="wsm-gui-0.1.0-alpha.5"
DESCRIPTION="WhackSmacker experimental Tauri graphical proof"
HOMEPAGE="https://github.com/SleepyMario/WhackSmacker"
SRC_URI="https://github.com/SleepyMario/WhackSmacker/releases/download/v0.1.0-alpha.5/${MY_P}-source.tar.xz"
S="${WORKDIR}/${MY_P}"
LICENSE="GPL-3+ Apache-2.0 MIT BSD-3"
SLOT="0"
KEYWORDS="~amd64"
BDEPEND=">=dev-lang/rust-1.91 virtual/pkgconfig"
DEPEND="net-libs/webkit-gtk:4.1 x11-libs/gtk+:3 net-libs/libsoup:3 dev-libs/openssl"
RDEPEND="${DEPEND}"
ECARGO_VENDOR="${S}/vendor"
QA_FLAGS_IGNORED="usr/libexec/wsm-gui"
src_configure() {
 cd src-tauri || die
 cargo_src_configure
}
src_compile() {
 cd src-tauri || die
 cargo_src_compile
}
src_install() {
 exeinto /usr/libexec
 newexe "src-tauri/$(cargo_target_dir)/wsm-gui-proof" wsm-gui
 newicon -s 128 src-tauri/icons/icon.png wsm-gui.png
 make_desktop_entry /usr/libexec/wsm-gui "WSM GUI Proof" wsm-gui Education
 dodoc README.md COPYING
}
