const BitRenderer = {
	draw(ctx, cx, cy, angle, options = {}) {
		const size = options.size || 24;
		const walkFrame = options.walkFrame || 0;
		const isWalking = options.isWalking || false;
		const jumpHeight = options.jumpHeight || 0;
		const time = options.time || performance.now();
		const isTurning = options.isTurning || false;

		const idleBob = (!isWalking && jumpHeight === 0) ? Math.sin(time / 280) * 1.5 : 0;
		const blinkFactor = (Math.sin(time / 1600) > 0.94) ? 0.15 : 1.0;

		let leftFootY = 0;
		let rightFootY = 0;
		let leftFootLift = 0;
		let rightFootLift = 0;
		let leftArmY = 0;
		let rightArmY = 0;
		let bodyDip = idleBob;
		let bodyTilt = 0;

		if (isWalking) {
			const stride = size * 0.38;
			switch (walkFrame) {
				case 0:
					rightFootY = -stride;
					leftFootY = stride;
					rightArmY = stride * 0.7;
					leftArmY = -stride * 0.7;
					bodyDip = 1.4;
					bodyTilt = 0.04;
					break;
				case 1:
					rightFootY = -stride * 0.2;
					leftFootY = 0;
					leftFootLift = -3;
					rightArmY = 0;
					leftArmY = 0;
					bodyDip = -2.0;
					bodyTilt = 0;
					break;
				case 2:
					rightFootY = stride;
					leftFootY = -stride;
					rightArmY = -stride * 0.7;
					leftArmY = stride * 0.7;
					bodyDip = 1.4;
					bodyTilt = -0.04;
					break;
				case 3:
					rightFootY = 0;
					rightFootLift = -3;
					leftFootY = -stride * 0.2;
					rightArmY = 0;
					leftArmY = 0;
					bodyDip = -2.0;
					bodyTilt = 0;
					break;
			}
		} else if (isTurning) {
			leftFootY = -size * 0.15;
			rightFootY = size * 0.15;
			bodyDip = 0;
		} else if (jumpHeight > 0) {
			leftFootY = size * 0.2;
			rightFootY = size * 0.2;
			leftArmY = -size * 0.3;
			rightArmY = -size * 0.3;
		}

		ctx.save();
		ctx.translate(cx, cy);

		const shadowScale = Math.max(0.3, 1 - jumpHeight / 60);
		ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
		ctx.beginPath();
		ctx.ellipse(0, size * 0.25, size * 0.85 * shadowScale, size * 0.42 * shadowScale, 0, 0, Math.PI * 2);
		ctx.fill();

		ctx.translate(0, -jumpHeight);
		ctx.rotate(angle + bodyTilt);

		const footW = size * 0.32;
		const footH = size * 0.58;
		const footXOffset = size * 0.62;

		ctx.fillStyle = '#1e3a8a';
		ctx.beginPath();
		if (ctx.roundRect) {
			ctx.roundRect(-footXOffset - footW / 2, -footH / 2 + leftFootY + leftFootLift, footW, footH, 4);
			ctx.roundRect(footXOffset - footW / 2, -footH / 2 + rightFootY + rightFootLift, footW, footH, 4);
		} else {
			ctx.rect(-footXOffset - footW / 2, -footH / 2 + leftFootY + leftFootLift, footW, footH);
			ctx.rect(footXOffset - footW / 2, -footH / 2 + rightFootY + rightFootLift, footW, footH);
		}
		ctx.fill();

		ctx.fillStyle = '#60a5fa';
		ctx.fillRect(-footXOffset - footW / 2 + 1, -footH / 2 + leftFootY + leftFootLift + 1, footW - 2, 3);
		ctx.fillRect(footXOffset - footW / 2 + 1, -footH / 2 + rightFootY + rightFootLift + 1, footW - 2, 3);

		const armW = size * 0.22;
		const armH = size * 0.46;
		const armXOffset = size * 0.86;

		ctx.fillStyle = '#1d4ed8';
		ctx.beginPath();
		if (ctx.roundRect) {
			ctx.roundRect(-armXOffset - armW / 2, -armH / 2 + leftArmY + bodyDip * 0.4, armW, armH, 3);
			ctx.roundRect(armXOffset - armW / 2, -armH / 2 + rightArmY + bodyDip * 0.4, armW, armH, 3);
		} else {
			ctx.rect(-armXOffset - armW / 2, -armH / 2 + leftArmY + bodyDip * 0.4, armW, armH);
			ctx.rect(armXOffset - armW / 2, -armH / 2 + rightArmY + bodyDip * 0.4, armW, armH);
		}
		ctx.fill();

		const bodyW = size * 1.34;
		const bodyH = size * 1.34;
		const bodyY = -bodyH / 2 + bodyDip;

		ctx.fillStyle = '#2563eb';
		ctx.strokeStyle = '#1d4ed8';
		ctx.lineWidth = 2;
		ctx.beginPath();
		if (ctx.roundRect) {
			ctx.roundRect(-bodyW / 2, bodyY, bodyW, bodyH, 8);
		} else {
			ctx.rect(-bodyW / 2, bodyY, bodyW, bodyH);
		}
		ctx.fill();
		ctx.stroke();

		const coreR = size * 0.16;
		ctx.fillStyle = '#1e40af';
		ctx.beginPath();
		ctx.arc(0, bodyDip + size * 0.22, coreR + 2, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#38bdf8';
		ctx.beginPath();
		ctx.arc(0, bodyDip + size * 0.22, coreR, 0, Math.PI * 2);
		ctx.fill();

		const visorW = size * 0.98;
		const visorH = size * 0.52;
		const visorY = bodyY + size * 0.16;

		ctx.fillStyle = '#0f172a';
		ctx.beginPath();
		if (ctx.roundRect) {
			ctx.roundRect(-visorW / 2, visorY, visorW, visorH, 5);
		} else {
			ctx.rect(-visorW / 2, visorY, visorW, visorH);
		}
		ctx.fill();

		const eyeW = size * 0.22;
		const eyeH = size * 0.26 * blinkFactor;
		const eyeY = visorY + (visorH - eyeW) / 2;
		const eyeSpacing = size * 0.26;

		ctx.fillStyle = '#38bdf8';
		ctx.beginPath();
		if (ctx.roundRect) {
			ctx.roundRect(-eyeSpacing - eyeW / 2, eyeY, eyeW, eyeH, 3);
			ctx.roundRect(eyeSpacing - eyeW / 2, eyeY, eyeW, eyeH, 3);
		} else {
			ctx.rect(-eyeSpacing - eyeW / 2, eyeY, eyeW, eyeH);
			ctx.rect(eyeSpacing - eyeW / 2, eyeY, eyeW, eyeH);
		}
		ctx.fill();

		if (blinkFactor > 0.5) {
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(-eyeSpacing - eyeW / 2 + 1, eyeY + 1, 2, 2);
			ctx.fillRect(eyeSpacing - eyeW / 2 + 1, eyeY + 1, 2, 2);
		}

		ctx.strokeStyle = '#1e3a8a';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, bodyY);
		ctx.lineTo(0, bodyY - size * 0.36);
		ctx.stroke();

		const ledPulse = Math.sin(time / 200) * 0.3 + 0.7;
		ctx.fillStyle = '#38bdf8';
		ctx.beginPath();
		ctx.arc(0, bodyY - size * 0.36, size * 0.14 * ledPulse, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(0, bodyY - size * 0.36, size * 0.06, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.moveTo(0, bodyY + size * 0.06);
		ctx.lineTo(size * 0.16, bodyY + size * 0.15);
		ctx.lineTo(-size * 0.16, bodyY + size * 0.15);
		ctx.closePath();
		ctx.fill();

		ctx.restore();
	}
};

