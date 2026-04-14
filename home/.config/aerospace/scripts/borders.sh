#!/usr/bin/env bash
set -euo pipefail

# Border colors per layout (Catppuccin Mocha palette)
COLOR_TILES="0xffa6e3a1"     # Green — tiling layout
COLOR_ACCORDION="0xff89b4fa" # Blue — accordion/monocle layout
COLOR_FLOATING="0xffcba6f7"  # Mauve — floating layout
COLOR_INACTIVE="0x00313244"  # Surface0 — inactive windows

BORDER_WIDTH=6.0
BORDER_STYLE="round"

LAST_COMMAND_FILE="/tmp/borders_last_command"
DEBOUNCE_FILE="/tmp/borders_debounce"
DEBOUNCE_S=0.025

send_borders() {
  python3 -c "
import ctypes, ctypes.util

lib = ctypes.CDLL(ctypes.util.find_library('System'))

# Mach message structs
class mach_msg_header_t(ctypes.Structure):
    _fields_ = [
        ('msgh_bits', ctypes.c_uint32),
        ('msgh_size', ctypes.c_uint32),
        ('msgh_remote_port', ctypes.c_uint32),
        ('msgh_local_port', ctypes.c_uint32),
        ('msgh_voucher_port', ctypes.c_uint32),
        ('msgh_id', ctypes.c_int32),
    ]

class mach_msg_ool_descriptor_t(ctypes.Structure):
    _fields_ = [
        ('address', ctypes.c_void_p),
        ('deallocate', ctypes.c_uint8),
        ('copy', ctypes.c_uint8),
        ('pad1', ctypes.c_uint8),
        ('type', ctypes.c_uint8),
        ('size', ctypes.c_uint32),
    ]

class mach_message(ctypes.Structure):
    _fields_ = [
        ('header', mach_msg_header_t),
        ('msgh_descriptor_count', ctypes.c_uint32),
        ('descriptor', mach_msg_ool_descriptor_t),
    ]

MACH_MSG_TYPE_COPY_SEND = 19
MACH_MSGH_BITS_COMPLEX = 0x80000000
MACH_MSG_VIRTUAL_COPY = 1
MACH_MSG_OOL_DESCRIPTOR = 1
MACH_SEND_MSG = 1
MACH_PORT_NULL = 0

port = ctypes.c_uint32(0)
kr = lib.bootstrap_look_up(lib.bootstrap_port, b'git.felix.borders', ctypes.byref(port))
if kr != 0:
    exit(1)

command = b'$1'
buf = ctypes.create_string_buffer(command)

msg = mach_message()
msg.header.msgh_bits = (MACH_MSG_TYPE_COPY_SEND) | MACH_MSGH_BITS_COMPLEX
msg.header.msgh_size = ctypes.sizeof(mach_message)
msg.header.msgh_remote_port = port.value
msg.header.msgh_local_port = MACH_PORT_NULL
msg.header.msgh_voucher_port = MACH_PORT_NULL
msg.header.msgh_id = 0
msg.msgh_descriptor_count = 1
msg.descriptor.address = ctypes.cast(buf, ctypes.c_void_p).value
msg.descriptor.size = len(command)
msg.descriptor.deallocate = 0
msg.descriptor.copy = MACH_MSG_VIRTUAL_COPY
msg.descriptor.type = MACH_MSG_OOL_DESCRIPTOR

lib.mach_msg(ctypes.byref(msg.header), MACH_SEND_MSG, ctypes.sizeof(mach_message), 0, MACH_PORT_NULL, 0, MACH_PORT_NULL)
" 2>/dev/null || borders "$1"
}

get_layout() {
  aerospace list-workspaces --focused --format '%{workspace-root-container-layout}' 2>/dev/null
}

get_active_color() {
  local window_layout
  window_layout=$(aerospace list-windows --focused --format '%{window-layout}' 2>/dev/null)

  if [[ "$window_layout" == "floating" ]]; then
    echo "$COLOR_FLOATING"
    return
  fi

  local layout
  layout=$(get_layout)

  case "$layout" in
  *accordion*) echo "$COLOR_ACCORDION" ;;
  *) echo "$COLOR_TILES" ;;
  esac
}

update_borders() {
  local active_color
  active_color=$(get_active_color)

  local command="active_color=$active_color inactive_color=$COLOR_INACTIVE style=$BORDER_STYLE width=$BORDER_WIDTH hidpi=on order=a"
  local last_command=""

  # Deduplicate — skip if identical to last command
  if [ -f "$LAST_COMMAND_FILE" ]; then
    IFS= read -r last_command <"$LAST_COMMAND_FILE" || true
  fi
  if [ "$last_command" = "$command" ]; then
    return
  fi

  printf '%s\n' "$command" >"$LAST_COMMAND_FILE"

  send_borders "$command"
}

debounce() {
  local token
  token="$$.$RANDOM"
  printf '%s\n' "$token" >"$DEBOUNCE_FILE"

  sleep "$DEBOUNCE_S"

  local debounce_token=""
  IFS= read -r debounce_token <"$DEBOUNCE_FILE" 2>/dev/null || true
  if [ "$debounce_token" = "$token" ]; then
    update_borders
  fi
}

debounce
