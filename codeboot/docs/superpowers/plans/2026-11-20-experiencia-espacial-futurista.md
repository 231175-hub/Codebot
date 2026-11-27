# Experiencia Espacial Futurista Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir CodeBoot en una experiencia espacial negra, colorida y futurista, con un mapa arrastrable, conexiones visibles sobre los planetas, fondos estrellados en todos los niveles y música de fondo integrada.

**Architecture:** La identidad visual se concentra en tokens y selectores existentes de `theme.css` y `layout.css`. El mapa conserva su canvas 2D procedural, pero adopta Pointer Events y un orden de render por capas. El motor 3D conserva los tableros y biomas, mientras todas las texturas de fondo comparten una base espacial y solo cambia el color de la nebulosa. `SoundFX` sigue siendo el controlador único para efectos y música.

**Tech Stack:** HTML5, CSS, JavaScript sin módulos, Canvas 2D, Three.js, Blockly, Web Audio API y HTMLAudioElement.

## Global Constraints

- Mantener tabuladores en HTML, CSS y JavaScript.
- No añadir comentarios nuevos en archivos de código.
- Mantener la interfaz en español y sin emojis.
- Conservar clic en nodos, rueda horizontal, transición de BIT, zoom de cámara y respaldo 2D.
- La música debe respetar las restricciones de autoplay y el control de sonido existente.

---

### Task 1: Tema oscuro espacial y estructura del mapa

**Files:**
- Modify: `css/theme.css`
- Modify: `css/layout.css`
- Modify: `index.html:55-95`

**Interfaces:**
- Consumes: selectores y variables CSS existentes.
- Produces: tema oscuro global, respaldo estrellado y un `#map-scroll-container` sin controles ni barra nativa.

- [ ] **Step 1: Reemplazar los tokens de tema**

```css
:root {
	--bg-main: #02040b;
	--bg-panel: #07111f;
	--bg-panel-light: #0b1728;
	--border-color: rgba(103, 232, 249, 0.2);
	--border-focus: #22d3ee;
	--text-main: #f4fbff;
	--text-secondary: #a9bfd3;
	--text-muted: #6f879e;
}
```

- [ ] **Step 2: Aplicar negro estrellado y paneles de cabina**

```css
html, body {
	background-color: #02040b;
	background-image: radial-gradient(circle at 15% 25%, rgba(34, 211, 238, 0.08), transparent 28%), radial-gradient(circle at 85% 75%, rgba(217, 70, 239, 0.07), transparent 30%);
}

.canvas-viewport, .map-scroll-container {
	background-color: #02040b;
	background-image: radial-gradient(circle, rgba(255, 255, 255, 0.7) 1px, transparent 1.2px), radial-gradient(circle, rgba(34, 211, 238, 0.45) 1px, transparent 1.3px);
	background-size: 86px 86px, 137px 137px;
}
```

- [ ] **Step 3: Eliminar controles sobrantes y preparar accesibilidad de audio**

```html
<button id="btn-sound-toggle" class="icon-button" title="Silenciar música y efectos" aria-label="Silenciar música y efectos" aria-pressed="true">
```

Eliminar `#btn-map-prev` y `#btn-map-next` del HTML.

- [ ] **Step 4: Ocultar la barra sin desactivar el desplazamiento**

```css
.map-scroll-container {
	scrollbar-width: none;
	touch-action: pan-y;
}

.map-scroll-container::-webkit-scrollbar {
	display: none;
}
```

- [ ] **Step 5: Comprobar estructura**

Run: `rg -n "btn-map-prev|btn-map-next|map-nav-arrow" index.html css/layout.css js`

Expected: ninguna coincidencia.

### Task 2: Arrastre y capas correctas del mapa

**Files:**
- Modify: `js/map3d.js:301-379`
- Modify: `js/map3d.js:793-938`

**Interfaces:**
- Consumes: `container.scrollLeft`, `hitNode()`, `drawPlanetSystems()` y `drawMoonsOfPlanet()`.
- Produces: arrastre por mouse, lápiz y toque; `drawForegroundMoons(timestamp)`; ruta delante de planetas y detrás de nodos frontales.

- [ ] **Step 1: Sustituir eventos de mouse por Pointer Events**

```js
this.container.addEventListener('pointerdown', (event) => {
	if (event.button !== 0) return;
	dragPointerId = event.pointerId;
	startX = event.clientX;
	scrollLeft = this.container.scrollLeft;
	hasMoved = false;
	this.container.setPointerCapture(event.pointerId);
	this.container.classList.add('is-dragging');
});
```

`pointermove` actualiza `scrollLeft`; `pointerup` y `pointercancel` liberan la captura. Un movimiento mayor de 5 px cancela el clic de nivel.

