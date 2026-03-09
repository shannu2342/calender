// Lightweight shape defaults for chatbot data.

export const Message = {
  id: '',
  text: '',
  sender: 'user',
  timestamp: new Date(),
  language: 'en',
};

export const ChatSettings = {
  language: 'te',
  voiceSpeed: 1,
  voiceType: 'female',
  autoPlay: true,
  friendMode: true,
  city: 'Hyderabad',
};

export const PanchangData = {
  date: '',
  city: '',
  tithi: '',
  vara: '',
  nakshatra: '',
  yoga: '',
  karana: '',
  rahukalam: '',
  yamagandam: '',
  gulikaKalam: '',
  abhijitMuhurtam: '',
  sunrise: '',
  sunset: '',
};

export const TimeCheckResponse = {
  verdict: 'neutral',
  reason: '',
  alternatives: [],
};
