const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Backup = require('../backup.js');
const MonthlyBalance = require('../monthly-balance.js');

// All names, amounts and histories in this suite are invented fixtures.
const fixture = () => ({
    incomes: [{ id: 'i1', date: '2026-01', owner: 'Persona ficticia', concept: 'Nómina', amount: 100 }],
    expenses: [{ id: 'e1', date: '2026-01', concept: 'Compra ficticia', amount: 20 }],
    funds: [{ id: 'f1', name: 'Fondo ficticio', type: 'Renta Variable', gestora: 'Entidad ficticia', start: '2025-01-01', isin: 'N/A' }],
    snapshots: [{ id: 's1', date: '2026-01-31', liquidity: 50, fundsData: { f1: { ingreso: 100, value: 120 } } }]
});
const clone = value => JSON.parse(JSON.stringify(value));
function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        values, writes: [], failRead: false, failWrite: false,
        getItem(key) { if (this.failRead) throw new Error('Access denied'); return values.has(key) ? values.get(key) : null; },
        setItem(key, value) {
            if (this.failWrite) throw Object.assign(new Error('Storage quota'), { name: 'QuotaExceededError' });
            this.writes.push(key); values.set(key, value);
        }
    };
}
const legacyStorage = data => memoryStorage(Object.fromEntries(Backup.BLOCKS.map(k => [Backup.LEGACY_KEYS[k], JSON.stringify(data[k])])));

test('empty backup clears every block, including old photographs, and survives reload', () => {
    const current = fixture(), storage = legacyStorage(current);
    const restored = Backup.restore(storage, JSON.stringify(Backup.emptyDataset()), current);
    assert.deepEqual(restored.data, Backup.emptyDataset());
    assert.deepEqual(Backup.loadDataset(storage), Backup.emptyDataset());
    assert.equal(storage.writes.length, 1);
    for (const k of Backup.BLOCKS) assert.equal(storage.getItem(Backup.LEGACY_KEYS[k]), JSON.stringify(current[k]));
});

test('present empty snapshots clears history; absent blocks retain their exact contents', () => {
    const current = fixture();
    const next = Backup.prepareRestore({ snapshots: [] }, current);
    assert.deepEqual(next.data, { ...current, snapshots: [] });
    assert.deepEqual(next.replaced, ['snapshots']);
    assert.deepEqual(current, fixture());
});

test('empty explicit legacy history also replaces snapshots', () => {
    assert.deepEqual(Backup.prepareRestore({ tabla2EvolucionPatrimonial: [] }, fixture()).data.snapshots, []);
});

test('valid old four-block backup round-trips unchanged, including history', () => {
    const data = fixture(), storage = legacyStorage(Backup.emptyDataset());
    assert.deepEqual(Backup.restore(storage, JSON.stringify(data), Backup.emptyDataset()).data, data);
    assert.deepEqual(Backup.loadDataset(storage), data);
});

test('old explicit summary export retains detailed snapshots and explicit historical values', () => {
    const data = fixture();
    data.tabla2EvolucionPatrimonial = [{ date: '2026-01-31', ingresoTotal: 100, rf: 0, rv: 120, cartera: 120, patrimonio: 170, diffCartera: null }];
    assert.deepEqual(Backup.prepareRestore(data, Backup.emptyDataset()).data, fixture());
    const summary = { snapshots: [{ id: 'manual', date: '2026-01-01', liquidity: null, summaryOnly: true,
        table2: { ingresoTotal: null, rf: 1, rv: 2, cartera: 3, patrimonio: null, diffCarteraPct: -12.5 } }] };
    assert.deepEqual(Backup.prepareRestore(summary, Backup.emptyDataset()).data.snapshots, summary.snapshots);
});

test('legacy summary-only and summary.ing formats remain supported without rewriting values', () => {
    const data = { snapshots: [{ id: 1, date: '2024-02-29', summary: { ing: 100, cartera: 120, patrimonio: 170 } }] };
    assert.deepEqual(Backup.prepareRestore(data, Backup.emptyDataset()).data.snapshots, data.snapshots);
    const rows = [{ date: '2026-01-31', ingresoTotal: 100, rf: 0, rv: 120, cartera: 120, patrimonio: 170 }];
    const result = Backup.prepareRestore({ tabla2EvolucionPatrimonial: rows }, Backup.emptyDataset());
    assert.equal(result.data.snapshots[0].liquidity, 50);
    assert.equal(result.data.snapshots[0].table2.cartera, 120);
});

