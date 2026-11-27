class Bit3D {
	constructor() {
		this.group = new THREE.Group();
		this.chassisGroup = new THREE.Group();
		this.leftArmGroup = new THREE.Group();
		this.rightArmGroup = new THREE.Group();
		this.leftLegGroup = new THREE.Group();
		this.rightLegGroup = new THREE.Group();
		this.antennaGroup = new THREE.Group();

		this.eyesCanvas = document.createElement('canvas');
		this.eyesCanvas.width = 128;
		this.eyesCanvas.height = 64;
		this.eyesCtx = this.eyesCanvas.getContext('2d');
		this.eyesTexture = new THREE.CanvasTexture(this.eyesCanvas);
		this.eyesTexture.minFilter = THREE.LinearFilter;
		this.eyesTexture.magFilter = THREE.LinearFilter;

		this.shadowMesh = null;
		this.antennaLed = null;
		this.coreLed = null;
		this.botLight = null;
		this.mood = 'normal';

		this.buildModel();
		this.group.scale.set(1.15, 1.15, 1.15);
		this.updateEyes(1.0, 0, 0);
	}

	buildModel() {
		const blueMat = new THREE.MeshStandardMaterial({
			color: 0x2563eb,
			roughness: 0.22,
			metalness: 0.18
		});
		const darkBlueMat = new THREE.MeshStandardMaterial({
			color: 0x1d4ed8,
			roughness: 0.28,
			metalness: 0.25
		});
		const metalMat = new THREE.MeshStandardMaterial({
			color: 0x64748b,
			roughness: 0.35,
			metalness: 0.7
		});
		const whiteMat = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 0.15,
			metalness: 0.1
		});

		const bodyGeo = new THREE.BoxGeometry(0.82, 0.82, 0.82);
		const bodyMesh = new THREE.Mesh(bodyGeo, blueMat);
		bodyMesh.castShadow = true;
		bodyMesh.receiveShadow = true;
		this.chassisGroup.add(bodyMesh);

		const visorGeo = new THREE.BoxGeometry(0.68, 0.36, 0.08);
		const visorMat = new THREE.MeshStandardMaterial({
			map: this.eyesTexture,
			roughness: 0.1,
			metalness: 0.4
		});
		const visorMesh = new THREE.Mesh(visorGeo, visorMat);
		visorMesh.position.set(0, 0.12, 0.43);
		this.chassisGroup.add(visorMesh);

		const chestGeo = new THREE.BoxGeometry(0.52, 0.24, 0.04);
		const chestMesh = new THREE.Mesh(chestGeo, darkBlueMat);
		chestMesh.position.set(0, -0.22, 0.42);
		this.chassisGroup.add(chestMesh);

		const coreGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16);
		const coreMat = new THREE.MeshStandardMaterial({
			color: 0x38bdf8,
			emissive: 0x38bdf8,
			emissiveIntensity: 0.9,
			roughness: 0.2
		});
		this.coreLed = new THREE.Mesh(coreGeo, coreMat);
		this.coreLed.rotation.x = Math.PI / 2;
		this.coreLed.position.set(0, -0.22, 0.44);
		this.chassisGroup.add(this.coreLed);

		const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8);
		const poleMesh = new THREE.Mesh(poleGeo, metalMat);
		poleMesh.position.set(0, 0.14, 0);
		poleMesh.castShadow = true;
		this.antennaGroup.add(poleMesh);

		const ledGeo = new THREE.SphereGeometry(0.07, 16, 16);
		const ledMat = new THREE.MeshStandardMaterial({
			color: 0x38bdf8,
			emissive: 0x38bdf8,
			emissiveIntensity: 1.0,
			roughness: 0.1
		});
		this.antennaLed = new THREE.Mesh(ledGeo, ledMat);
		this.antennaLed.position.set(0, 0.28, 0);
		this.antennaGroup.add(this.antennaLed);

		this.antennaGroup.position.set(0, 0.41, 0);
		this.chassisGroup.add(this.antennaGroup);

		const chevronGeo = new THREE.ConeGeometry(0.09, 0.18, 3);
		const chevronMesh = new THREE.Mesh(chevronGeo, whiteMat);
		chevronMesh.rotation.x = -Math.PI / 2;
		chevronMesh.rotation.z = Math.PI;
		chevronMesh.position.set(0, 0.42, 0.2);
		this.chassisGroup.add(chevronMesh);

		this.chassisGroup.position.set(0, 0.58, 0);
		this.group.add(this.chassisGroup);

		const shoulderGeo = new THREE.SphereGeometry(0.07, 12, 12);
		const armShaftGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.32, 12);
		const handGeo = new THREE.BoxGeometry(0.12, 0.14, 0.1);

		const leftShoulder = new THREE.Mesh(shoulderGeo, metalMat);
		const leftArmShaft = new THREE.Mesh(armShaftGeo, blueMat);
		leftArmShaft.position.set(0, -0.16, 0);
		leftArmShaft.castShadow = true;
		const leftHand = new THREE.Mesh(handGeo, darkBlueMat);
		leftHand.position.set(0, -0.34, 0);
		this.leftArmGroup.add(leftShoulder, leftArmShaft, leftHand);
		this.leftArmGroup.position.set(-0.52, 0.65, 0);
		this.group.add(this.leftArmGroup);

		const rightShoulder = new THREE.Mesh(shoulderGeo, metalMat);
		const rightArmShaft = new THREE.Mesh(armShaftGeo, blueMat);
		rightArmShaft.position.set(0, -0.16, 0);
		rightArmShaft.castShadow = true;
		const rightHand = new THREE.Mesh(handGeo, darkBlueMat);
		rightHand.position.set(0, -0.34, 0);
		this.rightArmGroup.add(rightShoulder, rightArmShaft, rightHand);
		this.rightArmGroup.position.set(0.52, 0.65, 0);
		this.group.add(this.rightArmGroup);

		const legShaftGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12);
		const footGeo = new THREE.BoxGeometry(0.2, 0.12, 0.36);

		const leftLegShaft = new THREE.Mesh(legShaftGeo, metalMat);
		leftLegShaft.position.set(0, 0.11, 0);
		leftLegShaft.castShadow = true;
		const leftFoot = new THREE.Mesh(footGeo, darkBlueMat);
		leftFoot.position.set(0, 0.06, 0.04);
		leftFoot.castShadow = true;
		this.leftLegGroup.add(leftLegShaft, leftFoot);
		this.leftLegGroup.position.set(-0.25, 0, 0);
		this.group.add(this.leftLegGroup);

		const rightLegShaft = new THREE.Mesh(legShaftGeo, metalMat);
		rightLegShaft.position.set(0, 0.11, 0);
		rightLegShaft.castShadow = true;
		const rightFoot = new THREE.Mesh(footGeo, darkBlueMat);
		rightFoot.position.set(0, 0.06, 0.04);
		rightFoot.castShadow = true;
		this.rightLegGroup.add(rightLegShaft, rightFoot);
		this.rightLegGroup.position.set(0.25, 0, 0);
		this.group.add(this.rightLegGroup);

		const shadowGeo = new THREE.PlaneGeometry(1.1, 1.1);
		const shadowCanvas = document.createElement('canvas');
		shadowCanvas.width = 64;
		shadowCanvas.height = 64;
		const sCtx = shadowCanvas.getContext('2d');
		const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
		grad.addColorStop(0, 'rgba(15, 23, 42, 0.35)');
		grad.addColorStop(0.6, 'rgba(15, 23, 42, 0.12)');
		grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
		sCtx.fillStyle = grad;
		sCtx.fillRect(0, 0, 64, 64);

		const shadowTex = new THREE.CanvasTexture(shadowCanvas);
		const shadowMat = new THREE.MeshBasicMaterial({
			map: shadowTex,
			transparent: true,
			depthWrite: false
		});
		this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
		this.shadowMesh.rotation.x = -Math.PI / 2;
		this.shadowMesh.position.set(0, 0.015, 0);
		this.group.add(this.shadowMesh);

		this.botLight = new THREE.PointLight(0x38bdf8, 1.4, 4.2);
		this.botLight.position.set(0, 0.75, 0.25);
		this.group.add(this.botLight);
	}

	setMood(mood) {
		this.mood = mood || 'normal';
		if (this.antennaLed) {
			if (this.mood === 'happy') {
				this.antennaLed.material.color.setHex(0x34d399);
				this.antennaLed.material.emissive.setHex(0x34d399);
				if (this.botLight) this.botLight.color.setHex(0x34d399);
			} else if (this.mood === 'error') {
				this.antennaLed.material.color.setHex(0xf59e0b);
				this.antennaLed.material.emissive.setHex(0xf59e0b);
				if (this.botLight) this.botLight.color.setHex(0xf59e0b);
			} else {
				this.antennaLed.material.color.setHex(0x38bdf8);
				this.antennaLed.material.emissive.setHex(0x38bdf8);
				if (this.botLight) this.botLight.color.setHex(0x38bdf8);
			}
		}
	}

	updateEyes(blinkFactor, lookX, lookY) {
		const ctx = this.eyesCtx;
		ctx.fillStyle = '#0f172a';
		ctx.fillRect(0, 0, 128, 64);

		const leftX = 36 + lookX * 6;
		const rightX = 92 + lookX * 6;
		const y = 32 + lookY * 4;

		if (this.mood === 'happy') {
			ctx.lineWidth = 5;
			ctx.strokeStyle = '#34d399';
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.arc(leftX, y + 4, 11, Math.PI * 1.15, Math.PI * 1.85, false);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(rightX, y + 4, 11, Math.PI * 1.15, Math.PI * 1.85, false);
			ctx.stroke();
		} else if (this.mood === 'error') {
			ctx.fillStyle = '#f59e0b';
			ctx.fillRect(leftX - 11, y - 2, 22, 5);
			ctx.fillRect(rightX - 11, y - 2, 22, 5);
		} else {
			const eyeW = 28;
			const eyeH = 34 * Math.max(blinkFactor, 0.1);

			ctx.fillStyle = '#38bdf8';
			if (ctx.roundRect) {
				ctx.beginPath();
				ctx.roundRect(leftX - eyeW / 2, y - eyeH / 2, eyeW, eyeH, 8);
				ctx.roundRect(rightX - eyeW / 2, y - eyeH / 2, eyeW, eyeH, 8);
				ctx.fill();
			} else {
				ctx.fillRect(leftX - eyeW / 2, y - eyeH / 2, eyeW, eyeH);
				ctx.fillRect(rightX - eyeW / 2, y - eyeH / 2, eyeW, eyeH);
			}

			if (blinkFactor > 0.4) {
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(leftX - eyeW / 2 + 4, y - eyeH / 2 + 4, 6, 6);
				ctx.fillRect(rightX - eyeW / 2 + 4, y - eyeH / 2 + 4, 6, 6);
			}
		}

		this.eyesTexture.needsUpdate = true;
	}

	animate(time, isWalking, walkProgress, isTurning, jumpHeight) {
		const blinkWave = Math.sin(time / 1400);
		const blink = blinkWave > 0.94 ? 0.12 : 1.0;
		this.updateEyes(blink, isTurning ? 0.4 : 0, 0);

		if (this.antennaLed) {
			const pulse = Math.sin(time / 200) * 0.3 + 0.7;
			this.antennaLed.material.emissiveIntensity = pulse;
		}

		if (jumpHeight > 0) {
			this.chassisGroup.position.y = 0.58 + jumpHeight;
			this.leftArmGroup.position.y = 0.65 + jumpHeight;
			this.rightArmGroup.position.y = 0.65 + jumpHeight;
			this.leftLegGroup.position.y = jumpHeight * 0.4;
			this.rightLegGroup.position.y = jumpHeight * 0.4;

			this.leftLegGroup.rotation.x = 0.4;
			this.rightLegGroup.rotation.x = 0.4;
			this.leftArmGroup.rotation.x = -1.1;
			this.rightArmGroup.rotation.x = -1.1;

			const shadowScale = Math.max(0.35, 1 - jumpHeight / 2.2);
			this.shadowMesh.scale.set(shadowScale, shadowScale, 1);
			this.shadowMesh.material.opacity = shadowScale * 0.9;
		} else if (isWalking) {
			const angle = walkProgress * Math.PI * 2;
			const legSwing = Math.sin(angle) * 0.55;
			const armSwing = -Math.sin(angle) * 0.65;
			const bob = Math.abs(Math.sin(angle)) * 0.08;
			const roll = Math.sin(angle) * 0.04;

			this.chassisGroup.position.y = 0.58 + bob;
			this.chassisGroup.rotation.z = roll;
			this.chassisGroup.rotation.x = 0.06;

			this.leftLegGroup.rotation.x = legSwing;
			this.rightLegGroup.rotation.x = -legSwing;

			this.leftLegGroup.position.y = Math.max(0, -Math.sin(angle) * 0.08);
			this.rightLegGroup.position.y = Math.max(0, Math.sin(angle) * 0.08);

			this.leftArmGroup.position.y = 0.65 + bob;
			this.rightArmGroup.position.y = 0.65 + bob;
			this.leftArmGroup.rotation.x = armSwing;
			this.rightArmGroup.rotation.x = -armSwing;

			this.antennaGroup.rotation.x = -0.15 + Math.sin(angle) * 0.08;

			this.shadowMesh.scale.set(1, 1, 1);
			this.shadowMesh.material.opacity = 1.0;
		} else if (isTurning) {
			const turnBob = Math.sin(time / 150) * 0.02;
			this.chassisGroup.position.y = 0.58 + turnBob;
			this.chassisGroup.rotation.set(0, 0, 0);

			this.leftLegGroup.rotation.x = Math.sin(time / 100) * 0.25;
			this.rightLegGroup.rotation.x = -Math.sin(time / 100) * 0.25;

			this.leftArmGroup.position.y = 0.65;
			this.rightArmGroup.position.y = 0.65;
			this.leftArmGroup.rotation.x = 0;
			this.rightArmGroup.rotation.x = 0;

			this.shadowMesh.scale.set(1, 1, 1);
			this.shadowMesh.material.opacity = 1.0;
		} else {
			const breathe = Math.sin(time / 280) * 0.025;
			this.chassisGroup.position.y = 0.58 + breathe;
			this.chassisGroup.rotation.set(0, 0, 0);

			this.leftLegGroup.rotation.set(0, 0, 0);
			this.rightLegGroup.rotation.set(0, 0, 0);
			this.leftLegGroup.position.y = 0;
			this.rightLegGroup.position.y = 0;

			this.leftArmGroup.position.y = 0.65 + breathe * 0.5;
			this.rightArmGroup.position.y = 0.65 + breathe * 0.5;
			this.leftArmGroup.rotation.set(0, 0, 0);
			this.rightArmGroup.rotation.set(0, 0, 0);

			this.antennaGroup.rotation.x = Math.sin(time / 400) * 0.05;

			this.shadowMesh.scale.set(1, 1, 1);
			this.shadowMesh.material.opacity = 1.0;
		}
	}
}

