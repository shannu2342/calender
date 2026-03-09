import swisseph as swe
from datetime import datetime, timedelta
import pytz
import json

# ---------------- CONFIG ----------------

IST = pytz.timezone("Asia/Kolkata")

LAT = 17.3850
LON = 78.4867
ALT = 0

UGADI_CACHE = {}


swe.set_sid_mode(swe.SIDM_LAHIRI)
swe.set_topo(LON, LAT, ALT)
swe.set_ephe_path(".")

# ---------------- CONSTANTS ----------------

TITHI_NAMES = [
    "Padyami","Dvitiya","Tritiya","Chaturthi","Panchami","Shashthi",
    "Saptami","Ashtami","Navami","Dashami","Ekadashi","Dwadashi",
    "Trayodashi","Chaturdashi","Purnima",
    "Padyami","Dvitiya","Tritiya","Chaturthi","Panchami","Shashthi",
    "Saptami","Ashtami","Navami","Dashami","Ekadashi","Dwadashi",
    "Trayodashi","Chaturdashi","Amavasya"
]

NAKSHATRA_NAMES = [
    "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra",
    "Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni",
    "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
    "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta",
    "Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"
]

YOGA_NAMES = [
    "Vishkumbha","Priti","Ayushman","Saubhagya","Shobhana",
    "Atiganda","Sukarma","Dhriti","Shoola","Ganda",
    "Vriddhi","Dhruva","Vyaghata","Harshana","Vajra",
    "Siddhi","Vyatipata","Variyana","Parigha","Shiva",
    "Siddha","Sadhya","Shubha","Shukla","Brahma",
    "Indra","Vaidhriti"
]

KARANA_REPEAT = [
    "Bava", "Balava", "Kaulava", "Taitila",
    "Garaja", "Vanija", "Vishti"
]

KARANA_FIXED = ["Shakuni", "Chatushpada", "Naga", "Kimstughna"]

LUNAR_MONTHS = [
    "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha",
    "Shravana", "Bhadrapada", "Ashwin", "Kartika",
    "Margashirsha", "Pausha", "Magha", "Phalguna"
]

SAMVATSARA_NAMES = [
    "Prabhava","Vibhava","Shukla","Pramodoota","Prajothpatti",
    "Angirasa","Shrimukha","Bhava","Yuva","Dhata",
    "Ishvara","Bahudhanya","Pramathi","Vikrama","Vrisha",
    "Chitrabhanu","Svabhanu","Tarana","Parthiva","Vyaya",
    "Sarvajit","Sarvadhari","Virodhi","Vikruti","Khara",
    "Nandana","Vijaya","Jaya","Manmatha","Durmukhi",
    "Hevilambi","Vilambi","Vikari","Sharvari","Plava",
    "Shubhakruthu","Shobhana","Krodhi","Vishvavasu","Parabhava",
    "Plavanga","Keelaka","Saumya","Sadharana","Virodhikruthu",
    "Paridhavi","Pramadeecha","Ananda","Rakshasa","Nala",
    "Pingala","Kalayukti","Siddharthi","Raudra","Durmathi",
    "Dundubhi","Rudhirodgari","Raktakshi","Krodhana","Akshaya"
]



RAHU_INDEX    = [2,7,5,6,4,3,8]
YAMA_INDEX    = [4,3,2,1,7,6,5]
GULIKAI_INDEX = [6,5,4,3,2,1,7]

# ---------------- HELPERS ----------------

def jd_from_utc(dt):
    return swe.julday(dt.year, dt.month, dt.day,
                      dt.hour + dt.minute/60 + dt.second/3600)

def utc_from_jd(jd):
    y,m,d,ut = swe.revjul(jd)
    h = int(ut)
    mi = int((ut-h)*60)
    s = int((((ut-h)*60)-mi)*60)
    return datetime(y,m,d,h,mi,s,tzinfo=pytz.utc)

def ist_from_jd(jd):
    return utc_from_jd(jd).astimezone(IST)

def fmt(dt):
    return dt.strftime("%I:%M %p") if dt else None 

