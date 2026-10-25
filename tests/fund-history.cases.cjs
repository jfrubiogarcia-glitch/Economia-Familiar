// Loaded by backup.test.cjs so the approved project test command covers both phases.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Backup = require('../backup.js');
const positive = require('./fixtures/01-valida.json');
const zero = require('./fixtures/07-valor-cero.json');
const orphan = require('./fixtures/05-fondo-eliminado.json');
const clone = value => structuredClone(value);
const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
function segment(start, end) {
    const a = html.indexOf(start), b = html.indexOf(end, a);
    assert(a >= 0 && b > a);
    return html.slice(a, b);
}
function totals(data, snapshot) {
    return JSON.parse(JSON.stringify(vm.runInNewContext(segment('            const getSnapTotals = ', '            const handleExport = ') + 'getSnapTotals(snapshot)', { funds: data.funds, snapshot })));
}

test('destructive removal reproduces the old defect; archiving after recorded zero preserves all past totals', () => {
    const data = clone(zero), history = JSON.stringify(data.snapshots);
    const before = data.snapshots.map(s => totals(data, s));
    assert.equal(totals({ ...data, funds: [] }, data.snapshots[1]).cartera, 0);
    const archived = Backup.setFundArchived(data, 'fondo-prueba', true);
    assert.deepEqual(archived.snapshots.map(s => totals(archived, s)), before);
    assert.equal(totals(archived, data.snapshots[1]).cartera, 120);
    assert.equal(JSON.stringify(archived.snapshots), history);
    assert.deepEqual(archived.funds[0], { ...data.funds[0], archived: true });
    assert.deepEqual(data, zero);
});

for (const [label, alter] of [
    ['positive value', d => { d.snapshots[0].fundsData['fondo-prueba'].value = 120; }],
    ['negative value', d => { d.snapshots[0].fundsData['fondo-prueba'].value = -1; }],
    ['unknown value', d => { delete d.snapshots[0].fundsData['fondo-prueba'].value; }],
    ['no observations', d => { d.snapshots = []; }],
    ['null value', d => { d.snapshots[0].fundsData['fondo-prueba'].value = null; }]
]) test(`archiving is blocked with ${label} without modifying the record or photographs`, () => {
    const data = clone(positive); alter(data);
    const before = clone(data);
    assert.throws(() => Backup.setFundArchived(data, 'fondo-prueba', true), /último valor registrado cero/);
    assert.deepEqual(data, before);
});

test('latest actual observation wins regardless of array order; aggregate-only rows are not invented valuations', () => {
    const data = clone(zero);
    data.snapshots.reverse();
    data.snapshots.push({ id: 'summary', date: '2026-10-30', table2: { cartera: 999 } });
    assert.deepEqual(Backup.archiveEligibility(data, 'fondo-prueba'), { allowed: true, date: '2026-10-08', value: 0 });
});

test('reactivation changes only administrative status', () => {
    const archived = Backup.setFundArchived(clone(zero), 'fondo-prueba', true);
    const active = Backup.setFundArchived(archived, 'fondo-prueba', false);
    assert.deepEqual(active.snapshots, zero.snapshots);
    assert.deepEqual(active.funds[0], { ...zero.funds[0], archived: false });
});

test('old backups without status and new backups with a valid archived status preserve all fields', () => {
    assert.deepEqual(Backup.prepareRestore(positive, Backup.emptyDataset()).data, positive);
    const archived = Backup.setFundArchived(clone(zero), 'fondo-prueba', true);
    assert.deepEqual(Backup.prepareRestore(JSON.stringify(archived), Backup.emptyDataset()).data, archived);
});

for (const status of ['true', 1, null]) test(`invalid archived metadata ${JSON.stringify(status)} is rejected`, () => {
    const data = clone(zero); data.funds[0].archived = status;
    assert.throws(() => Backup.prepareRestore(data, Backup.emptyDataset()), /archived/);
});
test('import cannot mark a fund with a nonzero or unknown latest value as archived', () => {
    const data = clone(positive); data.funds[0].archived = true;
    assert.throws(() => Backup.prepareRestore(data, Backup.emptyDataset()), /último valor/);
});

test('editing an old photograph preserves archived entries exactly, including optional metadata', () => {
    const data = Backup.setFundArchived(clone(zero), 'fondo-prueba', true);
    data.snapshots[1].fundsData['fondo-prueba'].note = 'Metadato ficticio original';
    const result = Backup.prepareSnapshotFunds(data, {}, 'foto-prueba', '2026-10-01');
    assert.deepEqual(result['fondo-prueba'], data.snapshots[1].fundsData['fondo-prueba']);
    assert.throws(() => Backup.prepareSnapshotFunds(data, {}, 'foto-prueba', '2026-10-02'), /fecha/);
});

