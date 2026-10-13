import { parseDraws, parseTiers, findWins, sortWins, formatDrawDate } from './lottery-core.mjs';

const mainSelection = new Set();
const euroSelection = new Set();
const mainGrid = document.getElementById('main-numbers');
const euroGrid = document.getElementById('euro-numbers');
const playButton = document.getElementById('play-button');
const clearButton = document.getElementById('clear-button');
const tierCutoff = document.getElementById('tier-cutoff');
const dataStatus = document.getElementById('data-status');
const dialog = document.getElementById('results-dialog');
const settingsButton = document.getElementById('settings-button');
const settingsPanel = document.getElementById('settings-panel');
let draws = null;
let tiers = [];
let winningDraws = [];
let resultSort = { column: 'date', direction: 'descending' };

function positionSettings() {
    if (!settingsPanel.matches(':popover-open')) return;
    const button = settingsButton.getBoundingClientRect();
    const panel = settingsPanel.getBoundingClientRect();
    const above = button.top - panel.height - 12;
    const below = button.bottom + 12;
    const top = above >= 16 ? above
        : below + panel.height <= innerHeight - 16 ? below
        : Math.max(16, innerHeight - panel.height - 16);
    const left = Math.max(16, Math.min(button.right - panel.width, innerWidth - panel.width - 16));
    settingsPanel.style.top = `${top}px`;
    settingsPanel.style.left = `${left}px`;
}

settingsPanel.addEventListener('toggle', positionSettings);
window.addEventListener('resize', positionSettings);
window.addEventListener('scroll', positionSettings, { passive: true });

function makeGrid(container, selection, maximum, limit, label) {
    const fragment = document.createDocumentFragment();
    for (let number = 1; number <= maximum; number++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'number-button';
        button.textContent = String(number);
        button.dataset.number = String(number);
        button.setAttribute('aria-label', `${label} number ${number}`);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
            if (selection.has(number)) {
                selection.delete(number);
            } else if (selection.size < limit) {
                selection.add(number);
            }
            updateSelection();
        });
        fragment.append(button);
    }
    container.append(fragment);
}

function updateGrid(container, selection, limit) {
    for (const button of container.children) {
        const selected = selection.has(Number(button.dataset.number));
        button.setAttribute('aria-pressed', String(selected));
        button.disabled = !selected && selection.size === limit;
    }
}

function updateSelection() {
    updateGrid(mainGrid, mainSelection, 5);
    updateGrid(euroGrid, euroSelection, 2);
    document.getElementById('main-count').textContent = `${mainSelection.size} / 5`;
    document.getElementById('euro-count').textContent = `${euroSelection.size} / 2`;
    playButton.disabled = draws === null || mainSelection.size !== 5 || euroSelection.size !== 2;
    clearButton.disabled = mainSelection.size === 0 && euroSelection.size === 0;
}

function sortedNumbers(selection) {
    return [...selection].sort((a, b) => a - b).join(', ');
}

function drawNumberGroup(numbers, selection, pool) {
    const group = document.createElement('div');
    group.className = `draw-numbers draw-${pool}`;
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', `${pool === 'main' ? 'Main' : 'Euro'} draw numbers`);
    for (const number of [...numbers].sort((a, b) => a - b)) {
        const matched = selection.has(number);
        const chip = document.createElement(matched ? 'mark' : 'span');
        chip.className = matched ? 'draw-number match-hit' : 'draw-number';
        chip.dataset.number = String(number);
        chip.textContent = String(number);
        if (matched) {
            const hint = document.createElement('span');
            hint.className = 'visually-hidden';
            hint.textContent = ' (matched)';
            chip.append(hint);
        }
        group.append(chip);
    }
    return group;
}

