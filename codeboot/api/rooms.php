<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/database.php';

const ROOM_CAPACITY = 50;

function findUserRoom(PDO $pdo, string $userCode): ?array
{
	$query = $pdo->prepare(
		'SELECT s.id_sala, s.codigo, (SELECT COUNT(*) FROM sala_miembros m WHERE m.id_sala = s.id_sala) AS miembros
		FROM sala_miembros propio
		JOIN salas s ON s.id_sala = propio.id_sala
		WHERE propio.codigo_usuario = ?'
	);
	$query->execute([$userCode]);
	return $query->fetch() ?: null;
}

function roomData(?array $room): ?array
{
	return $room === null ? null : [
		'code' => $room['codigo'],
		'memberCount' => (int) $room['miembros'],
		'capacity' => ROOM_CAPACITY,
	];
}

function createRoom(PDO $pdo): int
{
	$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	$insert = $pdo->prepare('INSERT IGNORE INTO salas (codigo) VALUES (?)');
	for ($attempt = 0; $attempt < 5; $attempt++) {
		$code = '';
		for ($digit = 0; $digit < 8; $digit++) {
			$code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
		}
		$insert->execute([$code]);
		if ($insert->rowCount() === 1) return (int) $pdo->lastInsertId();
	}
	throw new RuntimeException('No se pudo generar el código de sala.');
}

function changeRoom(PDO $pdo, string $userCode, string $action, string $code): void
{
	$pdo->beginTransaction();
	try {
		$lockUser = $pdo->prepare('SELECT codigo_usuario FROM usuarios WHERE codigo_usuario = ? FOR UPDATE');
		$lockUser->execute([$userCode]);
		if ($lockUser->fetchColumn() === false) {
			throw new DomainException('Vuelve a iniciar sesión para acceder a las salas.', 403);
		}
		$currentRoom = findUserRoom($pdo, $userCode);
		if ($action === 'leave') {
			if ($currentRoom !== null) {
				$roomId = $currentRoom['id_sala'];
				$lockRoom = $pdo->prepare('SELECT id_sala FROM salas WHERE id_sala = ? FOR UPDATE');
				$lockRoom->execute([$roomId]);
				$lockRoom->fetchColumn();
				$removeMember = $pdo->prepare('DELETE FROM sala_miembros WHERE codigo_usuario = ?');
				$removeMember->execute([$userCode]);
				$removeEmptyRoom = $pdo->prepare(
					'DELETE FROM salas WHERE id_sala = ? AND NOT EXISTS (SELECT 1 FROM sala_miembros WHERE id_sala = ?)'
				);
				$removeEmptyRoom->execute([$roomId, $roomId]);
			}
		} elseif ($currentRoom !== null) {
			if ($action === 'join' && $currentRoom['codigo'] !== $code) {
				throw new DomainException('Sal de tu sala actual antes de unirte a otra.', 409);
			}
		} else {
			if ($action === 'create') {
				$roomId = createRoom($pdo);
			} else {
				$lockRoom = $pdo->prepare('SELECT id_sala FROM salas WHERE codigo = ? FOR UPDATE');
				$lockRoom->execute([$code]);
				$roomId = $lockRoom->fetchColumn();
				if ($roomId === false) throw new DomainException('No encontramos una sala con ese código.', 404);
				$members = $pdo->prepare('SELECT codigo_usuario FROM sala_miembros WHERE id_sala = ? FOR UPDATE');
				$members->execute([$roomId]);
				if (count($members->fetchAll(PDO::FETCH_COLUMN)) >= ROOM_CAPACITY) {
					throw new DomainException('La sala ya tiene 50 personas.', 409);
				}
			}
			$addMember = $pdo->prepare('INSERT INTO sala_miembros (codigo_usuario, id_sala) VALUES (?, ?)');
			$addMember->execute([$userCode, $roomId]);
		}
		$pdo->commit();
	} catch (Throwable $error) {
		if ($pdo->inTransaction()) $pdo->rollBack();
		throw $error;
	}
}

function chooseMedal(int $stars, int $attempts): string
{
	if ($attempts > 0) {
		if ($stars >= 48 && $stars * 10 >= $attempts * 24) return 'diamante';
		if ($stars >= 36 && $stars * 10 >= $attempts * 18) return 'oro';
		if ($stars >= 18 && $stars * 10 >= $attempts * 12) return 'plata';
	}
	return 'cobre';
}

