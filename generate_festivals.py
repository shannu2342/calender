import json
from pathlib import Path
from datetime import datetime

BASE = Path("panchang-calendar/public/data")
FEST_DIR = BASE / "festivals"
FEST_DIR.mkdir(exist_ok=True)




LUNAR_FESTIVALS = [
    # 🌸 New Year & Major
    ("Ugadi", "Chaitra", "Shukla", "Padyami"),
    ("Gudi Padwa", "Chaitra", "Shukla", "Padyami"),

    # 🔱 Vaishnava / Shaiva
    ("Rama Navami", "Chaitra", "Shukla", "Navami"),
    ("Hanuman Jayanti", "Chaitra", None, "Purnima"),
    ("Maha Shivaratri", "Magha", "Krishna", "Chaturdashi"),

    # 🌕 Full / New Moon festivals
    ("Holi", "Phalguna", None, "Purnima"),
    ("Diwali", "Kartika", None, "Amavasya"),
    ("Lakshmi Puja", "Kartika", None, "Amavasya"),

    # 🐘 Ganapati
    ("Ganesh Chaturthi", "Bhadrapada", "Shukla", "Chaturthi"),

    # 🪔 Krishna
    ("Krishna Janmashtami", "Shravana", "Krishna", "Ashtami"),

    # 🌼 Shakti
    ("Vasant Panchami", "Magha", "Shukla", "Panchami"),
    ("Akshaya Tritiya", "Vaishakha", "Shukla", "Tritiya"),
    ("Navratri Begins", "Ashwin", "Shukla", "Padyami"),
    ("Dussehra", "Ashwin", "Shukla", "Dashami"),

    # 📿 Vishnu
    ("Devshayani Ekadashi", "Ashadha", "Shukla", "Ekadashi"),
    ("Devutthana Ekadashi", "Kartika", "Shukla", "Ekadashi"),

    # 🔥 Others
    ("Gita Jayanti", "Margashirsha", "Shukla", "Ekadashi"),
    ("Buddha Purnima", "Vaishakha", None, "Purnima"),
]


def iso(date_str):
    return datetime.strptime(date_str, "%d/%m/%Y").strftime("%Y-%m-%d")

def extract_tithi_name(tithi_str):
    # "Saptami upto 11:20 PM" -> "Saptami"
    return tithi_str.split(" upto ")[0].strip()

def extract_paksha(paksha_str):
    # "Krishna Paksha" -> "Krishna"
    # "Shukla Paksha"  -> "Shukla"
    return paksha_str.replace(" Paksha", "").strip()

def pradosh_prefix(weekday):
    return {
        "Monday": "Soma",
        "Tuesday": "Bhauma",
        "Wednesday": "Budha",
        "Thursday": "Guru",
        "Friday": "Shukra",
        "Saturday": "Shani",
        "Sunday": "Ravi"
    }.get(weekday, "")

def generate_year(year):
    with open(BASE / f"{year}.json", "r", encoding="utf-8") as f:
        days = json.load(f)

    festivals = {}

    for d in days:
        date_iso = iso(d["date"])
        month = d.get("Lunar Month", "")
        tithi = extract_tithi_name(d.get("Tithi", ""))
        paksha = extract_paksha(d.get("Paksha", ""))
        weekday = d.get("Weekday", "")

        for fest, f_month, f_paksha, f_tithi in LUNAR_FESTIVALS:
            if month != f_month:
                continue
            if f_paksha and paksha != f_paksha:
                continue
            if tithi == f_tithi:
                fests.append(fest)


        day_fests = []

        # EKADASHI
        if tithi == "Ekadashi":
            day_fests.append("Ekadashi")

        # PRADOSH VRAT (Trayodashi)
        if tithi == "Trayodashi":
            pref = pradosh_prefix(weekday)
            name = f"{pref} Pradosh Vrat" if pref else "Pradosh Vrat"
            day_fests.append(name)

        # SANKASHTI CHATURTHI (Krishna Paksha Chaturthi)
        if tithi == "Chaturthi" and paksha == "Krishna":
            day_fests.append("Sankashti Chaturthi")

        # PURNIMA
        if tithi == "Purnima":
            day_fests.append("Purnima")

        # AMAVASYA
        if tithi == "Amavasya":
            day_fests.append("Amavasya")

        # CHANDRA DARSHANA (Shukla Paksha Padyami/Pratipada)
        if tithi in ("Padyami", "Pratipada") and paksha == "Shukla":
            day_fests.append("Chandra Darshana")

        if day_fests:
            festivals[date_iso] = day_fests

    with open(FEST_DIR / f"{year}.json", "w", encoding="utf-8") as f:
        json.dump(festivals, f, indent=2)

    print(f"✅ Tithi-based festivals generated for {year}")

if __name__ == "__main__":
    generate_year(2026)
