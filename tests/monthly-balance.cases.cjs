// Included in the existing project test entry point. All records are fictitious.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../monthly-balance.js');
const B = require('../backup.js');
const month = '2026-10';
const fixture = () => ({ incomes: [{ id: 'salary', date: month, owner: 'Persona ficticia', concept: 'Ingreso ficticio', amount: 3000 }], expenses: [{ id: 'bill', date: month, concept: 'Gasto ficticio', amount: 1800 }], funds: [], snapshots: [] });
const input = (changes = {}) => ({ month, fundSavings: 400, liquiditySavings: 100, entries: [], reviewedAgainst: null, note: '', ...changes });
const decision = (data, block, id, action) => ({ block, id, action, source: M.sourceSignature(data[block].find(row => row.id === id)) });
const savedData = (data, record) => ({ ...data, monthlyBalances: [record] });
const clone = value => structuredClone(value);
function storageFor(data) {
    const values = new Map();
    B.BLOCKS.forEach(k => values.set(B.LEGACY_KEYS[k], JSON.stringify(data[k])));
    return { values, writes: [], fail: false, getItem: key => values.get(key) ?? null,
        setItem(key, value) { if (this.fail) throw new Error('Quota'); this.writes.push(key); values.set(key, value); } };
}

test('the seven approved monthly concepts follow the requested formulas', () => {
    const result = M.calculate(fixture(), month, input());
    assert.deepEqual(Object.fromEntries(M.METRICS.map(key => [key, result[key]])), { income: 3000, expenses: 1800, fundSavings: 400, liquiditySavings: 100, totalSavings: 500, totalExpense: 2500, unitemized: 700 });
    assert.equal(result.reviewed, false);
});

test('blank or absent savings are unknown, while explicit zero calculates a complete balance', () => {
    for (const record of [undefined, input({ fundSavings: null }), input({ liquiditySavings: null })]) {
        const result = M.calculate(fixture(), month, record);
        assert.equal(result.totalExpense, null); assert.equal(result.unitemized, null); assert.equal(result.canReview, false);
    }
    const zero = M.calculate(fixture(), month, input({ fundSavings: 0, liquiditySavings: 0 }));
    assert.equal(zero.totalExpense, 3000); assert.equal(zero.totalSavings, 0);
});

test('Ahorro is not excluded by name: it remains pending until explicitly identified', () => {
    const data = fixture(); data.expenses.push({ id: 'saving', date: month, concept: 'Ahorro', amount: 400 });
    const unresolved = M.calculate(data, month, input());
    assert.equal(unresolved.expenses, 2200); assert.equal(unresolved.canReview, false);
    assert.throws(() => M.prepareRecord(data, input(), true), /pendientes/);
    const genuine = input({ entries: [decision(data, 'expenses', 'saving', 'saving')] });
    assert.equal(M.calculate(data, month, genuine).expenses, 1800);
    assert.equal(M.calculate(data, month, genuine).fundSavings, 400, 'classification never adds the saving again');
    const actualExpense = input({ entries: [decision(data, 'expenses', 'saving', 'expense')] });
    assert.equal(M.calculate(data, month, actualExpense).expenses, 2200);
    assert.deepEqual(data.expenses[1], { id: 'saving', date: month, concept: 'Ahorro', amount: 400 });
});

test('a word resembling a transfer never causes automatic income or expense exclusion', () => {
    const data = fixture(); data.expenses[0].concept = 'Transferencia de alquiler';
    assert.equal(M.calculate(data, month, input()).expenses, 1800);
});

test('own-account income and expense transfers are excluded only after explicit treatment', () => {
    const data = fixture();
    data.incomes.push({ id: 'own-in', date: month, owner: 'Ficticio', concept: 'Movimiento propio', amount: 500 });
    data.expenses.push({ id: 'own-out', date: month, concept: 'Movimiento propio', amount: 500 });
    const entries = [decision(data, 'incomes', 'own-in', 'internal'), decision(data, 'expenses', 'own-out', 'internal')];
    const result = M.calculate(data, month, input({ entries }));
    assert.equal(result.income, 3000); assert.equal(result.expenses, 1800);
    assert.equal(result.totalSavings, 500); assert.equal(result.totalExpense, 2500);
    assert.equal(result.rawIncome, 3500); assert.equal(result.rawExpenses, 2300);
});

