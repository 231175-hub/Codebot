const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');
const MatrixMission = require('../js/matrix.js');

const readGameScript = file => readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
const levels = runInNewContext(`${readGameScript('levels.js')}\nLEVELS`);
const blocks = runInNewContext(`${readGameScript('blocks.js')}\nBlocksManager`);

const write = (row, column, value) => ['matriz_escribir', { ROW: row, COLUMN: column, VALUE: value }];
const copy = (sourceRow, sourceColumn, targetRow, targetColumn) => ['matriz_copiar', {
	SOURCE_ROW: sourceRow,
	SOURCE_COLUMN: sourceColumn,
	TARGET_ROW: targetRow,
	TARGET_COLUMN: targetColumn
}];

function workspaceFor(commands) {
	const top = commands.reduceRight((next, [type, fields], i) => ({
		id: `block-${i}`,
		type,
		getFieldValue: key => fields[key],
		getNextBlock: () => next
	}), null);
	return { getTopBlocks: () => top ? [top] : [] };
}

const solutions = {
	'6.1': [write(1, 2, 7), write(2, 3, 4)],
	'6.2': [copy(1, 3, 1, 1), copy(1, 1, 1, 3), copy(2, 1, 2, 2)],
	'6.3': [
		['matriz_llenar_fila', { ROW: 2, VALUE: 7 }],
		['matriz_llenar_columna', { COLUMN: 2, VALUE: 5 }]
	],
	'6.4': [copy(1, 1, 1, 1), copy(1, 2, 2, 1), copy(1, 3, 3, 1), copy(2, 1, 1, 2), copy(2, 2, 2, 2), copy(2, 3, 3, 2)]
};

for (const [id, commands] of Object.entries(solutions)) {
	test(`the generated Blockly program solves matrix mission ${id} within its three-star limit`, async () => {
		const level = levels.find(level => level.id === id);
		const mission = new MatrixMission(level.matrix);
		const sourceBefore = JSON.stringify(level.matrix.source);
		assert.equal(mission.isSolved(), false);
		assert.ok(commands.every(([type]) => level.availableBlocks.includes(type)));
		assert.equal(commands.length, level.maxBlocksFor3Stars);

		const workspace = workspaceFor(commands);
		const run = new Function(`return (${blocks.generateExecutableCode(workspace)});`)();
		await run({ step: (action, _id, args) => mission.step(action, args) }, () => false);
		assert.equal(mission.isSolved(), true);
		assert.deepEqual(mission.values, level.matrix.target);
		assert.equal(JSON.stringify(level.matrix.source), sourceBefore);
		mission.reset();
		assert.deepEqual(mission.values, level.matrix.initial);
		assert.equal(mission.isSolved(), false);
	});
}

test('the JavaScript preview clarifies zero-based indexing for matrix commands', () => {
	const workspace = workspaceFor([write(1, 2, 7), copy(2, 3, 3, 2), ...solutions['6.3']]);
	assert.equal(blocks.generateCleanCode(workspace), [
		'matriz[0][1] = 7;',
		'matriz[2][1] = fuente[1][2];',
		'matriz[1].fill(7);',
		'for (const fila of matriz) {\n\tfila[1] = 5;\n}'
	].join('\n'));
});

test('an out-of-range source or destination leaves the work matrix unchanged', async () => {
	const { matrix } = levels.find(level => level.id === '6.4');
	const mission = new MatrixMission(matrix);
	await assert.rejects(mission.step('matriz_copiar', [3, 1, 1, 1]), /fuente.*fila.*1 y 2/);
	await assert.rejects(mission.step('matriz_copiar', [1, 3, 1, 3]), /trabajo.*columna.*1 y 2/);
	assert.deepEqual(mission.values, matrix.initial);
});
