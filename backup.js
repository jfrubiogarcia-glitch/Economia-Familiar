/* JSON validation and persistence only: financial calculations remain in index.html. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FamilyBackup = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const BLOCKS = ['incomes', 'expenses', 'funds', 'snapshots'];
    const STORAGE_KEY = 'eco_public_blank_v4_dataset';
    const LEGACY_KEYS = Object.fromEntries(BLOCKS.map(k => [k, `eco_public_blank_v4_${k}`]));
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
        if (checkReferences) {
            const ids = new Set(data.funds.map(f => String(f.id)));
            data.snapshots.forEach((s, i) => Object.keys(s.fundsData || {}).forEach(id => {
                if (!ids.has(id)) fail(`snapshots[${i + 1}].fundsData`, 'hay una referencia a un fondo inexistente.');
            }));
        }
        return data;
    }

    function prepareRestore(input, current) {
        const data = typeof input === 'string' ? JSON.parse(input) : input;
        object(data, 'Archivo');
        const supplied = BLOCKS.filter(k => has(data, k));
        const hasTable = has(data, 'tabla2EvolucionPatrimonial');
        if (!supplied.length && !hasTable) fail('Archivo', 'no contiene bloques reconocibles.');
        // Validate every supplied block before merging or touching application state.
        supplied.forEach(k => validateBlock(k, data[k]));
        if (hasTable) records(data.tabla2EvolucionPatrimonial, 'tabla2EvolucionPatrimonial', (row, p) => {
            date(row.date, `${p}.date`);
            summary(row, p);
        }, true);

        const candidate = Object.fromEntries(BLOCKS.map(k => [k, has(data, k) ? data[k] : current[k]]));
        if (hasTable && !has(data, 'snapshots')) candidate.snapshots = [];
        validateDataset(candidate);
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
                const hasOwnFundsData = existing.fundsData && Object.values(existing.fundsData).some(fd => fd.ingreso || fd.value);
                if (!existing.table2 && !hasOwnFundsData) {
                    existing.table2 = Object.fromEntries(SUMMARY_FIELDS.filter(k => k !== 'ing').map(k => [k, row[k] ?? null]));
                    existing.summary = Object.fromEntries(['ingresoTotal', 'rf', 'rv', 'cartera', 'patrimonio'].map(k => [k, row[k] ?? null]));
                }
                byDate.set(row.date, existing);
            });
            next.snapshots = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
        }
        validateDataset(next);
        return { data: next, replaced: [...new Set([...supplied, ...(hasTable ? ['snapshots'] : [])])] };
    }

    function readStorageSnapshot(storage) {
        return Object.fromEntries([STORAGE_KEY, ...Object.values(LEGACY_KEYS)].map(k => [k, storage.getItem(k)]));
    }
    function loadDataset(storage) {
        const saved = readStorageSnapshot(storage);
        let data;
        if (saved[STORAGE_KEY] !== null) {
            const envelope = JSON.parse(saved[STORAGE_KEY]);
            if (!envelope || envelope.storageVersion !== 1) fail('Almacenamiento', 'formato local no reconocido; no se ha sobrescrito.');
            data = envelope.data;
        } else data = Object.fromEntries(BLOCKS.map(k => [k, saved[LEGACY_KEYS[k]] === null ? [] : JSON.parse(saved[LEGACY_KEYS[k]])]));
        // Existing histories may contain orphan funds from the old deletion bug.
        // Loading must not reinterpret or silently repair those historical records.
        return validateDataset(data, false);
    }
    function saveDataset(storage, data) {
        // Web Storage guarantees setItem is atomic on failure. A single key avoids
        // partial restores across four legacy keys, which are retained untouched.
        const serialized = JSON.stringify({ storageVersion: 1, data });
        storage.setItem(STORAGE_KEY, serialized);
    }
    function restore(storage, input, current, expectedStorage) {
        const prepared = prepareRestore(input, current);
        if (expectedStorage && JSON.stringify(readStorageSnapshot(storage)) !== JSON.stringify(expectedStorage)) {
            fail('Almacenamiento', 'los datos han cambiado mientras revisabas la copia. Cancela y vuelve a importar.');
        }
        saveDataset(storage, prepared.data);
        return prepared;
    }

    return { BLOCKS, STORAGE_KEY, LEGACY_KEYS, emptyDataset, validateDataset, prepareRestore,
        readStorageSnapshot, loadDataset, saveDataset, restore };
}));