test('editing a photograph without that archived entry does not insert it retrospectively', () => {
    const data = Backup.setFundArchived(clone(zero), 'fondo-prueba', true);
    data.snapshots.push({ id: 'no-entry', date: '2026-01-01', liquidity: 10, fundsData: {} });
    assert.deepEqual(Backup.prepareSnapshotFunds(data, { 'fondo-prueba': { ingreso: 100, value: 0 } }, 'no-entry', '2026-01-01'), {});
});

test('editing cannot discard stored summaries attached to archived historical entries', () => {
    const data = Backup.setFundArchived(clone(zero), 'fondo-prueba', true);
    data.snapshots[1].summary = { cartera: 120, patrimonio: 170 };
    const before = clone(data);
    assert.throws(() => Backup.prepareSnapshotFunds(data, {}, 'foto-prueba', '2026-10-01'), /resumen guardado/);
    assert.deepEqual(data, before);
});

test('new photographs cannot invent missing archived amounts or silently change their contribution', () => {
    const data = Backup.setFundArchived(clone(zero), 'fondo-prueba', true);
    assert.throws(() => Backup.prepareSnapshotFunds(data, {}, null, '2026-11-01'), /faltan valores/);
    assert.throws(() => Backup.prepareSnapshotFunds(data, { 'fondo-prueba': { ingreso: 0, value: 0 } }, null, '2026-11-01'), /faltan valores/);
    assert.throws(() => Backup.prepareSnapshotFunds(data, { 'fondo-prueba': { ingreso: 100, value: 0 } }, null, '2026-09-01'), /fecha futura/);
    const draft = { 'fondo-prueba': { ingreso: 100, value: 0 } };
    assert.deepEqual(Backup.prepareSnapshotFunds(data, draft, null, '2026-11-01'), draft);
});

test('a new photograph cannot replace an existing date implicitly', () => {
    assert.throws(() => Backup.prepareSnapshotFunds(zero, {}, null, '2026-10-01'), /ya existe/);
});

test('orphan entries block photo edits until metadata is recovered', () => {
    assert.throws(() => Backup.prepareSnapshotFunds(orphan, {}, 'foto-prueba', '2026-10-01'), /referencias/);
});

test('recovering original catalogue records preserves every target amount, date, id and snapshot', () => {
    const target = clone(orphan), original = clone(positive);
    const recovered = Backup.prepareFundRecovery(target, JSON.stringify(original));
    assert.deepEqual(recovered.data, { ...target, funds: original.funds });
    assert.equal(recovered.data.incomes[0].amount, 999, 'source income must not replace target income');
    assert.deepEqual(target, orphan);
    assert.deepEqual(original, positive);
    assert.equal(totals(recovered.data, target.snapshots[0]).cartera, 120);
    assert.equal(totals(recovered.data, target.snapshots[0]).patrimonio, 170);
});

test('same name with another id is not an original record match', () => {
    const donor = clone(positive); donor.funds[0].id = 'other'; donor.snapshots = [];
    assert.throws(() => Backup.prepareFundRecovery(orphan, donor), /registros originales/);
});

test('conflicting photographs of the same date require intervention rather than overwriting history', () => {
    const donor = clone(positive); donor.snapshots[0].fundsData['fondo-prueba'].value = 121;
    assert.throws(() => Backup.prepareFundRecovery(orphan, donor), /discrepan/);
});

test('stored aggregates on orphan photographs require review and are never recomputed', () => {
    const target = clone(orphan); target.snapshots[0].table2 = { cartera: 0, patrimonio: 50 };
    const before = clone(target);
    assert.throws(() => Backup.prepareFundRecovery(target, positive), /resúmenes guardados/);
    assert.deepEqual(target, before);
});

test('embedded original identity metadata must agree with donor classification', () => {
    const target = clone(orphan); target.snapshots[0].fundsData['fondo-prueba'].type = 'Renta Fija';
    assert.throws(() => Backup.prepareFundRecovery(target, positive), /metadatos/);
});

test('a donor that changes an existing catalogue classification is rejected', () => {
    const target = clone(orphan);
    target.funds.push({ ...positive.funds[0], id: 'existing' });
    const donor = clone(positive);
    donor.funds.push({ ...target.funds[0], type: 'Renta Fija' });
    assert.throws(() => Backup.prepareFundRecovery(target, donor), /catálogos discrepan/);
});

test('prepared manual conflict and saved-summary fixtures require intervention', () => {
    const donor = require('./fixtures/08-origen-conflictivo.json');
    const summarized = require('./fixtures/09-huerfana-con-resumen.json');
    assert.throws(() => Backup.prepareFundRecovery(orphan, donor), /discrepan/);
    assert.throws(() => Backup.prepareFundRecovery(summarized, positive), /resúmenes guardados/);
});

test('invalid unrelated source records reject the entire donor file', () => {
    const donor = clone(positive); donor.incomes = [{}];
    assert.throws(() => Backup.prepareFundRecovery(orphan, donor), /incomes/);
});

