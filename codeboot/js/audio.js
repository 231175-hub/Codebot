const SoundFX = {
	ctx: null,
	enabled: true,

	initContext() {
		if (!this.ctx) {
			const AudioContextClass = window.AudioContext || window.webkitAudioContext;
			if (AudioContextClass) {
				this.ctx = new AudioContextClass();
			}
		}
		if (this.ctx && this.ctx.state === 'suspended') {
			this.ctx.resume();
		}
	},

	toggle() {
		this.enabled = !this.enabled;
		return this.enabled;
	},

	playTone(freqStart, freqEnd, type, duration, volume) {
		if (!this.enabled) return;
		try {
			this.initContext();
			if (!this.ctx) return;
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			const now = this.ctx.currentTime;

			osc.type = type;
			osc.frequency.setValueAtTime(freqStart, now);
			if (freqEnd && freqEnd !== freqStart) {
				osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 10), now + duration);
			}

			gain.gain.setValueAtTime(volume, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

			osc.connect(gain);
			gain.connect(this.ctx.destination);

			osc.start(now);
			osc.stop(now + duration);
		} catch (e) {}
	},

	playStep() {
		this.playTone(320, 480, 'sine', 0.07, 0.12);
	},

	playTurn() {
		this.playTone(280, 200, 'triangle', 0.06, 0.1);
	},

	playAction() {
		if (!this.enabled) return;
		this.initContext();
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		this.playTone(587, 587, 'sine', 0.12, 0.15);
		setTimeout(() => {
			this.playTone(880, 880, 'sine', 0.18, 0.15);
		}, 60);
	},

	playSuccess() {
		if (!this.enabled) return;
		this.initContext();
		if (!this.ctx) return;
		const notes = [523.25, 659.25, 783.99, 1046.5];
		notes.forEach((freq, idx) => {
			setTimeout(() => {
				this.playTone(freq, freq, 'triangle', 0.22, 0.2);
			}, idx * 75);
		});
	},

	playUnlock() {
		if (!this.enabled) return;
		this.initContext();
		if (!this.ctx) return;
		const notes = [440, 554.37, 659.25, 880];
		notes.forEach((freq, idx) => {
			setTimeout(() => {
				this.playTone(freq, freq, 'sine', 0.18, 0.16);
			}, idx * 60);
		});
	},

	playError() {
		this.playTone(160, 90, 'sawtooth', 0.18, 0.15);
	},

	playSnap() {
		this.playTone(450, 220, 'sine', 0.04, 0.08);
	}
};

