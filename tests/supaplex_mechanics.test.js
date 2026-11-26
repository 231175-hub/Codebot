const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');

const readGameScript = file => readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');

const levels = runInNewContext(`${readGameScript('levels.js')}\nLEVELS`);
const blocks = runInNewContext(`${readGameScript('blocks.js')}\nBlocksManager`);

test('los niveles de Supaplex 7.1 a 7.5 estan correctamente registrados', () => {
	const supaplexLevels = levels.filter(lvl => lvl.module === 'Microprocesador');
	assert.equal(supaplexLevels.length, 5);
	assert.equal(supaplexLevels[0].id, '7.1');
	assert.equal(supaplexLevels[0].infotronsRequired, 3);
	assert.equal(supaplexLevels[1].id, '7.2');
	assert.equal(supaplexLevels[1].infotronsRequired, 2);
	assert.equal(supaplexLevels[4].id, '7.5');
	assert.equal(supaplexLevels[4].infotronsRequired, 9);
});

test('los generadores de codigo de Blockly para bloques de Supaplex funcionan correctamente', () => {
	const mockWorkspace = {
		getTopBlocks: () => [
			{
				id: 'blk-clear',
				type: 'despejar_frente',
				getNextBlock: () => ({
					id: 'blk-push',
					type: 'empujar_frente',
					getNextBlock: () => null
				})
			}
		]
	};

	const executable = blocks.generateExecutableCode(mockWorkspace);
	assert.ok(executable.includes("await engine.step('despejar', 'blk-clear')"));
	assert.ok(executable.includes("await engine.step('empujar', 'blk-push')"));

	const clean = blocks.generateCleanCode(mockWorkspace);
	assert.ok(clean.includes('despejarFrente();'));
	assert.ok(clean.includes('empujarAdelante();'));
});

test('la fisica de gravedad de Zonks desciende en espacio vacio', async () => {
	const SoundFX = { playZonkImpact() {}, playExitReady() {}, playError() {} };
	const BitRenderer = { draw() {} };
	const engineScript = readGameScript('engine.js');
	const GameEngineClass = runInNewContext(`
		${engineScript}
		GameEngine;
	`, {
		SoundFX,
		window: { SoundFX },
		document: { getElementById: () => ({ getContext: () => ({}) }) },
		requestAnimationFrame: () => {}
	});

	const engine = new GameEngineClass('dummy');
	engine.grid = [
		[1, 1, 1, 1],
		[1, 8, 1, 1],
		[1, 0, 1, 1],
		[1, 1, 1, 1]
	];
	engine.bot = { x: 3, y: 3, dir: 1 };

	await engine.tickPhysics();
	assert.equal(engine.grid[1][1], 0);
	assert.equal(engine.grid[2][1], 8);
});

test('la fisica de balanceo de Zonks rueda sobre superficies redondas', async () => {
	const SoundFX = { playZonkImpact() {}, playExitReady() {}, playError() {} };
	const BitRenderer = { draw() {} };
	const engineScript = readGameScript('engine.js');
	const GameEngineClass = runInNewContext(`
		${engineScript}
		GameEngine;
	`, {
		SoundFX,
		window: { SoundFX },
		document: { getElementById: () => ({ getContext: () => ({}) }) },
		requestAnimationFrame: () => {}
	});

	const engine = new GameEngineClass('dummy');
	engine.grid = [
		[1, 1, 1, 1, 1],
		[1, 0, 8, 0, 1],
		[1, 0, 8, 1, 1],
		[1, 1, 1, 1, 1]
	];
	engine.bot = { x: 4, y: 0, dir: 1 };

	await engine.tickPhysics();
	assert.equal(engine.grid[1][2], 0);
	assert.equal(engine.grid[1][1], 8);
});

test('la transmutacion del electron genera 9 infotrones', async () => {
	const SoundFX = { playZonkImpact() {}, playExitReady() {}, playError() {}, playInfotron() {} };
	const BitRenderer = { draw() {} };
	const engineScript = readGameScript('engine.js');
	const GameEngineClass = runInNewContext(`
		${engineScript}
		GameEngine;
	`, {
		SoundFX,
		window: { SoundFX },
		document: { getElementById: () => ({ getContext: () => ({}) }) },
		requestAnimationFrame: () => {}
	});

	const engine = new GameEngineClass('dummy');
	engine.grid = [
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 16, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0]
	];
	engine.bot = { x: 0, y: 0, dir: 1 };

	engine.transmuteElectron(2, 2);
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			assert.equal(engine.grid[2 + dy][2 + dx], 9);
		}
	}
});

