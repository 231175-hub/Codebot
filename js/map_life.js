const MapLife = {
	crew: [
		{ skin: '#baf178', accent: '#ffdc64', suit: '#4bcadf', kind: 'antennas' },
		{ skin: '#ffafca', accent: '#fd6d82', suit: '#a9a2ff', kind: 'ears' },
		{ skin: '#c0b5ff', accent: '#ffce80', suit: '#83e4b2', kind: 'horns' },
		{ skin: '#7cead9', accent: '#dcf97c', suit: '#ff9f82', kind: 'ears' },
		{ skin: '#ffd08d', accent: '#f593da', suit: '#8fbcff', kind: 'antennas' },
		{ skin: '#ffa78f', accent: '#9cf4e4', suit: '#926dd2', kind: 'triple' }
	],
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

	drawHead(ctx, alien) {
		if (alien.kind === 'ears') {
			for (const side of [-1, 1]) {
				this.ellipse(ctx, side * 8, -8, 3.3, 7.3, alien.skin, side * 0.43);
				this.ellipse(ctx, side * 9, -9, 1.3, 4.4, alien.accent, side * 0.43);
			}
		} else {
			for (const side of [-1, 1]) {
				ctx.beginPath();
				ctx.moveTo(side * 6, -4);
				ctx.quadraticCurveTo(side * 8, -12, side * 10, -14);
				ctx.strokeStyle = alien.skin;
				ctx.lineWidth = alien.kind === 'horns' ? 3.5 : 1.8;
				ctx.lineCap = 'round';
				ctx.stroke();
				this.ellipse(ctx, side * 10, -14, 2.2, 2.2, alien.accent);
			}
		}

		this.ellipse(ctx, 0, 1, 12.5, alien.kind === 'horns' ? 8 : 9.5, '#22324c');
		this.ellipse(ctx, 0, 0, 12, alien.kind === 'horns' ? 7.5 : 9, alien.skin);
		this.ellipse(ctx, -4, -5, 4, 1.6, 'rgba(255,255,255,0.55)', -0.15);
		const eyes = alien.kind === 'triple' ? [-6, 1, 8] : [-3.5, 5.5];
		for (const x of eyes) {
			this.ellipse(ctx, x, 0, 2.3, 3.15, '#1a2944');
			this.ellipse(ctx, x + 0.6, -1, 0.8, 0.95, '#ffffff');
		}
		this.ellipse(ctx, -7.5, 3.2, 2.2, 1.05, alien.accent);
		this.ellipse(ctx, 9, 3.2, 1.7, 0.9, alien.accent);
		ctx.beginPath();
		ctx.arc(1.2, 4, 1.8, 0.1, Math.PI - 0.1);
		ctx.lineWidth = 0.95;
		ctx.strokeStyle = '#344058';
		ctx.stroke();
	},

	drawWalker(ctx, planet, time, reducedMotion) {
		const alien = this.crew[planet.index];
		const phase = time / 4200 + planet.index * 1.65 + 0.4;
		const offset = Math.sin(phase) * 46;
		const surface = planet.y - Math.sqrt(planet.radius ** 2 - offset ** 2);
		const stride = reducedMotion ? 0 : Math.sin(time / 100 + planet.index * 1.4);
		ctx.save();
		ctx.translate(planet.x + offset, surface + 24);
		this.ellipse(ctx, 0, 0, 13, 3.8, 'rgba(3,10,28,0.45)');
		ctx.scale(Math.cos(phase) < 0 ? -1 : 1, 1);

		for (const side of [-1, 1]) {
			const legX = side * (5 + stride * 3);
			const legY = Math.min(0, side * stride * 3.5);
			ctx.beginPath();
			ctx.moveTo(side * 3, -8);
			ctx.lineTo(legX, legY - 2);
			ctx.strokeStyle = alien.suit;
			ctx.lineWidth = 3.2;
			ctx.lineCap = 'round';
			ctx.stroke();
			this.ellipse(ctx, legX + 1, legY - 1, 3.4, 2, '#e7f3ff');
			this.ellipse(ctx, side * 8, -12 + side * stride * 1.7, 2.6, 4.2, alien.skin, -side * 0.45);
		}
		const bob = Math.abs(stride) * 1.55;
		this.ellipse(ctx, 0, -11 - bob, 7.8, 7.7, alien.suit);
		this.ellipse(ctx, 1.5, -8 - bob, 2.2, 1.4, alien.accent);
		ctx.translate(0, -22 - bob);
		this.drawHead(ctx, alien);
		ctx.restore();
	},

	drawTraffic(ctx, route, index, time) {
		const ship = this.ships[index];
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

		this.ellipse(ctx, 0, -3, 15, 13, '#236582');
		ctx.save();
		ctx.translate(1, -7);
		ctx.scale(0.64, 0.64);
		this.drawHead(ctx, pilot);
		ctx.restore();
		this.ellipse(ctx, -7, -11, 4.3, 1.3, 'rgba(227,252,255,0.75)', -0.35);

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