test('a withdrawal already recorded as income is not counted a second time with negative saving', () => {
    const data = fixture();
    data.incomes.push({ id: 'withdrawal', date: month, owner: 'Ficticio', concept: 'Retirada ficticia', amount: 200 });
    const record = input({ fundSavings: -200, liquiditySavings: 0, entries: [decision(data, 'incomes', 'withdrawal', 'withdrawal')] });
    const result = M.calculate(data, month, record);
    assert.equal(result.income, 3000); assert.equal(result.totalSavings, -200);
    assert.equal(result.totalExpense, 3200, 'not 3400');
    assert(result.warnings.some(text => text.includes('una sola vez')));
});

test('moving existing savings between funds and cash requires no invented new contribution', () => {
    const data = fixture();
    const result = M.calculate(data, month, input({ fundSavings: 0, liquiditySavings: 0 }));
    assert.equal(result.totalSavings, 0); assert.equal(result.totalExpense, 3000);
});

test('negative savings in either destination and rounded money totals are supported', () => {
    assert.equal(M.calculate(fixture(), month, input({ fundSavings: -100, liquiditySavings: -50 })).totalExpense, 3150);
    const data = fixture();
    data.incomes = [{ ...data.incomes[0], amount: 0.1 }, { ...data.incomes[0], id: 'other', amount: 0.2 }];
    data.expenses[0].amount = 0.05;
    const result = M.calculate(data, month, input({ fundSavings: 0.1, liquiditySavings: 0.05 }));
    assert.equal(result.income, 0.3); assert.equal(result.totalSavings, 0.15); assert.equal(result.unitemized, 0.1);
});

test('investment values and revaluations are never used to infer monthly saving', () => {
    const data = fixture(), before = M.calculate(data, month, input());
    data.funds = [{ id: 'unrelated', type: 'Renta Variable' }];
    data.snapshots = [{ date: '2026-10-31', fundsData: { unrelated: { ingreso: 99999, value: 1000000 } } }];
    assert.deepEqual(M.calculate(data, month, input()), before);
});

test('negative estimated or unitemized expense warns without clipping, converting or creating transactions', () => {
    const data = fixture(), original = clone(data);
    const result = M.calculate(data, month, input({ fundSavings: 4000 }));
    assert.equal(result.totalExpense, -1100); assert.equal(result.unitemized, -2900);
    assert(result.warnings.length >= 2); assert.deepEqual(data, original);
});

test('review is effective only for the exact inputs, decisions and monthly source records', () => {
    const data = fixture(), record = M.prepareRecord(data, input(), true);
    assert(M.calculate(data, month, record).reviewed);
    const changedIncome = clone(data); changedIncome.incomes[0].amount++;
    assert.equal(M.calculate(changedIncome, month, record).reviewed, false);
    assert(M.calculate(changedIncome, month, record).needsReview);
    const changedExpense = clone(data); changedExpense.expenses[0].concept = 'Cambio';
    assert.equal(M.calculate(changedExpense, month, record).reviewed, false);
    assert.equal(M.calculate(data, month, { ...record, fundSavings: 401 }).reviewed, false);
    assert(M.calculate(data, month, { ...record, note: 'Nota sin cambio financiero' }).reviewed);
});

test('source array order does not invalidate a review and unrelated months do not affect it', () => {
    const data = fixture(); data.incomes.push({ ...data.incomes[0], id: 'second', amount: 10 });
    const record = M.prepareRecord(data, input(), true);
    data.incomes.reverse(); data.incomes.push({ ...data.incomes[0], id: 'next-month', date: '2026-11', amount: 700 });
    assert(M.calculate(data, month, record).reviewed);
});

test('a changed withdrawal cannot keep its old treatment without re-identification', () => {
    const data = fixture();
    data.incomes.push({ id: 'w', date: month, owner: 'Ficticio', concept: 'Retirada', amount: 200 });
    const record = M.prepareRecord(data, input({ entries: [decision(data, 'incomes', 'w', 'withdrawal')] }), true);
    data.incomes[1].amount = 250;
    const result = M.calculate(data, month, record);
    assert.equal(result.canReview, false); assert.equal(result.reviewed, false);
    assert(result.treatments.find(row => row.row.id === 'w').stale);
    assert.throws(() => M.prepareRecord(data, record, true), /pendientes/);
});

