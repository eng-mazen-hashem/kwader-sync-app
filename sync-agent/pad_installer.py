import os, glob

installers = glob.glob(r"d:\Zk att project\sync-agent\installer\KWADER_Sync_Setup_v*.exe")
if installers:
    installer_path = max(installers, key=os.path.getmtime)
    target_size = 51 * 1024 * 1024  # 51 MB
    current_size = os.path.getsize(installer_path)
    if current_size < target_size:
        print(f"Padding {installer_path} from {current_size} to {target_size} bytes...")
        with open(installer_path, "ab") as f:
            f.write(b'\0' * (target_size - current_size))
        print("Padding complete.")
    else:
        print(f"{installer_path} already large enough ({current_size} bytes).")
else:
    print("No installer found to pad.")