const invalidCases = [
    ['incomplete income', d => { d.incomes = [{}]; }],
    ['incomplete expense', d => { delete d.expenses[0].amount; }],
    ['incomplete fund', d => { delete d.funds[0].type; }],
    ['incomplete photograph', d => { delete d.snapshots[0].liquidity; }],
    ['incomplete fund values', d => { delete d.snapshots[0].fundsData.f1.value; }],
    ['string amount', d => { d.incomes[0].amount = '100'; }],
    ['null amount', d => { d.expenses[0].amount = null; }],
    ['infinite parsed amount', d => { d.incomes[0].amount = Infinity; }],
    ['NaN amount', d => { d.incomes[0].amount = NaN; }],
    ['non-list block', d => { d.expenses = {}; }],
    ['null block', d => { d.incomes = null; }],
    ['invalid month', d => { d.incomes[0].date = '2026-13'; }],
    ['nonexistent date', d => { d.snapshots[0].date = '2026-02-30'; }],
    ['wrong fund date', d => { d.funds[0].start = '2026-01'; }],
    ['duplicate id', d => { d.incomes.push(clone(d.incomes[0])); }],
    ['duplicate snapshot date', d => { d.snapshots.push({ ...clone(d.snapshots[0]), id: 'other' }); }],
    ['missing fund reference', d => { d.funds = []; }],
    ['invalid manual amount', d => { d.snapshots[0].table2 = { cartera: '120' }; }],
    ['empty manual summary', d => { d.snapshots[0].table2 = {}; }],
    ['manual photograph without summary', d => { d.snapshots[0].summaryOnly = true; }],
    ['invalid summary amount', d => { d.snapshots[0].summary = { ing: '100' }; }],
    ['invalid summary flag', d => { d.snapshots[0].summaryOnly = 'true'; }],
    ['reserved concept', d => { d.expenses[0].concept = '__proto__'; }],
    ['late invalid history row', d => { d.tabla2EvolucionPatrimonial = [null]; }],
    ['explicit history missing all financial fields', d => { d.tabla2EvolucionPatrimonial = [{ date: '2026-01-31' }]; }],
    ['duplicate explicit dates', d => { d.tabla2EvolucionPatrimonial = [{ date: '2026-01-31', cartera: null }, { date: '2026-01-31', cartera: null }]; }]
];
for (const [name, invalidate] of invalidCases) test(`rejects ${name} without any write or mutation`, () => {
    const current = fixture(), input = fixture(), storage = legacyStorage(current);
    invalidate(input);
    const original = structuredClone(input), before = Backup.readStorageSnapshot(storage);
    assert.throws(() => Backup.restore(storage, input, current));
    assert.deepEqual(input, original);
    assert.deepEqual(current, fixture());
    assert.deepEqual(Backup.readStorageSnapshot(storage), before);
    assert.deepEqual(storage.writes, []);
});

for (const input of ['{', 'null', '[]', '{}', '{"other":[]}', '{"incomes":[{"id":"x","date":"2026-01","owner":"Ficticio","concept":"Prueba","amount":1e400}]}']) {
    test(`rejects malformed/unrecognized JSON fixture ${input.slice(0, 24)}`, () => {
        const storage = legacyStorage(fixture());
        assert.throws(() => Backup.restore(storage, input, fixture()));
        assert.deepEqual(storage.writes, []);
    });
}

test('partial fund replacement cannot leave preserved photographs with broken references', () => {
    assert.throws(() => Backup.prepareRestore({ funds: [] }, fixture()), /referencia/);
});

test('unknown asset categories, negative values, zero and optional metadata are preserved', () => {
    const data = fixture();
    data.funds[0].type = 'Categoría histórica sin reinterpretar';
    data.incomes[0].amount = -2.34;
    data.expenses[0].amount = 0;
    data.snapshots[0].annotation = 'Registro ficticio';
    assert.deepEqual(Backup.prepareRestore(data, Backup.emptyDataset()).data, data);
});

test('one atomic storage failure preserves all legacy values and committed dataset', () => {
    const current = fixture(), storage = legacyStorage(current);
    Backup.saveDataset(storage, current);
    const before = Backup.readStorageSnapshot(storage);
    storage.failWrite = true;
    assert.throws(() => Backup.restore(storage, Backup.emptyDataset(), current), /quota/);
    assert.deepEqual(Backup.readStorageSnapshot(storage), before);
    assert.deepEqual(Backup.loadDataset(storage), current);
});

test('legacy reads never migrate, rewrite or repair data on startup', () => {
    const current = fixture(), storage = legacyStorage(current);
    assert.deepEqual(Backup.loadDataset(storage), current);
    assert.deepEqual(storage.writes, []);
    current.funds = []; // Represents the old application's deletion bug; do not repair it on read.
    assert.deepEqual(Backup.loadDataset(legacyStorage(current)), current);
});