- [ ] **Step 2: Reordenar la composición del canvas**

```js
this.drawSpaceBackground(timestamp);
this.drawPlanetSystems(timestamp);
this.drawCosmicFlightPath(timestamp);
this.drawForegroundMoons(timestamp);
this.drawLabels(timestamp);
```

`drawPlanetSystems()` conserva lunas traseras y planetas; `drawForegroundMoons()` pinta los nodos frontales después de la ruta.

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check js/map3d.js`

Expected: exit code 0 sin salida.

### Task 3: Fondo negro estrellado en todos los niveles

**Files:**
- Modify: `js/engine3d.js:1539-1644`
- Modify: `css/layout.css:518-538`

**Interfaces:**
- Consumes: `getBackgroundTexture(biome)`, semilla `rnd` y nombres `nave`, `fabrica`, `bosque`, `oceano`, `glaciar`.
- Produces: una base espacial común con una nebulosa cromática distinta por bioma.

- [ ] **Step 1: Pintar base espacial común**

```js
const palette = {
	nave: ['56,189,248', '217,70,239'],
	fabrica: ['245,158,11', '249,115,22'],
	bosque: ['34,197,94', '132,204,22'],
	oceano: ['20,184,166', '34,211,238'],
	glaciar: ['167,139,250', '125,211,252']
}[biome] || ['56,189,248', '167,139,250'];
grad([[0, '#01030a'], [0.55, '#050b18'], [1, '#02040d']]);
glow(W * 0.26, H * 0.32, 310, `rgba(${palette[0]},0.18)`, `rgba(${palette[0]},0)`);
glow(W * 0.78, H * 0.68, 340, `rgba(${palette[1]},0.14)`, `rgba(${palette[1]},0)`);
stars(360, 1);
```

- [ ] **Step 2: Mantener firma de bioma sin fondos claros**

Fábrica añade silueta industrial; bosque añade constelaciones verdes; océano añade arcos y partículas turquesas; glaciar añade auroras violetas. Ninguna rama repinta el lienzo con colores claros.

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check js/engine3d.js`

Expected: exit code 0 sin salida.

### Task 4: Música integrada y control persistente

**Files:**
- Modify: `js/audio.js`
- Modify: `js/main.js:32-56`
- Modify: `js/main.js:342-350`

**Interfaces:**
- Consumes: `aventura_estelar_original.mp3` y `#btn-sound-toggle`.
- Produces: `SoundFX.init()`, `SoundFX.syncPlayback()`, `App.updateSoundButton(enabled)`.

- [ ] **Step 1: Extender el controlador único de audio**

```js
init() {
	this.enabled = localStorage.getItem(this.preferenceKey) !== 'false';
	this.music = new Audio('aventura_estelar_original.mp3');
	this.music.loop = true;
	this.music.preload = 'auto';
	this.music.volume = 0.24;
}
```

Registrar activación única con `pointerdown` y `keydown`; llamar `play()` solo después de un gesto confiable y capturar cualquier rechazo.

- [ ] **Step 2: Unificar el botón**

```js
updateSoundButton(enabled) {
	const button = document.getElementById('btn-sound-toggle');
	button.setAttribute('aria-pressed', String(enabled));
	button.setAttribute('aria-label', enabled ? 'Silenciar música y efectos' : 'Activar música y efectos');
	button.title = button.getAttribute('aria-label');
}
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check js/audio.js; node --check js/main.js`

Expected: ambos comandos terminan con exit code 0.

### Task 5: Verificación integral

**Files:**
- Test: `index.html`

**Interfaces:**
- Consumes: todos los entregables anteriores.
- Produces: evidencia visual y funcional de la experiencia terminada.

- [ ] **Step 1: Ejecutar comprobaciones estáticas**

Run: `node --check js/audio.js; node --check js/main.js; node --check js/map3d.js; node --check js/engine3d.js`

Expected: exit code 0 sin errores.

- [ ] **Step 2: Revisar reglas de código**

Run: `rg -n "btn-map-prev|btn-map-next|map-nav-arrow" index.html css/layout.css js`

Expected: ninguna coincidencia.

- [ ] **Step 3: Probar en navegador**

Abrir `index.html`, arrastrar el mapa con mouse y toque, verificar que un arrastre no abre niveles, hacer clic en un nivel desbloqueado, confirmar que la ruta cruza delante del planeta y detrás de las lunas frontales, abrir un nivel de cada módulo, activar y silenciar audio, y recargar para comprobar persistencia.

- [ ] **Step 4: Confirmar accesibilidad básica**

Verificar foco visible, contraste de texto, `aria-pressed` correcto, movimiento reducido en el sistema y navegación responsive menor a 900 px.
