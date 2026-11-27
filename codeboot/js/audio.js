const SoundFX = {
	ctx: null,
	music: null,
	enabled: true,
	hasUserActivation: false,
	activationHandler: null,
	preferenceKey: 'codeboot_audio_enabled',

	init() {
		try {
			const savedPreference = localStorage.getItem(this.preferenceKey);
			this.enabled = savedPreference === null ? true : savedPreference === 'true';
		} catch (e) {
			this.enabled = true;
		}

		this.music = new Audio('aventura_estelar_original.mp3');
		this.music.loop = true;
		this.music.preload = 'auto';
		this.music.volume = 0.24 * 0.5;

		this.activationHandler = () => {
			window.removeEventListener('pointerdown', this.activationHandler);
			window.removeEventListener('keydown', this.activationHandler);
			this.activationHandler = null;
			this.hasUserActivation = true;
			this.initContext();
			this.syncPlayback();
		};

		window.addEventListener('pointerdown', this.activationHandler, { once: true });
		window.addEventListener('keydown', this.activationHandler, { once: true });
		return this.enabled;
	},

	initContext() {
		if (!this.ctx) {
			const AudioContextClass = window.AudioContext || window.webkitAudioContext;
			if (AudioContextClass) {
				this.ctx = new AudioContextClass();
			}
		}
		if (this.ctx && this.ctx.state === 'suspended') {
			const resumePromise = this.ctx.resume();
			if (resumePromise && typeof resumePromise.catch === 'function') {
				resumePromise.catch(() => {});
			}
		}
	},

	toggle() {
		this.enabled = !this.enabled;
		try {
			localStorage.setItem(this.preferenceKey, String(this.enabled));
		} catch (e) {}
		this.syncPlayback();
		return this.enabled;
	},

	syncPlayback() {
		if (!this.music) return;
		if (!this.enabled) {
			this.music.pause();
			return;
		}
		if (!this.hasUserActivation) return;
		this.initContext();
		const playPromise = this.music.play();
		if (playPromise && typeof playPromise.catch === 'function') {
			playPromise.catch(() => {});
		}
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
	},

	playMunch() {
		if (!this.enabled) return;
		this.initContext();
		if (!this.ctx) return;
		try {
			const bufferSize = this.ctx.sampleRate * 0.04;
			const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
			const data = buffer.getChannelData(0);
			for (let i = 0; i < bufferSize; i++) {
				data[i] = Math.random() * 2 - 1;
			}
			const noise = this.ctx.createBufferSource();
			noise.buffer = buffer;
			const filter = this.ctx.createBiquadFilter();
			filter.type = 'bandpass';
			filter.frequency.value = 1400;
			filter.Q.value = 3;
			const gain = this.ctx.createGain();
			const now = this.ctx.currentTime;
			gain.gain.setValueAtTime(0.12, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
			noise.connect(filter);
			filter.connect(gain);
			gain.connect(this.ctx.destination);
			noise.start(now);
			noise.stop(now + 0.04);
		} catch (e) {}
	},

	playInfotron() {
		if (!this.enabled) return;
		this.initContext();
		if (!this.ctx) return;
		const freqs = [880, 1174.66, 1760];
		freqs.forEach((freq, idx) => {
			setTimeout(() => {
				this.playTone(freq, freq, 'sine', 0.14, 0.16);
			}, idx * 45);
		});
	},

	playZonkImpact() {
		if (!this.enabled) return;
		this.initContext();
		if (!this.ctx) return;
		this.playTone(130, 45, 'triangle', 0.15, 0.22);
	},

	playExplosion() {
		if (!this.enabled) return;
		this.initContext();
		if (!this.ctx) return;
		try {
			const bufferSize = Math.floor(this.ctx.sampleRate * 0.35);
			const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
			const data = buffer.getChannelData(0);
			let lastOut = 0.0;
			for (let i = 0; i < bufferSize; i++) {
				const white = Math.random() * 2 - 1;
				lastOut = (lastOut + (0.02 * white)) / 1.02;
				data[i] = lastOut * 3.5;
			}
			const noise = this.ctx.createBufferSource();
			noise.buffer = buffer;
			const filter = this.ctx.createBiquadFilter();
			filter.type = 'lowpass';
			const now = this.ctx.currentTime;
			filter.frequency.setValueAtTime(1200, now);
			filter.frequency.exponentialRampToValueAtTime(80, now + 0.35);
			const gain = this.ctx.createGain();
			gain.gain.setValueAtTime(0.3, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
			noise.connect(filter);
			filter.connect(gain);
			gain.connect(this.ctx.destination);
			noise.start(now);
			noise.stop(now + 0.35);
		} catch (e) {}
	},

	playExitReady() {
		if (!this.enabled) return;
		this.initContext();
		if (!this.ctx) return;
		const notes = [440, 659.25, 880, 1318.5];
		notes.forEach((freq, idx) => {
			setTimeout(() => {
				this.playTone(freq, freq, 'triangle', 0.2, 0.18);
			}, idx * 60);
		});
	},

	playFall() {
		if (!this.enabled) return;
		this.initContext();
		if (!this.ctx) return;
		this.playTone(600, 65, 'sawtooth', 0.45, 0.2);
	},

	playSquash() {
		if (!this.enabled) return;
		this.initContext();
		if (!this.ctx) return;
		this.playTone(240, 40, 'triangle', 0.28, 0.25);
	}
};