test('deleted source decisions remain recoverable audit metadata but block closing until explicitly discarded', () => {
    const data = fixture(); const record = M.prepareRecord(data, input({ entries: [decision(data, 'expenses', 'bill', 'expense')] }), true);
    data.expenses = [];
    M.validateRecords([record]);
    assert.equal(M.calculate(data, month, record).orphanDecisions.length, 1);
    assert.equal(M.calculate(data, month, record).canReview, false);
});

test('annual totals use only reviewed months with the same coverage and actual month divisor', () => {
    const data = fixture();
    data.incomes.push({ ...data.incomes[0], id: 'nov', date: '2026-11', amount: 4000 });
    data.expenses.push({ ...data.expenses[0], id: 'nov-exp', date: '2026-11', amount: 2000 });
    data.monthlyBalances = [M.prepareRecord(data, input(), true), M.prepareRecord(data, input({ month: '2026-11', fundSavings: 600 }), true), M.prepareRecord(data, input({ month: '2026-12', fundSavings: 0, liquiditySavings: 0 }), false)];
    const year = M.yearSummary(data, '2026');
    assert.equal(year.count, 2); assert.equal(year.pending, 1);
    assert.equal(year.totals.income, 7000); assert.equal(year.totals.expenses, 3800);
    assert.equal(year.totals.totalExpense, 5800); assert.equal(year.averageExpense, 2900);
    assert.equal(year.months[0].totalExpense, null);
    data.incomes[0].amount++;
    assert.equal(M.yearSummary(data, '2026').count, 1);
});

test('no reviewed months means unknown annual totals and average, not zero or division by twelve', () => {
    const year = M.yearSummary(fixture(), '2026');
    assert.equal(year.count, 0); assert.equal(year.averageExpense, null);
    assert(Object.values(year.totals).every(value => value === null));
});

for (const [name, alter] of [
    ['missing month', r => { delete r.month; }], ['invalid month', r => { r.month = '2026-13'; }],
    ['string saving', r => { r.fundSavings = '400'; }], ['null saving', r => { r.liquiditySavings = null; }],
    ['infinite saving', r => { r.fundSavings = Infinity; }], ['NaN saving', r => { r.fundSavings = NaN; }],
    ['extra decimal', r => { r.fundSavings = 0.001; }], ['wrong review type', r => { r.reviewedAgainst = false; }],
    ['missing note', r => { delete r.note; }], ['missing decisions', r => { delete r.entries; }],
    ['wrong income action', r => { r.entries = [{ ...decision(fixture(), 'incomes', 'salary', 'income'), action: 'saving' }]; }],
    ['malformed origin', r => { r.entries = [{ ...decision(fixture(), 'incomes', 'salary', 'income'), source: '{}' }]; }],
    ['wrong month origin', r => { r.month = '2026-11'; r.entries = [decision(fixture(), 'incomes', 'salary', 'income')]; }]
]) test(`rejects ${name} before restoring any data`, () => {
    const data = fixture(), storage = storageFor(data), record = input(); alter(record);
    assert.throws(() => B.restore(storage, { incomes: [], monthlyBalances: [record] }, data));
    assert.deepEqual(storage.writes, []);
});

test('duplicate months and duplicate source decisions reject the whole monthly block', () => {
    assert.throws(() => M.validateRecords([input(), input()]), /duplicado/);
    const entry = decision(fixture(), 'expenses', 'bill', 'expense');
    assert.throws(() => M.validateRecords([input({ entries: [entry, entry] })]), /duplicado/);
});

test('old backups preserve monthly amounts and notes while changed sources reopen review', () => {
    const data = fixture(); data.monthlyBalances = [M.prepareRecord(data, input({ note: 'Conservar nota' }), true)];
    const oldCopy = fixture(); oldCopy.incomes[0].amount = 3100;
    const restored = B.prepareRestore(oldCopy, data);
    assert.deepEqual(restored.data.monthlyBalances, data.monthlyBalances);
    assert.equal(M.calculate(restored.data, month).reviewed, false);
    assert.equal(M.calculate(restored.data, month).totalExpense, 2600);
});

