// Скрипт для проверки переменных окружения Redis в Railway
require('dotenv').config();

console.log('Проверка переменных окружения для Redis в Railway:');
console.log('Версия Node.js:', process.version);
console.log('Текущая директория:', process.cwd());
console.log('Переменные окружения загружены:', Object.keys(process.env).length);

// Проверяем все возможные переменные окружения
const redisVars = [
	'REDIS_URL',
	'REDISHOST',
	'REDISPORT',
	'REDISPASSWORD',
	'REDISUSER',
	'REDIS_AOF_ENABLED',
	'REDIS_PASSWORD',
	'REDIS_PUBLIC_URL',
	'REDIS_RDB_POLICY',
];

// Выводим значения всех переменных
console.log('\nПроверка переменных Redis:');
redisVars.forEach((varName) => {
	const value = process.env[varName];
	if (value) {
		if (varName.includes('PASSWORD')) {
			console.log(`${varName}: ****** (задан)`);
		} else {
			console.log(`${varName}: ${value}`);
		}
	} else {
		console.log(`${varName}: не задан`);
	}
});

// Определяем URL для подключения к Redis
function getRedisUrl() {
	// Проверяем наличие основного URL
	if (process.env.REDIS_URL) {
		return process.env.REDIS_URL;
	}

	// Проверяем наличие Railway специфичных переменных
	if (process.env.REDISHOST && process.env.REDISPORT) {
		const password = process.env.REDISPASSWORD
			? `:${process.env.REDISPASSWORD}@`
			: '';
		const user = process.env.REDISUSER ? `${process.env.REDISUSER}:` : '';
		return `redis://${user}${password}${process.env.REDISHOST}:${process.env.REDISPORT}`;
	}

	// Если нет ни одной переменной для Redis, возвращаем локальный URL
	return 'redis://localhost:6379';
}

console.log('\nИтоговый URL для подключения к Redis:', getRedisUrl());
console.log(
	'\nЭтот скрипт нужно запустить в Railway для проверки переменных окружения.',
);
