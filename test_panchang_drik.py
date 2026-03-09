# panchang_complete_festivals.py
# 🔥 COMPLETE HINDU FESTIVAL ENGINE - DRIKPANCHANG ACCURATE

import swisseph as swe
from datetime import datetime, timedelta
import pytz
import json

IST = pytz.timezone("Asia/Kolkata")
LAT = 17.3850
LON = 78.4867
ALT = 0
swe.set_sid_mode(swe.SIDM_LAHIRI)
swe.set_topo(LON, LAT, ALT)
swe.set_ephe_path(".")

TITHI_NAMES = [
    "Pratipada", "Dvitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
    "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
    "Trayodashi", "Chaturdashi", "Purnima",
    "Pratipada", "Dvitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
    "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
    "Trayodashi", "Chaturdashi", "Amavasya"
]

NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
]

YOGA_NAMES = [
    "Vishkumbha", "Priti", "Ayushman", "Saubhagya", "Shobhana",
    "Atiganda", "Sukarma", "Dhriti", "Shoola", "Ganda",
    "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
    "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva",
    "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma",
    "Indra", "Vaidhriti"
]

LUNAR_MONTH_NAMES_AMANTA = [
    "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha",
    "Shravana", "Bhadrapada", "Ashwin", "Kartik",
    "Margashirsha", "Pausha", "Magha", "Phalguna"
]

RAHU_INDEX = [2, 7, 5, 6, 4, 3, 8]
YAMA_INDEX = [4, 3, 2, 1, 7, 6, 5]
GULIKAI_INDEX = [6, 5, 4, 3, 2, 1, 7]

def jd_from_utc(dt):
    return swe.julday(dt.year, dt.month, dt.day,
                      dt.hour + dt.minute/60 + dt.second/3600)

def utc_from_jd(jd):
    y, m, d, ut = swe.revjul(jd)
    h = int(ut)
    mi = int((ut-h)*60)
    s = int((((ut-h)*60)-mi)*60)
    return datetime(y, m, d, h, mi, s, tzinfo=pytz.utc)

def ist_from_jd(jd):
    return utc_from_jd(jd).astimezone(IST)

def fmt(dt):
    return dt.strftime("%I:%M %p") if dt else None

def sun_moon_lon(jd):
    sun = swe.calc_ut(jd, swe.SUN)[0][0]
    moon = swe.calc_ut(jd, swe.MOON)[0][0]
    ay = swe.get_ayanamsa_ut(jd)
    return (sun - ay) % 360, (moon - ay) % 360