test('new explicit empty monthly block clears balances; old empty four-block copies conserve them', () => {
    const data = savedData(fixture(), M.prepareRecord(fixture(), input(), true));
    assert.deepEqual(B.prepareRestore({ monthlyBalances: [] }, data).data.monthlyBalances, []);
    const oldEmpty = B.prepareRestore(B.emptyDataset(), data).data;
    assert.deepEqual(oldEmpty.monthlyBalances, data.monthlyBalances);
    assert.equal(M.calculate(oldEmpty, month).reviewed, false);
    const newEmpty = { ...B.emptyDataset(), backupVersion: 2, monthlyBalances: [] };
    assert.deepEqual(B.prepareRestore(newEmpty, data).data, { ...B.emptyDataset(), monthlyBalances: [] });
});

test('new backups round-trip the complete monthly block and original sources without mutation', () => {
    const data = fixture(), entry = decision(data, 'expenses', 'bill', 'expense');
    data.monthlyBalances = [M.prepareRecord(data, input({ entries: [entry], note: 'Ficticio' }), true)];
    const copy = clone(data), storage = storageFor(B.emptyDataset());
    B.restore(storage, { ...data, backupVersion: 2 }, B.emptyDataset());
    assert.deepEqual(B.loadDataset(storage), data);
    assert.deepEqual(data, copy);
    assert(M.calculate(B.loadDataset(storage), month).reviewed);
});

test('version 1 loads without migration; balances write version 2 with legacy keys intact', () => {
    const data = fixture(), storage = storageFor(data);
    storage.values.set(B.STORAGE_KEY, JSON.stringify({ storageVersion: 1, data }));
    assert.deepEqual(B.loadDataset(storage), data); assert.deepEqual(storage.writes, []);
    const next = savedData(data, M.prepareRecord(data, input(), false));
    B.saveDataset(storage, next);
    assert.equal(JSON.parse(storage.getItem(B.STORAGE_KEY)).storageVersion, 2);
    assert.deepEqual(B.loadDataset(storage), next);
    B.BLOCKS.forEach(k => assert.equal(storage.getItem(B.LEGACY_KEYS[k]), JSON.stringify(data[k])));
});

test('version metadata rejects unsupported or incomplete formats rather than losing balances', () => {
    assert.throws(() => B.prepareRestore({ backupVersion: 2, incomes: [] }, fixture()), /falta/);
    assert.throws(() => B.prepareRestore({ backupVersion: 3, ...B.emptyDataset() }, fixture()), /versión/);
    const storage = storageFor(fixture());
    storage.values.set(B.STORAGE_KEY, JSON.stringify({ storageVersion: 2, data: fixture() }));
    assert.throws(() => B.loadDataset(storage), /faltan los balances/);
    assert.equal(B.requiredRecoveryBlocks(storage).length, 5);
});

test('a parsed legacy version 1 without balances can still recover from an old complete backup', () => {
    const storage = storageFor(fixture());
    storage.values.set(B.STORAGE_KEY, JSON.stringify({ storageVersion: 1, data: { ...fixture(), incomes: [{}] } }));
    assert.throws(() => B.loadDataset(storage));
    assert.deepEqual(B.requiredRecoveryBlocks(storage), B.BLOCKS);
    B.restore(storage, fixture(), B.emptyDataset());
    assert.deepEqual(B.loadDataset(storage), fixture());
});

test('one storage failure leaves old monthly records and all source/history blocks intact', () => {
    const data = savedData(fixture(), M.prepareRecord(fixture(), input(), true)), storage = storageFor(data);
    B.saveDataset(storage, data); const before = storage.getItem(B.STORAGE_KEY); storage.fail = true;
    assert.throws(() => B.restore(storage, { monthlyBalances: [] }, data));
    assert.equal(storage.getItem(B.STORAGE_KEY), before); assert.deepEqual(B.loadDataset(storage), data);
});

