const MapMotion = (() => {
	const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
	const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

	const orbitPoint = (planet, angle) => {
		const x = finite(planet.x);
		const y = finite(planet.y);
		const rx = Math.max(1, Math.abs(finite(planet.orbitRx, 1)));
		const ry = Math.max(1, Math.abs(finite(planet.orbitRy, 1)));
		const tilt = finite(planet.tilt);
		const orbitalAngle = finite(angle);
		const cosAngle = Math.cos(orbitalAngle);
		const sinAngle = Math.sin(orbitalAngle);
		const cosTilt = Math.cos(tilt);
		const sinTilt = Math.sin(tilt);
		const localX = cosAngle * rx;
		const localY = sinAngle * ry;
		const tangentX = -sinAngle * rx * cosTilt - cosAngle * ry * sinTilt;
		const tangentY = -sinAngle * rx * sinTilt + cosAngle * ry * cosTilt;

		return {
			x: x + localX * cosTilt - localY * sinTilt,
			y: y + localX * sinTilt + localY * cosTilt,
			depth: sinAngle,
			tangentAngle: Math.atan2(tangentY, tangentX)
		};
	};

	const connectorBetween = (fromPlanet, toPlanet) => {
		const dx = toPlanet.x - fromPlanet.x;
		const dy = toPlanet.y - fromPlanet.y;
		const distance = Math.hypot(dx, dy) || 1;
		const fromInset = Math.max(0, fromPlanet.radius - 1) / distance;
		const toInset = Math.max(0, toPlanet.radius - 1) / distance;
		const p1 = { x: fromPlanet.x + dx * fromInset, y: fromPlanet.y + dy * fromInset };
		const p2 = { x: toPlanet.x - dx * toInset, y: toPlanet.y - dy * toInset };
		return {
			p1,
			cp1: { x: (p1.x * 2 + p2.x) / 3, y: (p1.y * 2 + p2.y) / 3 },
			cp2: { x: (p1.x + p2.x * 2) / 3, y: (p1.y + p2.y * 2) / 3 },
			p2
		};
	};

	const cubicPoint = (connector, t) => {
		const progress = clamp(finite(t), 0, 1);
		const remaining = 1 - progress;
		const remainingSquared = remaining * remaining;
		const progressSquared = progress * progress;

		return {
			x: remainingSquared * remaining * connector.p1.x
				+ 3 * remainingSquared * progress * connector.cp1.x
				+ 3 * remaining * progressSquared * connector.cp2.x
				+ progressSquared * progress * connector.p2.x,
			y: remainingSquared * remaining * connector.p1.y
				+ 3 * remainingSquared * progress * connector.cp1.y
				+ 3 * remaining * progressSquared * connector.cp2.y
				+ progressSquared * progress * connector.p2.y
		};
	};

	const stepInertia = (state, dtMs, bounds, options = {}) => {
		const min = finite(bounds && bounds.min);
		const max = Math.max(min, finite(bounds && bounds.max, min));
		let position = clamp(finite(state && state.position), min, max);
		let velocity = finite(state && state.velocity);
		const reducedMotion = Boolean(options.reducedMotion);

		if (reducedMotion) {
			return { position, velocity: 0 };
		}

		const maxDeltaMs = Math.max(0, finite(options.maxDeltaMs, 250));
		const seconds = clamp(finite(dtMs), 0, maxDeltaMs) / 1000;
		const friction = Math.max(0, finite(options.friction, 6.5));
		const epsilon = Math.max(0, finite(options.epsilon, 4));

		if (seconds > 0 && velocity !== 0) {
			if (friction > 0) {
				const decay = Math.exp(-friction * seconds);
				position += velocity * (1 - decay) / friction;
				velocity *= decay;
			} else {
				position += velocity * seconds;
			}
		}

		if (position <= min) {
			position = min;
			if (velocity < 0) velocity = 0;
		} else if (position >= max) {
			position = max;
			if (velocity > 0) velocity = 0;
		}

		if (Math.abs(velocity) < epsilon) velocity = 0;
		return { position, velocity };
	};

	return Object.freeze({
		orbitPoint,
		connectorBetween,
		cubicPoint,
		stepInertia
	});
})();

if (typeof globalThis !== 'undefined') {
	globalThis.MapMotion = MapMotion;
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = MapMotion;
}
