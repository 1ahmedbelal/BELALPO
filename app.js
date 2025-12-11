// ----------- Local storage keys -----------
const SHEET_URL_KEY = "po_sheet_url_v1";
const TIMER_SETTINGS_KEY = "po_timer_settings_v1";
const TRACKER_STATE_KEY = "po_tracker_state_v1";

// ----------- DOM HELPERS -----------
function $(id) {
  return document.getElementById(id);
}

// ----------- GOOGLE SHEET EMBED -----------
const sheetUrlInput = $("sheetUrlInput");
const btnLoadSheet = $("btnLoadSheet");
const sheetFrame = $("sheetFrame");
const sheetPlaceholder = $("sheetPlaceholder");

// Load saved sheet URL on start
(function initSheet() {
  const savedUrl = localStorage.getItem(SHEET_URL_KEY);
  if (savedUrl) {
    sheetUrlInput.value = savedUrl;
    loadSheet(savedUrl);
  }
})();

btnLoadSheet.addEventListener("click", () => {
  const url = sheetUrlInput.value.trim();
  if (!url) return;
  loadSheet(url);
  localStorage.setItem(SHEET_URL_KEY, url);
});

function loadSheet(url) {
  sheetFrame.src = url;
  sheetPlaceholder.classList.add("hidden");
}

// ----------- TIMER & SETTINGS -----------
const timerDisplay = $("timerDisplay");
const timerGavelCue = $("timerGavelCue");
const questionChunkLabel = $("questionChunkLabel");
const questionsUsedLabel = $("questionsUsedLabel");

const modeButtons = document.querySelectorAll(".mode-btn");
const presetButtons = document.querySelectorAll(".preset-btn");

const btnTimerStart = $("btnTimerStart");
const btnTimerPause = $("btnTimerPause");
const btnTimerReset = $("btnTimerReset");
const btnTimerNextQuestioner = $("btnTimerNextQuestioner");

const btnTimerSettingsToggle = $("btnTimerSettingsToggle");
const timerSettingsPanel = $("timerSettingsPanel");
const speechDurationInput = $("speechDurationInput");
const speechCue1Input = $("speechCue1Input");
const speechCue2Input = $("speechCue2Input");
const speechCue3Input = $("speechCue3Input");
const questionDurationInput = $("questionDurationInput");
const questionCueInput = $("questionCueInput");
const btnSaveTimerSettings = $("btnSaveTimerSettings");
const btnResetTimerSettings = $("btnResetTimerSettings");

const defaultTimerSettings = {
  speechDurationSec: 180,
  questionDurationSec: 30,
  speechCuesSec: [120, 150, 180],
  questionCueSec: 30,
};

let timerSettings = loadTimerSettings();
let timerState = {
  mode: "speech", // "speech" | "question"
  totalMs: timerSettings.speechDurationSec * 1000,
  remainingMs: timerSettings.speechDurationSec * 1000,
  intervalId: null,
  lastSecondShown: null,
  questionsUsedThisBlock: 0,
};

updateTimerDisplay();
updateQuestionInfo();

// Load timer settings from localStorage or defaults
function loadTimerSettings() {
  const raw = localStorage.getItem(TIMER_SETTINGS_KEY);
  if (!raw) return { ...defaultTimerSettings };
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultTimerSettings, ...parsed };
  } catch (e) {
    return { ...defaultTimerSettings };
  }
}

function saveTimerSettings() {
  localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(timerSettings));
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updateTimerDisplay(flash = false) {
  timerDisplay.textContent = formatTime(timerState.remainingMs);
  if (flash) {
    timerDisplay.classList.add("flash");
    setTimeout(() => timerDisplay.classList.remove("flash"), 300);
  }
}

function updateQuestionInfo() {
  questionChunkLabel.textContent = formatTime(timerSettings.questionDurationSec * 1000);
  questionsUsedLabel.textContent = timerState.questionsUsedThisBlock.toString();
}

function setMode(newMode) {
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  timerState.mode = newMode;
  timerGavelCue.textContent = "";
  timerState.lastSecondShown = null;

  if (newMode === "speech") {
    timerState.totalMs = timerSettings.speechDurationSec * 1000;
    timerState.remainingMs = timerSettings.speechDurationSec * 1000;
  } else {
    timerState.totalMs = timerSettings.questionDurationSec * 1000;
    timerState.remainingMs = timerSettings.questionDurationSec * 1000;
    timerState.questionsUsedThisBlock = 0;
    updateQuestionInfo();
  }

  updateTimerDisplay();

  modeButtons.forEach((btn) => {
    const mode = btn.getAttribute("data-mode");
    btn.classList.toggle("active", mode === newMode);
  });
}

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.getAttribute("data-mode");
    setMode(mode);
  });
});

// Preset buttons affect speech mode only
presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const presetSec = Number(btn.getAttribute("data-preset"));
    timerSettings.speechDurationSec = presetSec;
    saveTimerSettings();
    if (timerState.mode === "speech") {
      timerState.totalMs = presetSec * 1000;
      timerState.remainingMs = presetSec * 1000;
      timerState.lastSecondShown = null;
      updateTimerDisplay();
    }
  });
});

