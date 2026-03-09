// Panchang Service - uses local calculations instead of API

// Rahukalam calculation based on weekday and sunrise
function calculateRahukalam(sunrise, weekday) {
  const sunriseHour = sunrise.getHours() + sunrise.getMinutes() / 60;
  const dayDuration = 12;
  const slotDuration = dayDuration / 8;
  
  // Rahukalam slot by weekday (0=Sunday, 6=Saturday)
  const rahuSlots = [7, 1, 6, 4, 5, 3, 2];
  const slot = rahuSlots[weekday];
  
  const startHour = sunriseHour + (slot - 1) * slotDuration;
  const endHour = startHour + slotDuration;
  
  return {
    start: formatTime(startHour),
    end: formatTime(endHour)
  };
}

function calculateYamagandam(sunrise, weekday) {
  const sunriseHour = sunrise.getHours() + sunrise.getMinutes() / 60;
  const dayDuration = 12;
  const slotDuration = dayDuration / 8;
  
  const yamaSlots = [4, 7, 2, 5, 1, 6, 3];
  const slot = yamaSlots[weekday];
  
  const startHour = sunriseHour + (slot - 1) * slotDuration;
  const endHour = startHour + slotDuration;
  
  return {
    start: formatTime(startHour),
    end: formatTime(endHour)
  };
}

function calculateGulikaKalam(sunrise, weekday) {
  const sunriseHour = sunrise.getHours() + sunrise.getMinutes() / 60;
  const dayDuration = 12;
  const slotDuration = dayDuration / 8;
  
  const gulikaSlots = [6, 4, 5, 3, 7, 2, 1];
  const slot = gulikaSlots[weekday];
  
  const startHour = sunriseHour + (slot - 1) * slotDuration;
  const endHour = startHour + slotDuration;
  
  return {
    start: formatTime(startHour),
    end: formatTime(endHour)
  };
}

function calculateAbhijitMuhurtam() {
  return '11:30 AM - 12:18 PM';
}

function formatTime(hour) {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
}

// Mock Tithi/Nakshatra data (in real app, use API)
const tithis = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
  'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima/Amavasya'
];

const nakshatras = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira',
  'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
  'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati',
  'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha',
  'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada',
  'Uttara Bhadrapada', 'Revati'
];

const yogas = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana',
  'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda',
  'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra',
  'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva',
  'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma',
  'Indra', 'Vaidhriti'
];

const karanas = [
  'Bava', 'Balava', 'Kaulava', 'Taitila', 'Garaja',
  'Vanija', 'Vishti', 'Shakuni', 'Chatushpada', 'Naga', 'Kimstughna'
];

const varas = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function getPanchangData(city, date) {
  const weekday = date.getDay();
  const sunrise = new Date(date);
  sunrise.setHours(6, 0, 0);
  
  const sunset = new Date(date);
  sunset.setHours(18, 15, 0);
  
  const rahukalam = calculateRahukalam(sunrise, weekday);
  const yamagandam = calculateYamagandam(sunrise, weekday);
  const gulikaKalam = calculateGulikaKalam(sunrise, weekday);
  
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  
  return {
    date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    city,
    tithi: tithis[dayOfYear % tithis.length],
    vara: varas[weekday],
    nakshatra: nakshatras[dayOfYear % nakshatras.length],
    yoga: yogas[dayOfYear % yogas.length],
    karana: karanas[dayOfYear % karanas.length],
    rahukalam: `${rahukalam.start} - ${rahukalam.end}`,
    yamagandam: `${yamagandam.start} - ${yamagandam.end}`,
    gulikaKalam: `${gulikaKalam.start} - ${gulikaKalam.end}`,
    abhijitMuhurtam: calculateAbhijitMuhurtam(),
    sunrise: sunrise.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    sunset: sunset.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  };
}

export async function checkTimeAuspiciousness(city, dateTime) {
  const panchang = await getPanchangData(city, dateTime);
  const timeStr = dateTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  
  const isInRahukalam = isTimeInRange(timeStr, panchang.rahukalam);
  const isInYamagandam = isTimeInRange(timeStr, panchang.yamagandam);
  const isInGulika = isTimeInRange(timeStr, panchang.gulikaKalam);
  const isInAbhijit = isTimeInRange(timeStr, panchang.abhijitMuhurtam);
  
  if (isInRahukalam) {
    return {
      verdict: 'avoid',
      reason: 'This time falls in Rahukalam (inauspicious period)',
      alternatives: [
        panchang.abhijitMuhurtam + ' (Abhijit Muhurtam)',
        'After ' + panchang.rahukalam.split(' - ')[1]
      ]
    };
  }
  
  if (isInYamagandam) {
    return {
      verdict: 'avoid',
      reason: 'This time falls in Yamagandam (inauspicious period)',
      alternatives: [
        panchang.abhijitMuhurtam + ' (Abhijit Muhurtam)',
        'After ' + panchang.yamagandam.split(' - ')[1]
      ]
    };
  }
  
  if (isInGulika) {
    return {
      verdict: 'neutral',
      reason: 'This time falls in Gulika Kalam (moderately inauspicious)',
      alternatives: [
        panchang.abhijitMuhurtam + ' (Abhijit Muhurtam)'
      ]
    };
  }
  
  if (isInAbhijit) {
    return {
      verdict: 'good',
      reason: 'Excellent! This is Abhijit Muhurtam (most auspicious time)',
      alternatives: []
    };
  }
  
  const currentHour = dateTime.getHours();
  if (currentHour >= 6 && currentHour < 18) {
    return {
      verdict: 'good',
      reason: 'This is a good time, no inauspicious periods',
      alternatives: []
    };
  }
  
  return {
    verdict: 'neutral',
    reason: 'This time is okay, but consider auspicious muhurtams for important tasks',
    alternatives: [
      panchang.abhijitMuhurtam + ' (Abhijit Muhurtam)'
    ]
  };
}

function isTimeInRange(timeStr, range) {
  try {
    const [startStr, endStr] = range.split(' - ');
    const time = parseTime(timeStr);
    const start = parseTime(startStr);
    const end = parseTime(endStr);
    
    return time >= start && time <= end;
  } catch {
    return false;
  }
}

function parseTime(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
}
