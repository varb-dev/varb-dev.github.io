const DRAW_COLUMNS = [
    'Tag', 'Monat', 'Jahr',
    'ZahlA1', 'ZahlA2', 'ZahlA3', 'ZahlA4', 'ZahlA5', 'ZahlB1', 'ZahlB2',
];

function lines(text) {
    return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
}

function validNumbers(numbers, count, maximum) {
    return numbers.length === count
        && new Set(numbers).size === count
        && numbers.every(number => Number.isInteger(number) && number >= 1 && number <= maximum);
}

export function parseDraws(text) {
    const [header, ...rows] = lines(text);
    if (!header || rows.length === 0) {
        throw new Error('Draw history is empty.');
    }

    const columns = header.split(';').map(value => value.trim());
    const indices = DRAW_COLUMNS.map(column => columns.indexOf(column));
    if (indices.includes(-1)) {
        throw new Error('Draw history is missing required columns.');
    }

    return rows.map((row, index) => {
        const cells = row.split(';').map(value => value.trim());
        if (cells.length !== columns.length || indices.some(i => !/^\d+$/.test(cells[i]))) {
            throw new Error(`Invalid draw on data row ${index + 1}.`);
        }

        const [day, month, year, ...numbers] = indices.map(i => Number(cells[i]));
        const date = new Date(Date.UTC(year, month - 1, day));
        const main = numbers.slice(0, 5);
        const euro = numbers.slice(5);
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
            || date.getUTCDate() !== day || !validNumbers(main, 5, 50) || !validNumbers(euro, 2, 12)) {
            throw new Error(`Invalid date or numbers on data row ${index + 1}.`);
        }

        return { date: date.toISOString().slice(0, 10), main, euro };
    });
}

export function parseTiers(text) {
    const rows = lines(text);
    if (rows.length === 0) {
        throw new Error('Prize tiers are empty.');
    }

    const ranks = new Set();
    const combinations = new Set();
    const tiers = rows.map(row => {
        const match = row.trim().match(/^(\d+)\s+\((\d+)\s*\+\s*(\d+)\)$/);
        if (!match) {
            throw new Error('Invalid prize-tier definition.');
        }

        const [tier, mainMatches, euroMatches] = match.slice(1).map(Number);
        const combination = `${mainMatches}+${euroMatches}`;
        if (tier < 1 || mainMatches > 5 || euroMatches > 2
            || ranks.has(tier) || combinations.has(combination)) {
            throw new Error('Invalid or duplicate prize tier.');
        }

        ranks.add(tier);
        combinations.add(combination);
        return { tier, mainMatches, euroMatches };
    });

    tiers.sort((a, b) => a.tier - b.tier);
    if (tiers.some((tier, index) => tier.tier !== index + 1)) {
        throw new Error('Prize-tier ranks must start at 1 and be consecutive.');
    }
    return tiers;
}

export function findWins(draws, tiers, selectedMain, selectedEuro, cutoff) {
    const mainNumbers = [...selectedMain];
    const euroNumbers = [...selectedEuro];
    if (!validNumbers(mainNumbers, 5, 50) || !validNumbers(euroNumbers, 2, 12)) {
        throw new Error('Choose five distinct main numbers and two distinct Euro numbers.');
    }
    if (!tiers.some(tier => tier.tier === cutoff)) {
        throw new Error('Choose a valid prize-tier cutoff.');
    }

    const main = new Set(mainNumbers);
    const euro = new Set(euroNumbers);
    const tierLookup = new Map(tiers.map(tier => [`${tier.mainMatches}+${tier.euroMatches}`, tier.tier]));
    const wins = [];

    for (const draw of draws) {
        let mainMatches = 0;
        let euroMatches = 0;
        for (const number of draw.main) {
            if (main.has(number)) mainMatches++;
        }
        for (const number of draw.euro) {
            if (euro.has(number)) euroMatches++;
        }

        const tier = tierLookup.get(`${mainMatches}+${euroMatches}`);
        if (tier !== undefined && tier <= cutoff) {
            wins.push({ ...draw, tier, mainMatches, euroMatches });
        }
    }

    return sortWins(wins);
}

export function sortWins(wins, column = 'date', direction = 'descending') {
    const multiplier = direction === 'ascending' ? 1 : -1;
    return [...wins].sort((a, b) => {
        const comparison = column === 'tier' ? a.tier - b.tier : a.date.localeCompare(b.date);
        return multiplier * comparison || b.date.localeCompare(a.date);
    });
}

export function formatDrawDate(date) {
    return date.split('-').reverse().join('.');
}
