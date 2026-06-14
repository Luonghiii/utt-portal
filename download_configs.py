import requests

session = requests.Session()
login_url = "https://daotao.utt.edu.vn/congthongtin/login.aspx"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": login_url
}

print("=== Downloading files ===")
for path in ["Core/constant.js", "Config.js"]:
    url = f"https://daotao.utt.edu.vn/congthongtin/{path}"
    r = session.get(url, headers=headers)
    with open(path.split('/')[-1], "w", encoding="utf-8") as f:
        f.write(r.text)
    print(f"Downloaded {path} to {path.split('/')[-1]}")