function renderResults() {
    const fragment = document.createDocumentFragment();
    for (const win of sortWins(winningDraws, resultSort.column, resultSort.direction)) {
        const row = document.createElement('tr');
        row.dataset.date = win.date;
        row.dataset.tier = String(win.tier);
        if (win.tier === 1) row.className = 'jackpot-row';
        const values = [
            formatDrawDate(win.date),
            win.tier === 1 ? '1 · Jackpot' : String(win.tier),
        ];
        for (const value of values) {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.append(cell);
        }
        const matches = document.createElement('td');
        matches.append(drawNumberGroup(win.main, mainSelection, 'main'), drawNumberGroup(win.euro, euroSelection, 'euro'));
        row.append(matches);
        fragment.append(row);
    }
    document.getElementById('results-body').replaceChildren(fragment);
    for (const button of document.querySelectorAll('.sort-button')) {
        const column = button.dataset.sort;
        const active = column === resultSort.column;
        button.closest('th').setAttribute('aria-sort', active ? resultSort.direction : 'none');
        button.querySelector('.sort-icon').textContent = active ? resultSort.direction === 'ascending' ? '↑' : '↓' : '↕';
        const nextDirection = active
            ? resultSort.direction === 'ascending' ? 'descending' : 'ascending'
            : column === 'date' ? 'descending' : 'ascending';
        const order = column === 'date'
            ? nextDirection === 'ascending' ? 'oldest first' : 'newest first'
            : nextDirection === 'ascending' ? 'highest prizes first' : 'lowest prizes first';
        button.setAttribute('aria-label', `Sort by ${column}, ${order}`);
    }
    const order = resultSort.column === 'date'
        ? resultSort.direction === 'ascending' ? 'oldest first' : 'newest first'
        : resultSort.direction === 'ascending' ? 'highest prizes first' : 'lowest prizes first';
    document.getElementById('results-caption').textContent = `Winning draws, ${order}`;
    document.getElementById('results-table-wrap').scrollTop = 0;
}

for (const button of document.querySelectorAll('.sort-button')) {
    button.addEventListener('click', () => {
        const column = button.dataset.sort;
        resultSort = {
            column,
            direction: column === resultSort.column
                ? resultSort.direction === 'ascending' ? 'descending' : 'ascending'
                : column === 'date' ? 'descending' : 'ascending',
        };
        renderResults();
    });
}

document.getElementById('ticket-form').addEventListener('submit', event => {
    event.preventDefault();
    if (playButton.disabled) return;

    const cutoff = Number(tierCutoff.value);
    winningDraws = findWins(draws, tiers, mainSelection, euroSelection, cutoff);
    resultSort = { column: 'date', direction: 'descending' };
    const filterLabel = cutoff === 1 ? 'tier 1' : `tiers 1–${cutoff}`;
    document.getElementById('results-summary').textContent =
        `${winningDraws.length} winning ${winningDraws.length === 1 ? 'draw' : 'draws'} out of ${draws.length} checked · ${filterLabel}.`;
    document.getElementById('result-main').textContent = sortedNumbers(mainSelection);
    document.getElementById('result-euro').textContent = sortedNumbers(euroSelection);
    document.getElementById('empty-results').hidden = winningDraws.length > 0;
    document.getElementById('results-table-wrap').hidden = winningDraws.length === 0;
    document.getElementById('match-legend').hidden = winningDraws.length === 0;
    renderResults();
    document.body.classList.add('results-open');
    dialog.showModal();
});

clearButton.addEventListener('click', () => {
    mainSelection.clear();
    euroSelection.clear();
    updateSelection();
    mainGrid.firstElementChild.focus();
});

document.getElementById('close-results').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
    document.body.classList.remove('results-open');
    playButton.focus();
});
dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        dialog.close();
    }
});

async function loadText(filename) {
    const response = await fetch(new URL(filename, import.meta.url));
    if (!response.ok) throw new Error(`Could not load ${filename}: HTTP ${response.status}.`);
    return response.text();
}

async function loadHistory() {
    try {
        const [drawText, tierText] = await Promise.all([loadText('numbers.csv'), loadText('tiers.txt')]);
        const parsedDraws = parseDraws(drawText);
        const parsedTiers = parseTiers(tierText);
        const options = parsedTiers.map(({ tier, mainMatches, euroMatches }) => {
            const option = document.createElement('option');
            option.value = String(tier);
            option.textContent = tier === parsedTiers.length
                ? `All prize tiers · 1–${tier}`
                : tier === 1 ? `Tier 1 · Jackpot (${mainMatches} + ${euroMatches})` : `Tier ${tier} or higher · ${mainMatches} + ${euroMatches}`;
            return option;
        });
        tierCutoff.replaceChildren(...options);
        tierCutoff.value = String(parsedTiers.at(-1).tier);
        tierCutoff.disabled = false;
        draws = parsedDraws;
        tiers = parsedTiers;
        const dates = draws.map(draw => draw.date).sort();
        dataStatus.textContent = `${draws.length} draws · ${formatDrawDate(dates[0])}–${formatDrawDate(dates.at(-1))}`;
        updateSelection();
    } catch (error) {
        dataStatus.textContent = 'Draw history could not be loaded. Refresh the page to try again.';
        dataStatus.classList.add('load-error');
        tierCutoff.firstElementChild.textContent = 'Prize tiers unavailable';
        console.error(error);
    }
}

makeGrid(mainGrid, mainSelection, 50, 5, 'Main');
makeGrid(euroGrid, euroSelection, 12, 2, 'Euro');
void loadHistory();