def add_amrit_varjyam(nak_start, nak_end):
    duration = nak_end - nak_start

    # Varjyam: ~2/3rd of Nakshatra
    varjyam_start = nak_start + duration * 0.66
    varjyam_end   = varjyam_start + timedelta(minutes=90)

    # Amrit Kalam: last 1/5th of Nakshatra
    amrit_start = nak_start + duration * 0.80
    amrit_end   = amrit_start + timedelta(minutes=90)

    return {
        "Amrit Kalam": f"{fmt(amrit_start)} to {fmt(amrit_end)}",
        "Varjyam": f"{fmt(varjyam_start)} to {fmt(varjyam_end)}"
    }

def find_amavasya_near(jd_start):
    """
    Finds nearest Amavasya (Moon-Sun conjunction)
    """
    jd = jd_start
    step = 0.1  # ~2.4 hours

    prev_diff = None

    for _ in range(500):
        sun = swe.calc_ut(jd, swe.SUN)[0][0]
        moon = swe.calc_ut(jd, swe.MOON)[0][0]
        diff = (moon - sun) % 360

        if prev_diff is not None and diff < prev_diff:
            return jd  # conjunction crossed

        prev_diff = diff
        jd += step

    return None


def get_shaka_samvatsara(date, ugadi_date):
    """
    date       : datetime.datetime
    ugadi_date : datetime.date
    """

    d = date.date()  # ✅ convert datetime → date

    if d < ugadi_date:
        shaka_year = date.year - 79
    else:
        shaka_year = date.year - 78

    # Vishvavasu anchor (Shaka 1947)
    base_shaka = 1947
    base_index = 38  # Vishvavasu

    idx = (shaka_year - base_shaka + base_index) % 60
    samvatsara = SAMVATSARA_NAMES[idx]

    return shaka_year, samvatsara




# ---------------- ASTRONOMY ----------------

def sun_moon_lon(jd):
    sun = swe.calc_ut(jd, swe.SUN)[0][0]
    moon = swe.calc_ut(jd, swe.MOON)[0][0]
    ay = swe.get_ayanamsa_ut(jd)
    return (sun - ay) % 360, (moon - ay) % 360

