const test = require('node:test');
const assert = require('node:assert/strict');
const MapMotion = require('../js/map_motion.js');

const closeTo = (actual, expected, tolerance, message) => {
	assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} ≠ ${expected}`);
};

test('orbitPoint keeps every level on the rotated orbital ellipse', () => {
	const planet = { x: 520, y: 290, orbitRx: 196, orbitRy: 62, tilt: 0.24 };
	const cosTilt = Math.cos(planet.tilt);
	const sinTilt = Math.sin(planet.tilt);

	for (let base = -Math.PI; base <= Math.PI; base += Math.PI / 5) {
		for (let slot = 0; slot < 4; slot++) {
			const angle = base + slot * Math.PI / 2 + 0.6;
			const point = MapMotion.orbitPoint(planet, angle);
			const dx = point.x - planet.x;
			const dy = point.y - planet.y;
			const localX = dx * cosTilt + dy * sinTilt;
			const localY = -dx * sinTilt + dy * cosTilt;
			const ellipse = (localX * localX) / (planet.orbitRx * planet.orbitRx)
				+ (localY * localY) / (planet.orbitRy * planet.orbitRy);

			closeTo(ellipse, 1, 1e-10, 'el punto debe permanecer en la órbita');
			closeTo(point.depth, Math.sin(angle), 1e-12, 'la profundidad debe seguir el ángulo orbital');
			assert.ok(Number.isFinite(point.tangentAngle));
		}
	}
});

test('orbitPoint tangent follows the direction of orbital travel', () => {
	const planet = { x: 520, y: 290, orbitRx: 196, orbitRy: 62, tilt: -0.2 };
	const angle = 1.17;
	const point = MapMotion.orbitPoint(planet, angle);
	const next = MapMotion.orbitPoint(planet, angle + 1e-6);
	const sampledTangent = Math.atan2(next.y - point.y, next.x - point.x);
	const delta = Math.atan2(Math.sin(sampledTangent - point.tangentAngle), Math.cos(sampledTangent - point.tangentAngle));

	closeTo(delta, 0, 1e-5, 'la tangente debe coincidir con el movimiento');
});

test('connectorBetween joins the planet rims while ignoring the moving moons', () => {
	const from = { x: 500, y: 290, radius: 108, orbitRx: 196, orbitRy: 62, tilt: 0.26 };
	const to = { x: 1320, y: 315, radius: 125, orbitRx: 196, orbitRy: 62, tilt: -0.2 };
	const connector = MapMotion.connectorBetween(from, to);

	assert.ok(connector.p1.x > from.x);
	assert.ok(connector.p2.x < to.x);
	closeTo(Math.hypot(connector.p1.x - from.x, connector.p1.y - from.y), from.radius - 1, 1e-9, 'borde de salida');
	closeTo(Math.hypot(connector.p2.x - to.x, connector.p2.y - to.y), to.radius - 1, 1e-9, 'borde de llegada');
	assert.deepEqual(connector, MapMotion.connectorBetween(
		{ ...from, orbitRx: 240, orbitRy: 116, angle: 2.21 },
		{ ...to, orbitRx: 310, tilt: 0.4, angle: 5.74 }
	));

	for (let sample = 1; sample < 200; sample++) {
		const point = MapMotion.cubicPoint(connector, sample / 200);
		const fromDistance = Math.hypot(point.x - from.x, point.y - from.y);
		const toDistance = Math.hypot(point.x - to.x, point.y - to.y);
		assert.ok(fromDistance > from.radius, `muestra ${sample} invade el planeta de origen`);
		assert.ok(toDistance > to.radius, `muestra ${sample} invade el planeta de destino`);
		const expectedY = connector.p1.y + (connector.p2.y - connector.p1.y) * (sample / 200);
		closeTo(point.y, expectedY, 1e-9, 'la ruta entre planetas es recta');
	}
});

test('connectorBetween also remains stable when travelling to the left', () => {
	const from = { x: 1320, y: 330, radius: 108, orbitRx: 196, orbitRy: 62, tilt: -0.2 };
	const to = { x: 500, y: 270, radius: 108, orbitRx: 196, orbitRy: 62, tilt: 0.26 };
	const connector = MapMotion.connectorBetween(from, to);

	assert.ok(connector.p1.x < from.x);
	assert.ok(connector.p2.x > to.x);
	assert.ok(connector.cp1.x <= connector.p1.x && connector.cp1.x >= connector.p2.x);
	assert.ok(connector.cp2.x <= connector.p1.x && connector.cp2.x >= connector.p2.x);
});

test('stepInertia decays velocity monotonically and keeps moving after release', () => {
	let state = { position: 420, velocity: 1600 };
	let previousVelocity = state.velocity;

	for (let frame = 0; frame < 30; frame++) {
		const next = MapMotion.stepInertia(state, 1000 / 60, { min: 0, max: 4000 }, { friction: 6.5, epsilon: 0 });
		assert.ok(next.position > state.position);
		assert.ok(next.velocity > 0);
		assert.ok(next.velocity < previousVelocity);
		state = next;
		previousVelocity = next.velocity;
	}
});

test('stepInertia is consistent across different frame sizes', () => {
	const initial = { position: 300, velocity: 1450 };
	const options = { friction: 5.75, epsilon: 0, maxDeltaMs: 500 };
	let smallFrames = initial;

	for (let frame = 0; frame < 10; frame++) {
		smallFrames = MapMotion.stepInertia(smallFrames, 1000 / 60, { min: 0, max: 4000 }, options);
	}

	const oneFrame = MapMotion.stepInertia(initial, 1000 / 6, { min: 0, max: 4000 }, options);
	closeTo(smallFrames.position, oneFrame.position, 1e-9, 'la posición debe ser independiente del tamaño del cuadro');
	closeTo(smallFrames.velocity, oneFrame.velocity, 1e-9, 'la velocidad debe ser independiente del tamaño del cuadro');
});

test('stepInertia clamps bounds and only cancels outward velocity', () => {
	const right = MapMotion.stepInertia({ position: 98, velocity: 300 }, 100, { min: 0, max: 100 }, { friction: 0, epsilon: 0 });
	assert.deepEqual(right, { position: 100, velocity: 0 });

	const left = MapMotion.stepInertia({ position: 2, velocity: -300 }, 100, { min: 0, max: 100 }, { friction: 0, epsilon: 0 });
	assert.deepEqual(left, { position: 0, velocity: 0 });

	const inward = MapMotion.stepInertia({ position: 110, velocity: -50 }, 0, { min: 0, max: 100 }, { friction: 0, epsilon: 0 });
	assert.deepEqual(inward, { position: 100, velocity: -50 });
});

test('stepInertia stops immediately when reduced motion is requested', () => {
	const result = MapMotion.stepInertia(
		{ position: 420, velocity: 1800 },
		16,
		{ min: 0, max: 1000 },
		{ reducedMotion: true }
	);

	assert.deepEqual(result, { position: 420, velocity: 0 });
});
