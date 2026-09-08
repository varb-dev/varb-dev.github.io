/*
 * Change these values to set the local-time countdown.
 * `month` uses the familiar 1–12 format. This is interpreted in the device's timezone.
 */
const COUNTDOWN_CONFIG = {
    year: 2026,
    month: 11,
    day: 19,
    hour: 0,
    minute: 0,
    second: 0
};

const units = {
    days: document.querySelector("#days"),
    hours: document.querySelector("#hours"),
    minutes: document.querySelector("#minutes"),
    seconds: document.querySelector("#seconds")
};

const targetDate = new Date(
    COUNTDOWN_CONFIG.year,
    COUNTDOWN_CONFIG.month - 1,
    COUNTDOWN_CONFIG.day,
    COUNTDOWN_CONFIG.hour,
    COUNTDOWN_CONFIG.minute,
    COUNTDOWN_CONFIG.second,
    0
);

function updateCountdown() {
    const now = new Date();

    const totalSeconds = Math.max(0, Math.floor((targetDate - now) / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    units.days.value = String(days).padStart(3, "0");
    units.hours.value = String(hours).padStart(2, "0");
    units.minutes.value = String(minutes).padStart(2, "0");
    units.seconds.value = String(seconds).padStart(2, "0");
}

updateCountdown();
window.setInterval(updateCountdown, 1000);