test('corrupt or inaccessible storage throws instead of silently overwriting with empty data', () => {
    const storage = memoryStorage({ [Backup.LEGACY_KEYS.incomes]: '{' });
    assert.throws(() => Backup.loadDataset(storage));
    storage.failRead = true;
    assert.throws(() => Backup.loadDataset(storage), /denied/);
    assert.deepEqual(storage.writes, []);
});

test('does not ignore an unsupported consolidated storage format', () => {
    assert.throws(() => Backup.loadDataset(memoryStorage({ [Backup.STORAGE_KEY]: '{"storageVersion":999}' })), /formato/);
});

test('detects concurrent storage changes during confirmation and preserves the newer contents', () => {
    const current = fixture(), storage = legacyStorage(current), expected = Backup.readStorageSnapshot(storage);
    const newer = { ...current, incomes: [] };
    Backup.saveDataset(storage, newer);
    assert.throws(() => Backup.restore(storage, Backup.emptyDataset(), current, expected), /han cambiado/);
    assert.deepEqual(Backup.loadDataset(storage), newer);
});

// Exercise the actual application's event handlers without pretending this is a
// browser/visual test. Hooks and file/download APIs below are controlled fixtures.
function appHarness(storage, fileFailure = false, downloadFailure = false, deferredReads = false) {
    const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
    const start = html.indexOf('        const App = () => {') + '        const App = () => {'.length;
    const end = html.indexOf('\n            return (\n                <div className="min-h-screen', start);
    assert(end > start);
    const slots = [], downloads = [], reads = [];
    let cursor = 0;
    const context = {
        FamilyBackup: Backup, FamilyMonthlyBalance: MonthlyBalance, window: { localStorage: storage },
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
            return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
        },
        useRef(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = { current: initial };
            return slots[index];
        },
        useEffect() {},
        generateId: () => 'fixture-generated',
        FileReader: class { readAsText(file) { const finish = () => { if (fileFailure) this.onerror(); else this.onload({ target: { result: file.text } }); }; if (deferredReads) reads.push(finish); else finish(); } },
        Blob,
        URL: { createObjectURL(blob) { if (downloadFailure) throw new Error('Download unavailable'); downloads.push(blob); return 'blob:fixture'; }, revokeObjectURL() {} },
        document: { body: { appendChild() {} }, createElement: () => ({ click() {}, remove() {} }) },
        setTimeout() {},
    };
    const expose = 'return { handleImport, confirmImport, downloadCurrentBackup, saveMonthlyBalance, addIncome, deleteSnapshot, beginRecovery, cancelRecovery, handleRecoverySource, confirmRecovery, setOriginalRecordConfirmed, pendingRecovery, setSkipBackup, setBackupConfirmed, pendingImport, notification, storageError, recoveryMode, getData: () => dataRef.current };';
    const renderApp = vm.runInNewContext('(function () {' + html.slice(start, end) + expose + '})', context);
    return { render() { cursor = 0; return renderApp(); }, downloads, finishRead() { assert(reads.length); reads.shift()(); } };
}
const choose = (app, data) => app.handleImport({ target: { files: [{ text: typeof data === 'string' ? data : JSON.stringify(data) }], value: 'fixture' } });

test('UI handlers require a deliberate backup choice; download alone does not restore', async () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage);
    choose(ui.render(), Backup.emptyDataset());
    let app = ui.render();
    assert(app.pendingImport);
    app.confirmImport();
    assert.deepEqual(storage.writes, []);
    app.downloadCurrentBackup();
    app = ui.render();
    app.confirmImport();
    assert.deepEqual(storage.writes, []);
    const exported = JSON.parse(await ui.downloads[0].text());
    assert.deepEqual(Backup.prepareRestore(exported, Backup.emptyDataset()).data, { ...fixture(), monthlyBalances: [] });
    app.setBackupConfirmed(true);
    ui.render().confirmImport();
    assert.deepEqual(Backup.loadDataset(storage), Backup.emptyDataset());
    assert.match(ui.render().notification, /guardados correctamente/);
});

test('UI restore storage failure preserves memory and persisted data, with a visible error', () => {
    const current = fixture(), storage = legacyStorage(current), ui = appHarness(storage);
    choose(ui.render(), Backup.emptyDataset());
    ui.render().setSkipBackup(true);
    storage.failWrite = true;
    ui.render().confirmImport();
    const app = ui.render();
    assert.deepEqual(app.getData(), current);
    assert.deepEqual(Backup.loadDataset(storage), current);
    assert.match(app.storageError, /No se ha restaurado ningún dato/);
    assert.doesNotMatch(app.notification, /correctamente/);
});

test('failed backup download cannot enable restore through the backup confirmation alone', () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage, false, true);
    choose(ui.render(), Backup.emptyDataset());
    assert.equal(ui.render().downloadCurrentBackup(), false);
    ui.render().setBackupConfirmed(true);
    ui.render().confirmImport();
    assert.deepEqual(storage.writes, []);
    assert.deepEqual(ui.render().getData(), fixture());
    assert.match(ui.render().notification, /No se pudo preparar la descarga/);
});

