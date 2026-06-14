import json

with open("grades_dump.json", "r", encoding="utf-8") as f:
    data = json.load(f)

profile = data.get("rsThongTinNguoiHoc", [])
with open("all_profile_keys.txt", "w", encoding="utf-8") as f_out:
    if profile:
        f_out.write("ALL keys in rsThongTinNguoiHoc:\n")
        item = profile[0]
        keys = list(item.keys())
        keys.sort()
        for k in keys:
            f_out.write(f"  {k}: {item[k]}\n")
    else:
        f_out.write("No rsThongTinNguoiHoc found.\n")

print("Saved to all_profile_keys.txt")
