import requests

session = requests.Session()
login_url = "https://daotao.utt.edu.vn/congthongtin/login.aspx"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": login_url
}

print("=== Downloading Core files ===")
for path in ["Core/systemroot.js", "Core/systemextend.js", "Core/util.js"]:
    url = f"https://daotao.utt.edu.vn/congthongtin/{path}"
    r = session.get(url, headers=headers)
    filename = path.split('/')[-1]
    with open(filename, "w", encoding="utf-8") as f:
        f.write(r.text)
    print(f"Downloaded {path} to {filename}")
