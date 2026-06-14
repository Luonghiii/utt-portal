import base64
import json
import re
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="UTT Student Portal Proxy API")

# Enable CORS for convenience
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class LoginRequest(BaseModel):
    username: str
    password: str

class DateRangeRequest(BaseModel):
    tokenJWT: str
    userId: str
    startDate: str  # dd/MM/yyyy
    endDate: str    # dd/MM/yyyy

class TokenUserRequest(BaseModel):
    tokenJWT: str
    userId: str

# Helper Crypto Functions (Python equivalents of AD and AE in UTT JS)
def decrypt_ad(ciphertext_b64: str, key: str) -> str:
    try:
        decoded = base64.b64decode(ciphertext_b64)
        r_str = decoded.decode('utf-8')
        decrypted_chars = []
        for n in range(len(r_str)):
            char_code = ord(r_str[n]) ^ ord(key[n % len(key)])
            decrypted_chars.append(chr(char_code))
        return "".join(decrypted_chars)
    except Exception as e:
        print(f"Decryption error: {e}")
        return ""

def encrypt_ae(payload_dict: dict, key: str) -> str:
    try:
        payload_str = json.dumps(payload_dict, separators=(',', ':'))
        xor_chars = []
        for n in range(len(payload_str)):
            xor_char = ord(payload_str[n]) ^ ord(key[n % len(key)])
            xor_chars.append(chr(xor_char))
        xor_str = "".join(xor_chars)
        return base64.b64encode(xor_str.encode('utf-8')).decode('utf-8')
    except Exception as e:
        print(f"Encryption error: {e}")
        return ""

# Common API caller
def call_utt_api(action: str, payload: dict, token_jwt: str) -> dict:
    base_api_url = "https://daotao.utt.edu.vn"
    prefix = action.split("_")[0].lower()  # SV_ -> sv, TC_ -> tc
    
    # Resolve correct API subpath based on prefix
    if prefix == "sv":
        url_prefix = f"{base_api_url}/sinhvienapi/api"
    elif prefix == "tc":
        url_prefix = f"{base_api_url}/taichinhapi/api"
    else:
        url_prefix = f"{base_api_url}/cmsapi/api"
        
    url = f"{url_prefix}/{action}"
    
    # Extract encryption key from action (part after slash)
    if "/" in action:
        key = action[action.index("/") + 1:]
    else:
        key = action
        
    encrypted_payload = encrypt_ae(payload, key)
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token_jwt}",
        "Referer": "https://daotao.utt.edu.vn/congthongtin/Index.aspx"
    }
    
    try:
        r = requests.post(url, json={"A": encrypted_payload}, headers=headers)
        if r.status_code != 200:
            print(f"API Error {action} - Status {r.status_code}: {r.text}")
            return {"success": False, "message": f"Server school error ({r.status_code})"}
            
        res_json = r.json()
        if res_json.get("Success") and res_json.get("Data") and res_json["Data"].get("B"):
            # Decrypt response data using iM key ("1")
            decrypted_str = decrypt_ad(res_json["Data"]["B"], "1")
            return {"success": True, "data": json.loads(decrypted_str)}
        else:
            return {"success": False, "message": res_json.get("Message", "Unknown API error")}
    except Exception as e:
        print(f"Connection error: {e}")
        return {"success": False, "message": f"Connection error: {str(e)}"}

@app.post("/api/login")
def login(req: LoginRequest):
    login_url = "https://daotao.utt.edu.vn/congthongtin/login.aspx"
    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        # 1. GET tokens
        r_get = session.get(login_url, headers=headers, timeout=10)
        if r_get.status_code != 200:
            raise HTTPException(status_code=500, detail="Cannot connect to UTT portal")
            
        soup = BeautifulSoup(r_get.text, 'html.parser')
        viewstate = soup.find('input', {'name': '__VIEWSTATE'}).get('value')
        viewstategen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'}).get('value')
        eventval = soup.find('input', {'name': '__EVENTVALIDATION'}).get('value')
        
        # 2. POST credentials
        post_data = {
            "__VIEWSTATE": viewstate,
            "__VIEWSTATEGENERATOR": viewstategen,
            "__EVENTVALIDATION": eventval,
            "username": req.username,
            "password": req.password,
            "cms_authenticate_do_login": "Đăng nhập"
        }
        
        headers["Referer"] = login_url
        r_post = session.post(login_url, data=post_data, headers=headers, allow_redirects=True, timeout=15)
        
        # 3. Check login success
        if "/Index.aspx" not in r_post.url:
            soup_error = BeautifulSoup(r_post.text, 'html.parser')
            # Look for error labels (usually containing text like "không đúng")
            error_tags = soup_error.find_all(text=lambda text: text and "không đúng" in text.lower())
            msg = error_tags[0].strip() if error_tags else "Sai tài khoản hoặc mật khẩu"
            return {"success": False, "message": msg}
            
        # 4. Extract token JWT from Index page script
        soup_idx = BeautifulSoup(r_post.text, 'html.parser')
        script_text = ""
        for s in soup_idx.find_all('script'):
            if s.string and "AXYZCLRVN" in s.string:
                script_text = s.string
                break
                
        match = re.search(r'AXYZCLRVN\s*=\s*\(\)\s*=>\s*["\'](.*?)["\']', script_text)
        if not match:
            return {"success": False, "message": "Logged in but failed to parse auth token"}
            
        axyz_b64 = match.group(1)
        config_str = decrypt_ad(axyz_b64, "AzzS")
        config = json.loads(config_str)
        
        return {
            "success": True,
            "userId": config.get("userId"),
            "tokenJWT": config.get("tokenJWT"),
            "profile": {
                "username": req.username
            }
        }
    except requests.RequestException as e:
        raise HTTPException(status_code=504, detail=f"UTT server timeout or unreachable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/api/schedule")
