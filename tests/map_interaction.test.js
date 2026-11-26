const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const MapMotion = require('../js/map_motion.js');

const source = readFileSync(join(__dirname, '../js/map3d.js'), 'utf8');

function createMap() {
	const events = new Map();
	const selected = [];
	const map = runInNewContext(`${source}\nProgressMap3D`, {
		MapMotion,
		window: { addEventListener() {} }
	});
	const dispatchPointer = (type, coordinates = {}) => {
		events.get(type)({
			isPrimary: true, pointerId: 1, pointerType: 'mouse', button: 0,
			timeStamp: 16, clientX: 120, clientY: 100, ...coordinates
		});
	};
	map.virtualWidth = 400;
	map.virtualHeight = 300;
	map.canvas = {
		style: {},
		addEventListener() {},
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 })
	};
	map.container = {
		style: {},
		scrollLeft: 30,
		scrollWidth: 400,
		clientWidth: 250,
		classList: { add() {}, remove() {} },
		addEventListener(type, handler) { events.set(type, handler); },
		setPointerCapture() {},
		hasPointerCapture() { return true; },
		releasePointerCapture() {}
	};
	map.state = { unlockedLevel: 0, stars: { '1.2': 2 } };
	map.nodes = [
		{ x: 55, y: 100, scale: 1, depth: 0.5, level: { id: '1.1' } },
		{ x: 120, y: 100, scale: 1, depth: 0.5, level: { id: '1.2' } },
		{ x: 200, y: 100, scale: 1, depth: 0.5, level: { id: '1.3' } }
	];
	map.onSelectLevel = (index) => selected.push(index);
	map.bindEvents();
	return { map, selected, dispatchPointer };
}

test('tapping a completed moon selects it through the container capture', () => {
	const { selected, dispatchPointer } = createMap();
	dispatchPointer('pointerdown');
	dispatchPointer('pointerup');
	assert.deepEqual(selected, [1]);
});

test('dragged, canceled, and locked moons do not open a level', () => {
	const { selected, dispatchPointer } = createMap();
	dispatchPointer('pointerdown');
	dispatchPointer('pointerup', { clientX: 132 });
	dispatchPointer('pointerdown');
	dispatchPointer('pointercancel');
	dispatchPointer('pointerdown', { clientX: 200 });
	dispatchPointer('pointerup', { clientX: 200 });
	assert.deepEqual(selected, []);
});

test('the exposed part of a back moon can be selected', () => {
	const { map } = createMap();
	map.planets = [{ x: 200, y: 160, radius: 108 }];
	Object.assign(map.nodes[1], { x: 305, y: 160, depth: -0.5, planetIndex: 0 });
	assert.equal(map.hitNode(302, 160), -1);
	assert.equal(map.hitNode(315, 160), 1);
});