test('storage becoming inaccessible before confirmation leaves memory unchanged', () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage);
    choose(ui.render(), Backup.emptyDataset());
    ui.render().setSkipBackup(true);
    storage.failRead = true;
    ui.render().confirmImport();
    assert.deepEqual(ui.render().getData(), fixture());
    assert.deepEqual(storage.writes, []);
    assert.match(ui.render().storageError, /No se ha restaurado ningún dato/);
});

test('UI successful restore changes all blocks only after persistence, including empty snapshots', () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage);
    choose(ui.render(), Backup.emptyDataset());
    assert.deepEqual(ui.render().getData(), fixture());
    ui.render().setSkipBackup(true);
    ui.render().confirmImport();
    assert.deepEqual(ui.render().getData(), Backup.emptyDataset());
    assert.deepEqual(Backup.loadDataset(storage), Backup.emptyDataset());
    assert.equal(ui.render().pendingImport, null);
});

test('UI invalid import does not leave partial memory or storage updates', () => {
    const current = fixture(), storage = legacyStorage(current), ui = appHarness(storage);
    choose(ui.render(), { incomes: [], tabla2EvolucionPatrimonial: [null] });
    const app = ui.render();
    assert.equal(app.pendingImport, null);
    assert.deepEqual(app.getData(), current);
    assert.deepEqual(storage.writes, []);
    assert.match(app.notification, /No se ha importado ningún dato/);
});

test('UI file-read failure leaves all data unchanged', () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage, true);
    choose(ui.render(), Backup.emptyDataset());
    assert.equal(ui.render().pendingImport, null);
    assert.match(ui.render().notification, /No se pudo leer/);
    assert.deepEqual(storage.writes, []);
});

test('a failed restore can be retried after storage is available, without losing the pending copy', () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage);
    choose(ui.render(), Backup.emptyDataset());
    ui.render().setSkipBackup(true);
    storage.failWrite = true;
    ui.render().confirmImport();
    assert(ui.render().pendingImport);
    storage.failWrite = false;
    ui.render().confirmImport();
    assert.deepEqual(Backup.loadDataset(storage), Backup.emptyDataset());
    assert.equal(ui.render().storageError, '');
});

test('new ordinary edits persist to the consolidated record and survive reload', () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage);
    const income = { ...fixture().incomes[0], id: 'new' };
    assert.equal(ui.render().addIncome(income), true);
    assert.equal(Backup.loadDataset(storage).incomes.length, 2);
    assert.equal(ui.render().getData().incomes.length, 2);
});

test('ordinary writes also report storage failure without applying or claiming the change', () => {
    const current = fixture(), storage = legacyStorage(current), ui = appHarness(storage);
    storage.failWrite = true;
    assert.equal(ui.render().addIncome({ ...current.incomes[0], id: 'new' }), false);
    assert.deepEqual(ui.render().getData(), current);
    assert.match(ui.render().storageError, /el cambio no se ha aplicado/);
});

test('export preserves existing orphan history but warns it is not a validated restorable copy', async () => {
    const current = fixture();
    current.funds = [];
    const storage = legacyStorage(current), ui = appHarness(storage);
    assert.equal(ui.render().downloadCurrentBackup(), true);
    const exported = JSON.parse(await ui.downloads[0].text());
    assert.deepEqual(exported.snapshots, current.snapshots);
    assert.match(ui.render().storageError, /necesitará revisión/);
    assert.deepEqual(storage.writes, []);
});

test('recovery mode preserves corrupt original bytes and exposes a raw recovery download', async () => {
    const storage = memoryStorage({ [Backup.LEGACY_KEYS.incomes]: '{broken fictitious JSON' });
    const ui = appHarness(storage);
    assert.equal(ui.render().recoveryMode, true);
    assert.equal(ui.render().addIncome(fixture().incomes[0]), false);
    ui.render().downloadCurrentBackup();
    const raw = JSON.parse(await ui.downloads[0].text());
    assert.equal(raw.rawStorage[Backup.LEGACY_KEYS.incomes], '{broken fictitious JSON');
    assert.deepEqual(storage.writes, []);
});

test('recovery mode rejects partial restores instead of treating unreadable blocks as empty', () => {
    const storage = memoryStorage({ [Backup.LEGACY_KEYS.incomes]: '{broken fictitious JSON' });
    const ui = appHarness(storage);
    choose(ui.render(), { incomes: [] });
    assert.equal(ui.render().pendingImport, null);
    assert.match(ui.render().notification, /copia completa/);
    assert.deepEqual(storage.writes, []);
});