def lunar_month_amanta(jd):
    """
    Amanta system: Month changes AFTER Amavasya
    
    Method:
    1. If current tithi is in Shukla Paksha (0-14): Find the LAST Amavasya
    2. If current tithi is in Krishna Paksha (15-29): Use sun's CURRENT position
       (because the Amavasya naming this month hasn't happened yet, 
        but it will happen in current sun's rashi)
    
    The month is named after the solar rashi where Amavasya occurs.
    """
    s, m = sun_moon_lon(jd)
    tithi_deg = (m - s) % 360
    tithi = int(tithi_deg // 12)
    
    if tithi < 15:  # Shukla Paksha - we're AFTER the Amavasya
        # Search backward to find when Amavasya occurred
        # Start from current JD and go back
        jd_search = jd
        
        for day in range(1, 32):  # Search back up to 31 days
            jd_search = jd - day
            s_search, m_search = sun_moon_lon(jd_search)
            tithi_search = int(((m_search - s_search) % 360) // 12)
            
            # Check if we crossed from Krishna Paksha to Shukla Paksha
            jd_next = jd_search + 0.5  # Check half day later
            s_next, m_next = sun_moon_lon(jd_next)
            tithi_next = int(((m_next - s_next) % 360) // 12)
            
            # If tithi changed from 29 (Amavasya) to 0 (Pratipada), we found it!
            if tithi_search == 29 or (tithi_search >= 28 and tithi_next < 2):
                # Return the sun's rashi at the time of that Amavasya
                return int(s_search // 30)
        
        # Fallback: use current sun position
        return int(s // 30)
    
    else:  # Krishna Paksha (tithi 15-29) - we're BEFORE the next Amavasya
        # The current month is named after where the UPCOMING Amavasya will occur
        # This is typically the current sun's rashi
        
        # But to be precise, let's look ahead to where Amavasya will be
        jd_search = jd
        
        for day in range(1, 17):  # Amavasya is within 15 days in Krishna Paksha
            jd_search = jd + day
            s_search, m_search = sun_moon_lon(jd_search)
            tithi_search = int(((m_search - s_search) % 360) // 12)
            
            if tithi_search == 29:  # Found Amavasya
                return int(s_search // 30)
        
        # Fallback
        return int(s // 30)


def tithi_index(jd):
    s, m = sun_moon_lon(jd)
    return int(((m - s) % 360) // 12)

def nakshatra_index(jd):
    _, m = sun_moon_lon(jd)
    return int(m // (360 / 27))

def yoga_index(jd):
    s, m = sun_moon_lon(jd)
    return int(((s + m) % 360) // (360 / 27))

def solve_transition(jd0, fn, idx):
    a, b = jd0, jd0 + 1
    for _ in range(50):
        mid = (a + b) / 2
        if fn(mid) == idx:
            a = mid
        else:
            b = mid
    return (a + b) / 2

def check_madhyana_vyapini(date, sr, ti_required):
    madhyana_start = datetime.combine(date, datetime.min.time()) + timedelta(hours=9)
    madhyana_end = datetime.combine(date, datetime.min.time()) + timedelta(hours=12)
    
    madhyana_start_ist = IST.localize(madhyana_start)
    madhyana_end_ist = IST.localize(madhyana_end)
    
    jd_start = jd_from_utc(madhyana_start_ist.astimezone(pytz.utc))
    jd_end = jd_from_utc(madhyana_end_ist.astimezone(pytz.utc))
    
    ti_start = tithi_index(jd_start)
    ti_end = tithi_index(jd_end)
    
    return (ti_start == ti_required or ti_end == ti_required)

def check_midnight_presence(date, ti_required):
    midnight = datetime.combine(date + timedelta(days=1), datetime.min.time())
    midnight_ist = IST.localize(midnight)
    jd_midnight = jd_from_utc(midnight_ist.astimezone(pytz.utc))
    
    ti_midnight = tithi_index(jd_midnight)
    return (ti_midnight == ti_required)

def check_tithi_at_sunrise(date, sr, ti_required):
    jd_sr = jd_from_utc(sr.astimezone(pytz.utc))
    ti_sr = tithi_index(jd_sr)
    return (ti_sr == ti_required)

def sunrise_sunset(date):
    jd = swe.julday(date.year, date.month, date.day, 0)
    sr = swe.rise_trans(jd, swe.SUN, swe.CALC_RISE | swe.BIT_DISC_CENTER, (LON, LAT, ALT))[1][0]
    ss = swe.rise_trans(jd, swe.SUN, swe.CALC_SET | swe.BIT_DISC_CENTER, (LON, LAT, ALT))[1][0]
    return ist_from_jd(sr), ist_from_jd(ss)

def moonrise_moonset(date):
    jd = swe.julday(date.year, date.month, date.day, 0)
    mr = swe.rise_trans(jd, swe.MOON, swe.CALC_RISE | swe.BIT_DISC_CENTER, (LON, LAT, ALT))[1][0]
    ms = swe.rise_trans(jd, swe.MOON, swe.CALC_SET | swe.BIT_DISC_CENTER, (LON, LAT, ALT))[1][0]
    return ist_from_jd(mr), ist_from_jd(ms)

def kaalam(sr, ss, idx):
    seg = (ss - sr) / 8
    st = sr + seg * (idx - 1)
    return fmt(st), fmt(st + seg)

def abhijit(sr, ss, wd):
    if wd == 2:
        return None
    mid = sr + (ss - sr) / 2
    return fmt(mid - timedelta(minutes=24)), fmt(mid + timedelta(minutes=24))

def dur_muhurtam(sr, ss, wd):
    seg = (ss - sr) / 8
    if wd == 2:
        mid = sr + (ss - sr) / 2
        return f"{fmt(mid - timedelta(minutes=24))} to {fmt(mid + timedelta(minutes=24))}"
    if wd == 5:
        return f"{fmt(sr)} to {fmt(sr+seg)}, {fmt(sr+seg*6)} to {fmt(sr+seg*7)}"
    DUR_INDEX = {6: 4, 0: 5, 1: 6, 3: 3, 4: 2}
    i = DUR_INDEX.get(wd)
    return f"{fmt(sr+seg*(i-1))} to {fmt(sr+seg*i)}" if i else None

def get_festivals(date, sr, ss, ti, ni, month_idx, paksha):
    festivals = []
    jd_sr = jd_from_utc(sr.astimezone(pytz.utc))
    jd_ss = jd_from_utc(ss.astimezone(pytz.utc))
    
    tithi_name = TITHI_NAMES[ti]
    nakshatra_name = NAKSHATRA_NAMES[ni]
    month_name = LUNAR_MONTH_NAMES_AMANTA[month_idx]
    
    # MONTHLY RECURRING
    if tithi_name == "Amavasya":
        festivals.append("Amavasya")
    if tithi_name == "Purnima":
        festivals.append("Purnima")
    if tithi_name == "Ekadashi":
        festivals.append("Ekadashi")
    if tithi_name == "Chaturthi" and paksha == "Krishna Paksha":
        festivals.append("Sankashti Chaturthi")
    if tithi_name == "Chaturdashi" and paksha == "Krishna Paksha":
        festivals.append("Masik Shivaratri")
    if tithi_name == "Trayodashi":
        festivals.append("Pradosh Vrat")
    
    # SOLAR FESTIVALS
    sun_lon, _ = sun_moon_lon(jd_sr)
    sun_sign = int(sun_lon // 30)
    prev_date = date - timedelta(days=1)
    try:
        jd_prev = jd_from_utc(sunrise_sunset(prev_date)[0].astimezone(pytz.utc))
        sun_lon_prev, _ = sun_moon_lon(jd_prev)
        sun_sign_prev = int(sun_lon_prev // 30)
    except:
        sun_sign_prev = sun_sign
    
    if sun_sign == 9 and sun_sign != sun_sign_prev:
        festivals.append("Makar Sankranti")
        festivals.append("Pongal")
    
    if sun_sign == 0 and sun_sign != sun_sign_prev:
        festivals.append("Baisakhi")
        festivals.append("Vaisakhi")
    
    # VASANT PANCHAMI
    if month_name == "Magha" and tithi_name == "Panchami" and paksha == "Shukla Paksha":
        festivals.append("Vasant Panchami")
        festivals.append("Saraswati Puja")
    
    # MAHA SHIVARATRI
    if month_name in ["Magha", "Phalguna"]:
        if tithi_name == "Chaturdashi" and paksha == "Krishna Paksha":
            if check_midnight_presence(date, ti):
                festivals.append("Maha Shivaratri")
    
    # HOLI
    if month_name == "Phalguna":
        if tithi_name == "Purnima":
            festivals.append("Holika Dahan")
            festivals.append("Chhoti Holi")
            festivals.append("Phalguna Purnima")
        if tithi_name == "Pratipada" and paksha == "Krishna Paksha":
            festivals.append("Holi")
            festivals.append("Dhulandi")
            festivals.append("Rangwali Holi")
    
    # UGADI
    if month_name == "Chaitra" and tithi_name == "Pratipada" and paksha == "Shukla Paksha":
        festivals.append("Ugadi")
        festivals.append("Gudi Padwa")
        festivals.append("Chaitra Navratri Begins")
    
    # RAMA NAVAMI
    if month_name == "Chaitra" and tithi_name == "Navami" and paksha == "Shukla Paksha":
        festivals.append("Rama Navami")
    
    # HANUMAN JAYANTI
    if month_name == "Chaitra" and tithi_name == "Purnima":
        festivals.append("Hanuman Jayanti")
    
    # AKSHAYA TRITIYA
    if month_name == "Vaishakha" and tithi_name == "Tritiya" and paksha == "Shukla Paksha":
        festivals.append("Akshaya Tritiya")
    
    # BUDDHA PURNIMA
    if month_name == "Vaishakha" and tithi_name == "Purnima":
        festivals.append("Buddha Purnima")
    
    # NIRJALA EKADASHI
    if month_name == "Jyeshtha" and tithi_name == "Ekadashi" and paksha == "Shukla Paksha":
        festivals.append("Nirjala Ekadashi")
    
    # RATHA YATRA
    if month_name == "Ashadha" and tithi_name == "Dvitiya" and paksha == "Shukla Paksha":
        festivals.append("Ratha Yatra")
    
    # GURU PURNIMA
    if month_name == "Ashadha" and tithi_name == "Purnima":
        festivals.append("Guru Purnima")
    
    # HARIYALI TEEJ
    if month_name == "Shravana" and tithi_name == "Tritiya" and paksha == "Shukla Paksha":
        festivals.append("Hariyali Teej")
    
    # NAG PANCHAMI
    if month_name == "Shravana" and tithi_name == "Panchami" and paksha == "Shukla Paksha":
        festivals.append("Nag Panchami")
    
    # RAKSHA BANDHAN
    if month_name == "Shravana" and tithi_name == "Purnima":
        festivals.append("Raksha Bandhan")
        festivals.append("Shravana Purnima")
    
    # JANMASHTAMI
    if month_name in ["Shravana", "Bhadrapada"]:
        if tithi_name == "Ashtami" and paksha == "Krishna Paksha":
            if nakshatra_name == "Rohini":
                festivals.append("Janmashtami")
                festivals.append("Krishna Jayanti")
    
    # GANESH CHATURTHI
    if month_name == "Bhadrapada" and tithi_name == "Chaturthi" and paksha == "Shukla Paksha":
        festivals.append("Ganesh Chaturthi")
        festivals.append("Vinayaka Chaturthi")
    
    # ANANT CHATURDASHI
    if month_name == "Bhadrapada" and tithi_name == "Chaturdashi" and paksha == "Shukla Paksha":
        festivals.append("Anant Chaturdashi")
        festivals.append("Ganesh Visarjan")
    
    # PITRU PAKSHA
    if month_name == "Bhadrapada" and tithi_name == "Pratipada" and paksha == "Krishna Paksha":
        festivals.append("Pitru Paksha Begins")
    if month_name == "Bhadrapada" and tithi_name == "Amavasya":
        festivals.append("Mahalaya Amavasya")
    
    # NAVRATRI
    if month_name == "Ashwin":
        if tithi_name == "Pratipada" and paksha == "Shukla Paksha":
            festivals.append("Sharad Navratri Begins")
        if tithi_name == "Saptami" and paksha == "Shukla Paksha":
            festivals.append("Maha Saptami")
        if tithi_name == "Ashtami" and paksha == "Shukla Paksha":
            festivals.append("Durga Ashtami")
            festivals.append("Maha Ashtami")
        if tithi_name == "Navami" and paksha == "Shukla Paksha":
            festivals.append("Maha Navami")
        if tithi_name == "Dashami" and paksha == "Shukla Paksha":
            festivals.append("Vijayadashami")
            festivals.append("Dussehra")
    
    # SHARAD PURNIMA
    if month_name == "Ashwin" and tithi_name == "Purnima":
        festivals.append("Sharad Purnima")
    
    # KARVA CHAUTH
    if month_name == "Kartik" and tithi_name == "Chaturthi" and paksha == "Krishna Paksha":
        festivals.append("Karwa Chauth")
    
    # DHANTERAS
    if month_name == "Kartik" and tithi_name == "Trayodashi" and paksha == "Krishna Paksha":
        festivals.append("Dhanteras")
    
    # NARAKA CHATURDASHI
    if month_name == "Kartik" and tithi_name == "Chaturdashi" and paksha == "Krishna Paksha":
        festivals.append("Naraka Chaturdashi")
        festivals.append("Choti Diwali")
    
    # DIWALI
    if month_name == "Kartik" and tithi_name == "Amavasya":
        festivals.append("Diwali")
        festivals.append("Lakshmi Puja")
    
    # GOVARDHAN PUJA
    if month_name == "Kartik" and tithi_name == "Pratipada" and paksha == "Shukla Paksha":
        festivals.append("Govardhan Puja")
    
    # BHAI DOOJ
    if month_name == "Kartik" and tithi_name == "Dvitiya" and paksha == "Shukla Paksha":
        festivals.append("Bhai Dooj")
        festivals.append("Yama Dwitiya")
    
    # CHHATH PUJA
    if month_name == "Kartik" and tithi_name == "Shashthi" and paksha == "Shukla Paksha":
        festivals.append("Chhath Puja")
    
    # KARTIK PURNIMA
    if month_name == "Kartik" and tithi_name == "Purnima":
        festivals.append("Kartik Purnima")
        festivals.append("Dev Deepawali")
    
    # GITA JAYANTI
    if month_name == "Margashirsha" and tithi_name == "Ekadashi" and paksha == "Shukla Paksha":
        festivals.append("Gita Jayanti")
    
    # RATHA SAPTAMI
    if month_name == "Magha" and tithi_name == "Saptami" and paksha == "Shukla Paksha":
        festivals.append("Ratha Saptami")
    
    # MAGHA PURNIMA
    if month_name == "Magha" and tithi_name == "Purnima":
        festivals.append("Magha Purnima")
    
    return festivals

def generate_day(date):
    sr, ss = sunrise_sunset(date)
    mr, ms = moonrise_moonset(date)
    jd0 = jd_from_utc(sr.astimezone(pytz.utc))
    
    ti = tithi_index(jd0)
    ni = nakshatra_index(jd0)
    yi = yoga_index(jd0)
    month_idx = lunar_month_amanta(jd0)
    paksha = "Krishna Paksha" if ti >= 15 else "Shukla Paksha"
    
    t_end = ist_from_jd(solve_transition(jd0, tithi_index, ti))
    n_end = ist_from_jd(solve_transition(jd0, nakshatra_index, ni))
    y_end = ist_from_jd(solve_transition(jd0, yoga_index, yi))
    
    festivals = get_festivals(date, sr, ss, ti, ni, month_idx, paksha)
    
    wd = date.weekday()
    
    return {
        "date": date.strftime("%d/%m/%Y"),
        "Weekday": date.strftime("%A"),
        "Sunrise": fmt(sr),
        "Sunset": fmt(ss),
        "Moonrise": fmt(mr),
        "Moonset": fmt(ms),
        "Paksha": paksha,
        "Tithi": f"{TITHI_NAMES[ti]} upto {fmt(t_end)}",
        "Nakshatra": f"{NAKSHATRA_NAMES[ni]} upto {fmt(n_end)}",
        "Yoga": f"{YOGA_NAMES[yi]} upto {fmt(y_end)}",
        "Lunar Month": LUNAR_MONTH_NAMES_AMANTA[month_idx],
        "Rahu Kalam": " to ".join(kaalam(sr, ss, RAHU_INDEX[wd])),
        "Gulikai Kalam": " to ".join(kaalam(sr, ss, GULIKAI_INDEX[wd])),
        "Yamaganda": " to ".join(kaalam(sr, ss, YAMA_INDEX[wd])),
        "Abhijit": None if abhijit(sr, ss, wd) is None else " to ".join(abhijit(sr, ss, wd)),
        "Dur Muhurtam": dur_muhurtam(sr, ss, wd),
        "Festivals": festivals
    }

def generate_years(start_year=1940, end_year=2126):
    total_years = end_year - start_year
    print(f"🚀 Starting Panchang Generation: {start_year} to {end_year-1}")
    print(f"📊 Total Years: {total_years}")
    print("="*60)
    
    for year in range(start_year, end_year):
        year_data = []
        start_date = datetime(year, 1, 1)
        end_date = datetime(year + 1, 1, 1)
        current_date = start_date
        
        print(f"📁 Processing: {year}.json", end=" ")
        
        while current_date < end_date:
            year_data.append(generate_day(current_date))
            current_date += timedelta(days=1)
        
        with open(f"{year}.json", "w", encoding="utf-8") as f:
            json.dump(year_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ ({len(year_data)} days)")
    
    print("="*60)
    print(f"🎉 COMPLETE! Generated {total_years} years of Panchang data")

if __name__ == "__main__":
    test_dates = [
        ("15/02/2026", "Maha Shivaratri"),
        ("03/03/2026", "Holika Dahan"),
        ("04/03/2026", "Holi"),
        ("19/03/2026", "Ugadi"),
        ("26/03/2026", "Ashtami"),
        ("27/03/2026", "Rama Navami"),
        ("20/08/2026", "Janmashtami"),
        ("17/09/2026", "Ganesh Chaturthi"),
        ("25/09/2026", "Dussehra"),
        ("19/10/2026", "Karwa Chauth"),
        ("11/11/2026", "Diwali"),
        ("13/11/2026", "Bhai Dooj"),
    ]
    
    print("\n🎉 TESTING 2026 MAJOR FESTIVALS:\n")
    for date_str, expected in test_dates:
        d = datetime.strptime(date_str, "%d/%m/%Y")
        result = generate_day(d)
        print(f"📅 {result['date']} - {expected}")
        print(f"   Month: {result['Lunar Month']}, Tithi: {result['Tithi']}")
        print(f"   Festivals: {result['Festivals']}")
        print()
    
    # Uncomment to generate
    # generate_years(1940, 2126)
