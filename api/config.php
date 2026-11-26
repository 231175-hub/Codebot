<?php

declare(strict_types=1);

return [
	'db' => [
		'host' => getenv('CODEBOOT_DB_HOST') ?: '127.0.0.1',
		'port' => getenv('CODEBOOT_DB_PORT') ?: '3306',
		'name' => getenv('CODEBOOT_DB_NAME') ?: 'codeboot',
		'user' => getenv('CODEBOOT_DB_USER') ?: 'root',
		'pass' => getenv('CODEBOOT_DB_PASS') !== false ? getenv('CODEBOOT_DB_PASS') : '',
		'charset' => 'utf8mb4',
	],
	'codideep' => [
		'login_url' => 'https://codideep.com/api/usuario/loginrest',
		'timeout' => 15,
	],
];