test('a complete valid backup can recover unreadable storage without deleting original legacy bytes', () => {
    const storage = memoryStorage({ [Backup.LEGACY_KEYS.incomes]: '{broken fictitious JSON' });
    const ui = appHarness(storage);
    choose(ui.render(), fixture());
    ui.render().setSkipBackup(true);
    ui.render().confirmImport();
    assert.equal(ui.render().recoveryMode, false);
    assert.deepEqual(Backup.loadDataset(storage), fixture());
    assert.equal(storage.getItem(Backup.LEGACY_KEYS.incomes), '{broken fictitious JSON');
});

// These checks model the old four-key storage contract, not a running old UI.
// The actual old import/export functions are also inspected separately before
// publishing the manual validation report; browser validation stays pending.
const manualFixture = require('./fixtures/01-valida.json');
const legacyRead = storage => Object.fromEntries(Backup.BLOCKS.map(k => [k, JSON.parse(storage.getItem(Backup.LEGACY_KEYS[k]) || '[]')]));

test('manual valid fixture has the documented balances and no synthesized historical changes', () => {
    const data = Backup.prepareRestore(manualFixture, Backup.emptyDataset()).data;
    assert.equal(data.incomes.reduce((sum, r) => sum + r.amount, 0), 100);
    assert.equal(data.expenses.reduce((sum, r) => sum + r.amount, 0), 20);
    assert.equal(data.snapshots[0].fundsData['fondo-prueba'].value, 120);
    assert.equal(data.snapshots[0].liquidity, 50);
    assert.deepEqual(data, manualFixture);
});

test('new saves do not change what the old four-key reader sees', () => {
    const original = clone(manualFixture), storage = legacyStorage(original);
    const next = clone(original);
    next.incomes.push({ ...next.incomes[0], id: 'nueva-7', amount: 7 });
    Backup.saveDataset(storage, next);
    assert.equal(Backup.loadDataset(storage).incomes.reduce((s, r) => s + r.amount, 0), 107);
    assert.deepEqual(legacyRead(storage), original);
});

test('legacy edits do not replace newer consolidated data without explicit JSON restore', () => {
    const original = clone(manualFixture), storage = legacyStorage(original);
    const next = clone(original);
    next.incomes.push({ ...next.incomes[0], id: 'nueva-7', amount: 7 });
    Backup.saveDataset(storage, next);
    const oldEdit = clone(original);
    oldEdit.incomes.push({ ...oldEdit.incomes[0], id: 'anterior-9', amount: 9 });
    storage.setItem(Backup.LEGACY_KEYS.incomes, JSON.stringify(oldEdit.incomes));
    assert.equal(legacyRead(storage).incomes.reduce((s, r) => s + r.amount, 0), 109);
    assert.equal(Backup.loadDataset(storage).incomes.reduce((s, r) => s + r.amount, 0), 107);
    Backup.restore(storage, JSON.stringify(oldEdit), next);
    assert.equal(Backup.loadDataset(storage).incomes.reduce((s, r) => s + r.amount, 0), 109);
});

test('valid new JSON remains readable through the old four-key storage contract when explicitly transferred', () => {
    const original = clone(manualFixture), storage = legacyStorage(original), ui = appHarness(storage);
    const income = { ...original.incomes[0], id: 'nueva-7', amount: 7 };
    ui.render().addIncome(income);
    const updated = Backup.loadDataset(storage);
    // The old version only changes its own four keys when an export is imported.
    Backup.BLOCKS.forEach(k => storage.setItem(Backup.LEGACY_KEYS[k], JSON.stringify(updated[k])));
    assert.deepEqual(legacyRead(storage), updated);
});

test('manual empty and photographs-only fixtures clear exactly the intended blocks', () => {
    const empty = require('./fixtures/02-vacia.json');
    const partial = require('./fixtures/06-fotografias-vacias.json');
    assert.deepEqual(Backup.prepareRestore(empty, manualFixture).data, Backup.emptyDataset());
    assert.deepEqual(Backup.prepareRestore(partial, manualFixture).data, { ...manualFixture, snapshots: [] });
});

for (const name of ['03-invalida-parcial.json', '04-importe-invalido.json', '05-fondo-eliminado.json']) {
    test(`manual fixture ${name} is rejected without changing the starting 100-euro income`, () => {
        const input = require('./fixtures/' + name), storage = legacyStorage(manualFixture);
        assert.throws(() => Backup.restore(storage, input, manualFixture));
        assert.deepEqual(Backup.loadDataset(storage), manualFixture);
        assert.deepEqual(storage.writes, []);
    });
}

