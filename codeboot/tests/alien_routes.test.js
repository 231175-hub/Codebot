const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');

const readScript = name => readFileSync(join(__dirname, '..', 'js', name), 'utf8');
const { GameEngine, GameEngine3D, AlienPatrols, LEVELS } = runInNewContext(
	['levels.js', 'alien_patrols.js', 'engine.js', 'engine3d.js'].map(readScript).join('\n') +
		'\n({ GameEngine, GameEngine3D, AlienPatrols, LEVELS })',
	{
		window: {},
		document: { getElementById: () => ({ width: 800, height: 500, getContext: () => ({}) }) },
		requestAnimationFrame() {},
		setTimeout: callback => callback(),
		performance
	}
);
const actions = {
	F: 'avanzar', L: 'girar_izq', R: 'girar_der', C: 'despejar', W: 'esperar', P: 'empujar', E: 'encender'
};
const missions = [
	['1.1', 'F5 E', 'R F4 L F5 L F4 E'],
	['1.2', 'F4 L F4 E', 'F2 L F2 R F2 L F2 E'],
	['1.3', 'F3 R F4 L F2 E', 'F3 R F2 R F2 L F2 L F4 E', true],
	['1.4', 'F3 E F2 R F4 E', 'F3 E R F2 L F2 R F2 E'],
	['7.1', 'F5 R F2', 'R F6 L F11 L F4 L F6'],
	['7.2', 'F C W F4', 'R F5 L F11 L F5 L F6'],
	['7.3', 'C L F R F4 R F L F', 'R F4 L F11 L F3 L F6 R F'],
	['7.4', 'F P F5 R F', 'R F5 L F12 L F4 L F6'],
	['7.5', 'F R F2 L C L F R R F L F2 R F R F2 L F L F3 W F L F',
		'F8 R F2 L F R F L C L F R R F L F2 R F R F2 L F L F2 L F2 L F3 R F L F3 L F']
];

function make2DEngine(level) {
	const engine = new GameEngine('canvas');
	engine.loadLevel(level);
	return engine;
}

function make3DEngine(level) {
	const engine = Object.create(GameEngine3D.prototype);
	const cores = level.grid.flatMap((row, y) => row.flatMap((tile, x) => tile === 2 ? [{
		x, y, active: false,
		crystalMesh: { material: { color: { setHex() {} } } },
		light: {},
		group: { position: { x, z: y } }
	}] : []));
	Object.assign(engine, {
		level,
		grid: level.grid.map(row => [...row]),
		cores,
		bot: { ...level.start, renderAngle: 0, memory: 0 },
		bot3D: { setMood() {} },
		alienPatrols: AlienPatrols.create(level.aliens || []),
		alienModels: [],
		alienStepRevision: 0,
		laserMeshes: [],
		infotronsCollected: 0,
		infotronsRequired: level.infotronsRequired || 0,
		exitUnlocked: !level.infotronsRequired,
		spawnCoreParticles3D() {},
		refreshSupaplexMeshes() {}
	});
	return engine;
}

async function runProgram(engine, program) {
	engine.startAnimation = animation => {
		Object.assign(engine.bot, { renderX: animation.toX, renderY: animation.toY, renderAngle: animation.toAngle });
		return Promise.resolve();
	};
	const visited = new Set();
	let turns = 0;
	let blocks = 0;
	const canRepeat = engine.level.availableBlocks.includes('repetir');
	for (const command of program.split(' ')) {
		const action = actions[command[0]];
		const blockType = { C: 'despejar_frente', P: 'empujar_frente' }[command[0]] || action;
		assert.ok(engine.level.availableBlocks.includes(blockType), `Bloque no disponible: ${blockType}`);
		const count = Number(command.slice(1)) || 1;
		blocks += canRepeat ? Math.min(count, 2) : count;
		for (let step = 0; step < count; step++) {
			const location = `${engine.bot.x},${engine.bot.y}`;
			try {
				await engine.step(action);
			} catch (error) {
				throw new Error(`Paso ${turns + 1} (${action} desde ${location}): ${error.message}`);
			}
			visited.add(`${engine.bot.x},${engine.bot.y}`);
			turns++;
		}
	}
	return { turns, blocks, visited };
}

async function solveMission(engine, program) {
	const result = await runProgram(engine, program);
	assert.equal(engine.infotronsCollected, engine.level.infotronsRequired || 0);
	assert.equal(engine.isAtGoal(), true);
	assert.equal(engine.areAllCoresActive(), true);
	return result;
}

for (const [renderer, makeEngine] of [['2D', make2DEngine], ['3D', make3DEngine]]) {
	test(`la primera misión exige los infotrones y el núcleo en el motor ${renderer}`, async () => {
		const level = LEVELS[0];
		const engine = makeEngine(level);
		await runProgram(engine, 'F5');
		assert.equal(engine.infotronsCollected, level.infotronsRequired);
		assert.equal(engine.isAtGoal(), false);
		assert.equal(engine.areAllCoresActive(), false);

		await engine.step('encender');
		assert.equal(engine.isAtGoal(), true);
		await engine.step('girar_der');
		await engine.step('avanzar');
		assert.equal(engine.isAtGoal(), false);

		const withoutCrystals = makeEngine(level);
		Object.assign(withoutCrystals.bot, level.exit);
		await withoutCrystals.step('encender');
		assert.equal(withoutCrystals.isAtGoal(), false);
	});

	for (const [id, shortcut, detour, detourEarnsThreeStars = false] of missions) {
		test(`la misión ${id} se resuelve por dos rutas distintas en el motor ${renderer}`, async () => {
			const level = LEVELS.find(entry => entry.id === id);
			const short = await solveMission(makeEngine(level), shortcut);
			const long = await solveMission(makeEngine(level), detour);
			assert.ok(long.turns > short.turns);
			assert.ok(long.blocks > short.blocks);
			assert.ok(short.blocks <= level.maxBlocksFor3Stars);
			assert.equal(long.blocks <= level.maxBlocksFor3Stars, detourEarnsThreeStars);
			assert.ok([...short.visited].some(cell => !long.visited.has(cell)));
			assert.ok([...long.visited].some(cell => !short.visited.has(cell)));
		});
	}
}