// Timer controls
btnTimerStart.addEventListener("click", () => {
  if (timerState.intervalId) return;
  timerState.intervalId = setInterval(tickTimer, 200);
});

btnTimerPause.addEventListener("click", () => {
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
});

btnTimerReset.addEventListener("click", () => {
  resetTimerForCurrentMode();
});

btnTimerNextQuestioner.addEventListener("click", () => {
  if (timerState.mode !== "question") return;
  timerState.questionsUsedThisBlock += 1;
  timerState.totalMs = timerSettings.questionDurationSec * 1000;
  timerState.remainingMs = timerSettings.questionDurationSec * 1000;
  timerState.lastSecondShown = null;
  updateTimerDisplay(true);
  updateQuestionInfo();
  timerGavelCue.textContent = "";
});

// Timer tick
function tickTimer() {
  timerState.remainingMs -= 200;
  if (timerState.remainingMs <= 0) {
    timerState.remainingMs = 0;
    updateTimerDisplay(true);
    showGavelCue("Time elapsed");
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
    return;
  }

  const currentSec = Math.round(timerState.remainingMs / 1000);
  if (currentSec !== timerState.lastSecondShown) {
    timerState.lastSecondShown = currentSec;
    updateTimerDisplay();

    const elapsedSec =
      (timerState.totalMs - timerState.remainingMs) / 1000;

    if (timerState.mode === "speech") {
      const cues = timerSettings.speechCuesSec.filter((v) => v > 0);
      cues.forEach((cue, index) => {
        if (Math.round(elapsedSec) === cue) {
          if (index === 0) {
            showGavelCue("Tap gavel once.");
          } else if (index === 1) {
            showGavelCue("Tap gavel twice.");
          } else {
            showGavelCue("Final tap.");
          }
          updateTimerDisplay(true);
        }
      });
    } else if (timerState.mode === "question") {
      const qCue = timerSettings.questionCueSec;
      if (qCue > 0 && Math.round(elapsedSec) === qCue) {
        showGavelCue("Tap gavel for question time.");
        updateTimerDisplay(true);
      }
    }
  }
}

function showGavelCue(text) {
  timerGavelCue.textContent = text;
  setTimeout(() => {
    if (timerGavelCue.textContent === text) {
      timerGavelCue.textContent = "";
    }
  }, 3000);
}

function resetTimerForCurrentMode() {
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  timerGavelCue.textContent = "";
  timerState.lastSecondShown = null;
  if (timerState.mode === "speech") {
    timerState.totalMs = timerSettings.speechDurationSec * 1000;
    timerState.remainingMs = timerSettings.speechDurationSec * 1000;
  } else {
    timerState.totalMs = timerSettings.questionDurationSec * 1000;
    timerState.remainingMs = timerSettings.questionDurationSec * 1000;
    timerState.questionsUsedThisBlock = 0;
    updateQuestionInfo();
  }
  updateTimerDisplay();
}

// Settings panel
btnTimerSettingsToggle.addEventListener("click", () => {
  timerSettingsPanel.classList.toggle("hidden");
  if (!timerSettingsPanel.classList.contains("hidden")) {
    populateTimerSettingsInputs();
  }
});

function populateTimerSettingsInputs() {
  speechDurationInput.value = timerSettings.speechDurationSec;
  const cues = timerSettings.speechCuesSec;
  speechCue1Input.value = cues[0] || "";
  speechCue2Input.value = cues[1] || "";
  speechCue3Input.value = cues[2] || "";
  questionDurationInput.value = timerSettings.questionDurationSec;
  questionCueInput.value = timerSettings.questionCueSec || "";
}

btnSaveTimerSettings.addEventListener("click", () => {
  const sd = Number(speechDurationInput.value) || defaultTimerSettings.speechDurationSec;
  const qd =
    Number(questionDurationInput.value) || defaultTimerSettings.questionDurationSec;

  const c1 = Number(speechCue1Input.value) || 0;
  const c2 = Number(speechCue2Input.value) || 0;
  const c3 = Number(speechCue3Input.value) || 0;
  const qc = Number(questionCueInput.value) || 0;

  timerSettings.speechDurationSec = sd;
  timerSettings.questionDurationSec = qd;
  timerSettings.speechCuesSec = [c1, c2, c3];
  timerSettings.questionCueSec = qc;

  saveTimerSettings();

  // If timer is not running, reset durations
  if (!timerState.intervalId) {
    if (timerState.mode === "speech") {
      timerState.totalMs = sd * 1000;
      timerState.remainingMs = sd * 1000;
    } else {
      timerState.totalMs = qd * 1000;
      timerState.remainingMs = qd * 1000;
      timerState.questionsUsedThisBlock = 0;
      updateQuestionInfo();
    }
    timerState.lastSecondShown = null;
    updateTimerDisplay();
  }

  updateQuestionInfo();
});