function loadLeaderboard(PDO $pdo, string $userCode, ?int $roomId): array
{
	$membership = $roomId === null ? '' : 'JOIN sala_miembros m ON m.codigo_usuario = u.codigo_usuario AND m.id_sala = ?';
	$hasProgress = $roomId === null ? 'HAVING completados > 0' : '';
	$query = $pdo->prepare(
		"SELECT u.codigo_usuario, u.nombre_completo,
			COALESCE(SUM(p.estrellas), 0) AS estrellas,
			COALESCE(SUM(p.completado), 0) AS completados,
			COALESCE(SUM(p.intentos), 0) AS intentos,
			CASE WHEN SUM(p.completado) = COUNT(t.nivel_id) THEN SUM(t.mejor_tiempo_ms) END AS tiempo_ms
		FROM usuarios u
		$membership
		LEFT JOIN progreso_niveles p ON p.codigo_usuario = u.codigo_usuario AND p.nivel_id REGEXP ?
		LEFT JOIN tiempos_niveles t ON t.codigo_usuario = p.codigo_usuario AND t.nivel_id = p.nivel_id AND p.completado = 1
		GROUP BY u.codigo_usuario, u.nombre_completo
		$hasProgress
		ORDER BY estrellas DESC, completados DESC, tiempo_ms IS NULL, tiempo_ms ASC, u.codigo_usuario ASC
		LIMIT 10"
	);
	$parameters = $roomId === null ? [GameDatabase::LEVEL_ID_PATTERN] : [$roomId, GameDatabase::LEVEL_ID_PATTERN];
	$query->execute($parameters);
	return array_map(static function (array $row) use ($userCode): array {
		$stars = (int) $row['estrellas'];
		$attempts = (int) $row['intentos'];
		return [
			'name' => $row['nombre_completo'],
			'stars' => $stars,
			'completedLevels' => (int) $row['completados'],
			'attempts' => $attempts,
			'timeMs' => $row['tiempo_ms'] !== null ? (int) $row['tiempo_ms'] : null,
			'medal' => chooseMedal($stars, $attempts),
			'isSelf' => $row['codigo_usuario'] === $userCode,
		];
	}, $query->fetchAll());
}

$user = getSessionUser();
session_write_close();
if ($user === null) {
	jsonResponse(['success' => false, 'message' => 'Inicia sesión para acceder a las salas y la clasificación.'], 401);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$userCode = $user['codigoUsuario'];
try {
	if ($method === 'GET') {
		$scope = $_GET['scope'] ?? 'global';
		if (!in_array($scope, ['global', 'room'], true)) {
			throw new DomainException('Selecciona una clasificación válida.', 400);
		}
		$pdo = GameDatabase::connect();
		$room = findUserRoom($pdo, $userCode);
		$scores = $scope === 'global' ? loadLeaderboard($pdo, $userCode, null)
			: ($room === null ? [] : loadLeaderboard($pdo, $userCode, (int) $room['id_sala']));
		jsonResponse(['success' => true, 'room' => roomData($room), 'leaderboard' => $scores]);
	}
	if ($method === 'POST') {
		if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') {
			throw new DomainException('Envía la solicitud de sala en JSON.', 415);
		}
		$input = readRequestInput();
		$action = $input['action'] ?? '';
		if (!in_array($action, ['create', 'join', 'leave'], true)) {
			throw new DomainException('Acción de sala inválida.', 400);
		}
		$code = is_string($input['code'] ?? null) ? strtoupper(trim($input['code'])) : '';
		if ($action === 'join' && !preg_match('/^[A-HJ-NP-Z2-9]{8}$/D', $code)) {
			throw new DomainException('Ingresa los 8 caracteres del código de sala.', 400);
		}
		$pdo = GameDatabase::connect();
		changeRoom($pdo, $userCode, $action, $code);
		jsonResponse(['success' => true, 'room' => roomData(findUserRoom($pdo, $userCode))]);
	}
	header('Allow: GET, POST');
	throw new DomainException('Método HTTP no permitido.', 405);
} catch (DomainException $error) {
	jsonResponse(['success' => false, 'message' => $error->getMessage()], $error->getCode());
} catch (Throwable $error) {
	error_log($error->getMessage());
	jsonResponse(['success' => false, 'message' => 'No se pudieron cargar las salas o la clasificación.'], 500);
}
