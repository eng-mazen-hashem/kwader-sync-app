import struct
import os
import sys
from pathlib import Path

def patch_pe_subsystem(file_path):
    path = Path(file_path)
    if not path.exists():
        print(f"[!] File not found: {path}")
        return False

    try:
        with open(path, 'r+b') as f:
            f.seek(0x3c)
            pe_off = struct.unpack('<I', f.read(4))[0]
            f.seek(pe_off)
            sig = f.read(4)
            if sig != b'PE\x00\x00':
                print(f"[!] Invalid PE signature in {path}: {sig}")
                return False
            
            sub_off = pe_off + 0x5c
            f.seek(sub_off)
            current_sub = struct.unpack('<H', f.read(2))[0]
            print(f"[*] {path.name} current subsystem: {current_sub}")
            
            if current_sub != 2:
                f.seek(sub_off)
                f.write(struct.pack('<H', 2))
                print(f"[+] Successfully patched {path.name} subsystem to 2 (GUI application - no console).")
            else:
                print(f"[=] {path.name} is already set to GUI subsystem.")
            return True
    except Exception as e:
        print(f"[!] Error patching {path}: {e}")
        return False

if __name__ == '__main__':
    targets = [
        Path(r'd:\Zk att project\sync-agent\bin\whatsapp-node.exe'),
        Path(os.path.expanduser('~')) / r'AppData\Roaming\sync-agent\bin\whatsapp-node.exe'
    ]
    for target in targets:
        patch_pe_subsystem(target)