btnResetTimerSettings.addEventListener("click", () => {
  timerSettings = { ...defaultTimerSettings };
  saveTimerSettings();
  populateTimerSettingsInputs();
  if (!timerState.intervalId) {
    if (timerState.mode === "speech") {
      timerState.totalMs = timerSettings.speechDurationSec * 1000;
      timerState.remainingMs = timerSettings.speechDurationSec * 1000;
    } else {
      timerState.totalMs = timerSettings.questionDurationSec * 1000;
      timerState.remainingMs = timerSettings.questionDurationSec * 1000;
      timerState.questionsUsedThisBlock = 0;
      updateQuestionInfo();
    }
    timerState.lastSecondShown = null;
    updateTimerDisplay();
  }
  updateQuestionInfo();
});

// ----------- AFF / NEG TRACKER -----------
const chamberTypeSelect = $("chamberTypeSelect");
const authorshipGivenCheckbox = $("authorshipGivenCheckbox");
const nextSpeechLabel = $("nextSpeechLabel");
const affCountLabel = $("affCountLabel");
const negCountLabel = $("negCountLabel");
const suggestedLineEl = $("suggestedLine");
const btnNextAff = $("btnNextAff");
const btnNextNeg = $("btnNextNeg");
const btnMarkSpeechGiven = $("btnMarkSpeechGiven");
const btnResetBill = $("btnResetBill");

let trackerState = loadTrackerState();

// Default initial state
if (!trackerState) {
  trackerState = {
    chamberType: "senate",
    authorshipGiven: false,
    affCount: 0,
    negCount: 0,
    nextSide: "aff", // "aff" | "neg"
  };
}

// Apply loaded state
chamberTypeSelect.value = trackerState.chamberType;
authorshipGivenCheckbox.checked = trackerState.authorshipGiven;
renderTracker();

function loadTrackerState() {
  const raw = localStorage.getItem(TRACKER_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveTrackerState() {
  localStorage.setItem(TRACKER_STATE_KEY, JSON.stringify(trackerState));
}

function numberToOrdinalWord(n) {
  const map = {
    1: "first",
    2: "second",
    3: "third",
    4: "fourth",
    5: "fifth",
    6: "sixth",
    7: "seventh",
    8: "eighth",
    9: "ninth",
    10: "tenth",
    11: "eleventh",
    12: "twelfth",
  };
  return map[n] || `${n}th`;
}

function getChamberAddress() {
  if (trackerState.chamberType === "house") return "Representatives";
  if (trackerState.chamberType === "senate") return "Senators";
  return "Delegates";
}

function renderTracker() {
  const affNext = trackerState.affCount + 1;
  const negNext = trackerState.negCount + 1;

  const isAff = trackerState.nextSide === "aff";
  const sideLabel = isAff ? "Affirmation" : "Negation";
  const number = isAff ? affNext : negNext;

  nextSpeechLabel.textContent = `${sideLabel} #${number}`;
  affCountLabel.textContent = trackerState.affCount.toString();
  negCountLabel.textContent = trackerState.negCount.toString();

  const ordinal = numberToOrdinalWord(number);
  const address = getChamberAddress();

  const line = `Thank you, ${address}. We are now in line for the ${ordinal.toLowerCase()} ${sideLabel.toLowerCase()} speech on this legislation.`;
  suggestedLineEl.textContent = line;

  saveTrackerState();
}

chamberTypeSelect.addEventListener("change", () => {
  trackerState.chamberType = chamberTypeSelect.value;
  renderTracker();
});

authorshipGivenCheckbox.addEventListener("change", () => {
  trackerState.authorshipGiven = authorshipGivenCheckbox.checked;
  renderTracker();
});

btnNextAff.addEventListener("click", () => {
  trackerState.nextSide = "aff";
  renderTracker();
});

btnNextNeg.addEventListener("click", () => {
  trackerState.nextSide = "neg";
  renderTracker();
});

btnMarkSpeechGiven.addEventListener("click", () => {
  if (trackerState.nextSide === "aff") {
    trackerState.affCount += 1;
    trackerState.nextSide = "neg";
  } else {
    trackerState.negCount += 1;
    trackerState.nextSide = "aff";
  }
  renderTracker();
});

btnResetBill.addEventListener("click", () => {
  trackerState.affCount = 0;
  trackerState.negCount = 0;
  trackerState.nextSide = "aff";
  renderTracker();
});

// ----------- CHAMBER & TOURNAMENT NAMES (nice to have) -----------
const chamberNameInput = $("chamberNameInput");
const tournamentNameInput = $("tournamentNameInput");
const NAMES_KEY = "po_names_state_v1";

(function initNames() {
  const raw = localStorage.getItem(NAMES_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.chamber) chamberNameInput.value = parsed.chamber;
    if (parsed.tournament) tournamentNameInput.value = parsed.tournament;
  } catch (e) {
    // ignore
  }
})();

function saveNames() {
  const state = {
    chamber: chamberNameInput.value.trim(),
    tournament: tournamentNameInput.value.trim(),
  };
  localStorage.setItem(NAMES_KEY, JSON.stringify(state));
}

chamberNameInput.addEventListener("input", saveNames);
tournamentNameInput.addEventListener("input", saveNames);
