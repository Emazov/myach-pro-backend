module.exports = {
	apps: [
		{
			name: 'myach-pro-server',
			script: './dist/index.js',
			cwd: '/projects/myach-pro/server',
			instances: 1, // Только один процесс
			exec_mode: 'fork', // Обычный режим
			env: {
				NODE_ENV: 'production',
				PORT: 3000,
			},
			// Автоматический перезапуск при изменениях
			watch: false,

			// Настройки логирования
			log_file: '/projects/myach-pro/logs/combined.log',
			out_file: '/projects/myach-pro/logs/out.log',
			error_file: '/projects/myach-pro/logs/error.log',
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

			// Настройки памяти
			max_memory_restart: '1G',

			// Настройки перезапуска
			restart_delay: 4000,
			max_restarts: 10,
			min_uptime: '10s',

			// Автоматический перезапуск при превышении использования памяти
			kill_timeout: 5000,

			// Мониторинг
			monitoring: true,

			// Переменные окружения для продакшена
			env_production: {
				NODE_ENV: 'production',
				PORT: 3000,
			},
		},
	],

	// Настройки деплоя (опционально для автодеплоя)
	deploy: {
		production: {
			user: 'myach',
			host: 'server.myach-specialprojects.ru',
			ref: 'origin/main',
			repo: 'https://github.com/Emazov/myach-pro-backend.git',
			path: '/projects/myach-pro',
			'post-deploy':
				'cd server && pnpm install && npx prisma migrate deploy && npx prisma generate && pnpm run build && pnpm install --production --ignore-scripts && pm2 reload pm2.config.js --env production && pm2 save',
		},
	},
};
