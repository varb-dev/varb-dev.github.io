import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDraws, parseTiers, findWins, sortWins, formatDrawDate } from './lottery-core.mjs';

const csv = readFileSync(new URL('./numbers.csv', import.meta.url), 'utf8');
const tierText = readFileSync(new URL('./tiers.txt', import.meta.url), 'utf8');
const draws = parseDraws(csv);
const tiers = parseTiers(tierText);
const mainTicket = [1, 2, 3, 4, 5];
const euroTicket = [1, 2];
const expectedTiers = [
    [5, 2], [5, 1], [5, 0], [4, 2], [4, 1], [3, 2],
    [4, 0], [2, 2], [3, 1], [3, 0], [1, 2], [2, 1],
];

function drawWithMatches(mainCount, euroCount, date = '2026-10-09') {
    return {
        date,
        main: [...mainTicket.slice(0, mainCount), ...Array.from({ length: 5 - mainCount }, (_, i) => 10 + i)],
        euro: [...euroTicket.slice(0, euroCount), ...Array.from({ length: 2 - euroCount }, (_, i) => 10 + i)],
    };
}

test('parses the complete supplied history without changing numbers or dates', () => {
    const originalRows = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1);
    assert.equal(draws.length, originalRows.length);
    originalRows.forEach((row, index) => {
        const [day, month, year, ...numbers] = row.split(';').map(Number);
        assert.deepEqual(draws[index], {
            date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            main: numbers.slice(0, 5),
            euro: numbers.slice(5),
        });
    });
    assert.ok(draws.some(draw => draw.euro.includes(11)));
    assert.ok(draws.some(draw => draw.euro.includes(12)));
});

test('handles BOM, CRLF, whitespace and blank lines', () => {
    const sample = '\uFEFFTag;Monat;Jahr;ZahlA1;ZahlA2;ZahlA3;ZahlA4;ZahlA5;ZahlB1;ZahlB2\r\n\r\n 23;3;2012;5;46;37;21;8;8;6 \r\n';
    assert.deepEqual(parseDraws(sample), [{ date: '2012-03-23', main: [5, 46, 37, 21, 8], euro: [8, 6] }]);
    assert.deepEqual(parseTiers(`\uFEFF\r\n${tierText}\r\n\r\n`), tiers);
});

test('rejects missing columns, invalid dates, duplicate numbers and out-of-range numbers', () => {
    const header = 'Tag;Monat;Jahr;ZahlA1;ZahlA2;ZahlA3;ZahlA4;ZahlA5;ZahlB1;ZahlB2\n';
    assert.throws(() => parseDraws(''));
    assert.throws(() => parseDraws('date;numbers\n2012;1'));
    for (const row of [
        '31;2;2026;1;2;3;4;5;1;2',
        '1;1;2026;1;1;3;4;5;1;2',
        '1;1;2026;1;2;3;4;51;1;2',
        '1;1;2026;1;2;3;4;5;1;13',
        '1;1;2026;1;2;3;4;5;2;2',
        '1;1;2026;1;2;3;4;5;1;',
    ]) assert.throws(() => parseDraws(header + row));
});

test('uses all twelve supplied tier definitions', () => {
    assert.deepEqual(tiers, expectedTiers.map(([mainMatches, euroMatches], index) => ({
        tier: index + 1, mainMatches, euroMatches,
    })));
    assert.throws(() => parseTiers(''));
    assert.throws(() => parseTiers('1 (5 + 2)\n1 (5 + 1)'));
    assert.throws(() => parseTiers('1 (5 + 2)\n2 (5 + 2)'));
    assert.throws(() => parseTiers('1 (6 + 2)'));
    assert.throws(() => parseTiers('2 (5 + 2)'));
});

for (let main = 0; main <= 5; main++) {
    for (let euro = 0; euro <= 2; euro++) {
        test(`classifies ${main} main + ${euro} Euro matches exactly once, or as no prize`, () => {
            const result = findWins([drawWithMatches(main, euro)], tiers, mainTicket, euroTicket, 12);
            const tierIndex = expectedTiers.findIndex(([a, b]) => a === main && b === euro);
            assert.equal(result.length, tierIndex === -1 ? 0 : 1);
            if (result.length) assert.equal(result[0].tier, tierIndex + 1);
        });
    }
}