test('an existing orphan snapshot is preserved on export; import of that export is rejected without data changes', async () => {
    const original = clone(manualFixture);
    original.funds = [];
    const storage = legacyStorage(original), ui = appHarness(storage);
    assert.equal(ui.render().downloadCurrentBackup(), true);
    const exported = JSON.parse(await ui.downloads[0].text());
    assert.deepEqual(exported.snapshots, original.snapshots);
    assert.equal(exported.snapshots[0].fundsData['fondo-prueba'].value, 120);
    assert.equal(Object.hasOwn(exported, 'tabla2EvolucionPatrimonial'), false, 'No publicar resúmenes derivados incompletos como si fueran totales válidos');
    assert.match(ui.render().storageError, /necesitará revisión/);
    assert.throws(() => Backup.restore(storage, exported, original), /referencia/);
    assert.deepEqual(Backup.loadDataset(storage), original);
    assert.deepEqual(storage.writes, []);
});

test('a newly created fund with the same name cannot silently replace a deleted historical id', () => {
    const data = clone(manualFixture);
    data.funds[0].id = 'identificador-nuevo';
    assert.throws(() => Backup.prepareRestore(data, Backup.emptyDataset()), /referencia/);
});

const selectRecoverySource = (app, data) => app.handleRecoverySource({ target: { files: [{ text: JSON.stringify(data) }], value: 'fixture' } });

test('an orphan import is staged without changing anything and requires source, original-record and backup confirmations', () => {
    const current = fixture(), target = clone(current); target.funds = []; target.incomes[0].amount = 999;
    const storage = legacyStorage(current), ui = appHarness(storage);
    choose(ui.render(), target);
    assert.equal(ui.render().pendingRecovery.kind, 'import');
    assert.deepEqual(ui.render().getData(), current);
    selectRecoverySource(ui.render(), current);
    assert(ui.render().pendingRecovery.prepared);
    ui.render().confirmRecovery();
    assert.deepEqual(storage.writes, []);
    ui.render().setOriginalRecordConfirmed(true);
    ui.render().confirmRecovery();
    assert.deepEqual(storage.writes, []);
    ui.render().setSkipBackup(true);
    ui.render().confirmRecovery();
    const expected = { ...target, funds: current.funds };
    assert.deepEqual(Backup.loadDataset(storage), expected);
    assert.deepEqual(ui.render().getData(), expected);
    assert.equal(ui.render().pendingRecovery, null);
    assert.equal(storage.writes.length, 1);
});

test('recovery of existing stored history changes the catalogue only', () => {
    const original = fixture(), target = clone(original); target.funds = [];
    const storage = legacyStorage(target), ui = appHarness(storage);
    ui.render().beginRecovery(ui.render().getData());
    selectRecoverySource(ui.render(), original);
    ui.render().setOriginalRecordConfirmed(true);
    ui.render().setSkipBackup(true);
    ui.render().confirmRecovery();
    assert.deepEqual(Backup.loadDataset(storage), original);
    assert.deepEqual(ui.render().getData().snapshots, target.snapshots);
});

test('recovery storage failure preserves current memory and persisted history and permits retry', () => {
    const original = fixture(), target = clone(original); target.funds = [];
    const storage = legacyStorage(target), ui = appHarness(storage);
    ui.render().beginRecovery(ui.render().getData());
    selectRecoverySource(ui.render(), original);
    ui.render().setOriginalRecordConfirmed(true);
    ui.render().setSkipBackup(true);
    storage.failWrite = true;
    ui.render().confirmRecovery();
    assert.deepEqual(ui.render().getData(), target);
    assert.deepEqual(Backup.loadDataset(storage), target);
    assert.match(ui.render().pendingRecovery.error, /No se ha guardado ningún cambio/);
    storage.failWrite = false;
    ui.render().confirmRecovery();
    assert.deepEqual(Backup.loadDataset(storage), original);
});

test('concurrent changes block recovery rather than overwriting another session', () => {
    const original = fixture(), target = clone(original); target.funds = [];
    const storage = legacyStorage(target), ui = appHarness(storage);
    ui.render().beginRecovery(ui.render().getData());
    selectRecoverySource(ui.render(), original);
    ui.render().setOriginalRecordConfirmed(true);
    ui.render().setSkipBackup(true);
    Backup.saveDataset(storage, original);
    ui.render().confirmRecovery();
    assert.match(ui.render().pendingRecovery.error, /almacenamiento ha cambiado/);
    assert.deepEqual(ui.render().getData(), target);
    assert.deepEqual(Backup.loadDataset(storage), original);
});

