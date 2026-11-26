# PLAN.md — Plan Maestro de Refactorización y Expansión de Niveles de CodeBoot

## 1. Diagnóstico Integral y Auditoría de Errores Críticos

Tras un análisis exhaustivo del archivo de niveles (`js/levels.js`), el motor de simulación (`js/engine.js` y `js/engine3d.js`) y el evaluador de objetivos (`js/main.js`), se identificaron fallos lógicos graves, niveles físicamente imposibles de resolver y una escala espacial excesivamente reducida que desmerece el potencial gráfico 3D del proyecto.

### 1.1 Errores Críticos Detectados en los Niveles Actuales
1. **Nivel 2.2 (El gran salto — Totalmente Bloqueado):**
   * *Diagnóstico:* BIT inicia en `(1, 1)` con orientación Sur (`dir: 2`). En la celda frontal `(1, 2)` hay un muro sólido (`1`) y la celda `(1, 3)` también es muro.
   * *Fallo fatal:* La lista de bloques disponibles es `["avanzar", "saltar", "encender"]` (carece de `girar_izq` y `girar_der`). BIT no tiene forma de girar ni avanzar sin colisionar de inmediato en el primer paso. El nivel es 100% inoperable.
2. **Nivel 5.4 (Gran Maestro del Código — Físicamente Imposible):**
   * *Diagnóstico:* En la fila 2 solo existe suelo en `(4, 2)`. Al Sur, en `(4, 3)`, hay un hueco (`3`); si BIT intenta saltar hacia el Sur, la celda de aterrizaje `(4, 4)` es un muro perimetral (`1`), provocando caída o colisión fatal. Hacia el Oeste `(3, 2)` y Este `(5, 2)` existen muros bloqueando el paso. Es físicamente imposible acceder al segundo núcleo en `(2, 3)`.
3. **Nivel 4.2 (Recolector de cristales — Fuga de Muro Perimetral):**
   * *Diagnóstico:* En la fila 1 de la matriz (`[1, 0, 4, 4, 4, 0, 5, 2]`), el núcleo meta (`2`) se encuentra en el índice 7 sin muro de cierre perimetral. Mientras las filas 0 y 2 tienen muros, la fila 1 termina en el núcleo en el borde del abismo sin consistencia estructural.
4. **Presupuestos Matemáticamente Imposibles para 3 Estrellas:**
   * *Nivel 1.3:* Requiere obligatoriamente 11 bloques secuenciales sin bucles (`avanzar x2, girar, avanzar x2, girar, avanzar x2, girar, avanzar, encender`), pero `maxBlocksFor3Stars` está fijado en 9. Imposible obtener 3 estrellas.
   * *Nivel 4.3:* Requiere 12 bloques mínimos sin bucles, pero el tope para 3 estrellas es 9.
   * *Nivel 4.4:* Requiere al menos 11 bloques usando bucles o 13 directos, pero el límite es 8.
   * *Nivel 5.2:* La cruz con retorno al centro requiere 11 bloques mínimos con bucle y función, pero el límite es 8.
5. **Carencia de Ejercicio Lógico Real en Sensores (Nivel 3.1):**
   * En el nivel 3.1, todos los obstáculos son agujeros consecutivos en posiciones impares. Un estudiante puede resolver el nivel únicamente ejecutando dos saltos directos sin evaluar jamás la rama `si no`, invalidando el propósito didáctico del condicional.
6. **Escala Espacial Insuficiente y Rutas Monótonas:**
   * 9 de los 20 niveles son simples pasillos unidimensionales rectos de 1 sola casilla de ancho (formatos de 6x3 u 8x3), lo que genera una apariencia vacía en la vista 3D isométrica y no estimula el razonamiento espacial de navegación bidimensional.

---

## 2. Objetivos de la Refactorización de Niveles

1. **Ampliación Espacial a Dioramas Tridimensionales (7x7 a 10x10):**
   * Transformar cada nivel en una plataforma con volumen, muros perimetrales estandarizados, cambios de rasante, giros en escuadra y circuitos navegables en 2D/3D.
2. **Corrección del 100% de Errores de Bloqueo:**
   * Garantizar que cada nivel cuente con los bloques indispensables para su resolución (giros disponibles, metas accesibles y física coherente).
3. **Calibración Matemática Exacta de las 3 Estrellas:**
   * Cada nivel tendrá una solución óptima verificada paso a paso, con un umbral de `maxBlocksFor3Stars` alcanzable mediante el concepto enseñado (secuencia limpia, bucle óptimo, sensor bien estructurado, memoria precisa o función modular).
4. **Desafíos Pedagógicos Genuinos:**
   * Los sensores deberán enfrentarse a patrones irregulares (suelo mixto donde conviven avances y saltos condicionales).
   * Los bucles y funciones deberán ofrecer reducciones drásticas del número de bloques (de 14 a 4 bloques), recompensando al estudiante que aplica buenas prácticas.

