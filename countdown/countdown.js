// Auckland is on NZDT (UTC+13) on 19 November 2026.
const targetDate = new Date("2026-11-19T00:00:00+13:00");

const units = {
    days: document.querySelector("#days"),
    hours: document.querySelector("#hours"),
    minutes: document.querySelector("#minutes"),
    seconds: document.querySelector("#seconds")
};

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