test('cutoff includes the selected tier and every higher prize', () => {
    const fixtures = expectedTiers.map(([main, euro]) => drawWithMatches(main, euro));
    for (let cutoff = 1; cutoff <= 12; cutoff++) {
        assert.deepEqual(
            findWins(fixtures, tiers, mainTicket, euroTicket, cutoff).map(win => win.tier).sort((a, b) => a - b),
            Array.from({ length: cutoff }, (_, i) => i + 1),
        );
    }
});

test('finds the first historical jackpot independently of number order', () => {
    const wins = findWins(draws, tiers, [37, 8, 46, 5, 21], [6, 8], 1);
    assert.ok(wins.some(win => win.date === '2012-03-23' && win.tier === 1));
    assert.equal(formatDrawDate('2012-03-23'), '23.03.2012');
});

test('keeps the main and Euro pools separate', () => {
    const draw = { date: '2026-10-09', main: [1, 2, 3, 6, 7], euro: [4, 5] };
    const [win] = findWins([draw], tiers, mainTicket, euroTicket, 12);
    assert.equal(win.tier, 10);
    assert.equal(win.mainMatches, 3);
    assert.equal(win.euroMatches, 0);
});

test('sorts newest first and leaves the inputs unchanged across repeated plays', () => {
    const fixtures = [drawWithMatches(5, 2, '2012-03-23'), drawWithMatches(5, 2, '2026-10-09')];
    const before = JSON.stringify({ fixtures, mainTicket, euroTicket });
    const wins = findWins(fixtures, tiers, mainTicket, euroTicket, 12);
    assert.deepEqual(wins.map(win => win.date), ['2026-10-09', '2012-03-23']);
    assert.deepEqual(findWins(fixtures, tiers, mainTicket, euroTicket, 12), wins);
    assert.equal(JSON.stringify({ fixtures, mainTicket, euroTicket }), before);
});

test('rejects incomplete tickets, duplicates, invalid ranges and invalid cutoffs', () => {
    for (const [main, euro, cutoff] of [
        [[1, 2, 3, 4], euroTicket, 12],
        [[1, 1, 3, 4, 5], euroTicket, 12],
        [[1, 2, 3, 4, 51], euroTicket, 12],
        [mainTicket, [1], 12],
        [mainTicket, [1, 13], 12],
        [mainTicket, euroTicket, 0],
        [mainTicket, euroTicket, 13],
    ]) assert.throws(() => findWins(draws, tiers, main, euro, cutoff));
});

test('sorts dates chronologically in both directions across months and years', () => {
    const wins = [
        { date: '2026-01-02', tier: 10 },
        { date: '2012-03-23', tier: 1 },
        { date: '2025-12-30', tier: 2 },
    ];
    const ascending = ['2012-03-23', '2025-12-30', '2026-01-02'];
    assert.deepEqual(sortWins(wins, 'date', 'ascending').map(win => win.date), ascending);
    assert.deepEqual(sortWins(wins, 'date', 'descending').map(win => win.date), [...ascending].reverse());
    assert.deepEqual(wins.map(win => win.date), ['2026-01-02', '2012-03-23', '2025-12-30']);
});

test('sorts tiers numerically, uses newest-first ties and supports repeated reversal', () => {
    const wins = [
        { date: '2026-10-09', tier: 12 },
        { date: '2012-03-23', tier: 2 },
        { date: '2025-12-30', tier: 10 },
        { date: '2026-01-02', tier: 2 },
    ];
    const ascending = sortWins(wins, 'tier', 'ascending');
    assert.deepEqual(ascending.map(win => [win.tier, win.date]), [
        [2, '2026-01-02'], [2, '2012-03-23'], [10, '2025-12-30'], [12, '2026-10-09'],
    ]);
    const descending = sortWins(ascending, 'tier', 'descending');
    assert.deepEqual(descending.map(win => win.tier), [12, 10, 2, 2]);
    assert.deepEqual(sortWins(descending, 'tier', 'ascending'), ascending);
    assert.deepEqual(sortWins([], 'tier', 'ascending'), []);
});
