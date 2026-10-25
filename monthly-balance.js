/* Monthly cash-flow estimates only. Existing investment formulas are untouched. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FamilyMonthlyBalance = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const ACTIONS = { incomes: ['income', 'internal', 'withdrawal'], expenses: ['expense', 'saving', 'internal'] };
    const METRICS = ['income', 'expenses', 'fundSavings', 'liquiditySavings', 'totalSavings', 'totalExpense', 'unitemized'];
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const fail = message => { throw new Error(`Balance mensual: ${message}`); };
    const monthValid = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
    const idValid = value => (typeof value === 'string' && value.trim() && !['__proto__', 'constructor', 'prototype'].includes(value)) || Number.isSafeInteger(value);
    const key = (block, id) => `${block}:${JSON.stringify(id)}`;
    const euro = value => {
        if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) fail('el importe no puede representarse con precisión en céntimos.');
        return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100 || 0;
    };
    function sourceSignature(row) {
        return JSON.stringify({ id: row.id, date: row.date, concept: row.concept, amount: row.amount, ...(has(row, 'owner') ? { owner: row.owner } : {}) });
    }
    function monthEntries(data, month) {
        return ['incomes', 'expenses'].flatMap(block => data[block].filter(row => row.date === month)
            .map(row => ({ block, row, key: key(block, row.id), source: sourceSignature(row) })))
            .sort((a, b) => a.key.localeCompare(b.key));
    }
    function validateRecords(records) {
        if (!Array.isArray(records)) fail('monthlyBalances debe ser una lista.');
        const months = new Set();
        records.forEach((record, index) => {
            const prefix = `registro ${index + 1}`;
            if (!record || typeof record !== 'object' || Array.isArray(record) || !monthValid(record.month)) fail(`${prefix}: mes inválido.`);
            if (months.has(record.month)) fail(`${prefix}: mes duplicado.`);
            months.add(record.month);
            for (const field of ['fundSavings', 'liquiditySavings']) {
                if (typeof record[field] !== 'number' || !Number.isFinite(record[field])) fail(`${prefix}: ${field} debe ser un número finito.`);
                if (Math.abs(record[field] - euro(record[field])) > 1e-9) fail(`${prefix}: los importes de ahorro admiten como máximo dos decimales.`);
            }
            if (!Array.isArray(record.entries)) fail(`${prefix}: faltan las decisiones sobre movimientos.`);
            const keys = new Set();
            record.entries.forEach(entry => {
                if (!entry || !has(ACTIONS, entry.block) || !ACTIONS[entry.block].includes(entry.action) || !idValid(entry.id) || typeof entry.source !== 'string') fail(`${prefix}: movimiento incompleto o tratamiento inválido.`);
                const identity = key(entry.block, entry.id);
                if (keys.has(identity)) fail(`${prefix}: movimiento duplicado.`);
                keys.add(identity);
                let source;
                try { source = JSON.parse(entry.source); } catch (error) { fail(`${prefix}: origen de movimiento inválido.`); }
                if (!source || source.id !== entry.id || source.date !== record.month || typeof source.concept !== 'string' || !source.concept.trim() || typeof source.amount !== 'number' || !Number.isFinite(source.amount)) fail(`${prefix}: origen incompleto o de otro mes.`);
                if (entry.block === 'incomes' && (typeof source.owner !== 'string' || !source.owner.trim())) fail(`${prefix}: falta la persona del ingreso original.`);
            });
            if (record.reviewedAgainst !== null && typeof record.reviewedAgainst !== 'string') fail(`${prefix}: revisión inválida.`);
            if (typeof record.note !== 'string') fail(`${prefix}: la nota debe ser un texto.`);
        });
        return records;
    }
    function calculate(data, month, record = (data.monthlyBalances || []).find(row => row.month === month)) {
        if (!monthValid(month)) fail('mes inválido.');
        const rows = monthEntries(data, month), decisions = record?.entries || [];
        const byKey = new Map(decisions.map(entry => [key(entry.block, entry.id), entry]));
        const unresolved = [], warnings = [];
        let income = 0, expenses = 0, rawIncome = 0, rawExpenses = 0;
        const treatments = rows.map(item => {
            const decision = byKey.get(item.key);
            const stale = Boolean(decision && decision.source !== item.source);
            let action = decision && !stale ? decision.action : null;
            if (!decision && !(item.block === 'expenses' && item.row.concept === 'Ahorro')) action = item.block === 'incomes' ? 'income' : 'expense';
            if (!action || stale) unresolved.push(item.key);
            // An unresolved Ahorro is included provisionally, never excluded by name.
            if (item.block === 'incomes') {
                rawIncome += item.row.amount;
                if (action === 'income' || !action) income += item.row.amount;
            } else {
                rawExpenses += item.row.amount;
                if (action === 'expense' || !action) expenses += item.row.amount;
            }
            return { ...item, action: stale ? null : action, stale };
        });
        const currentKeys = new Set(rows.map(row => row.key));
        const orphanDecisions = decisions.filter(entry => !currentKeys.has(key(entry.block, entry.id)));
        if (unresolved.length) warnings.push('Hay movimientos sin clasificar o modificados. Sus importes se incluyen provisionalmente como ingreso/gasto; revisa antes de cerrar el mes.');
        if (orphanDecisions.length) warnings.push('Hay decisiones sobre apuntes que ya no existen en este mes; revisa y descártalas antes de cerrar.');
        if (treatments.some(row => row.action === 'withdrawal')) warnings.push('Las retiradas marcadas no suman ingresos: deben figurar una sola vez en el ahorro neto. No se ajustan automáticamente tus dos importes.');
        const hasInputs = typeof record?.fundSavings === 'number' && Number.isFinite(record.fundSavings) && typeof record?.liquiditySavings === 'number' && Number.isFinite(record.liquiditySavings);
        const totalSavings = hasInputs ? euro(record.fundSavings + record.liquiditySavings) : null;
        income = euro(income); expenses = euro(expenses);
        const totalExpense = hasInputs ? euro(income - totalSavings) : null;
        const unitemized = hasInputs ? euro(totalExpense - expenses) : null;
        if (totalExpense !== null && totalExpense < 0) warnings.push('El ahorro supera los ingresos incluidos. Revisa cobros, fechas y movimientos pendientes; no se convierte ni corrige la diferencia.');
        if (unitemized !== null && unitemized < 0) warnings.push('Los gastos registrados superan el gasto estimado. Revisa la conciliación; no se recorta la diferencia a cero.');
        const fingerprint = hasInputs ? JSON.stringify({ month, fundSavings: record.fundSavings, liquiditySavings: record.liquiditySavings,
            source: rows.map(row => [row.key, row.source]), entries: decisions.map(entry => [key(entry.block, entry.id), entry.source, entry.action]).sort((a, b) => a[0].localeCompare(b[0])) }) : null;
        const canReview = hasInputs && !unresolved.length && !orphanDecisions.length;
        const reviewed = Boolean(canReview && record.reviewedAgainst && record.reviewedAgainst === fingerprint);
        const needsReview = Boolean(record?.reviewedAgainst && !reviewed);
        return { month, income, expenses, rawIncome: euro(rawIncome), rawExpenses: euro(rawExpenses),
            fundSavings: hasInputs ? record.fundSavings : null, liquiditySavings: hasInputs ? record.liquiditySavings : null,
            totalSavings, totalExpense, unitemized, hasInputs, canReview, reviewed, needsReview, fingerprint,
            treatments, unresolved, orphanDecisions, warnings, hasRecord: Boolean(record) };
    }
    function prepareRecord(data, input, reviewed) {
        const record = { ...input, reviewedAgainst: null };
        validateRecords([record]);
        const result = calculate(data, record.month, record);
        if (reviewed && !result.canReview) fail('resuelve los movimientos pendientes antes de marcar el mes como revisado.');
        record.reviewedAgainst = reviewed ? result.fingerprint : null;
        return record;
    }
    function savingsRate(savings, income) {
        // No meaningful income-based rate when income is unknown, zero or negative.
        if (!Number.isFinite(savings) || !Number.isFinite(income) || income <= 0) return null;
        const percentage = savings / income * 100;
        if (!Number.isFinite(percentage) || !Number.isSafeInteger(Math.round(percentage * 100))) return null;
        return euro(percentage);
    }
    function monthStatus(row) {
        return row.reviewed ? 'reviewed' : row.hasRecord || row.treatments.length ? 'pending' : 'missing';
    }
    function periodSummary(data, year, endMonth = 12) {
        if (!/^\d{4}$/.test(String(year))) fail('año inválido.');
        if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) fail('mes final inválido.');
        const months = Array.from({ length: endMonth }, (_, i) => calculate(data, `${year}-${String(i + 1).padStart(2, '0')}`));
        const included = months.filter(row => row.reviewed);
        const totals = Object.fromEntries(METRICS.map(metric => [metric, included.length ? euro(included.reduce((sum, row) => sum + row[metric], 0)) : null]));
        return { months, totals, count: included.length, expected: endMonth, complete: included.length === endMonth,
            pending: months.filter(row => monthStatus(row) === 'pending').length,
            missing: months.filter(row => monthStatus(row) === 'missing').length,
            savingsRate: savingsRate(totals.totalSavings, totals.income),
            averageExpense: included.length ? euro(totals.totalExpense / included.length) : null };
    }
    function yearSummary(data, year) { return periodSummary(data, year); }
    function compareYears(data, selectedYear) {
        const selected = yearSummary(data, selectedYear);
        const years = new Set([String(selectedYear), ...(data.monthlyBalances || []).map(row => row.month.slice(0, 4)),
            ...data.incomes.map(row => row.date.slice(0, 4)), ...data.expenses.map(row => row.date.slice(0, 4))]);
        return [...years].filter(year => year <= String(selectedYear)).sort().reverse().map(year => {
            const summary = year === String(selectedYear) ? selected : yearSummary(data, year);
            const comparable = year !== String(selectedYear) && selected.complete && summary.complete;
            return { year, ...summary, comparable,
                expenseDifference: comparable ? euro(selected.totals.totalExpense - summary.totals.totalExpense) : null,
                savingsDifference: comparable ? euro(selected.totals.totalSavings - summary.totals.totalSavings) : null };
        });
    }
    return { ACTIONS, METRICS, euro, key, sourceSignature, monthEntries, validateRecords, calculate, prepareRecord, yearSummary,
        savingsRate, monthStatus, periodSummary, compareYears };
}));