---

## 3. Especificación Técnica de los 20 Nuevos Niveles Expandidos

```
Leyenda de Baldoas:
0 = Suelo transitable
1 = Muro sólido
2 = Núcleo de energía (Meta)
3 = Hueco / Abismo (Requiere salto)
4 = Batería de memoria
5 = Compuerta de seguridad rosa
6 = Barrera láser intermitente
```

### Bioma 1: Secuencias (Cimientos de la Lógica Lineal)

#### Nivel 1.1 — Pasarela Estelar (7x5)
* **Concepto:** Avance lineal extenso y activación de núcleo.
* **Inicio:** `{ x: 1, y: 2, dir: 1 }` (Este).
* **Meta:** Núcleo en `(5, 2)`.
* **Dimensiones:** 7 columnas x 5 filas.
* **Bloques disponibles:** `["avanzar", "encender"]`.
* **Solución Óptima:** Avanzar x4, Encender (5 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 5`.

#### Nivel 1.2 — La Curva en Escuadra (7x7)
* **Concepto:** Orientación espacial, giro a la izquierda y alineación en ángulo recto.
* **Inicio:** `{ x: 1, y: 5, dir: 1 }` (Este).
* **Meta:** Núcleo en `(5, 1)`.
* **Dimensiones:** 7x7.
* **Bloques disponibles:** `["avanzar", "girar_izq", "girar_der", "encender"]`.
* **Solución Óptima:** Avanzar x4, Girar Izquierda, Avanzar x4, Encender (10 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 10`.

#### Nivel 1.3 — El Laberinto en S (8x8)
* **Concepto:** Alternancia de giros derecha e izquierda para sortear contrafuertes.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Meta:** Núcleo en `(6, 6)`.
* **Dimensiones:** 8x8.
* **Bloques disponibles:** `["avanzar", "girar_izq", "girar_der", "encender"]`.
* **Solución Óptima:** Avanzar x3, Girar Der, Avanzar x2, Girar Der, Avanzar x2, Girar Izq, Avanzar x3, Girar Izq, Avanzar x4, Encender.
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 16`.

#### Nivel 1.4 — Maniobra del Doble Núcleo (8x7)
* **Concepto:** Activación secuencial de múltiples objetivos en una ruta bifurcada.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Metas:** Núcleo 1 en `(3, 1)`, Núcleo 2 en `(6, 5)`.
* **Dimensiones:** 8x7.
* **Bloques disponibles:** `["avanzar", "girar_izq", "girar_der", "encender"]`.
* **Solución Óptima:** Avanzar x2, Encender, Avanzar x3, Girar Der, Avanzar x4, Encender (11 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 11`.

---

### Bioma 2: Bucles (Automatización y Patrones Repetitivos)

#### Nivel 2.1 — El Gran Corredor (10x5)
* **Concepto:** Reducción drástica de código usando `Repetir N veces`.
* **Inicio:** `{ x: 1, y: 2, dir: 1 }` (Este).
* **Meta:** Núcleo en `(8, 2)`.
* **Dimensiones:** 10x5.
* **Bloques disponibles:** `["avanzar", "encender", "repetir"]`.
* **Solución Óptima:** Repetir 7 veces [Avanzar], Encender (3 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 3`.

#### Nivel 2.2 — El Abismo Abierto (8x7 — CORREGIDO)
* **Concepto:** Saltos de 2 casillas sobre abismos con giros orientados.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Meta:** Núcleo en `(6, 5)`.
* **Obstáculo:** Huecos en `(3, 1)` y `(6, 3)`.
* **Bloques disponibles:** `["avanzar", "saltar", "girar_der", "girar_izq", "encender"]`.
* **Solución Óptima:** Avanzar, Saltar, Avanzar x2, Girar Der, Saltar, Avanzar, Encender (8 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 8`.

#### Nivel 2.3 — Cadencia de Saltos Rítmicos (9x5)
* **Concepto:** Bucle con patrón compuesto `[Avanzar, Saltar]` repetido.
* **Inicio:** `{ x: 1, y: 2, dir: 1 }` (Este).
* **Meta:** Núcleo en `(7, 2)`.
* **Obstáculos:** Huecos en `(3, 2)` y `(6, 2)`.
* **Bloques disponibles:** `["avanzar", "saltar", "encender", "repetir"]`.
* **Solución Óptima:** Repetir 2 veces [Avanzar, Saltar], Encender (4 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 4`.

#### Nivel 2.4 — Patrulla Perimetral Cuadrada (7x7)
* **Concepto:** Bucle cuádruple para recorrer el perímetro completo activando 4 núcleos.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Metas:** Núcleos en las 4 esquinas: `(5, 1)`, `(5, 5)`, `(1, 5)`, `(1, 1)`.
* **Bloques disponibles:** `["avanzar", "girar_der", "encender", "repetir"]`.
* **Solución Óptima:** Repetir 4 veces [Repetir 4 veces [Avanzar], Encender, Girar Der] (6 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 6`.

---

### Bioma 3: Condicionales y Sensores (Toma de Decisiones)

#### Nivel 3.1 — Suelo Irregular Mixto (9x5 — CORREGIDO)
* **Concepto:** Evaluación condicional real (`si hay hueco adelante saltar, si no avanzar`).
* **Inicio:** `{ x: 1, y: 2, dir: 1 }` (Este).
* **Meta:** Núcleo en `(7, 2)`.
* **Distribución de casillas:** Suelo en (1,2), Suelo en (2,2), Hueco en (3,2), Suelo en (4,2), Suelo en (5,2), Hueco en (6,2), Núcleo en (7,2).
* **Bloques disponibles:** `["avanzar", "saltar", "encender", "repetir", "si_hueco"]`.
* **Solución Óptima:** Repetir 5 veces [Si hay hueco saltar, si no avanzar], Encender (5 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 5`.

#### Nivel 3.2 — Punto de Control Láser (8x5)
* **Concepto:** Sincronización temporal con sensor de láser (`si láser encendido esperar, si no avanzar`).
* **Inicio:** `{ x: 1, y: 2, dir: 1 }` (Este).
* **Meta:** Núcleo en `(6, 2)`.
* **Obstáculo:** Láseres intermitentes en `(3, 2)` y `(5, 2)`.
* **Bloques disponibles:** `["avanzar", "esperar", "encender", "repetir", "si_laser"]`.
* **Solución Óptima:** Repetir 6 veces [Si láser encendido esperar, si no avanzar], Encender (5 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 5`.

#### Nivel 3.3 — Navegador de Laberinto Autónomo (8x8)
* **Concepto:** Algoritmo autónomo de seguimiento de muros mediante `mientras_no_meta`.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Meta:** Núcleo en el centro `(4, 4)`.
* **Bloques disponibles:** `["avanzar", "girar_der", "girar_izq", "encender", "mientras_no_meta", "si_muro"]`.
* **Solución Óptima:** Mientras no esté en el núcleo [Si hay muro adelante girar derecha, si no avanzar], Encender (5 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 5`.

#### Nivel 3.4 — Pista de Riesgo Integrada (10x6)
* **Concepto:** Árbol de decisiones compuesto: huecos y barreras láser en la misma ruta.
* **Inicio:** `{ x: 1, y: 2, dir: 1 }` (Este).
* **Meta:** Núcleo en `(8, 2)`.
* **Bloques disponibles:** `["avanzar", "saltar", "esperar", "encender", "repetir", "si_hueco", "si_laser"]`.
* **Solución Óptima:** Repetir 8 veces [Si hueco saltar, si no [Si láser esperar, si no avanzar]], Encender (8 bloques).
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 8`.

---

### Bioma 4: Variables y Memoria (Almacenamiento de Estado)

#### Nivel 4.1 — Acceso de Seguridad Nivel 1 (8x6)
* **Concepto:** Lectura de batería en memoria y apertura de compuerta de seguridad.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Recorrido:** Batería en `(4, 1)`, Compuerta rosa en `(6, 3)`, Núcleo en `(6, 4)`.
* **Bloques disponibles:** `["avanzar", "girar_der", "girar_izq", "recoger_memoria", "encender"]`.
* **Requisito:** `requiredMemory: 1`.
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 9`.

#### Nivel 4.2 — Acumulador Trifásico (9x7 — CORREGIDO)
* **Concepto:** Suma incremental de valores (+1) en memoria hasta cumplir umbral 3.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Baterías:** Tres unidades en `(3, 1)`, `(5, 3)` y `(3, 5)`.
* **Compuerta y Núcleo:** Compuerta en `(7, 5)`, Núcleo en `(7, 3)`.
* **Muro perimetral:** Rectángulo cerrado sin fugas.
* **Bloques disponibles:** `["avanzar", "girar_der", "girar_izq", "sumar_memoria", "encender", "repetir"]`.
* **Requisito:** `requiredMemory: 3`.
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 10`.

#### Nivel 4.3 — Doble Cámara con Compuerta Central (8x8)
* **Concepto:** Navegación en dos salas con recolección acumulativa de 2 baterías.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Baterías:** en `(3, 2)` y `(5, 4)`.
* **Compuerta:** en `(5, 5)`, Núcleo en `(6, 6)`.
* **Bloques disponibles:** `["avanzar", "girar_der", "girar_izq", "sumar_memoria", "encender", "repetir"]`.
* **Requisito:** `requiredMemory: 2`.
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 11`.

#### Nivel 4.4 — La Bóveda Cuádruple (8x8)
* **Concepto:** Circuito cerrado recolectando 4 baterías antes de ingresar a la bóveda blindada.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Baterías:** 4 celdas en las cuatro esquinas de un pasillo circular.
* **Compuerta:** Requiere 4 unidades para franquear la puerta de la cámara acorazada interior.
* **Requisito:** `requiredMemory: 4`.
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 9`.

---

### Bioma 5: Funciones (Modularidad y Abstracción Maestra)

#### Nivel 5.1 — Las Tres Torres de Reparación (10x6)
* **Concepto:** Creación de una función `reparar_torre` invocada 3 veces.
* **Inicio:** `{ x: 1, y: 2, dir: 1 }` (Este).
* **Metas:** Tres torres con núcleos en `(3, 2)`, `(5, 2)` y `(7, 2)`.
* **Bloques disponibles:** `["avanzar", "encender", "repetir", "definir_funcion", "llamar_funcion"]`.
* **Solución Óptima:** Función `reparar`: [Avanzar x2, Encender]. Programa principal: Repetir 3 veces [Llamar `reparar`]. Total: 6 bloques.
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 7`.

#### Nivel 5.2 — La Cruz de Energía (7x7 — CORREGIDO)
* **Concepto:** Modularización de un brazo en cruz con retorno al centro.
* **Inicio:** Centro en `{ x: 3, y: 3, dir: 0 }` (Norte).
* **Metas:** Núcleos en `(3, 1)`, `(5, 3)`, `(3, 5)`, `(1, 3)`.
* **Bloques disponibles:** `["avanzar", "girar_der", "encender", "repetir", "definir_funcion", "llamar_funcion"]`.
* **Función Brazo:** Avanzar x2, Encender, Girar Der x2, Avanzar x2, Girar Der (8 bloques).
* **Programa:** Repetir 4 veces [Llamar función] (3 bloques). Total: 11 bloques.
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 11` (calibrado con precisión exacta).

#### Nivel 5.3 — Puente Combinado (8x8)
* **Concepto:** Función modular que unifica avance, salto sobre hueco y recolección de energía.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Requisito:** Batería y salto en dos alas idénticas.
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 10`.

#### Nivel 5.4 — El Templo del Código Maestro (9x9 — CORREGIDO)
* **Concepto:** Laberinto maestro simétrico con dos alas conectadas y núcleos duales totalmente accesibles.
* **Inicio:** `{ x: 1, y: 1, dir: 1 }` (Este).
* **Metas:** Núcleo 1 en `(4, 1)`, Núcleo 2 en `(4, 7)`.
* **Geometría corregida:** Pasillo central sin callejones sin salida; puentes con saltos verificados donde el aterrizaje siempre ocurre sobre suelo firme (`0`).
* **Bloques disponibles:** `["avanzar", "girar_der", "girar_izq", "saltar", "encender", "repetir", "definir_funcion", "llamar_funcion"]`.
* **Meta 3 Estrellas:** `maxBlocksFor3Stars: 12`.

---

## 4. Adaptaciones en Motores de Renderizado (2D y 3D)

Al expandir el tamaño de las matrices de 6x3/5x5 a rangos de 7x7 hasta 10x10:
1. **Ajuste de Frustum en Three.js (`js/engine3d.js`):**
   * Verificar la función `computeLayout()` para garantizar que mapas de 10x10 queden perfectamente centrados, con márgenes mínimos de 40px y sin recortes de bordes en pantallas de cualquier relación de aspecto.
2. **Escala Automática en Canvas 2D (`js/engine.js`):**
   * El tamaño de baldosa (`tileSize = Math.min(availW / cols, availH / rows)`) se recomputará dinámicamente para conservar nitidez y proporciones perfectas.
3. **Persistencia y Compatibilidad Retroactiva:**
   * La estructura de almacenamiento `Storage.save` en `js/storage.js` mantendrá total compatibilidad, conservando los progresos y diplomas del usuario.

---

## 5. Plan de Ejecución Inmediata

1. **Paso 1: Reescribir `js/levels.js`:**
   * Sustituir los 20 niveles por las matrices expandidas, libres de errores de colisión y con presupuestos óptimos calibrados.
2. **Paso 2: Validación Automatizada en Node.js:**
   * Ejecutar script de verificación de dimensiones, alcanzabilidad de núcleos, posiciones válidas de inicio y conteo exacto de bloques.
3. **Paso 3: Auditoría de Estándares:**
   * Cero comentarios en el código (`.html`, `.css`, `.js`).
   * Indentación estricta por tabuladores (`\t`).
   * Cero emojis (SVG exclusivo).
   * Tema claro e iluminación luminosa intacta.
