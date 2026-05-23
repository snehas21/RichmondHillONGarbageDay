const Alexa = require('ask-sdk-core');

// ── STREET DATA ───────────────────────────────────────────────────────────────
// Add more streets here as needed. Source: Richmond Hill eServices lookup tool.
// day: JS weekday (0=Sun … 4=Thu … 6=Sat)
// zone: 'blue' or 'yellow' (bi-weekly garbage week)
const STREETS = {
  'winisk st':     { day: 4, zone: 'yellow', label: 'Winisk Street' },
  'winisk street': { day: 4, zone: 'yellow', label: 'Winisk Street' },
};

const DEFAULT_STREET = 'winisk st';

// ── ZONE-WEEK CALCULATION ─────────────────────────────────────────────────────
// Reference anchor: week of Monday, January 5, 2026 = Blue zone garbage week.
const BLUE_REF = new Date(2026, 0, 5);

function mondayOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

function zoneWeekFor(date) {
  const weekStart = mondayOfWeek(date);
  const refStart  = mondayOfWeek(BLUE_REF);
  const weeksDiff = Math.round((weekStart - refStart) / (7 * 864e5));
  return ((weeksDiff % 2) + 2) % 2 === 0 ? 'blue' : 'yellow';
}

// ── DATE HELPERS ──────────────────────────────────────────────────────────────
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS   = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];

function formatDate(d) {
  const n   = d.getDate();
  const sfx = n % 10 === 1 && n !== 11 ? 'st'
             : n % 10 === 2 && n !== 12 ? 'nd'
             : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${MONTHS[d.getMonth()]} ${n}${sfx}`;
}

function nextWeekday(from, dow) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let ahead = (dow - d.getDay() + 7) % 7;
  if (ahead === 0) ahead = 7;
  d.setDate(d.getDate() + ahead);
  return d;
}

function nextGarbageDay(from, dow, zone) {
  let d = nextWeekday(from, dow);
  while (zoneWeekFor(d) !== zone) d.setDate(d.getDate() + 7);
  return d;
}

// ── SPEECH BUILDERS ───────────────────────────────────────────────────────────
function buildTodaySpeech() {
  const street  = STREETS[DEFAULT_STREET];
  const today   = new Date();
  today.setHours(0, 0, 0, 0);

  const isCollDay = today.getDay() === street.day;
  const isGarbDay = isCollDay && zoneWeekFor(today) === street.zone;

  if (isCollDay && isGarbDay) {
    return `Yes! Today is garbage day on ${street.label}. Put out your green bin, blue box recycling, and black bag garbage.`;
  }

  if (isCollDay) {
    const nextGarb = nextGarbageDay(today, street.day, street.zone);
    return `Today is collection day on ${street.label}, but it's green bin and recycling only — no black bags this week. `
         + `The next black bag garbage day is ${WEEKDAYS[nextGarb.getDay()]}, ${formatDate(nextGarb)}.`;
  }

  const nextColl   = nextWeekday(today, street.day);
  const nextIsGarb = zoneWeekFor(nextColl) === street.zone;
  const garbagePart = nextIsGarb
    ? 'Black bag garbage goes out too.'
    : 'Green bin and recycling only — no black bags.';
  return `No, today is not a collection day on ${street.label}. `
       + `Your next collection day is ${WEEKDAYS[nextColl.getDay()]}, ${formatDate(nextColl)}. `
       + garbagePart;
}

function buildNextSpeech() {
  const street  = STREETS[DEFAULT_STREET];
  const today   = new Date();
  today.setHours(0, 0, 0, 0);

  const nextColl   = nextWeekday(today, street.day);
  const nextIsGarb = zoneWeekFor(nextColl) === street.zone;
  const nextGarb   = nextGarbageDay(today, street.day, street.zone);

  let speech = `Your next collection day on ${street.label} is ${WEEKDAYS[nextColl.getDay()]}, ${formatDate(nextColl)}. `;
  if (nextIsGarb) {
    speech += 'Green bin, recycling, and black bag garbage all go out.';
  } else {
    speech += `Green bin and recycling only. `
            + `The next black bag garbage day is ${WEEKDAYS[nextGarb.getDay()]}, ${formatDate(nextGarb)}.`;
  }
  return speech;
}

// ── HANDLERS ──────────────────────────────────────────────────────────────────
const LaunchRequestHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest';
  },
  handle(h) {
    const speech = buildTodaySpeech();
    return h.responseBuilder
      .speak(speech)
      .withSimpleCard('Richmond Hill Garbage Day', speech)
      .getResponse();
  },
};

const CheckCollectionIntentHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(h.requestEnvelope) === 'CheckCollectionIntent';
  },
  handle(h) {
    const speech = buildTodaySpeech();
    return h.responseBuilder
      .speak(speech)
      .withSimpleCard('Today\'s Collection', speech)
      .getResponse();
  },
};

const NextCollectionIntentHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(h.requestEnvelope) === 'NextCollectionIntent';
  },
  handle(h) {
    const speech = buildNextSpeech();
    return h.responseBuilder
      .speak(speech)
      .withSimpleCard('Next Collection Day', speech)
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(h) {
    const speech = 'You can ask: is today garbage day, or when is the next garbage day.';
    return h.responseBuilder.speak(speech).reprompt(speech).getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
        && (Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.CancelIntent'
         || Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.StopIntent');
  },
  handle(h) {
    return h.responseBuilder.speak('Goodbye!').getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(h) { return h.responseBuilder.getResponse(); },
};

const ErrorHandler = {
  canHandle() { return true; },
  handle(h, error) {
    console.error('Skill error:', error);
    return h.responseBuilder
      .speak('Sorry, something went wrong. Please try again.')
      .reprompt('Please try again.')
      .getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    CheckCollectionIntentHandler,
    NextCollectionIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
