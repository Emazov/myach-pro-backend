require('dotenv').config();

// Функция для получения URL Redis
function getRedisUrl() {
	// Проверяем наличие основного URL
	if (process.env.REDIS_URL) {
		console.log('Найден REDIS_URL:', process.env.REDIS_URL);
		return process.env.REDIS_URL;
	}

	// Проверяем наличие Railway специфичных переменных
	if (process.env.REDISHOST && process.env.REDISPORT) {
		const password = process.env.REDISPASSWORD
			? `:${process.env.REDISPASSWORD}@`
			: '';
		const user = process.env.REDISUSER ? `${process.env.REDISUSER}:` : '';
		const url = `redis://${user}${password}${process.env.REDISHOST}:${process.env.REDISPORT}`;
		console.log('Сформирован URL из Railway переменных:', url);
		console.log('REDISHOST:', process.env.REDISHOST);
		console.log('REDISPORT:', process.env.REDISPORT);
		console.log(
			'REDISPASSWORD:',
			process.env.REDISPASSWORD ? '***' : 'не задан',
		);
		console.log('REDISUSER:', process.env.REDISUSER || 'не задан');
		return url;
	}

	// Если нет ни одной переменной для Redis, возвращаем локальный URL
	console.log(
		'Не найдены переменные окружения для Redis, используем локальный URL',
	);
	return 'redis://localhost:6379';
}

// Получаем URL для Redis
const redisUrl = getRedisUrl();
console.log('Итоговый URL для подключения к Redis:', redisUrl);

// Пробуем подключиться к Redis
try {
	const Redis = require('ioredis');
	console.log('Пробуем подключиться к Redis...');

	const redis = new Redis(redisUrl);

	redis.on('error', (err) => {
		console.error('Ошибка подключения к Redis:', err.message);
		process.exit(1);
	});

	redis.on('connect', async () => {
		console.log('Успешное подключение к Redis!');

		// Тестируем основные операции
		try {
			console.log('Тестируем операции с Redis...');

			// Установка значения
			await redis.set('test-key', 'test-value');
			console.log('SET: успешно');

			// Получение значения
			const value = await redis.get('test-key');
			console.log('GET:', value);

			// Удаление значения
			await redis.del('test-key');
			console.log('DEL: успешно');

			console.log('Тест успешно завершен!');
		} catch (err) {
			console.error('Ошибка при тестировании операций:', err.message);
		} finally {
			// Закрываем соединение
			redis.quit();
			process.exit(0);
		}
	});
} catch (err) {
	console.error('Ошибка при инициализации Redis:', err.message);
	process.exit(1);
}
