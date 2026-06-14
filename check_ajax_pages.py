import requests
from bs4 import BeautifulSoup

session = requests.Session()
login_url = "https://daotao.utt.edu.vn/congthongtin/login.aspx"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": login_url
}

print("=== Logging in ===")
r_get = session.get(login_url, headers=headers)
soup = BeautifulSoup(r_get.text, 'html.parser')

payload = {
    "__VIEWSTATE": soup.find('input', {'name': '__VIEWSTATE'}).get('value'),
    "__VIEWSTATEGENERATOR": soup.find('input', {'name': '__VIEWSTATEGENERATOR'}).get('value'),
    "__EVENTVALIDATION": soup.find('input', {'name': '__EVENTVALIDATION'}).get('value'),
    "username": "76DCTD26342",
    "password": "29/05/2007",
    "cms_authenticate_do_login": "Đăng nhập"
}

r_post = session.post(login_url, data=payload, headers=headers, allow_redirects=True)

if "/Index.aspx" in r_post.url:
    print("Login successful.")
    
    # Try fetching with AJAX headers
    ajax_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://daotao.utt.edu.vn/congthongtin/Index.aspx",
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "text/html, */*; q=0.01",
        "Accept-Language": "vi,en-US;q=0.9,en;q=0.8"
    }
    
    test_paths = [
        "/congthongtin/SV/modules/thoikhoabieu/html/lichthi.html",
        "/congthongtin/modules/thoikhoabieu/html/lichthi.html",
        "/SV/modules/thoikhoabieu/html/lichthi.html",
        "/modules/thoikhoabieu/html/lichthi.html"
    ]
    
    for p in test_paths:
        url = f"https://daotao.utt.edu.vn{p}"
        r_mod = session.get(url, headers=ajax_headers)
        print(f"AJAX Path: {p} -> Status: {r_mod.status_code}, Length: {len(r_mod.text)}")
        if r_mod.status_code == 200 and len(r_mod.text) > 100:
            print("  AJAX SUCCESS!")
            print("  Preview:", r_mod.text[:300])
else:
    print("Login failed.")
