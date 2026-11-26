# AGENT.MD — Guía Operativa y Estándares de CodeBoot

## Propósito
Este documento define las directrices arquitectónicas, estándares de desarrollo y responsabilidades del agente en la construcción y evolución del videojuego educativo **CodeBoot**.

## Estándares de Código y Diseño Visual
* **Cero comentarios:** Ningún archivo de código (`.html`, `.css`, `.js`) debe contener comentarios explicativos, anotaciones temporales o comentarios de bloqueo. El código debe ser autoexplicativo por medio de nombres descriptivos y funciones concisas.
* **Indentación estricta:** Utilizar tabuladores (`\t`) con ancho visual de 4 espacios en todos los archivos del proyecto.
* **Interfaz Clara (Sin temas oscuros):** Toda la interfaz gráfica debe utilizar temas claros con fondos neutros luminosos (`#f8fafc`, `#ffffff`), bordes de alto contraste (`#e2e8f0`, `#cbd5e1`), tarjetas blancas con sombras suaves y tipografía oscura legible (`#0f172a`, `#334155`). Se prohíben paletas oscuras o temas de modo noche.
* **Tipografía Moderna (Inter):** Utilizar la tipografía `Inter` como fuente sans-serif principal para toda la aplicación y `JetBrains Mono` para la visualización de código técnico.
* **Fondo Cuadriculado Estilo Figma (Solo en Bloques):** El espacio de trabajo de programación (`#blockly-div`) debe lucir un fondo idéntico al lienzo de Figma (`#f5f5f5` con cuadrícula sutil en cuadrados de 20px x 20px mediante `rgba(0, 0, 0, 0.05)`). El área del simulador derecho (`#simulator-panel`) debe mantener un fondo limpio, plano y sólido sin cuadrícula.
* **Paleta de Bloques Fija en Escala 1.0:** La paleta lateral de bloques en la columna izquierda debe permanecer estricta y permanentemente en escala 1.0, inmune al zoom del lienzo. El zoom con ratón o rueda solo debe escalar los bloques ensamblados dentro del espacio de trabajo.
* **Menú de Anticlic 100% en Español:** Todas las opciones del menú contextual de clic derecho (anticlic), tanto sobre bloques individuales (*Duplicar, Eliminar bloque, Desactivar bloque, Contraer bloque*) como sobre el lienzo (*Deshacer, Rehacer, Ordenar bloques, Eliminar todos los bloques*), deben estar traducidas al español neutro.
* **Paleta de Bloques con Largo Uniforme:** Todos los bloques disponibles en la paleta deben tener exactamente el mismo largo visual estandarizado (ancho unificado de 175px), garantizando una alineación pulcra y sin bordes dentados o irregulares.
* **Detención Inmediata de Ejecución:** El botón *Detener* debe interrumpir instantáneamente la ejecución de cualquier animación en curso (`engine.cancelAnimation`), resolviendo y abortando el flujo asíncrono sin retrasos y devolviendo el botón a su estado *Ejecutar* de inmediato.
* **Eliminación Unificada y sin Papelera Flotante:** Se desactiva la papelera flotante predeterminada de Blockly (`trashcan: false`). La manipulación de eliminación se realiza mediante anticlic o mediante el dock flotante inferior con confirmación.
* **Cero emojis:** Queda estrictamente prohibido el uso de caracteres emoji tanto en el HTML, CSS, JavaScript, canvas y bloques de Blockly. Para iconografía interactiva se deben utilizar exclusivamente vectores SVG limpios o glifos tipográficos funcionales estándar.
* **Diseño Responsivo Obligatorio:** La interfaz debe adaptarse fluidamente a pantallas de escritorio, portátiles, tabletas y móviles. Los paneles principales deben usar `min-width: 0` y dimensionamiento relativo. El canvas 2D debe escalar automáticamente respetando su relación de aspecto. En pantallas estrechas (< 900px), se debe proveer un conmutador de vistas para alternar entre el área de programación y el simulador sin desbordamientos horizontales.
* **Separación de responsabilidades:**
	* `index.html`: Estructura semántica, accesibilidad, script de idioma oficial en español y modales sin estilos inline ni scripts embebidos.
	* `css/theme.css`: Definición de variables CSS para tema claro, paleta de colores vibrantes educativos y tokens tipográficos.
	* `css/layout.css`: Sistemas de grid/flexbox responsivos, dock flotante inferior, fondo cuadriculado estilo Figma exclusivo para bloques, modales e iconografía SVG.
	* `js/storage.js`: Capa de persistencia (`localStorage`), serialización y compresión Base64 (`CB1-`).
	* `js/audio.js`: Sintetizador Web Audio API puro, sin librerías externas ni assets MP3/WAV.
	* `js/levels.js`: Definición de niveles, matrices de mapa, toolboxes y objetivos.
	* `js/blocks.js`: Definición de bloques de Google Blockly con largo visual uniforme (175px), registro completo del diccionario de anticlic en español y generadores de código.
	* `js/bit_renderer.js`: Renderizado vectorial articulado en Canvas 2D para el personaje BIT con ciclo de caminata de 4 frames, balanceo sincronizado de extremidades, oscilación de chasis y rotación direccional suave.
	* `js/bit3d.js`: Modelo paramétrico 3D de BIT en Three.js con materiales PBR, textura dinámica en canvas para visor con ojos LED expresivos, antena con diodo emisivo y cinemática articulada.
	* `js/engine.js`: Motor de renderizado en Canvas 2D del simulador con cancelación instantánea de animación (`cancelAnimation`), cinemática/interpolación fluida (60 FPS), partículas y sensores.
	* `js/engine3d.js`: Motor 3D WebGL con cámara isométrica ortográfica, iluminación de estudio (`PCFSoftShadowMap`), baldosas biseladas, núcleos octaédricos giratorios y micro-parallax reactivo.
	* `js/map.js`: Pantalla inicial y vista interactiva del Mapa de Progreso con spline curvo continuo conectando 15 niveles a lo largo de 5 biomas temáticos.
	* `js/map3d.js`: Mapa de Progreso 3D con dioramas de islas flotantes en relieve para los 5 biomas, carreteras extruidas con sombras y avatar 3D guiado de BIT.
	* `js/main.js`: Orquestador de ciclo de vida de la aplicación, control de pantallas (Mapa / Espacio de trabajo), control de flujo, interrupción inmediata con botón Detener, inmovilización estricta de escala en la paleta lateral de bloques y control responsive.

## Reglas Técnicas de Inicialización y Ejecución
* Interceptar `Blockly.WorkspaceSvg.prototype.setScale` para garantizar que cualquier workspace correspondiente a un flyout mantenga una escala fija de `1.0`.
* Al inyectar el espacio de trabajo de Google Blockly (`Blockly.inject`), inicializar con toolbox directo (`FlyoutToolbox`) no nulo, desactivar `trashcan`, desactivar `zoom.controls`, y activar `zoom.wheel: true`.
* Toda llamada a `engine.step` debe abortar de inmediato si `abortExecution` es verdadero. El método `stop` debe cancelar la animación activa en el motor mediante `engine.cancelAnimation()`.
* El entorno de bloques genera secuencias asíncronas compatibles con promesas (`await engine.step(...)`).
* Cada acción del robot debe soportar resaltado en vivo de bloques correspondientes (`workspace.highlightBlock`).

## Calidad y Rendimiento
* Renderizado a 60 FPS utilizando `requestAnimationFrame`.
* Gestión de memoria y limpieza de temporizadores y listeners al cambiar de nivel o reiniciar.
* Responsividad y adaptación a resolución de pantalla mediante escalado de viewport en Canvas y layouts fluidos.
