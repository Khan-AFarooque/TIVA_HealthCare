/**
 * Medical Emergency Audio Alarm Utility
 *
 * Uses the Web Audio API to synthesize a clinical hospital monitor
 * intermittent alert tone (alternating 880Hz / 660Hz) for 10 seconds.
 * Does not require external audio files or network requests.
 */

let activeAudioCtx = null;
let alarmIntervalId = null;
let alarmTimeoutId = null;

export function playEmergencyAlarm(durationSeconds = 10) {
  try {
    // Stop any existing playing alarm first
    stopEmergencyAlarm();

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    activeAudioCtx = new AudioContext();
    if (activeAudioCtx.state === "suspended") {
      activeAudioCtx.resume();
    }

    let isHighPitch = true;

    // Beep generator function
    const playBeep = () => {
      if (!activeAudioCtx || activeAudioCtx.state === "closed") return;

      const osc = activeAudioCtx.createOscillator();
      const gain = activeAudioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(isHighPitch ? 880 : 660, activeAudioCtx.currentTime); // A5 and E5 medical alarm frequencies
      isHighPitch = !isHighPitch;

      // Pulse envelope
      gain.gain.setValueAtTime(0.001, activeAudioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, activeAudioCtx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, activeAudioCtx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(activeAudioCtx.destination);

      osc.start();
      osc.stop(activeAudioCtx.currentTime + 0.24);
    };

    // Play immediate first beep and repeat every 320ms
    playBeep();
    alarmIntervalId = setInterval(playBeep, 320);

    // Automatically stop after durationSeconds (default 10s)
    alarmTimeoutId = setTimeout(() => {
      stopEmergencyAlarm();
    }, durationSeconds * 1000);

    return true;
  } catch (err) {
    console.warn("Audio alarm playback notice:", err);
    return false;
  }
}

export function stopEmergencyAlarm() {
  if (alarmIntervalId) {
    clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }
  if (alarmTimeoutId) {
    clearTimeout(alarmTimeoutId);
    alarmTimeoutId = null;
  }
  if (activeAudioCtx) {
    try {
      activeAudioCtx.close();
    } catch {
      /* ignore */
    }
    activeAudioCtx = null;
  }
}