test('el nivel 7.2 se resuelve con exito evitando el aplastamiento con despejar y esperar', async () => {
	const SoundFX = { playZonkImpact() {}, playExitReady() {}, playError() {}, playStep() {}, playMunch() {}, playInfotron() {}, playTurn() {}, playAction() {} };
	const BitRenderer = { draw() {} };
	const engineScript = readGameScript('engine.js');
	const GameEngineClass = runInNewContext(`
		${engineScript}
		GameEngine;
	`, {
		SoundFX,
		window: { SoundFX },
		document: { getElementById: () => ({ getContext: () => ({}) }) },
		requestAnimationFrame: () => {},
		performance: { now: () => Date.now() },
		setTimeout: (cb) => cb(),
		clearTimeout: () => {}
	});

	const engine = new GameEngineClass('dummy');
	engine.startAnimation = function(anim) {
		this.bot.renderX = anim.toX;
		this.bot.renderY = anim.toY;
		return Promise.resolve();
	};
	const lvl = levels.find(l => l.id === '7.2');
	engine.loadLevel(lvl);

	await engine.step('avanzar', '1');
	await engine.step('despejar', '2');
	await engine.step('esperar', '3');
	await engine.step('avanzar', '4');
	await engine.step('avanzar', '5');
	await engine.step('avanzar', '6');
	await engine.step('avanzar', '7');

	assert.equal(engine.bot.x, 6);
	assert.equal(engine.bot.y, 2);
	assert.equal(engine.infotronsCollected, 2);
	assert.equal(engine.exitUnlocked, true);
	assert.equal(engine.isAtGoal(), true);
});

test('caer en fosa activa animacion de caida y genera error de baldosa rota', async () => {
	let fallAnimated = false;
	const SoundFX = { playFall() {}, playStep() {} };
	const BitRenderer = { draw() {} };
	const engineScript = readGameScript('engine.js');
	const GameEngineClass = runInNewContext(`
		${engineScript}
		GameEngine;
	`, {
		SoundFX,
		window: { SoundFX },
		document: { getElementById: () => ({ getContext: () => ({}) }) },
		requestAnimationFrame: () => {},
		performance: { now: () => Date.now() }
	});

	const engine = new GameEngineClass('dummy');
	engine.startAnimation = function(anim) {
		this.bot.renderX = anim.toX;
		this.bot.renderY = anim.toY;
		return Promise.resolve();
	};
	engine.animateFall = async function() {
		fallAnimated = true;
	};

	engine.grid = [
		[1, 1, 1],
		[1, 0, 3],
		[1, 1, 1]
	];
	engine.bot = { x: 1, y: 1, dir: 1, renderX: 1, renderY: 1, renderAngle: 0, jumpHeight: 0, memory: 0, walkFrame: 0, isWalking: false, scaleX: 1, scaleY: 1, alpha: 1, rotationOffset: 0 };

	await assert.rejects(async () => {
		await engine.performMove();
	}, /baldosa rota/);

	assert.equal(fallAnimated, true);
});

test('aplastamiento por Zonk activa animacion de aplastamiento y genera error', async () => {
	let squashAnimated = false;
	const SoundFX = { playSquash() {}, playZonkImpact() {} };
	const BitRenderer = { draw() {} };
	const engineScript = readGameScript('engine.js');
	const GameEngineClass = runInNewContext(`
		${engineScript}
		GameEngine;
	`, {
		SoundFX,
		window: { SoundFX },
		document: { getElementById: () => ({ getContext: () => ({}) }) },
		requestAnimationFrame: () => {},
		performance: { now: () => Date.now() }
	});

	const engine = new GameEngineClass('dummy');
	engine.animateSquash = async function() {
		squashAnimated = true;
	};

	engine.grid = [
		[1, 8, 1],
		[1, 0, 1],
		[1, 1, 1]
	];
	engine.bot = { x: 1, y: 1, dir: 1 };

	await assert.rejects(async () => {
		await engine.tickPhysics();
	}, /Aplastado/);

	assert.equal(squashAnimated, true);
});

test('los niveles con caminos falsos incorporan fosas de trampa', () => {
	const lvl22 = levels.find(l => l.id === '2.2');
	const lvl71 = levels.find(l => l.id === '7.1');
	const lvl73 = levels.find(l => l.id === '7.3');
	const lvl74 = levels.find(l => l.id === '7.4');

	assert.equal(lvl22.grid[3][4], 3);
	assert.equal(lvl71.grid[3][2], 3);
	assert.equal(lvl73.grid[4][3], 3);
	assert.equal(lvl74.grid[1][4], 3);
});