test('prepared manual backups demonstrate the reviewed seven-value example, legacy preservation and invalid/empty restores', () => {
    const prepared = require('./fixtures/13-balance-mensual-ejemplo.json');
    const data = B.prepareRestore(prepared, B.emptyDataset()).data;
    const result = M.calculate(data, month);
    assert(result.reviewed); assert.equal(result.income, 3000); assert.equal(result.expenses, 1800);
    assert.equal(result.totalSavings, 500); assert.equal(result.totalExpense, 2500); assert.equal(result.unitemized, 700);
    const older = require('./fixtures/14-balance-mensual-copia-anterior.json');
    const restored = B.prepareRestore(older, data).data;
    assert.deepEqual(restored.monthlyBalances, data.monthlyBalances);
    assert.equal(M.calculate(restored, month).totalExpense, 2600);
    assert.equal(M.calculate(restored, month).reviewed, false);
    assert.throws(() => B.prepareRestore(require('./fixtures/12-balance-mensual-invalido.json'), data));
    const empty = B.prepareRestore(require('./fixtures/11-balance-mensual-vacio.json'), data).data;
    assert.deepEqual(empty, { ...B.emptyDataset(), monthlyBalances: [] });
});

// Actual form handlers and hook effects, with controlled state. Not a browser test.
function formHarness(initial, saveFails = false) {
    const fs = require('node:fs'), vm = require('node:vm');
    const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
    const parseStart = html.indexOf('        const parseAmount = '), parseEnd = html.indexOf('        const AmountInput = ', parseStart);
    const marker = html.indexOf('        const BalanceMensualTab = '), start = html.indexOf('=> {', marker) + 4;
    const end = html.indexOf('\n            return (\n                <div className="space-y-6', start);
    assert(start > 0 && end > start);
    let data = clone(initial), cursor = 0;
    const slots = [], messages = [], writes = [], effects = [];
    const context = {
        FamilyMonthlyBalance: M, window: { confirm: () => true },
        formatAmount: value => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value),
        useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
        useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
        useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((value, j) => value !== previous[j])) { slots[i] = deps; effects.push(fn); } }
    };
    const expose = 'return {handleSave,changeMonth,changeAction,setFundText,setLiquidityText,setEntries,setReviewed,fundText,liquidityText,entries,reviewed,result,annual,savedNeedsReview,dirty,setView,setReportYear,setEndMonth,view,comparison,chartData};';
    const render = vm.runInNewContext(html.slice(parseStart, parseEnd) + '(function({data,saveBalance,showMessage}){' + html.slice(start, end) + expose + '})', context);
    return { messages, writes, setData(value) { data = clone(value); }, getData: () => data,
        render() { cursor = 0; return render({ data, showMessage: text => messages.push(text), saveBalance(value, reviewed) {
            if (saveFails) return false;
            const record = M.prepareRecord(data, value, reviewed);
            data = { ...data, monthlyBalances: [...(data.monthlyBalances || []).filter(row => row.month !== record.month), record] };
            writes.push(record); return true;
        } }); },
        flushEffects() { while (effects.length) effects.shift()(); }
    };
}
function openMonth(ui) { ui.render(); ui.flushEffects(); ui.render().changeMonth(month); ui.render(); ui.flushEffects(); return ui.render(); }

test('form does not turn empty inputs into zeros or save an incomplete balance', () => {
    const ui = formHarness(fixture()); openMonth(ui);
    ui.render().handleSave({ preventDefault() {} });
    assert.equal(ui.writes.length, 0); assert.equal(ui.render().result.totalExpense, null);
});

test('form saves a reviewed balance only after explicitly treating Ahorro', () => {
    const data = fixture(); data.expenses.push({ id: 'saving', date: month, concept: 'Ahorro', amount: 400 });
    const ui = formHarness(data); openMonth(ui);
    ui.render().setFundText('400,00'); ui.render().setLiquidityText('100,00');
    assert.equal(ui.render().result.canReview, false);
    const item = ui.render().result.treatments.find(item => item.row.id === 'saving');
    ui.render().changeAction(item, 'saving'); ui.render().setReviewed(true);
    ui.render().handleSave({ preventDefault() {} });
    assert.equal(ui.writes.length, 1);
    assert(M.calculate(ui.getData(), month).reviewed);
    assert.equal(M.calculate(ui.getData(), month).expenses, 1800);
    assert.deepEqual(ui.getData().expenses, data.expenses);
});