def get_schedule(req: DateRangeRequest):
    payload = {
        "func": "pkg_congthongtin_hssv_thongtin.LayDSLichCaNhan",
        "iM": "1",
        "strQLSV_NguoiHoc_Id": req.userId,
        "strNgayBatDau": req.startDate,
        "strNgayKetThuc": req.endDate,
        "strChucNang_Id": "B46109CD333D4E3DAC50D43E8607ED46",
        "strNguoiThucHien_Id": req.userId
    }
    
    res = call_utt_api("SV_ThongTin_MH/DSA4BRINKCIpAiAPKSAv", payload, req.tokenJWT)
    return res

@app.post("/api/exams")
def get_exams(req: TokenUserRequest):
    today = datetime.now()
    # Broad range to cover past and future exams in the semester
    start_date = (today - timedelta(days=90)).strftime("%d/%m/%Y")
    end_date = (today + timedelta(days=120)).strftime("%d/%m/%Y")
    
    payload = {
        "func": "pkg_congthongtin_hssv_thongtin.LayDSLichCaNhan",
        "iM": "1",
        "strQLSV_NguoiHoc_Id": req.userId,
        "strNgayBatDau": start_date,
        "strNgayKetThuc": end_date,
        "strChucNang_Id": "AF6FFE7566A84F058C31083395D4ED4B", # Lịch thi chức năng
        "strNguoiThucHien_Id": req.userId
    }
    
    res = call_utt_api("SV_ThongTin_MH/DSA4BRINKCIpAiAPKSAv", payload, req.tokenJWT)
    return res

@app.post("/api/grades")
def get_grades(req: TokenUserRequest):
    # 1. Fetch curriculum list to get the program ID
    curr_payload = {
        "func": "pkg_congthongtin_hssv_thongtin.LayThongTinChuongTrinhHoc",
        "iM": "1",
        "strQLSV_NguoiHoc_Id": req.userId,
        "strChucNang_Id": "458922CCB7064213A3D94F7511852261",
        "strNguoiThucHien_Id": req.userId
    }
    
    curr_res = call_utt_api("SV_ThongTin_MH/DSA4FSkuLyYVKC8CKTQuLyYVMygvKQkuIgPP", curr_payload, req.tokenJWT)
    program_id = ""
    if curr_res.get("success") and isinstance(curr_res.get("data"), list) and len(curr_res["data"]) > 0:
        program_id = curr_res["data"][0].get("DAOTAO_TOCHUCCHUONGTRINH_ID", "")
        
    # 2. Call grades using the program_id
    grades_payload = {
        "func": "pkg_congthongtin_hssv_thongtin.KetQuaHocTapCaNhan",
        "iM": "1",
        "strQLSV_NguoiHoc_Id": req.userId,
        "strDaoTao_ChuongTrinh_Id": program_id,
        "strChucNang_Id": "458922CCB7064213A3D94F7511852261",
        "strNguoiThucHien_Id": req.userId
    }
    
    res = call_utt_api("SV_ThongTin_MH/CiQ1EDQgCS4iFSAxAiAPKSAv", grades_payload, req.tokenJWT)
    return res

@app.post("/api/tuition")
def get_tuition(req: TokenUserRequest):
    # 1. Fetch summary status
    summary_payload = {
        "func": "pkg_taichinh_thongtin.LayDSTinhTrangTaiChinh",
        "iM": "1",
        "strNguoiDung_Id": req.userId,
        "strChucNang_Id": "7A425B5F926A4EFCAB2ACC5D0A9B8F36",
        "strNguoiThucHien_Id": req.userId
    }
    summary_res = call_utt_api("TC_ThongTin_MH/DSA4BRIVKC8pFTMgLyYVICgCKSgvKQPP", summary_payload, req.tokenJWT)
    
    # 2. Fetch amounts payable list
    payable_payload = {
        "func": "pkg_taichinh_thongtin.LayDSKhoanPhaiNop",
        "iM": "1",
        "strQLSV_NguoiHoc_Id": req.userId,
        "strChucNang_Id": "7A425B5F926A4EFCAB2ACC5D0A9B8F36",
        "strNguoiThucHien_Id": req.userId
    }
    payable_res = call_utt_api("TC_ThongTin_MH/DSA4BRIKKS4gLxEpICgPLjEP", payable_payload, req.tokenJWT)
    
    # 3. Fetch amounts paid list
    paid_payload = {
        "func": "pkg_taichinh_thongtin.LayDSKhoanDaNop",
        "iM": "1",
        "strQLSV_NguoiHoc_Id": req.userId,
        "strChucNang_Id": "7A425B5F926A4EFCAB2ACC5D0A9B8F36",
        "strNguoiThucHien_Id": req.userId
    }
    paid_res = call_utt_api("TC_ThongTin_MH/DSA4BRIKKS4gLwUgDy4x", paid_payload, req.tokenJWT)
    
    return {
        "success": True,
        "summary": summary_res.get("data") if summary_res.get("success") else None,
        "payable": payable_res.get("data") if payable_res.get("success") else [],
        "paid": paid_res.get("data") if paid_res.get("success") else []
    }

# Mount static folder
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