def lunar_month(jd):
    sun, _ = sun_moon_lon(jd)
    return int(sun // 30)

def tithi_index(jd):
    s,m = sun_moon_lon(jd)
    return int(((m - s) % 360) // 12)

def nakshatra_index(jd):
    _,m = sun_moon_lon(jd)
    return int(m // (360 / 27))

def yoga_index(jd):
    s,m = sun_moon_lon(jd)
    return int(((s + m) % 360) // (360 / 27))

def karana_index(jd):
    s,m = sun_moon_lon(jd)
    return int(((m - s) % 360) // 6)

def karana_name(index):
    if index == 0:
        return "Kimstughna"
    if index >= 57:
        return KARANA_FIXED[index - 57]
    return KARANA_REPEAT[(index - 1) % 7]

def solve_transition(jd0, fn, idx):
    a,b = jd0, jd0 + 1
    for _ in range(50):
        mid = (a + b) / 2
        if fn(mid) == idx:
            a = mid
        else:
            b = mid
    return (a + b) / 2 

def solve_previous_transition(jd0, fn, idx):
    a,b = jd0 - 1, jd0
    for _ in range(50):
        mid = (a + b) / 2
        if fn(mid) == idx:
            b = mid
        else:
            a = mid
    return (a + b) / 2

def sunrise_jd(date):
    jd = swe.julday(date.year, date.month, date.day, 0)
    sr = swe.rise_trans(
        jd, swe.SUN,
        swe.CALC_RISE | swe.BIT_DISC_CENTER,
        (LON, LAT, ALT)
    )[1][0]
    return sr

# ---------------- RISE / SET ----------------

def sunrise_sunset(date):
    jd = swe.julday(date.year, date.month, date.day, 0)
    sr = swe.rise_trans(jd, swe.SUN,
        swe.CALC_RISE | swe.BIT_DISC_CENTER,(LON,LAT,ALT))[1][0]
    ss = swe.rise_trans(jd, swe.SUN,
        swe.CALC_SET | swe.BIT_DISC_CENTER,(LON,LAT,ALT))[1][0]
    return ist_from_jd(sr), ist_from_jd(ss)

def moonrise_moonset(date):
    jd = swe.julday(date.year, date.month, date.day, 0)
    mr = swe.rise_trans(jd, swe.MOON,
        swe.CALC_RISE | swe.BIT_DISC_CENTER,(LON,LAT,ALT))[1][0]
    ms = swe.rise_trans(jd, swe.MOON,
        swe.CALC_SET | swe.BIT_DISC_CENTER,(LON,LAT,ALT))[1][0]
    return ist_from_jd(mr), ist_from_jd(ms)

# ---------------- KAALAMS ----------------

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
    DUR_INDEX = {6:4,0:5,1:6,3:3,4:2}
    i = DUR_INDEX.get(wd)
    return f"{fmt(sr+seg*(i-1))} to {fmt(sr+seg*i)}" if i else None

# ---------------- FESTIVALS ----------------
def get_lunar_month(jd):
    """
    Determine lunar month (Amanta system)
    based on Sun's zodiac at last Amavasya
    """
    # Step back until Amavasya is found
    step = 0
    while step < 35:
        sun_lon = swe.calc_ut(jd - step, swe.SUN)[0][0]
        moon_lon = swe.calc_ut(jd - step, swe.MOON)[0][0]

        diff = (moon_lon - sun_lon) % 360

        # Amavasya condition (~0 degrees)
        if diff < 6 or diff > 354:
            sun_sign = int(sun_lon // 30)
            return LUNAR_MONTHS[sun_sign]

        step += 1

    return ""


def is_diwali(sr, ss):
    jd = jd_from_utc(ss.astimezone(pytz.utc))
    return TITHI_NAMES[tithi_index(jd)] == "Amavasya" and lunar_month(jd) == 7

def is_naraka_chaturdashi(sr):
    jd = jd_from_utc(sr.astimezone(pytz.utc))
    ti = tithi_index(jd)
    return TITHI_NAMES[ti] == "Chaturdashi" and ti >= 15 and lunar_month(jd) == 7 

def calculate_ugadi(year):
    """
    Returns Ugadi date (datetime.date) for given Gregorian year
    Guaranteed not to return None
    """

    # Start search from March 18 (safer)
    jd_start = swe.julday(year, 3, 18, 0)

    amavasya_jd = find_amavasya_near(jd_start)

    # 🔥 Check next 7 sunrises (not 3)
    for i in range(1, 8):
        test_date = utc_from_jd(amavasya_jd + i).date()
        sr_jd = sunrise_jd(test_date)

        if tithi_index(sr_jd) == 0:  # Shukla Pratipada
            return ist_from_jd(sr_jd).date()

    # 🚨 HARD FALLBACK (should almost never happen)
    # Use March 22 as safe fallback (Ugadi never goes beyond this)
    return datetime(year, 3, 22).date() 

def get_ugadi_for_year(year):
    """
    Cached Ugadi lookup per Gregorian year
    Always returns a valid datetime.date
    """
    if year not in UGADI_CACHE:
        ugadi = calculate_ugadi(year)

        # Absolute safety (should almost never trigger)
        if ugadi is None:
            ugadi = datetime(year, 3, 22).date()

        UGADI_CACHE[year] = ugadi

    return UGADI_CACHE[year]



   

# ---------------- PANCHANG ----------------

def generate_day(date):
    sr, ss = sunrise_sunset(date)
    mr, ms = moonrise_moonset(date)
    jd0 = jd_from_utc(sr.astimezone(pytz.utc))

    ti = tithi_index(jd0)
    ni = nakshatra_index(jd0)
    yi = yoga_index(jd0)
    ki = karana_index(jd0)

    t_start = ist_from_jd(solve_previous_transition(jd0, tithi_index, ti))
    t_end = ist_from_jd(solve_transition(jd0, tithi_index, ti))
    n_start = ist_from_jd(solve_previous_transition(jd0, nakshatra_index, ni))
    n_end = ist_from_jd(solve_transition(jd0, nakshatra_index, ni))
    y_start = ist_from_jd(solve_previous_transition(jd0, yoga_index, yi))
    y_end = ist_from_jd(solve_transition(jd0, yoga_index, yi))
    k_start = ist_from_jd(solve_previous_transition(jd0, karana_index, ki))
    k_end = ist_from_jd(solve_transition(jd0, karana_index, ki))

    av = add_amrit_varjyam(n_start, n_end) 
    lunar_month = get_lunar_month(jd0)
    ugadi_date = get_ugadi_for_year(date.year)
    shaka_year, samvatsara = get_shaka_samvatsara(date, ugadi_date)




    festivals = []
    if is_naraka_chaturdashi(sr):
        festivals.append("Naraka Chaturdashi")
    if is_diwali(sr, ss):
        festivals.append("Diwali (Deepavali)")

    wd = date.weekday()

    return {
        "date": date.strftime("%d/%m/%Y"),
        "Weekday": date.strftime("%A"),
        "Sunrise": fmt(sr),
        "Sunset": fmt(ss),
        "Moonrise": fmt(mr),
        "Moonset": fmt(ms),
        "Paksha": "Krishna Paksha" if ti >= 15 else "Shukla Paksha",
        "Tithi": {
            "name": TITHI_NAMES[ti],
            "start": fmt(t_start),
            "end": fmt(t_end)
        },
        "Nakshatra": {
            "name": NAKSHATRA_NAMES[ni],
            "start": fmt(n_start),
            "end": fmt(n_end)
        },
        "Yoga": {
            "name": YOGA_NAMES[yi],
            "start": fmt(y_start),
            "end": fmt(y_end)
        },
        "Karana": {
            "name": karana_name(ki),
            "start": fmt(k_start),
            "end": fmt(k_end)
        },
        "Rahu Kalam": " to ".join(kaalam(sr, ss, RAHU_INDEX[wd])),
        "Gulikai Kalam": " to ".join(kaalam(sr, ss, GULIKAI_INDEX[wd])),
        "Yamaganda": " to ".join(kaalam(sr, ss, YAMA_INDEX[wd])),
        "Abhijit": None if abhijit(sr, ss, wd) is None else " to ".join(abhijit(sr, ss, wd)),
        "Dur Muhurtam": dur_muhurtam(sr, ss, wd),
        "Amrit Kalam": av["Amrit Kalam"],
        "Varjyam": av["Varjyam"],
        "Lunar Month": lunar_month,
        "Shaka Samvat": f"{shaka_year} {samvatsara}",



        "Festivals": festivals
    }

# ---------------- 100 YEAR GENERATOR ----------------

def generate_100_years(start_year=2026, years=100):
    start = datetime(start_year, 1, 1)
    end   = datetime(start_year + years, 1, 1)

    d = start
    current_year = d.year
    year_data = []

    print(f"📁 Started file: {current_year}.json")

    while d < end:
        # Year changed → write previous year
        if d.year != current_year:
            with open(f"{current_year}.json", "w", encoding="utf-8") as f:
                json.dump(year_data, f, ensure_ascii=False, indent=2)

            print(f"✅ Finished {current_year}.json ({len(year_data)} days)")

            # Reset for new year
            current_year = d.year
            year_data = []
            print(f"📁 Started file: {current_year}.json")

        year_data.append(generate_day(d))
        d += timedelta(days=1)

    # Write last year
    with open(f"{current_year}.json", "w", encoding="utf-8") as f:
        json.dump(year_data, f, ensure_ascii=False, indent=2)

    print(f"✅ Finished {current_year}.json ({len(year_data)} days)")
    print(f"🎉 Panchang generated from {start_year} to {start_year + years - 1}")



# ---------------- RUN ----------------

if __name__ == "__main__":
    generate_100_years(1940, 186)

