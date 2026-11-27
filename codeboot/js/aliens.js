const AlienArt = {
	species: {
		orb: { name: 'Céfiro', skin: '#69efac', shade: '#3986ad', accent: '#c6f970' },
		stalk: { name: 'Brote', skin: '#ff9a91', shade: '#aa507d', accent: '#ffde87' },
		manta: { name: 'Vélida', skin: '#bbabff', shade: '#6754b1', accent: '#8cf7e1' }
	},

	outline: '#192245',

	oval(ctx, x, y, rx, ry, fill, angle = 0) {
		ctx.beginPath();
		ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
		ctx.fillStyle = fill;
		ctx.fill();
	},

	fillShape(ctx, fill) {
		ctx.closePath();
		ctx.fillStyle = fill;
		ctx.fill();
		ctx.strokeStyle = this.outline;
		ctx.lineWidth = 1.75;
		ctx.stroke();
	},

	shading(ctx, palette) {
		const colors = ctx.createLinearGradient(-11, -21, 13, 24);
		colors.addColorStop(0, palette.skin);
		colors.addColorStop(0.62, palette.skin);
		colors.addColorStop(1, palette.shade);
		return colors;
	},

	eye(ctx, x, y, rx, ry, angle, ring) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(angle);
		this.oval(ctx, 0, 0, rx + 1.05, ry + 1.05, ring);
		this.oval(ctx, 0, 0, rx, ry, '#191635');
		this.oval(ctx, rx * 0.24, ry * 0.54, rx * 0.53, ry * 0.23, '#4a4172');
		this.oval(ctx, -rx * 0.29, -ry * 0.38, rx * 0.33, ry * 0.28, '#fffaff', -0.24);
		ctx.restore();
	},

	drawOrb(ctx, palette, sway) {
		ctx.beginPath();
		ctx.moveTo(-11, 6);
		ctx.bezierCurveTo(-21, 9, -22, 18, -17, 20);
		ctx.quadraticCurveTo(-12, 21, -10, 16);
		ctx.quadraticCurveTo(-9, 20, -12, 23);
		ctx.quadraticCurveTo(-10, 27, -5, 24);
		ctx.lineTo(-3, 20);
		ctx.lineTo(4, 20);
		ctx.lineTo(7, 25);
		ctx.quadraticCurveTo(14, 26, 13, 22);
		ctx.lineTo(11, 16);
		ctx.quadraticCurveTo(16, 22, 21, 17);
		ctx.quadraticCurveTo(21, 11, 11, 7);
		this.fillShape(ctx, palette.shade);
		this.oval(ctx, 0, 16, 9, 4.5, palette.skin);
		this.oval(ctx, 0, 17, 3.4, 1.9, palette.accent);

		ctx.beginPath();
		ctx.moveTo(-16, -15);
		ctx.lineTo(-24, -17);
		ctx.quadraticCurveTo(-23, -4, -16, 1);
		ctx.lineTo(15, 1);
		ctx.quadraticCurveTo(23, -5, 22, -15);
		ctx.lineTo(13, -12);
		this.fillShape(ctx, palette.shade);

		ctx.save();
		ctx.translate(sway * 0.55, 0);
		ctx.beginPath();
		ctx.moveTo(-19, -11);
		ctx.bezierCurveTo(-19, -20, -9, -24, -2, -23);
		ctx.quadraticCurveTo(1, -24, 6, -29);
		ctx.quadraticCurveTo(10, -27, 11, -22);
		ctx.bezierCurveTo(29, -17, 20, 0, 11, 6);
		ctx.quadraticCurveTo(3, 15, -4, 10);
		ctx.bezierCurveTo(-12, 6, -23, -3, -19, -11);
		this.fillShape(ctx, this.shading(ctx, palette));
		this.oval(ctx, -6, -19, 6, 1.45, '#b4ffce', -0.24);
		this.eye(ctx, -9, -6, 5.3, 7.1, -0.72, '#397883');
		this.eye(ctx, 10, -6, 5.3, 7.1, 0.66, '#397883');
		this.oval(ctx, 0.7, 4.5, 3.5, 1.2, '#257582');
		this.oval(ctx, -12, 0.8, 1.25, 0.95, palette.accent);
		this.oval(ctx, 14, 0.8, 1.25, 0.95, palette.accent);
		ctx.restore();
	},

	drawStalk(ctx, palette, sway) {
		ctx.beginPath();
		ctx.moveTo(-12, 1);
		ctx.bezierCurveTo(-20, 4, -21, -6, -20, -10);
		ctx.bezierCurveTo(-23, -13, -29, -9, -26, -2);
		ctx.quadraticCurveTo(-24, 9, -14, 14);
		ctx.bezierCurveTo(-14, 21, -23, 20, -23, 25);
		ctx.quadraticCurveTo(-16, 28, -7, 22);
		ctx.quadraticCurveTo(-2, 29, 5, 24);
		ctx.quadraticCurveTo(10, 22, 13, 25);
		ctx.quadraticCurveTo(21, 27, 22, 22);
		ctx.quadraticCurveTo(18, 18, 16, 14);
		ctx.bezierCurveTo(25, 10, 27, 5, 23, 1);
		ctx.quadraticCurveTo(20, -2, 17, 4);
		ctx.quadraticCurveTo(14, -2, 10, -4);
		this.fillShape(ctx, this.shading(ctx, palette));
		this.oval(ctx, -17, 7.4, 1.7, 2.8, palette.accent, -0.8);
		this.oval(ctx, -12.5, 12, 1.3, 1.9, palette.accent, -0.65);
		this.oval(ctx, 15, 10, 1.65, 2.25, palette.accent, 0.5);
		this.oval(ctx, 9.5, 17, 1.05, 1.65, palette.accent, 0.5);

		ctx.beginPath();
		ctx.moveTo(-9, 6);
		ctx.bezierCurveTo(-12, 0, -6, -14, -13 + sway, -21);
		ctx.bezierCurveTo(-14 + sway, -25, -11 + sway, -29, -7 + sway, -27);
		ctx.bezierCurveTo(-1, -25, 1, -13, 8, -11);
		ctx.bezierCurveTo(19, -8, 18, 9, 8, 13);
		ctx.quadraticCurveTo(-4, 16, -9, 6);
		this.fillShape(ctx, palette.skin);
		this.oval(ctx, -8 + sway, -24, 3.75, 2.4, palette.accent, 0.45);
		this.eye(ctx, 3.4, 0, 7.6, 8.6, 0.12, '#dd5d92');
		this.oval(ctx, 1.5, 12.2, 3, 1.45, '#6e305c', -0.13);
	},

	drawManta(ctx, palette, sway) {
		ctx.beginPath();
		ctx.moveTo(9, 11);
		ctx.bezierCurveTo(15, 20, 8, 27, 17, 25);
		ctx.quadraticCurveTo(12, 31, 6, 26);
		ctx.quadraticCurveTo(0, 22, 2, 14);
		this.fillShape(ctx, palette.shade);

		ctx.beginPath();
		ctx.moveTo(-1, -15);
		ctx.bezierCurveTo(4, -18, 12, -23 - sway, 26, -19 - sway);
		ctx.bezierCurveTo(29, -15, 23, -7, 17, -5);
		ctx.bezierCurveTo(20, 1, 21, 10, 11, 17);
		ctx.quadraticCurveTo(1, 24, -8, 16);
		ctx.quadraticCurveTo(-16, 10, -17, 4);
		ctx.bezierCurveTo(-22, -1, -25, -7 + sway, -27, -15 + sway);
		ctx.bezierCurveTo(-20, -20 + sway, -10, -20, -1, -15);
		this.fillShape(ctx, this.shading(ctx, palette));

		ctx.strokeStyle = '#7462ba';
		ctx.lineWidth = 1.4;
		for (const side of [-1, 1]) {
			ctx.beginPath();
			ctx.moveTo(side * 20, -13);
			ctx.quadraticCurveTo(side * 13, -13, side * 9, -9);
			ctx.stroke();
			this.oval(ctx, side * 18, -12.3, 2.6, 1.45, palette.accent, -side * 0.28);
		}
		this.oval(ctx, 0, 11.5, 8.5, 4.1, '#d6c9ff');
		this.eye(ctx, -8.4, -2.5, 4.65, 6.2, -0.44, '#7768be');
		this.eye(ctx, 8.6, -2.6, 4.65, 6.2, 0.42, '#7768be');
		this.eye(ctx, 0, -11.9, 3.05, 3.55, 0, palette.accent);
		this.oval(ctx, 0.9, 6.8, 2.5, 1.25, '#555192');
	},

	draw(ctx, kind, x, y, size, time = 0) {
		const palette = this.species[kind] || this.species.orb;
		const sway = Math.sin(time / 310) * 1.55;
		ctx.save();
		ctx.translate(x, y);
		ctx.scale(size / 62, size / 62);
		ctx.translate(0, sway * 0.68);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		if (kind === 'stalk') this.drawStalk(ctx, palette, sway);
		else if (kind === 'manta') this.drawManta(ctx, palette, sway);
		else this.drawOrb(ctx, palette, sway);
		ctx.restore();
	}
};