test('summary-only valid history is preserved without inventing a per-fund breakdown', () => {
    const data = Backup.emptyDataset();
    data.snapshots.push({ id: 'summary', date: '2026-10-01', summary: { cartera: 120, patrimonio: 170 } });
    assert.deepEqual(Backup.findOrphans(data), []);
    assert.deepEqual(Backup.prepareRestore(data, Backup.emptyDataset()).data, data);
});

test('recovery staging never weakens the strict restore operation', () => {
    const staged = Backup.prepareRestore(orphan, positive, { allowMissingReferences: true });
    assert.equal(Backup.findOrphans(staged.data).length, 1);
    const storage = { setItem() { assert.fail('must not write'); } };
    assert.throws(() => Backup.restore(storage, orphan, positive), /referencia/);
});

test('partial catalogue restore cannot reclassify preserved historical snapshots', () => {
    const funds = clone(positive.funds); funds[0].type = 'Renta Fija';
    assert.throws(() => Backup.prepareRestore({ funds }, positive), /copia parcial/);
});

// Actual investment handlers, with hook state and UI APIs controlled by fixtures.
function investmentHarness(initial, { confirm = true, writeFails = false } = {}) {
    let data = clone(initial), cursor = 0;
    const slots = [], messages = [], saves = [];
    const context = {
        FamilyBackup: Backup, generateId: () => 'new-photo', confirm: () => confirm,
        useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
        useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
        useEffect() {}, useMemo: fn => fn(), useSortableData: items => ({ items, requestSort() {} })
    };
    const parsing = segment('        const parseAmount = ', '        const AmountInput = ');
    const begin = html.indexOf('        const InversionesTab = ');
    const start = html.indexOf('=> {', begin) + 4;
    const end = html.indexOf('\n            return (\n                <div className="space-y-6', start);
    const expose = 'return {handleArchiveFund,handleReactivateFund,handleOpenEditFund,handleSaveFundModal,handleSaveSnapshot,setFundType,setSnapDate,setSnapFundsData,setArchivedValuesConfirmed,setEditingSnapId,activeFunds,archivedFunds};';
    const render = vm.runInNewContext(parsing + '(function({funds,snapshots,setFunds,showMessage,addSnapshot,updateSnapshot}) {' + html.slice(start, end) + expose + '})', context);
    return { messages, saves, getData: () => data, render() { cursor = 0; return render({ ...data,
        showMessage: text => messages.push(text),
        setFunds: funds => { if (writeFails) return false; data = { ...data, funds }; return true; },
        addSnapshot: row => { saves.push(row); return !writeFails; }, updateSnapshot: row => { saves.push(row); return !writeFails; }
    }); } };
}

test('investment handler archives instead of deleting and separates active and archived lists', () => {
    const ui = investmentHarness(zero);
    ui.render().handleArchiveFund('fondo-prueba');
    assert.equal(ui.getData().funds.length, 1);
    assert.equal(ui.render().activeFunds.length, 0);
    assert.equal(ui.render().archivedFunds.length, 1);
    assert.deepEqual(ui.getData().snapshots, zero.snapshots);
    ui.render().handleReactivateFund('fondo-prueba');
    assert.equal(ui.render().activeFunds.length, 1);
});

test('investment handler blocks nonzero archive and preserves data on cancel or write failure', () => {
    const blocked = investmentHarness(positive); blocked.render().handleArchiveFund('fondo-prueba');
    assert.deepEqual(blocked.getData(), positive);
    assert(blocked.messages.some(m => m.includes('cero')));
    for (const options of [{ confirm: false }, { writeFails: true }]) {
        const ui = investmentHarness(zero, options); ui.render().handleArchiveFund('fondo-prueba');
        assert.deepEqual(ui.getData(), zero);
        assert.equal(ui.messages.length, 0);
    }
});

test('investment handler does not save a new photo without explicit review of archived values', () => {
    const data = Backup.setFundArchived(clone(zero), 'fondo-prueba', true), ui = investmentHarness(data);
    ui.render().setSnapDate('2026-11-01');
    ui.render().setSnapFundsData({ 'fondo-prueba': { ingreso: 100, value: 0 } });
    ui.render().handleSaveSnapshot({ preventDefault() {} });
    assert.equal(ui.saves.length, 0);
    ui.render().setArchivedValuesConfirmed(true);
    ui.render().handleSaveSnapshot({ preventDefault() {} });
    assert.equal(ui.saves.length, 1);
    assert.deepEqual(ui.saves[0].fundsData['fondo-prueba'], { ingreso: 100, value: 0 });
});

test('investment handler cannot overwrite referenced fund classification from its edit form', () => {
    const ui = investmentHarness(positive);
    ui.render().handleOpenEditFund(ui.getData().funds[0]);
    ui.render().setFundType('Renta Fija');
    ui.render().handleSaveFundModal({ preventDefault() {} });
    assert.deepEqual(ui.getData(), positive);
    assert(ui.messages.some(m => m.includes('histórico')));
});