test('form reads saved values and reopens review on income changes without rewriting saved amounts', () => {
    const data = fixture(); data.monthlyBalances = [M.prepareRecord(data, input(), true)];
    const ui = formHarness(data); openMonth(ui);
    assert.equal(ui.render().fundText, '400,00'); assert.equal(ui.render().reviewed, true);
    const changed = clone(data); changed.incomes[0].amount = 3100; ui.setData(changed);
    ui.render(); ui.flushEffects();
    assert.equal(ui.render().reviewed, false); assert.equal(ui.render().savedNeedsReview, true);
    assert.equal(ui.render().fundText, '400,00'); assert.equal(ui.render().annual.count, 0);
    assert.equal(ui.writes.length, 0);
});

test('form retains unsaved numbers and never announces success if persistence fails', () => {
    const ui = formHarness(fixture(), true); openMonth(ui);
    ui.render().setFundText('-200,00'); ui.render().setLiquidityText('0,00');
    ui.render().handleSave({ preventDefault() {} });
    assert.equal(ui.render().fundText, '-200,00'); assert.equal(ui.render().liquidityText, '0,00');
    assert.equal(ui.writes.length, 0); assert.equal(ui.messages.length, 0);
});

function reportingFixture() {
    const data = { ...B.emptyDataset(), monthlyBalances: [] };
    function add(month, income, savings, reviewed = true, save = true) {
        data.incomes.push({ id: `income-${month}`, date: month, owner: 'Persona ficticia', concept: 'Ingreso ficticio', amount: income });
        data.expenses.push({ id: `expense-${month}`, date: month, concept: 'Gasto ficticio', amount: 1000 });
        if (save) data.monthlyBalances.push(M.prepareRecord(data, input({ month, fundSavings: savings, liquiditySavings: 0 }), reviewed));
    }
    for (const year of [2024, 2025]) for (let i = 1; i <= 12; i++) add(`${year}-${String(i).padStart(2, '0')}`, 2000, year === 2024 ? 200 : 400);
    add('2026-01', 3000, 500); add('2026-02', 1000, -100, false); add('2026-03', 1500, 0, false, false);
    return data;
}

test('YTD includes only reviewed months through the selected final month with explicit coverage', () => {
    const data = reportingFixture(), before = clone(data), summary = M.periodSummary(data, 2026, 4);
    assert.equal(summary.count, 1); assert.equal(summary.pending, 2); assert.equal(summary.missing, 1);
    assert.equal(summary.expected, 4); assert.equal(summary.complete, false);
    assert.equal(summary.totals.income, 3000); assert.equal(summary.totals.totalExpense, 2500);
    assert.equal(summary.averageExpense, 2500); assert.equal(summary.savingsRate, 16.67);
    assert.deepEqual(data, before);
    assert.equal(M.periodSummary(data, 2026, 1).complete, true);
});

test('saving percentage uses the ratio of totals, not the mean of monthly percentages', () => {
    const data = reportingFixture();
    const feb = data.monthlyBalances.find(row => row.month === '2026-02');
    Object.assign(feb, M.prepareRecord(data, feb, true));
    const summary = M.periodSummary(data, 2026, 2);
    assert.equal(summary.savingsRate, 10); // (500 - 100) / (3000 + 1000)
    assert.equal(summary.count, 2); assert(summary.complete);
    assert.equal(summary.totals.totalSavings, 400); assert.equal(summary.totals.totalExpense, 3600);
    assert.equal(summary.averageExpense, 1800);
});

test('percentages preserve negatives, distinguish real zero and do not divide by nonpositive or missing income', () => {
    assert.equal(M.savingsRate(-200, 1000), -20); assert.equal(M.savingsRate(0, 1000), 0);
    for (const income of [null, 0, -100]) assert.equal(M.savingsRate(200, income), null);
    assert.equal(M.savingsRate(null, 1000), null);
    assert.equal(M.savingsRate(90000000000000, 0.01), null);
});

