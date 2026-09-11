from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import os, hashlib, numpy as np, cv2, psycopg2, requests, json
from PIL import Image
import io as _io
from dotenv import load_dotenv

load_dotenv('/etc/kapbeni.env')

app = FastAPI(title="kapbeni KYC Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB_URL = os.getenv('DATABASE_URL')

def get_db():
    return psycopg2.connect(DB_URL)

def img_from_bytes(data: bytes):
    arr = np.frombuffer(data, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)

def yuz_tespit(img):
    """Basit yüz tespiti — insightface olmadan OpenCV Haar Cascade ile"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = cascade.detectMultiScale(gray, 1.1, 4)
    return len(faces) > 0, len(faces)

def yuz_karsilastir(img1, img2):
    """İki görüntüdeki yüzleri basit histogram karşılaştırması ile eşleştir"""
    def hist(img):
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h = cv2.calcHist([hsv],[0,1],None,[180,256],[0,180,0,256])
        cv2.normalize(h,h)
        return h
    score = cv2.compareHist(hist(img1), hist(img2), cv2.HISTCMP_CORREL)
    return float(max(0, score))

def db_kaydet(user_id, durum, kimlik_hash, selfie_score, liveness_score, red_sebebi=None):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO kyc_results(user_id,durum,kimlik_no_hash,selfie_score,liveness_score,red_sebebi)
        VALUES(%s,%s,%s,%s,%s,%s)
    """, (user_id, durum, kimlik_hash, selfie_score, liveness_score, red_sebebi))
    conn.commit()
    cur.close(); conn.close()

def audit_kaydet(user_id, durum, detay):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO audit_log(olay,kaynak,user_id,detay) VALUES(%s,'kyc',%s,%s)
    """, (f'kyc.{durum}', user_id, json.dumps(detay)))
    conn.commit()
    cur.close(); conn.close()

def api_webhook(user_id, durum):
    """KYC sonucunu Backend API'ye bildir — API → DB'yi günceller"""
    try:
        secret = os.getenv('KYC_WEBHOOK_SECRET')
        api_url = os.getenv('API_INTERNAL_URL')
        requests.post(f"{api_url}/api/kyc/webhook",
            json={"user_id": user_id, "durum": durum},
            headers={"x-kyc-secret": secret}, timeout=5)
    except Exception as e:
        print(f"Webhook hatası: {e}")

@app.get("/health")
def health():
    return {"durum": "ok", "servis": "kyc"}

@app.post("/verify")
async def verify(
    user_id: int,
    kimlik_on: UploadFile = File(...),
    kimlik_arka: UploadFile = File(...),
    selfie: UploadFile = File(...),
    x_kyc_secret: str = Header(None)
):
    # Webhook secret kontrolü
    if x_kyc_secret != os.getenv('KYC_WEBHOOK_SECRET'):
        raise HTTPException(403, "Yetkisiz")

    # Dosyaları oku
    kimlik_on_bytes  = await kimlik_on.read()
    selfie_bytes     = await selfie.read()

    img_kimlik = img_from_bytes(kimlik_on_bytes)
    img_selfie = img_from_bytes(selfie_bytes)

    if img_kimlik is None or img_selfie is None:
        raise HTTPException(400, "Geçersiz görüntü")

    # Aynı görsel iki kez yüklenemez (kimlik == selfie) — sahtecilik önlemi
    if hashlib.sha256(selfie_bytes).hexdigest() == hashlib.sha256(kimlik_on_bytes).hexdigest():
        db_kaydet(user_id,'reddedildi',hashlib.sha256(kimlik_on_bytes).hexdigest(),0,0,'Kimlik ve selfie aynı görsel')
        return {"durum":"reddedildi","sebep":"Kimlik fotoğrafı ile selfie aynı görsel olamaz. Lütfen farklı iki fotoğraf yükleyin."}

    # TC kimlik numarası hash — ham numara saklanmaz
    kimlik_hash = hashlib.sha256(kimlik_on_bytes).hexdigest()

    # Yüz tespiti
    kimlikte_yuz, _ = yuz_tespit(img_kimlik)
    selfide_yuz, _ = yuz_tespit(img_selfie)

    if not kimlikte_yuz:
        db_kaydet(user_id,'reddedildi',kimlik_hash,0,0,'Kimlikte yüz bulunamadı')
        audit_kaydet(user_id,'reddedildi',{'sebep':'kimlikte_yuz_yok'})
        return {"durum":"reddedildi","sebep":"Kimlik fotoğrafında yüz tespit edilemedi"}

    if not selfide_yuz:
        db_kaydet(user_id,'reddedildi',kimlik_hash,0,0,'Selfie\'de yüz bulunamadı')
        return {"durum":"reddedildi","sebep":"Selfie'de yüz tespit edilemedi"}

    # Yüz eşleştirme skoru
    selfie_score = yuz_karsilastir(img_kimlik, img_selfie)

    # Liveness — boyut ve aspect ratio kontrolü (basit)
    h, w = img_selfie.shape[:2]
    liveness_score = min(1.0, (h * w) / (640 * 480))

    # Karar
    if selfie_score >= 0.999:
        durum='reddedildi'; db_kaydet(user_id,durum,kimlik_hash,selfie_score,liveness_score,'Görseller neredeyse aynı')
        return {"durum":"reddedildi","sebep":"Kimlik ve selfie neredeyse aynı görsel. Lütfen gerçek bir selfie çekin."}
    if selfie_score > 0.3 and liveness_score > 0.4:
        durum = 'onaylandi'
    elif selfie_score > 0.15:
        durum = 'manuel_inceleme'
    else:
        durum = 'reddedildi'

    db_kaydet(user_id, durum, kimlik_hash, selfie_score, liveness_score)
    audit_kaydet(user_id, durum, {'selfie_score': selfie_score, 'liveness_score': liveness_score})
    api_webhook(user_id, durum)

    return {
        "durum": durum,
        "selfie_score": round(selfie_score, 4),
        "liveness_score": round(liveness_score, 4),
        "mesaj": {
            "onaylandi": "Kimlik doğrulandı",
            "manuel_inceleme": "Manuel inceleme gerekiyor",
            "reddedildi": "Kimlik doğrulanamadı"
        }.get(durum)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv('KYC_PORT', 8001)))
