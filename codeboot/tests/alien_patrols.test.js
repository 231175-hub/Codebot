const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');

const script = name => readFileSync(join(__dirname, '../js', name), 'utf8');

function setupEngine(engineFile, engineName, path) {
	const { Engine, AlienPatrols } = runInNewContext(
		`${script('alien_patrols.js')}\n${script(engineFile)}\n({ Engine: ${engineName}, AlienPatrols })`,
		{ window: {}, setTimeout: resolve => resolve() }
	);
	const engine = Object.create(Engine.prototype);
	engine.bot = { x: 1, y: 1, dir: 1, renderAngle: 0, memory: 0 };
	engine.grid = Array.from({ length: 5 }, () => Array(6).fill(0));
	engine.alienPatrols = AlienPatrols.create([{ kind: 'orb', path }]);
	engine.alienModels = [];
	engine.laserMeshes = [];
	engine.alienStepRevision = 0;
	engine.startAnimation = async () => {};
	engine.tickPhysics = async () => {};
	engine.updateBot3DPosition = () => {};
	return engine;
}

for (const [engineFile, engineName] of [['engine.js', 'GameEngine'], ['engine3d.js', 'GameEngine3D']]) {
	test(`${engineName} detecta al alien y bloquea cruzar su casilla`, async () => {
		const engine = setupEngine(engineFile, engineName, [[2, 1], [2, 2]]);
		assert.equal(engine.checkAheadType('enemigo'), true);
		assert.equal(engine.checkAheadType('vacio'), false);
		await assert.rejects(engine.step('avanzar'), /Un alien interceptó/);
		assert.equal(engine.bot.x, 1);
		assert.equal(engine.alienPatrols[0].index, 0);

		await engine.step('esperar');
		assert.equal(engine.checkAheadType('vacio'), true);
		await engine.step('girar_izq');
		assert.equal(engine.alienPatrols[0].index, 0);
	});

	test(`${engineName} detecta contacto cuando la patrulla alcanza a BIT`, async () => {
		const engine = setupEngine(engineFile, engineName, [[1, 2], [1, 1]]);
		await assert.rejects(engine.step('esperar'), /Un alien interceptó/);
		assert.equal(engine.alienPatrols[0].index, 1);
	});

	test(`${engineName} bloquea saltos y empujes hacia un alien`, async () => {
		const engine = setupEngine(engineFile, engineName, [[3, 1], [3, 2]]);
		await assert.rejects(engine.step('saltar'), /Un alien interceptó/);
		assert.equal(engine.bot.x, 1);
		engine.grid[1][2] = 8;
		await assert.rejects(engine.step('empujar'), /Espacio bloqueado/);
		assert.equal(engine.grid[1][2], 8);
		assert.equal(engine.grid[1][3], 0);
	});

	test(`${engineName} conserva la posición de la patrulla al detener una orden pendiente`, async () => {
		const engine = setupEngine(engineFile, engineName, [[2, 1], [2, 2]]);
		let finish;
		engine.performWait = () => new Promise(resolve => { finish = resolve; });
		const step = engine.step('esperar');
		engine.cancelAnimation();
		finish();
		await step;
		assert.equal(engine.alienPatrols[0].index, 0);
	});
}