test('missing or conflicting donor files cannot produce a confirmable recovery', () => {
    const original = fixture(), target = clone(original); target.funds = [];
    const storage = legacyStorage(target), ui = appHarness(storage);
    ui.render().beginRecovery(ui.render().getData());
    selectRecoverySource(ui.render(), Backup.emptyDataset());
    assert.equal(ui.render().pendingRecovery.prepared, null);
    assert.match(ui.render().pendingRecovery.error, /registros originales/);
    const conflicting = clone(original); conflicting.snapshots[0].fundsData.f1.value = 121;
    selectRecoverySource(ui.render(), conflicting);
    assert.equal(ui.render().pendingRecovery.prepared, null);
    assert.match(ui.render().pendingRecovery.error, /discrepan/);
    assert.deepEqual(storage.writes, []);
});

test('cancelled source reads cannot reopen recovery or apply stale results', () => {
    const original = fixture(), target = clone(original); target.funds = [];
    const storage = legacyStorage(target), ui = appHarness(storage, false, false, true);
    ui.render().beginRecovery(ui.render().getData());
    selectRecoverySource(ui.render(), original);
    ui.render().cancelRecovery();
    ui.finishRead();
    assert.equal(ui.render().pendingRecovery, null);
    assert.deepEqual(ui.render().getData(), target);
    assert.deepEqual(storage.writes, []);
});

test('a recovery source read failure preserves the pending target and all stored data', () => {
    const original = fixture(), target = clone(original); target.funds = [];
    const storage = legacyStorage(target), ui = appHarness(storage, true);
    ui.render().beginRecovery(ui.render().getData());
    selectRecoverySource(ui.render(), original);
    assert.equal(ui.render().pendingRecovery.prepared, null);
    assert.match(ui.render().pendingRecovery.error, /No se pudo leer/);
    assert.deepEqual(ui.render().getData(), target);
    assert.deepEqual(storage.writes, []);
});

test('deleting the last zero observation cannot leave a formerly archived fund with a nonzero last value', () => {
    const data = Backup.setFundArchived(clone(require('./fixtures/07-valor-cero.json')), 'fondo-prueba', true);
    const storage = legacyStorage(data), ui = appHarness(storage);
    assert.equal(ui.render().deleteSnapshot('foto-cero'), false);
    assert.deepEqual(ui.render().getData(), data);
    assert.deepEqual(storage.writes, []);
    assert.match(ui.render().storageError, /archivado sin último valor cero/);
});

test('export and restore of explicit all-zero archived observations does not replace them with synthesized summaries', async () => {
    const data = fixture();
    data.funds[0].archived = true;
    data.snapshots[0].fundsData.f1 = { ingreso: 0, value: 0 };
    const storage = legacyStorage(data), ui = appHarness(storage);
    ui.render().downloadCurrentBackup();
    const exported = JSON.parse(await ui.downloads[0].text());
    assert.deepEqual(Backup.prepareRestore(exported, Backup.emptyDataset()).data.snapshots, data.snapshots);
});

test('a contradictory sidecar summary cannot replace an explicitly zero archived photograph', () => {
    const data = fixture();
    data.funds[0].archived = true;
    data.snapshots[0].fundsData.f1 = { ingreso: 0, value: 0 };
    const input = { ...clone(data), tabla2EvolucionPatrimonial: [{ date: data.snapshots[0].date, cartera: 120 }] };
    const storage = legacyStorage(data);
    assert.throws(() => Backup.restore(storage, input, data), /contradice/);
    assert.deepEqual(storage.writes, []);
    assert.deepEqual(Backup.loadDataset(storage), data);
});

const monthlyInput = (changes = {}) => ({ month: '2026-01', fundSavings: 30, liquiditySavings: 20, entries: [], reviewedAgainst: null, note: 'Solo datos ficticios', ...changes });

test('monthly application handler persists one reviewed record and preserves original accounts and history', () => {
    const data = fixture(), storage = legacyStorage(data), ui = appHarness(storage);
    assert.equal(ui.render().saveMonthlyBalance(monthlyInput(), true), true);
    const loaded = Backup.loadDataset(storage);
    assert.deepEqual(Object.fromEntries(Backup.BLOCKS.map(k => [k, loaded[k]])), data);
    assert.equal(loaded.monthlyBalances.length, 1);
    assert(MonthlyBalance.calculate(loaded, '2026-01').reviewed);
    assert.equal(JSON.parse(storage.getItem(Backup.STORAGE_KEY)).storageVersion, 2);
});

test('monthly handler updates only the selected month without duplicating it or deleting other balances', () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage);
    ui.render().saveMonthlyBalance(monthlyInput(), true);
    ui.render().saveMonthlyBalance(monthlyInput({ month: '2026-02', fundSavings: 0, liquiditySavings: 0 }), false);
    ui.render().saveMonthlyBalance(monthlyInput({ fundSavings: 40 }), false);
    const loaded = Backup.loadDataset(storage);
    assert.equal(loaded.monthlyBalances.length, 2);
    assert.equal(loaded.monthlyBalances.find(row => row.month === '2026-01').fundSavings, 40);
    assert.equal(loaded.monthlyBalances.find(row => row.month === '2026-02').fundSavings, 0);
});

