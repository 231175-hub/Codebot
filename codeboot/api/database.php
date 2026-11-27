<?php

declare(strict_types=1);

class GameDatabase
{
	private const WORLD_COUNT = 6;
	private const LEVELS_PER_WORLD = 4;
	private const MAX_UNLOCKED_LEVEL = self::WORLD_COUNT * self::LEVELS_PER_WORLD - 1;
	public const LEVEL_ID_PATTERN = '^[1-' . self::WORLD_COUNT . '][.][1-' . self::LEVELS_PER_WORLD . ']$';

	private static ?PDO $pdo = null;

	public static function connect(): PDO
	{
		if (self::$pdo instanceof PDO) {
			return self::$pdo;
		}

		$config = require __DIR__ . '/config.php';
		$db = $config['db'];

		$dsn = sprintf(
			'mysql:host=%s;port=%s;dbname=%s;charset=%s',
			$db['host'],
			$db['port'],
			$db['name'],
			$db['charset']
		);

		self::$pdo = new PDO($dsn, $db['user'], $db['pass'], [
			PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
			PDO::ATTR_EMULATE_PREPARES => false,
		]);

		return self::$pdo;
	}

	public static function upsertUser(array $user): void
	{
		$pdo = self::connect();

		$stmt = $pdo->prepare('SELECT codigo_usuario FROM usuarios WHERE codigo_usuario = :codigo_usuario LIMIT 1');
		$stmt->execute([':codigo_usuario' => $user['codigoUsuario']]);
		$exists = $stmt->fetch();

		if ($exists) {
			$update = $pdo->prepare(
				'UPDATE usuarios
				SET correo_electronico = :correo_electronico,
					nombre_completo = :nombre_completo,
					extension_avatar = :extension_avatar,
					nombre_tipo_usuario = :nombre_tipo_usuario,
					ultima_actualizacion_api = :ultima_actualizacion_api,
					ultimo_acceso = CURRENT_TIMESTAMP
				WHERE codigo_usuario = :codigo_usuario'
			);
			$update->execute([
				':correo_electronico' => $user['correoElectronico'],
				':nombre_completo' => $user['nombreCompleto'],
				':extension_avatar' => $user['extensionAvatar'],
				':nombre_tipo_usuario' => $user['nombreTipoUsuario'],
				':ultima_actualizacion_api' => $user['ultimaActualizacion'],
				':codigo_usuario' => $user['codigoUsuario'],
			]);
			return;
		}

		$insert = $pdo->prepare(
			'INSERT INTO usuarios (
				codigo_usuario,
				correo_electronico,
				nombre_completo,
				extension_avatar,
				nombre_tipo_usuario,
				ultima_actualizacion_api
			) VALUES (
				:codigo_usuario,
				:correo_electronico,
				:nombre_completo,
				:extension_avatar,
				:nombre_tipo_usuario,
				:ultima_actualizacion_api
			)'
		);
		$insert->execute([
			':codigo_usuario' => $user['codigoUsuario'],
			':correo_electronico' => $user['correoElectronico'],
			':nombre_completo' => $user['nombreCompleto'],
			':extension_avatar' => $user['extensionAvatar'],
			':nombre_tipo_usuario' => $user['nombreTipoUsuario'],
			':ultima_actualizacion_api' => $user['ultimaActualizacion'],
		]);
	}

	public static function loadUserProgress(string $codigoUsuario): array
	{
		$pdo = self::connect();

		$userStmt = $pdo->prepare(
			'SELECT nombre_completo, nivel_desbloqueado, estrellas_totales, puntuacion_total, niveles_completados
			FROM usuarios
			WHERE codigo_usuario = :codigo_usuario
			LIMIT 1'
		);
		$userStmt->execute([':codigo_usuario' => $codigoUsuario]);
		$userRow = $userStmt->fetch();

		$levelsStmt = $pdo->prepare(
			'SELECT p.nivel_id, p.estrellas, p.puntuacion, p.bloques_usados, p.intentos,
				p.completado, p.workspace_xml, t.mejor_tiempo_ms
			FROM progreso_niveles p
			LEFT JOIN tiempos_niveles t ON t.codigo_usuario = p.codigo_usuario AND t.nivel_id = p.nivel_id
			WHERE p.codigo_usuario = :codigo_usuario AND p.nivel_id REGEXP :level_pattern
			ORDER BY p.id_progreso ASC'
		);
		$levelsStmt->execute([':codigo_usuario' => $codigoUsuario, ':level_pattern' => self::LEVEL_ID_PATTERN]);
		$rows = $levelsStmt->fetchAll();

		$unlockedLevel = self::clampUnlockedLevel((int) ($userRow['nivel_desbloqueado'] ?? 0));
		$stars = [];
		$scores = [];
		$blocksUsed = [];
		$attempts = [];
		$bestTimes = [];
		$savedWorkspaces = [];

		foreach ($rows as $row) {
			$nivelId = (string) $row['nivel_id'];
			$estrellas = (int) $row['estrellas'];
			$puntuacion = (int) $row['puntuacion'];
			$intentos = (int) $row['intentos'];

			if ((int) $row['completado'] === 1) {
				$unlockedLevel = max($unlockedLevel, self::nextLevelIndex($nivelId));
			}
			if ($estrellas > 0) {
				$stars[$nivelId] = $estrellas;
			}
			if ($puntuacion > 0) {
				$scores[$nivelId] = $puntuacion;
			}
			if ($row['bloques_usados'] !== null) {
				$blocksUsed[$nivelId] = (int) $row['bloques_usados'];
			}
			if ($intentos > 0) {
				$attempts[$nivelId] = $intentos;
			}
			if ($row['mejor_tiempo_ms'] !== null) {
				$bestTimes[$nivelId] = (int) $row['mejor_tiempo_ms'];
			}
			if ($row['workspace_xml'] !== null && $row['workspace_xml'] !== '') {
				$savedWorkspaces[$nivelId] = (string) $row['workspace_xml'];
			}
		}

		return [
			'studentName' => $userRow ? (string) $userRow['nombre_completo'] : '',
			'unlockedLevel' => $unlockedLevel,
			'totalStars' => $userRow ? (int) $userRow['estrellas_totales'] : 0,
			'totalScore' => $userRow ? (int) $userRow['puntuacion_total'] : 0,
			'completedLevels' => $userRow ? (int) $userRow['niveles_completados'] : 0,
			'stars' => empty($stars) ? new stdClass() : $stars,
			'scores' => empty($scores) ? new stdClass() : $scores,
			'blocksUsed' => empty($blocksUsed) ? new stdClass() : $blocksUsed,
			'attempts' => empty($attempts) ? new stdClass() : $attempts,
			'bestTimes' => empty($bestTimes) ? new stdClass() : $bestTimes,
			'savedWorkspaces' => empty($savedWorkspaces) ? new stdClass() : $savedWorkspaces,
		];
	}

	public static function saveLevelProgress(string $codigoUsuario, array $payload): array
	{
		$nivelId = trim((string) ($payload['nivelId'] ?? ''));
		if (!self::isValidLevelId($nivelId)) {
			throw new InvalidArgumentException('Identificador de nivel inválido.');
		}

		$estrellas = max(0, min(3, (int) ($payload['estrellas'] ?? 0)));
		$puntuacion = max(0, (int) ($payload['puntuacion'] ?? 0));
		$bloquesUsados = isset($payload['bloquesUsados']) && $payload['bloquesUsados'] !== null
			? max(0, (int) $payload['bloquesUsados'])
			: null;
		$completado = !empty($payload['completado']) ? 1 : 0;
		$unlockedLevel = isset($payload['unlockedLevel']) ? self::clampUnlockedLevel((int) $payload['unlockedLevel']) : null;
		$workspaceXml = isset($payload['workspaceXml']) ? (string) $payload['workspaceXml'] : null;

		$pdo = self::connect();
		$pdo->beginTransaction();

		try {
			self::lockProgressOwner($pdo, $codigoUsuario);
			$select = $pdo->prepare(
				'SELECT id_progreso, estrellas, puntuacion, bloques_usados, intentos, completado, workspace_xml
				FROM progreso_niveles
				WHERE codigo_usuario = :codigo_usuario AND nivel_id = :nivel_id
				LIMIT 1'
			);
			$select->execute([
				':codigo_usuario' => $codigoUsuario,
				':nivel_id' => $nivelId,
			]);
			$existing = $select->fetch();

			if ($existing) {
				$newEstrellas = max((int) $existing['estrellas'], $estrellas);
				$newPuntuacion = max((int) $existing['puntuacion'], $puntuacion);
				$newCompletado = max((int) $existing['completado'], $completado);
				$newBloques = $existing['bloques_usados'] !== null ? (int) $existing['bloques_usados'] : null;

				if ($completado === 1 && $bloquesUsados !== null) {
					$newBloques = $newBloques === null ? $bloquesUsados : min($newBloques, $bloquesUsados);
				}

				$newXml = $workspaceXml !== null ? $workspaceXml : $existing['workspace_xml'];

				$update = $pdo->prepare(
					'UPDATE progreso_niveles
					SET estrellas = :estrellas,
						puntuacion = :puntuacion,
						bloques_usados = :bloques_usados,
						completado = :completado,
						workspace_xml = :workspace_xml,
						actualizado_en = CURRENT_TIMESTAMP
					WHERE id_progreso = :id_progreso'
				);
				$update->execute([
					':estrellas' => $newEstrellas,
					':puntuacion' => $newPuntuacion,
					':bloques_usados' => $newBloques,
					':completado' => $newCompletado,
					':workspace_xml' => $newXml,
					':id_progreso' => (int) $existing['id_progreso'],
				]);
			} else {
				$insert = $pdo->prepare(
					'INSERT INTO progreso_niveles (
						codigo_usuario,
						nivel_id,
						estrellas,
						puntuacion,
						bloques_usados,
						intentos,
						completado,
						workspace_xml
					) VALUES (
						:codigo_usuario,
						:nivel_id,
						:estrellas,
						:puntuacion,
						:bloques_usados,
						:intentos,
						:completado,
						:workspace_xml
					)'
				);
				$insert->execute([
					':codigo_usuario' => $codigoUsuario,
					':nivel_id' => $nivelId,
					':estrellas' => $estrellas,
					':puntuacion' => $puntuacion,
					':bloques_usados' => $completado === 1 ? $bloquesUsados : null,
					':intentos' => max(1, (int) ($payload['intentos'] ?? 1)),
					':completado' => $completado,
					':workspace_xml' => $workspaceXml,
				]);
			}

			if ($completado === 1) {
				self::saveBestTime($pdo, $codigoUsuario, $nivelId, $payload['timeMs'] ?? null);
			}
			$totals = self::recalculateUserTotals($pdo, $codigoUsuario, $unlockedLevel);
			$pdo->commit();

			return $totals;
		} catch (Throwable $e) {
			if ($pdo->inTransaction()) {
				$pdo->rollBack();
			}
			throw $e;
		}
	}

	public static function incrementAttempt(string $codigoUsuario, string $nivelId, ?string $ejecucionId = null): array
	{
		$nivelId = trim($nivelId);
		if (!self::isValidLevelId($nivelId)) {
			throw new InvalidArgumentException('Identificador de nivel inválido.');
		}
		if ($ejecucionId !== null && !preg_match('/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/D', $ejecucionId)) {
			throw new InvalidArgumentException('Identificador de intento inválido.');
		}

		$pdo = self::connect();
		$pdo->beginTransaction();
		$params = [':codigo_usuario' => $codigoUsuario, ':nivel_id' => $nivelId];

		try {
			self::lockProgressOwner($pdo, $codigoUsuario);
			$recordedLevel = false;
			if ($ejecucionId !== null) {
				$event = $pdo->prepare('SELECT nivel_id FROM ejecuciones_niveles WHERE codigo_usuario = ? AND ejecucion_id = ?');
				$event->execute([$codigoUsuario, $ejecucionId]);
				$recordedLevel = $event->fetchColumn();
				if ($recordedLevel !== false && $recordedLevel !== $nivelId) {
					throw new InvalidArgumentException('El intento corresponde a otro nivel.');
				}
			}
			if ($recordedLevel === false) {
				$increment = $pdo->prepare(
					'INSERT INTO progreso_niveles (codigo_usuario, nivel_id, intentos)
					VALUES (:codigo_usuario, :nivel_id, 1)
					ON DUPLICATE KEY UPDATE intentos = intentos + 1'
				);
				$increment->execute($params);
				if ($ejecucionId !== null) {
					$event = $pdo->prepare('INSERT INTO ejecuciones_niveles (codigo_usuario, ejecucion_id, nivel_id) VALUES (?, ?, ?)');
					$event->execute([$codigoUsuario, $ejecucionId, $nivelId]);
				}
			}
			$select = $pdo->prepare(
				'SELECT intentos FROM progreso_niveles WHERE codigo_usuario = :codigo_usuario AND nivel_id = :nivel_id'
			);
			$select->execute($params);
			$intentos = (int) $select->fetchColumn();
			$pdo->commit();
			return ['nivelId' => $nivelId, 'intentos' => $intentos];
		} catch (Throwable $e) {
			$pdo->rollBack();
			throw $e;
		}
	}

	public static function saveWorkspace(string $codigoUsuario, string $nivelId, string $workspaceXml): void
	{
		$nivelId = trim($nivelId);
		if (!self::isValidLevelId($nivelId)) {
			throw new InvalidArgumentException('Identificador de nivel inválido.');
		}

		$pdo = self::connect();

		$select = $pdo->prepare(
			'SELECT id_progreso
			FROM progreso_niveles
			WHERE codigo_usuario = :codigo_usuario AND nivel_id = :nivel_id
			LIMIT 1'
		);
		$select->execute([
			':codigo_usuario' => $codigoUsuario,
			':nivel_id' => $nivelId,
		]);
		$existing = $select->fetch();

		if ($existing) {
			$update = $pdo->prepare(
				'UPDATE progreso_niveles
				SET workspace_xml = :workspace_xml, actualizado_en = CURRENT_TIMESTAMP
				WHERE id_progreso = :id_progreso'
			);
			$update->execute([
				':workspace_xml' => $workspaceXml,
				':id_progreso' => (int) $existing['id_progreso'],
			]);
			return;
		}

		$insert = $pdo->prepare(
			'INSERT INTO progreso_niveles (codigo_usuario, nivel_id, workspace_xml)
			VALUES (:codigo_usuario, :nivel_id, :workspace_xml)'
		);
		$insert->execute([
			':codigo_usuario' => $codigoUsuario,
			':nivel_id' => $nivelId,
			':workspace_xml' => $workspaceXml,
		]);
	}

	public static function syncFullProgress(string $codigoUsuario, array $payload): array
	{
		$unlockedLevel = self::clampUnlockedLevel((int) ($payload['unlockedLevel'] ?? 0));
		$starsMap = is_array($payload['stars'] ?? null) ? $payload['stars'] : [];
		$scoresMap = is_array($payload['scores'] ?? null) ? $payload['scores'] : [];
		$blocksMap = is_array($payload['blocksUsed'] ?? null) ? $payload['blocksUsed'] : [];
		$attemptsMap = is_array($payload['attempts'] ?? null) ? $payload['attempts'] : [];
		$timesMap = is_array($payload['bestTimes'] ?? null) ? $payload['bestTimes'] : [];
		$workspacesMap = is_array($payload['savedWorkspaces'] ?? null) ? $payload['savedWorkspaces'] : [];

		$levelIds = array_unique(array_merge(
			array_keys($starsMap),
			array_keys($scoresMap),
			array_keys($blocksMap),
			array_keys($attemptsMap),
			array_keys($timesMap),
			array_keys($workspacesMap)
		));

		$pdo = self::connect();
		$pdo->beginTransaction();

		try {
			self::lockProgressOwner($pdo, $codigoUsuario);
			foreach ($levelIds as $nivelId) {
				$nivelId = trim((string) $nivelId);
				if (!self::isValidLevelId($nivelId)) {
					continue;
				}

				$estrellas = max(0, min(3, (int) ($starsMap[$nivelId] ?? 0)));
				$puntuacion = isset($scoresMap[$nivelId])
					? max(0, (int) $scoresMap[$nivelId])
					: ($estrellas === 3 ? 350 : ($estrellas === 2 ? 200 : ($estrellas === 1 ? 100 : 0)));
				$bloques = isset($blocksMap[$nivelId]) && $blocksMap[$nivelId] !== null ? max(0, (int) $blocksMap[$nivelId]) : null;
				$intentos = max(0, (int) ($attemptsMap[$nivelId] ?? ($estrellas > 0 ? 1 : 0)));
				$completado = $estrellas > 0 ? 1 : 0;
				$xml = isset($workspacesMap[$nivelId]) ? (string) $workspacesMap[$nivelId] : null;

				$select = $pdo->prepare(
					'SELECT id_progreso, estrellas, puntuacion, bloques_usados, intentos, completado, workspace_xml
					FROM progreso_niveles
					WHERE codigo_usuario = :codigo_usuario AND nivel_id = :nivel_id
					LIMIT 1'
				);
				$select->execute([
					':codigo_usuario' => $codigoUsuario,
					':nivel_id' => $nivelId,
				]);
				$existing = $select->fetch();

				if ($existing) {
					$newBloques = $existing['bloques_usados'] !== null ? (int) $existing['bloques_usados'] : null;
					if ($bloques !== null) {
						$newBloques = $newBloques === null ? $bloques : min($newBloques, $bloques);
					}
					$update = $pdo->prepare(
						'UPDATE progreso_niveles
						SET estrellas = :estrellas,
							puntuacion = :puntuacion,
							bloques_usados = :bloques_usados,
							intentos = :intentos,
							completado = :completado,
							workspace_xml = :workspace_xml,
							actualizado_en = CURRENT_TIMESTAMP
						WHERE id_progreso = :id_progreso'
					);
					$update->execute([
						':estrellas' => max((int) $existing['estrellas'], $estrellas),
						':puntuacion' => max((int) $existing['puntuacion'], $puntuacion),
						':bloques_usados' => $newBloques,
						':intentos' => max((int) $existing['intentos'], $intentos),
						':completado' => max((int) $existing['completado'], $completado),
						':workspace_xml' => $xml !== null && $xml !== '' ? $xml : $existing['workspace_xml'],
						':id_progreso' => (int) $existing['id_progreso'],
					]);
				} else {
					$insert = $pdo->prepare(
						'INSERT INTO progreso_niveles (
							codigo_usuario,
							nivel_id,
							estrellas,
							puntuacion,
							bloques_usados,
							intentos,
							completado,
							workspace_xml
						) VALUES (
							:codigo_usuario,
							:nivel_id,
							:estrellas,
							:puntuacion,
							:bloques_usados,
							:intentos,
							:completado,
							:workspace_xml
						)'
					);
					$insert->execute([
						':codigo_usuario' => $codigoUsuario,
						':nivel_id' => $nivelId,
						':estrellas' => $estrellas,
						':puntuacion' => $puntuacion,
						':bloques_usados' => $bloques,
						':intentos' => $intentos,
						':completado' => $completado,
						':workspace_xml' => $xml,
					]);
				}
				if ($completado === 1) {
					self::saveBestTime($pdo, $codigoUsuario, $nivelId, $timesMap[$nivelId] ?? null);
				}
			}

			$totals = self::recalculateUserTotals($pdo, $codigoUsuario, $unlockedLevel);
			$pdo->commit();

			return $totals;
		} catch (Throwable $e) {
			if ($pdo->inTransaction()) {
				$pdo->rollBack();
			}
			throw $e;
		}
	}

	private static function isValidLevelId(string $nivelId): bool
	{
		return preg_match('/' . self::LEVEL_ID_PATTERN . '/D', $nivelId) === 1;
	}

	private static function clampUnlockedLevel(int $index): int
	{
		return max(0, min(self::MAX_UNLOCKED_LEVEL, $index));
	}

	private static function nextLevelIndex(string $nivelId): int
	{
		[$world, $level] = explode('.', $nivelId);
		return self::clampUnlockedLevel(((int) $world - 1) * self::LEVELS_PER_WORLD + (int) $level);
	}

	private static function lockProgressOwner(PDO $pdo, string $codigoUsuario): void
	{
		$lock = $pdo->prepare('SELECT codigo_usuario FROM usuarios WHERE codigo_usuario = ? FOR UPDATE');
		$lock->execute([$codigoUsuario]);
		$lock->fetchColumn();
	}

	private static function saveBestTime(PDO $pdo, string $codigoUsuario, string $nivelId, $timeMs): void
	{
		if (!is_int($timeMs) || $timeMs < 1 || $timeMs > 86400000) {
			return;
		}
		$save = $pdo->prepare(
			'INSERT INTO tiempos_niveles (codigo_usuario, nivel_id, mejor_tiempo_ms)
			VALUES (?, ?, ?)
			ON DUPLICATE KEY UPDATE mejor_tiempo_ms = LEAST(mejor_tiempo_ms, ?)'
		);
		$save->execute([$codigoUsuario, $nivelId, $timeMs, $timeMs]);
	}

	private static function recalculateUserTotals(PDO $pdo, string $codigoUsuario, ?int $requestedUnlockedLevel = null): array
	{
		$aggStmt = $pdo->prepare(
			'SELECT
				COALESCE(SUM(estrellas), 0) AS estrellas_totales,
				COALESCE(SUM(puntuacion), 0) AS puntuacion_total,
				COALESCE(SUM(completado), 0) AS niveles_completados,
				MAX(CASE WHEN completado = 1 THEN nivel_id END) AS ultimo_nivel_completado
			FROM progreso_niveles
			WHERE codigo_usuario = :codigo_usuario AND nivel_id REGEXP :level_pattern'
		);
		$aggStmt->execute([':codigo_usuario' => $codigoUsuario, ':level_pattern' => self::LEVEL_ID_PATTERN]);
		$agg = $aggStmt->fetch();

		$estrellasTotales = (int) ($agg['estrellas_totales'] ?? 0);
		$puntuacionTotal = (int) ($agg['puntuacion_total'] ?? 0);
		$nivelesCompletados = (int) ($agg['niveles_completados'] ?? 0);

		$userStmt = $pdo->prepare('SELECT nivel_desbloqueado FROM usuarios WHERE codigo_usuario = :codigo_usuario LIMIT 1');
		$userStmt->execute([':codigo_usuario' => $codigoUsuario]);
		$currentUnlocked = (int) ($userStmt->fetchColumn() ?: 0);

		$lastCompleted = $agg['ultimo_nivel_completado'] ?? null;
		$nextLevel = $lastCompleted === null ? 0 : self::nextLevelIndex($lastCompleted);
		$newUnlocked = self::clampUnlockedLevel(max($currentUnlocked, $requestedUnlockedLevel ?? 0, $nextLevel));

		$updateUser = $pdo->prepare(
			'UPDATE usuarios
			SET nivel_desbloqueado = :nivel_desbloqueado,
				estrellas_totales = :estrellas_totales,
				puntuacion_total = :puntuacion_total,
				niveles_completados = :niveles_completados,
				ultimo_acceso = CURRENT_TIMESTAMP
			WHERE codigo_usuario = :codigo_usuario'
		);
		$updateUser->execute([
			':nivel_desbloqueado' => $newUnlocked,
			':estrellas_totales' => $estrellasTotales,
			':puntuacion_total' => $puntuacionTotal,
			':niveles_completados' => $nivelesCompletados,
			':codigo_usuario' => $codigoUsuario,
		]);

		return [
			'unlockedLevel' => $newUnlocked,
			'totalStars' => $estrellasTotales,
			'totalScore' => $puntuacionTotal,
			'completedLevels' => $nivelesCompletados,
		];
	}
}
