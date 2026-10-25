/* Validation, persistence and catalogue preservation. Financial formulas remain in index.html. */
(function (root, factory) {
    const balance = typeof module === 'object' && module.exports ? require('./monthly-balance.js') : root.FamilyMonthlyBalance;
    const api = factory(balance);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FamilyBackup = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (MonthlyBalance) {
    'use strict';

    const BLOCKS = ['incomes', 'expenses', 'funds', 'snapshots'];
    const ALL_BLOCKS = [...BLOCKS, 'monthlyBalances'];
    const STORAGE_KEY = 'eco_public_blank_v4_dataset';
    const LEGACY_KEYS = Object.fromEntries(BLOCKS.map(k => [k, `eco_public_blank_v4_${k}`]));
    const FUND_IDENTITY = ['name', 'isin', 'type', 'start', 'gestora'];
    const SUMMARY_FIELDS = ['ingresoTotal', 'ing', 'rf', 'rv', 'cartera', 'patrimonio',
        'diffCartera', 'diffCarteraPct', 'diffPatrimonio', 'diffPatrimonioPct'];
    const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const emptyDataset = () => Object.fromEntries(BLOCKS.map(k => [k, []]));
    const fail = (path, message) => { throw new Error(`${path}: ${message}`); };
    const object = (value, path) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'se esperaba un objeto.');
    };
    const text = (value, path) => {
        if (typeof value !== 'string' || !value.trim()) fail(path, 'falta un texto obligatorio.');
    };
    const number = (value, path, nullable = false) => {
        if (nullable && value === null) return;
        if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'se esperaba un número finito, sin comillas.');
    };
    const safeKey = (value, path) => {
        if (['__proto__', 'constructor', 'prototype'].includes(String(value))) fail(path, 'identificador reservado.');
    };
    const identifier = (value, path) => {
        if (!(typeof value === 'string' && value.trim()) && !Number.isSafeInteger(value)) fail(path, 'falta un identificador válido.');
        safeKey(value, path);
    };
    const date = (value, path, monthly = false) => {
        const pattern = monthly ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/;
        if (typeof value !== 'string' || !pattern.test(value)) fail(path, monthly ? 'usa una fecha AAAA-MM válida.' : 'usa una fecha AAAA-MM-DD válida.');
        if (!monthly) {
            const parsed = new Date(`${value}T00:00:00Z`);
            if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(path, 'la fecha no existe.');
        }
    };
    const summary = (value, path) => {
        object(value, path);
        if (!SUMMARY_FIELDS.some(k => has(value, k))) fail(path, 'faltan los campos del resumen financiero.');
        SUMMARY_FIELDS.forEach(k => { if (has(value, k)) number(value[k], `${path}.${k}`, true); });
    };
    const records = (value, path, validate, uniqueDate = false) => {
        if (!Array.isArray(value)) fail(path, 'se esperaba una lista; usa [] para vaciarla.');
        const ids = new Set(), dates = new Set();
        value.forEach((row, i) => {
            const p = `${path}[${i + 1}]`;
            object(row, p);
            validate(row, p);
            if (has(row, 'id')) {
                identifier(row.id, `${p}.id`);
                if (ids.has(String(row.id))) fail(`${p}.id`, 'identificador duplicado.');
                ids.add(String(row.id));
            }
            if (uniqueDate) {
                if (dates.has(row.date)) fail(`${p}.date`, 'fecha duplicada.');
                dates.add(row.date);
            }
        });
    };
    function validateBlock(key, value) {
        if (key === 'monthlyBalances') return MonthlyBalance.validateRecords(value);
        records(value, key, (row, p) => {
            identifier(row.id, `${p}.id`);
            if (key === 'incomes' || key === 'expenses') {
                date(row.date, `${p}.date`, true);
                text(row.concept, `${p}.concept`);
                safeKey(row.concept, `${p}.concept`);
                number(row.amount, `${p}.amount`);
                if (key === 'incomes') text(row.owner, `${p}.owner`);
            } else if (key === 'funds') {
                ['name', 'type', 'gestora'].forEach(k => text(row[k], `${p}.${k}`));
                date(row.start, `${p}.start`);
                if (has(row, 'isin') && typeof row.isin !== 'string') fail(`${p}.isin`, 'se esperaba un texto.');
                if (has(row, 'archived') && typeof row.archived !== 'boolean') fail(`${p}.archived`, 'se esperaba verdadero o falso.');
            } else {
                date(row.date, `${p}.date`);
                if (has(row, 'summaryOnly') && typeof row.summaryOnly !== 'boolean') fail(`${p}.summaryOnly`, 'se esperaba verdadero o falso.');
                if (has(row, 'liquidity')) number(row.liquidity, `${p}.liquidity`, true);
                if (has(row, 'table2')) summary(row.table2, `${p}.table2`);
                if (has(row, 'summary')) summary(row.summary, `${p}.summary`);
                if (row.summaryOnly && !row.table2 && !row.summary) fail(p, 'falta el resumen de la fotografía manual.');
                if (has(row, 'fundsData')) {
                    object(row.fundsData, `${p}.fundsData`);
                    Object.entries(row.fundsData).forEach(([id, entry]) => {
                        safeKey(id, `${p}.fundsData`);
                        object(entry, `${p}.fundsData`);
                        number(entry.ingreso, `${p}.fundsData.ingreso`);
                        number(entry.value, `${p}.fundsData.value`);
                    });
                } else if (!row.table2 && !row.summary) fail(`${p}.fundsData`, 'falta el desglose o el resumen histórico.');
                if (!row.table2 && !row.summary) number(row.liquidity, `${p}.liquidity`);
            }
        }, key === 'snapshots');
    }

    function validateDataset(data, checkReferences = true) {
        object(data, 'Datos');
        BLOCKS.forEach(k => validateBlock(k, data[k]));
        if (has(data, 'monthlyBalances')) validateBlock('monthlyBalances', data.monthlyBalances);
        if (checkReferences) {
            const ids = new Set(data.funds.map(f => String(f.id)));
            data.snapshots.forEach((s, i) => Object.keys(s.fundsData || {}).forEach(id => {
                if (!ids.has(id)) fail(`snapshots[${i + 1}].fundsData`, 'hay una referencia a un fondo inexistente.');
            }));
            data.funds.forEach((f, i) => {
                if (f.archived && !archiveEligibility(data, f.id).allowed) fail(`funds[${i + 1}].archived`, 'el último valor registrado debe ser cero.');
            });
        }
        return data;
    }

    function prepareRestore(input, current, { allowMissingReferences = false } = {}) {
        const data = typeof input === 'string' ? JSON.parse(input) : input;
        object(data, 'Archivo');
        if (has(data, 'backupVersion') && ![1, 2].includes(data.backupVersion)) fail('Archivo', 'versión de copia no reconocida.');
        if (data.backupVersion === 2 && !has(data, 'monthlyBalances')) fail('Archivo', 'falta el bloque de balances de una copia versión 2.');
        const supplied = ALL_BLOCKS.filter(k => has(data, k));
        const hasTable = has(data, 'tabla2EvolucionPatrimonial');
        if (!supplied.length && !hasTable) fail('Archivo', 'no contiene bloques reconocibles.');
        // Validate every supplied block before merging or touching application state.
        supplied.forEach(k => validateBlock(k, data[k]));
        if (hasTable) records(data.tabla2EvolucionPatrimonial, 'tabla2EvolucionPatrimonial', (row, p) => {
            date(row.date, `${p}.date`);
            summary(row, p);
        }, true);

        const candidate = Object.fromEntries(BLOCKS.map(k => [k, has(data, k) ? data[k] : current[k]]));
        if (has(data, 'monthlyBalances')) candidate.monthlyBalances = data.monthlyBalances;
        else if (has(current, 'monthlyBalances')) candidate.monthlyBalances = current.monthlyBalances;
        if (hasTable && !has(data, 'snapshots')) candidate.snapshots = [];
        if (has(data, 'funds') && !has(data, 'snapshots') && !hasTable) {
            current.funds.forEach(f => {
                const next = data.funds.find(g => String(g.id) === String(f.id));
                if (next && referencedFund(current, f.id) &&
                    (next.id !== f.id || FUND_IDENTITY.some(k => next[k] !== f[k]))) {
                    fail('funds', 'la copia parcial cambiaría los datos de un fondo vinculado a fotografías conservadas.');
                }
            });
        }
        validateDataset(candidate, !allowMissingReferences);
        // Clone before adding legacy summary rows: never mutate input or current data.
        const next = JSON.parse(JSON.stringify(candidate));
        if (hasTable) {
            const byDate = new Map((has(data, 'snapshots') ? next.snapshots : []).map(s => [s.date, s]));
            data.tabla2EvolucionPatrimonial.forEach(row => {
                const existing = byDate.get(row.date) || {
                    id: `snap_${row.date}`, date: row.date,
                    liquidity: row.patrimonio != null && row.cartera != null ? row.patrimonio - row.cartera : null,
                    fundsData: {}, summaryOnly: true
                };
                // Explicit zero observations are real historical data as well.
                const hasOwnFundsData = existing.fundsData && Object.keys(existing.fundsData).length > 0;
                if (hasOwnFundsData && !existing.table2 && !existing.summary && Object.values(existing.fundsData).every(fd => fd.ingreso === 0 && fd.value === 0)) {
                    const conflictingZero = ['ingresoTotal', 'rf', 'rv', 'cartera'].some(k => row[k] != null && row[k] !== 0);
                    if (conflictingZero || (row.patrimonio != null && row.patrimonio !== existing.liquidity)) {
                        fail('tabla2EvolucionPatrimonial', 'el resumen contradice una fotografía con valores cero explícitos; se necesita revisión.');
                    }
                }
                if (!existing.table2 && !hasOwnFundsData) {
                    existing.table2 = Object.fromEntries(SUMMARY_FIELDS.filter(k => k !== 'ing').map(k => [k, row[k] ?? null]));
                    existing.summary = Object.fromEntries(['ingresoTotal', 'rf', 'rv', 'cartera', 'patrimonio'].map(k => [k, row[k] ?? null]));
                }
                byDate.set(row.date, existing);
            });
            next.snapshots = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
        }
        validateDataset(next, !allowMissingReferences);
        return { data: next, replaced: [...new Set([...supplied, ...(hasTable ? ['snapshots'] : [])])] };
    }

    function findOrphans(data) {
        const known = new Set(data.funds.map(f => String(f.id))), missing = new Map();
        data.snapshots.forEach(s => Object.keys(s.fundsData || {}).forEach(id => {
            if (!known.has(id)) {
                if (!missing.has(id)) missing.set(id, { id, dates: [] });
                missing.get(id).dates.push(s.date);
            }
        }));
        return [...missing.values()];
    }
    function lastFundRecord(data, id) {
        return data.snapshots.filter(s => has(s.fundsData || {}, String(id)))
            .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
    }
    function archiveEligibility(data, id) {
        const last = lastFundRecord(data, id);
        const value = last?.fundsData[String(id)]?.value;
        return { allowed: typeof value === 'number' && Number.isFinite(value) && value === 0,
            date: last?.date || null, value: typeof value === 'number' && Number.isFinite(value) ? value : null };
    }
    function setFundArchived(data, id, archived) {
        if (typeof archived !== 'boolean') fail('Archivado', 'estado no válido.');
        if (!data.funds.some(f => String(f.id) === String(id))) fail('Archivado', 'el fondo no existe.');
        if (archived && !archiveEligibility(data, id).allowed) fail('Archivado', 'solo se permite con último valor registrado cero; no se modifica ningún saldo.');
        return { ...data, funds: data.funds.map(f => String(f.id) === String(id) ? { ...f, archived } : f) };
    }
    function referencedFund(data, id) {
        return data.snapshots.some(s => has(s.fundsData || {}, String(id)));
    }
    function prepareSnapshotFunds(data, draft, editingId, targetDate) {
        if (findOrphans(data).length) fail('Fotografía', 'recupera primero las referencias a fondos ausentes.');
        const result = JSON.parse(JSON.stringify(draft));
        const original = data.snapshots.find(s => s.id === editingId);
        if (!original && data.snapshots.some(s => s.date === targetDate)) fail('Fotografía', 'la fecha ya existe; utiliza Editar para no sobrescribirla.');
        data.funds.filter(f => f.archived).forEach(f => {
            const id = String(f.id);
            if (original) {
                if (has(original.fundsData || {}, id)) {
                    if (original.table2 || original.summary) fail('Fotografía', 'el registro archivado tiene un resumen guardado; necesita revisión explícita, no se eliminará ni recalculará desde este formulario.');
                    if (targetDate !== original.date) fail('Fotografía', 'no cambies la fecha de una fotografía con fondos archivados.');
                    result[id] = JSON.parse(JSON.stringify(original.fundsData[id]));
                } else delete result[id];
            } else {
                const last = lastFundRecord(data, id), entry = result[id];
                if (!last || !entry || entry.value !== 0 || entry.ingreso !== last.fundsData[id].ingreso || targetDate < last.date) {
                    fail('Fotografía', 'faltan valores revisables del fondo archivado; no se completarán con ceros ni se trasladarán desde una fecha futura.');
                }
            }
        });
        return result;
    }
    function prepareFundRecovery(target, donorInput) {
        validateDataset(target, false);
        const missing = findOrphans(target);
        if (!missing.length) fail('Recuperación', 'no hay referencias huérfanas.');
        // Source files must be valid in their entirety, even though only their
        // original catalogue records may be copied. No source photographs are restored.
        const donor = prepareRestore(donorInput, emptyDataset()).data;
        target.funds.forEach(f => {
            const other = donor.funds.find(g => String(g.id) === String(f.id));
            if (other && (other.id !== f.id || FUND_IDENTITY.some(k => f[k] !== other[k]))) fail('Recuperación', 'los catálogos discrepan sobre un fondo existente; se necesita revisión.');
        });
        const additions = missing.map(({ id }) => {
            const original = donor.funds.find(f => String(f.id) === id);
            if (!original) fail('Recuperación', 'la copia no contiene todos los registros originales ausentes.');
            return JSON.parse(JSON.stringify(original));
        });
        const missingIds = new Set(missing.map(r => r.id));
        target.snapshots.forEach(s => {
            if (!Object.keys(s.fundsData || {}).some(id => missingIds.has(id))) return;
            // A stored aggregate could already reflect the old deletion defect.
            // Do not decide which historical representation is authoritative.
            if (s.table2 || s.summary) fail('Recuperación', 'una fotografía huérfana contiene resúmenes guardados; requiere revisión, no se recalculará automáticamente.');
            missingIds.forEach(id => {
                const entry = s.fundsData?.[id], original = additions.find(f => String(f.id) === id);
                if (entry && FUND_IDENTITY.some(k => has(entry, k) && entry[k] !== original[k])) fail('Recuperación', 'el registro original discrepa de los metadatos guardados en una fotografía.');
            });
            const prior = donor.snapshots.find(p => p.date === s.date);
            if (prior) missingIds.forEach(id => {
                const a = s.fundsData?.[id], b = prior.fundsData?.[id];
                if (a && b && (a.ingreso !== b.ingreso || a.value !== b.value)) fail('Recuperación', 'las copias discrepan en una fotografía de la misma fecha; se necesita revisión.');
            });
        });
        const data = { ...target, funds: [...target.funds, ...additions] };
        validateDataset(data);
        return { data, additions, missing };
    }

    function readStorageSnapshot(storage) {
        return Object.fromEntries([STORAGE_KEY, ...Object.values(LEGACY_KEYS)].map(k => [k, storage.getItem(k)]));
    }
    function loadDataset(storage) {
        const saved = readStorageSnapshot(storage);
        let data;
        if (saved[STORAGE_KEY] !== null) {
            const envelope = JSON.parse(saved[STORAGE_KEY]);
            if (!envelope || ![1, 2].includes(envelope.storageVersion)) fail('Almacenamiento', 'formato local no reconocido; no se ha sobrescrito.');
            if (envelope.storageVersion === 2 && !has(envelope.data || {}, 'monthlyBalances')) fail('Almacenamiento', 'faltan los balances de la versión 2; no se ha sobrescrito.');
            data = envelope.data;
        } else data = Object.fromEntries(BLOCKS.map(k => [k, saved[LEGACY_KEYS[k]] === null ? [] : JSON.parse(saved[LEGACY_KEYS[k]])]));
        // Existing histories may contain orphan funds from the old deletion bug.
        // Loading must not reinterpret or silently repair those historical records.
        return validateDataset(data, false);
    }
    function saveDataset(storage, data) {
        // Web Storage guarantees setItem is atomic on failure. A single key avoids
        // partial restores across four legacy keys, which are retained untouched.
        const serialized = JSON.stringify({ storageVersion: has(data, 'monthlyBalances') ? 2 : 1, data });
        storage.setItem(STORAGE_KEY, serialized);
    }
    function requiredRecoveryBlocks(storage) {
        // With unreadable consolidated data, balances may exist. Never replace
        // that unknown content with an older backup that cannot preserve it.
        const raw = storage.getItem(STORAGE_KEY);
        if (raw === null) return BLOCKS;
        try {
            const envelope = JSON.parse(raw);
            if (envelope?.storageVersion === 1 && envelope.data && typeof envelope.data === 'object' && !has(envelope.data, 'monthlyBalances')) return BLOCKS;
        } catch (error) { /* The presence of monthly data cannot be established. */ }
        return ALL_BLOCKS;
    }
    function restore(storage, input, current, expectedStorage) {
        const prepared = prepareRestore(input, current);
        if (expectedStorage && JSON.stringify(readStorageSnapshot(storage)) !== JSON.stringify(expectedStorage)) {
            fail('Almacenamiento', 'los datos han cambiado mientras revisabas la copia. Cancela y vuelve a importar.');
        }
        saveDataset(storage, prepared.data);
        return prepared;
    }

    return { BLOCKS, ALL_BLOCKS, STORAGE_KEY, LEGACY_KEYS, emptyDataset, validateDataset, prepareRestore,
        readStorageSnapshot, loadDataset, saveDataset, restore, findOrphans,
        archiveEligibility, setFundArchived, referencedFund, prepareSnapshotFunds, prepareFundRecovery, requiredRecoveryBlocks };
}));
