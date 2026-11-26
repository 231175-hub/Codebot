<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/database.php';

$user = getSessionUser();
if ($user === null) {
	jsonResponse([
		'success' => false,
		'message' => 'Debes iniciar sesión para sincronizar tu progreso.',
	], 401);
}

$codigoUsuario = $user['codigoUsuario'];
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
	if ($method === 'GET') {
		$progress = GameDatabase::loadUserProgress($codigoUsuario);
		jsonResponse([
			'success' => true,
			'progress' => $progress,
		], 200);
	}

	if ($method === 'POST') {
		$input = readRequestInput();
		if (isset($input['expectedUserCode']) && $input['expectedUserCode'] !== $codigoUsuario) {
			jsonResponse(['success' => false, 'message' => 'La sesión de CodeBoot cambió.'], 409);
		}
		$action = strtolower(trim((string) ($input['action'] ?? $_GET['action'] ?? 'level')));

		if ($action === 'level') {
			$totals = GameDatabase::saveLevelProgress($codigoUsuario, $input);
			jsonResponse([
				'success' => true,
				'totals' => $totals,
			], 200);
		}

		if ($action === 'attempt') {
			$nivelId = (string) ($input['nivelId'] ?? '');
			$ejecucionId = isset($input['ejecucionId']) ? (string) $input['ejecucionId'] : null;
			$result = GameDatabase::incrementAttempt($codigoUsuario, $nivelId, $ejecucionId);
			jsonResponse([
				'success' => true,
				'data' => $result,
			], 200);
		}

		if ($action === 'workspace') {
			$nivelId = (string) ($input['nivelId'] ?? '');
			$workspaceXml = (string) ($input['workspaceXml'] ?? '');
			GameDatabase::saveWorkspace($codigoUsuario, $nivelId, $workspaceXml);
			jsonResponse([
				'success' => true,
			], 200);
		}

		if ($action === 'sync') {
			$totals = GameDatabase::syncFullProgress($codigoUsuario, $input);
			$progress = GameDatabase::loadUserProgress($codigoUsuario);
			jsonResponse([
				'success' => true,
				'totals' => $totals,
				'progress' => $progress,
			], 200);
		}

		jsonResponse([
			'success' => false,
			'message' => 'Acción no reconocida.',
		], 400);
	}

	jsonResponse([
		'success' => false,
		'message' => 'Método HTTP no permitido.',
	], 405);
} catch (InvalidArgumentException $e) {
	jsonResponse([
		'success' => false,
		'message' => $e->getMessage(),
	], 400);
} catch (Throwable $e) {
	jsonResponse([
		'success' => false,
		'message' => 'No se pudo guardar el progreso en la base de datos.',
		'detail' => $e->getMessage(),
	], 500);
}