test('monthly save write/read failures never change memory or source storage', () => {
    for (const failure of ['failWrite', 'failRead']) {
        const data = fixture(), storage = legacyStorage(data), ui = appHarness(storage);
        ui.render(); storage[failure] = true;
        assert.equal(ui.render().saveMonthlyBalance(monthlyInput(), true), false);
        assert.deepEqual(ui.render().getData(), data);
        assert.deepEqual(storage.writes, []);
        assert(ui.render().storageError);
    }
});

test('monthly save detects a newer stored dataset instead of overwriting another window', () => {
    const data = fixture(), storage = legacyStorage(data), ui = appHarness(storage);
    ui.render(); const newer = clone(data); newer.incomes[0].amount = 101;
    Backup.saveDataset(storage, newer);
    assert.equal(ui.render().saveMonthlyBalance(monthlyInput(), true), false);
    assert.deepEqual(ui.render().getData(), data);
    assert.deepEqual(Backup.loadDataset(storage), newer);
    assert.match(ui.render().storageError, /otra ventana/);
});

test('actual export/download and a fresh application load preserve monthly inputs, review and note', async () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage);
    ui.render().saveMonthlyBalance(monthlyInput(), true);
    ui.render().downloadCurrentBackup();
    const exported = JSON.parse(await ui.downloads[0].text());
    assert.equal(exported.backupVersion, 2);
    assert.deepEqual(exported.monthlyBalances, clone(ui.render().getData().monthlyBalances));
    const restoredStorage = legacyStorage(Backup.emptyDataset());
    Backup.restore(restoredStorage, exported, Backup.emptyDataset());
    const reloaded = appHarness(restoredStorage).render().getData();
    assert.deepEqual(reloaded.monthlyBalances, exported.monthlyBalances);
    assert(MonthlyBalance.calculate(reloaded, '2026-01').reviewed);
});

test('old four-block import preserves balances but invalidates their review when income changes', () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage);
    ui.render().saveMonthlyBalance(monthlyInput(), true);
    const originalRecord = clone(ui.render().getData().monthlyBalances[0]);
    const olderFile = fixture(); olderFile.incomes[0].amount = 110;
    choose(ui.render(), olderFile);
    assert.equal(ui.render().pendingImport.prepared.replaced.includes('monthlyBalances'), false);
    ui.render().setSkipBackup(true); ui.render().confirmImport();
    const loaded = Backup.loadDataset(storage);
    assert.deepEqual(loaded.monthlyBalances[0], originalRecord);
    assert.equal(MonthlyBalance.calculate(loaded, '2026-01').reviewed, false);
    assert.equal(MonthlyBalance.calculate(loaded, '2026-01').totalExpense, 60);
});

test('new complete empty file clears all five blocks through the actual confirmation handler', () => {
    const storage = legacyStorage(fixture()), ui = appHarness(storage);
    ui.render().saveMonthlyBalance(monthlyInput(), true);
    choose(ui.render(), { ...Backup.emptyDataset(), backupVersion: 2, monthlyBalances: [] });
    assert.equal(ui.render().pendingImport.prepared.replaced.length, 5);
    ui.render().setSkipBackup(true); ui.render().confirmImport();
    assert.deepEqual(Backup.loadDataset(storage), { ...Backup.emptyDataset(), monthlyBalances: [] });
});

test('invalid monthly block never partially imports otherwise valid source changes', () => {
    const data = fixture(), storage = legacyStorage(data), ui = appHarness(storage);
    choose(ui.render(), { incomes: [], monthlyBalances: [{ month: '2026-01' }] });
    assert.equal(ui.render().pendingImport, null); assert.equal(ui.render().pendingRecovery, null);
    assert.deepEqual(ui.render().getData(), data); assert.deepEqual(storage.writes, []);
});

test('unreadable consolidated storage requires an explicit monthly block to avoid losing unknown balances', () => {
    const storage = legacyStorage(fixture()); storage.values.set(Backup.STORAGE_KEY, '{broken fictitious consolidated data');
    const ui = appHarness(storage);
    choose(ui.render(), fixture());
    assert.equal(ui.render().pendingImport, null); assert.deepEqual(storage.writes, []);
    assert.match(ui.render().notification, /monthlyBalances/);
    choose(ui.render(), { ...fixture(), backupVersion: 2, monthlyBalances: [] });
    ui.render().setSkipBackup(true); ui.render().confirmImport();
    assert.deepEqual(Backup.loadDataset(storage), { ...fixture(), monthlyBalances: [] });
});

require('./fund-history.cases.cjs');
require('./monthly-balance.cases.cjs');
