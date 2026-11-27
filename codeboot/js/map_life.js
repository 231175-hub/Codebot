const MapLife = {
	crew: ['orb', 'stalk', 'manta', 'orb', 'manta', 'stalk', 'orb'],
	ships: [
		{ hull: '#4bcadf', trim: '#fcdf82', points: [[-27, 2], [-15, -5], [15, -5], [27, 2], [13, 11], [-15, 11]] },
		{ hull: '#fc8b93', trim: '#bfe88d', points: [[-29, 11], [-17, -4], [6, -6], [29, 4], [8, 8], [-10, 8], [-19, 13]] },
		{ hull: '#9c9dfb', trim: '#faadcb', points: [[-25, 3], [-19, -7], [10, -4], [27, 0], [18, 9], [-19, 10]] },
		{ hull: '#9ae8ae', trim: '#ffbe9f', points: [[-26, 8], [-25, -4], [-9, -4], [10, -8], [25, 3], [15, 11], [-10, 11]] },
		{ hull: '#fb7185', trim: '#fbe6a2', points: [[-28, 3], [-18, -6], [-9, -3], [12, -3], [25, -9], [28, 1], [18, 10], [-17, 10]] }
	],

	ellipse(ctx, x, y, rx, ry, fill, angle = 0) {
		ctx.beginPath();
		ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
		ctx.fillStyle = fill;
		ctx.fill();
	},

	drawWalker(ctx, planet, time, reducedMotion) {
		const kind = this.crew[planet.index % this.crew.length];
		const poseTime = reducedMotion ? 0 : time;
		const phase = poseTime / 4800 + planet.index * 1.65 + 0.4;
		const offset = Math.sin(phase) * Math.min(46, planet.radius * 0.3);
		const surface = planet.y - Math.sqrt(planet.radius ** 2 - offset ** 2);
		const size = Math.min(64, planet.radius * 0.44);
		ctx.save();
		ctx.translate(planet.x + offset, surface + 8);
		this.ellipse(ctx, 0, size * 0.48, size * 0.33, size * 0.07, 'rgba(3,10,28,0.45)');
		ctx.scale(Math.cos(phase) < 0 ? -1 : 1, 1);
		AlienArt.draw(ctx, kind, 0, 0, size, poseTime);
		ctx.restore();
	},

	drawTraffic(ctx, route, index, time) {
		const ship = this.ships[index % this.ships.length];
		const pilot = this.crew[(index + 2) % this.crew.length];
		const phase = time / (5000 + index * 560) + index * 2.6 - 0.55;
		const point = MapMotion.cubicPoint(route, 0.5 + 0.31 * Math.sin(phase));
		const lane = index % 2 === 0 ? -1 : 1;
		const drift = time / 900 + index * 1.2;
		ctx.save();
		ctx.translate(point.x, point.y + lane * (65 + index * 7) + Math.sin(drift) * 8);
		ctx.rotate(Math.sin(drift) * 0.09);
		ctx.scale(Math.cos(phase) < 0 ? -1 : 1, 1);

		const exhaust = ctx.createLinearGradient(-52, 0, -21, 0);
		exhaust.addColorStop(0, 'transparent');
		exhaust.addColorStop(1, ship.trim);
		this.ellipse(ctx, -35, 5, 12 + Math.sin(drift * 7) * 3, 2.2, exhaust);
		this.ellipse(ctx, -32, 8, 9, 1.3, exhaust);

		this.ellipse(ctx, 0, -4, 17, 14, '#285d89');
		AlienArt.draw(ctx, pilot, 0, -4.5, 25);
		this.ellipse(ctx, -9, -13, 3.2, 1.2, 'rgba(227,252,255,0.75)', -0.35);

		const metal = ctx.createLinearGradient(0, -6, 0, 14);
		metal.addColorStop(0, ship.hull);
		metal.addColorStop(1, '#30365c');
		ctx.beginPath();
		for (const [i, [x, y]] of ship.points.entries()) {
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.fillStyle = metal;
		ctx.fill();
		ctx.strokeStyle = ship.hull;
		ctx.lineWidth = 1.05;
		ctx.stroke();
		for (const x of [-13, -4, 5, 14]) {
			this.ellipse(ctx, x, 4, 2.45, 1.35, ship.trim);
		}
		ctx.restore();
	}
};