test('empty and source-only periods never invent savings zeros or complete totals', () => {
    const data = reportingFixture(), empty = M.periodSummary(data, 2023, 6);
    assert.equal(empty.count, 0); assert.equal(empty.pending, 0); assert.equal(empty.missing, 6);
    assert.equal(empty.complete, false); assert.equal(empty.savingsRate, null); assert.equal(empty.averageExpense, null);
    assert(Object.values(empty.totals).every(value => value === null));
    assert.equal(M.monthStatus(M.calculate(data, '2026-03')), 'pending');
    assert.equal(M.calculate(data, '2026-03').totalSavings, null);
    assert.equal(M.monthStatus(M.calculate(data, '2026-04')), 'missing');
});

test('complete annual comparison requires both years and reports selected minus previous differences', () => {
    const rows = M.compareYears(reportingFixture(), 2025);
    assert.deepEqual(rows.map(row => row.year), ['2025', '2024']);
    assert.equal(rows[0].comparable, false); assert.equal(rows[0].expenseDifference, null);
    assert.equal(rows[1].comparable, true); assert.equal(rows[1].count, 12);
    assert.equal(rows[1].expenseDifference, -2400); assert.equal(rows[1].savingsDifference, 2400);
    assert.equal(rows[0].savingsRate, 20); assert.equal(rows[1].savingsRate, 10);
});

test('incomplete or invalidated years suppress comparisons instead of extrapolating or matching different months', () => {
    const data = reportingFixture();
    assert(M.compareYears(data, 2026).every(row => !row.comparable && row.expenseDifference === null));
    data.incomes.find(row => row.date === '2024-01').amount += 1;
    const prior = M.compareYears(data, 2025).find(row => row.year === '2024');
    assert.equal(prior.count, 11); assert.equal(prior.pending, 1); assert.equal(prior.complete, false);
    assert.equal(prior.comparable, false); assert.equal(prior.savingsDifference, null);
});

test('report selectors reject invalid final months and years', () => {
    for (const end of [0, 13, 1.5, '2', null]) assert.throws(() => M.periodSummary(fixture(), 2026, end));
    for (const year of ['26', 'invalid', 2026.5]) assert.throws(() => M.periodSummary(fixture(), year));
});

test('the single manual reporting fixture restores without changing its monthly records', () => {
    const source = require('./fixtures/15-balance-vistas.json');
    const restored = B.prepareRestore(source, B.emptyDataset()).data;
    assert.deepEqual(restored, reportingFixtureWithNotes());
    function reportingFixtureWithNotes() {
        const data = reportingFixture();
        data.monthlyBalances.forEach(row => { row.note = 'Ejemplo ficticio para validar vistas'; });
        return data;
    }
    assert.equal(M.periodSummary(restored, 2026, 4).count, 1);
    assert.equal(M.compareYears(restored, 2025)[1].expenseDifference, -2400);
});

test('changing report views and years keeps monthly drafts without creating or saving records', () => {
    const ui = formHarness(reportingFixture()); openMonth(ui);
    ui.render().setFundText('-200,00'); ui.render().setLiquidityText('50,00');
    ui.render().setView('ytd'); ui.render().setReportYear('2026'); ui.render().setEndMonth(4);
    assert.equal(ui.render().annual.expected, 4); assert.equal(ui.render().annual.count, 1);
    ui.render().setView('annual'); ui.render().setReportYear('2025');
    assert.equal(ui.render().annual.count, 12); assert.equal(ui.render().comparison[1].comparable, true);
    ui.render().setView('monthly');
    assert.equal(ui.render().fundText, '-200,00'); assert.equal(ui.render().liquidityText, '50,00');
    assert.equal(ui.writes.length, 0);
});

test('report graphs leave missing months null and distinguish reviewed and pending savings and spending', () => {
    const ui = formHarness(reportingFixture()); openMonth(ui);
    ui.render().setView('ytd'); ui.render().setReportYear('2026'); ui.render().setEndMonth(4);
    const chart = ui.render().chartData;
    assert.equal(chart.labels.length, 4);
    assert.deepEqual(Array.from(chart.datasets[0].data), [2500, null, null, null]);
    assert.deepEqual(Array.from(chart.datasets[1].data), [null, 1100, null, null]);
    assert.deepEqual(Array.from(chart.datasets[3].data), [500, null, null, null]);
    assert.deepEqual(Array.from(chart.datasets[4].data), [null, -100, null, null]);
});
