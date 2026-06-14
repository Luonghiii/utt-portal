import requests

session = requests.Session()
login_url = "https://daotao.utt.edu.vn/congthongtin/login.aspx"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": login_url
}

print("=== Logging in ===")
import bs4
r_get = session.get(login_url, headers=headers)
soup = bs4.BeautifulSoup(r_get.text, 'html.parser')

payload = {
    "__VIEWSTATE": soup.find('input', {'name': '__VIEWSTATE'}).get('value'),
    "__VIEWSTATEGENERATOR": soup.find('input', {'name': '__VIEWSTATEGENERATOR'}).get('value'),
    "__EVENTVALIDATION": soup.find('input', {'name': '__EVENTVALIDATION'}).get('value'),
    "username": "76DCTD26342",
    "password": "29/05/2007",
    "cms_authenticate_do_login": "Đăng nhập"
}

r_post = session.post(login_url, data=payload, headers=headers, allow_redirects=True)

paths = {
    "lichthi.html": "/SV/modules/thoikhoabieu/html/lichthi.html",
    "diemhoc.html": "/SV/modules/hoctap/html/diemhoc.html",
    "tracuu.html": "/SV/modules/dangkyhoc/html/tracuu.html"
}

print("\n=== Fetching Module HTML Files ===")
for name, p in paths.items():
    url = f"https://daotao.utt.edu.vn{p}"
    r = session.get(url, headers=headers)
    if r.status_code == 200:
        print(f"FOUND: {p} (length: {len(r.text)})")
        with open(f"module_{name}", "w", encoding="utf-8") as f:
            f.write(r.text)
    else:
        print(f"FAILED: {p} (status: {r.status_code})")
        # Try alternate without /SV
        url_alt = f"https://daotao.utt.edu.vn/congthongtin{p.replace('/SV', '')}"
        r_alt = session.get(url_alt, headers=headers)
        if r_alt.status_code == 200:
            print(f"FOUND (alt): {url_alt} (length: {len(r_alt.text)})")
            with open(f"module_alt_{name}", "w", encoding="utf-8") as f:
                f.write(r_alt.text)

print("Done.")
