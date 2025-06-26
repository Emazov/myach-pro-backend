import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { config } from '../config/env';
import { prisma } from '../prisma';
import { StorageService } from './storage.service';
import fs from 'fs';
import path from 'path';

// Обновленная структура данных для генерации изображения
export interface ShareImageData {
	categorizedPlayerIds: { [categoryName: string]: string[] };
	categories: Array<{ name: string; color: string; slots: number }>;
	clubId: string;
}

/**
 * Создает SVG плейсхолдер для аватара игрока
 */
function createPlayerAvatarPlaceholder(playerName: string): string {
	const colors = [
		'#FF6B6B',
		'#4ECDC4',
		'#45B7D1',
		'#96CEB4',
		'#FCEA2B',
		'#FF9FF3',
		'#54A0FF',
		'#5F27CD',
		'#00D2D3',
		'#FF9F43',
		'#6C5CE7',
		'#A29BFE',
		'#FD79A8',
		'#74B9FF',
		'#00B894',
	];

	// Генерируем цвет на основе имени игрока
	let hash = 0;
	for (let i = 0; i < playerName.length; i++) {
		hash = playerName.charCodeAt(i) + ((hash << 5) - hash);
	}
	const color = colors[Math.abs(hash) % colors.length];

	const initial = playerName.charAt(0).toUpperCase();

	return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='${encodeURIComponent(
		color,
	)}'/%3E%3Ctext x='50%25' y='50%25' font-size='14' text-anchor='middle' dy='.3em' fill='white' font-family='Arial, sans-serif' font-weight='bold'%3E${initial}%3C/text%3E%3C/svg%3E`;
}

/**
 * Сервис для генерации изображений результатов игры
 */
export class ImageGenerationService {
	private static instance: ImageGenerationService;
	private browser: any = null;

	private constructor() {}

	public static getInstance(): ImageGenerationService {
		if (!ImageGenerationService.instance) {
			ImageGenerationService.instance = new ImageGenerationService();
		}
		return ImageGenerationService.instance;
	}

	/**
	 * Загружает шрифт в формате base64 для встраивания в HTML
	 */
	private loadFontAsBase64(fontFileName: string): string {
		try {
			// Путь к шрифтам относительно корня проекта
			const fontPath = path.join(
				process.cwd(),
				'assets',
				'fonts',
				fontFileName,
			);

			// Проверяем существование файла
			if (!fs.existsSync(fontPath)) {
				console.warn(`Шрифт не найден: ${fontPath}`);
				return '';
			}

			// Читаем и кодируем шрифт в base64
			const fontBuffer = fs.readFileSync(fontPath);
			return fontBuffer.toString('base64');
		} catch (error) {
			console.error('Ошибка при загрузке шрифта:', error);
			return '';
		}
	}

	/**
	 * Загружает изображение в формате base64 для встраивания в HTML
	 */
	private loadImageAsBase64(imageFileName: string): string {
		try {
			// Путь к изображениям относительно корня проекта
			const imagePath = path.join(process.cwd(), 'assets', imageFileName);

			// Проверяем существование файла
			if (!fs.existsSync(imagePath)) {
				console.warn(`Изображение не найдено: ${imagePath}`);
				return '';
			}

			// Читаем и кодируем изображение в base64
			const imageBuffer = fs.readFileSync(imagePath);
			const extension = path.extname(imageFileName).toLowerCase();

			// Определяем MIME-тип
			let mimeType = 'image/jpeg';
			if (extension === '.png') mimeType = 'image/png';
			else if (extension === '.jpg' || extension === '.jpeg')
				mimeType = 'image/jpeg';
			else if (extension === '.gif') mimeType = 'image/gif';
			else if (extension === '.webp') mimeType = 'image/webp';

			return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
		} catch (error) {
			console.error('Ошибка при загрузке изображения:', error);
			return '';
		}
	}

	/**
	 * Генерирует CSS для встраивания шрифтов
	 */
	private generateFontFaces(): string {
		// Список шрифтов для загрузки
		const fonts = [
			{ file: 'Montserrat-Regular.ttf', weight: 400, style: 'normal' },
			{ file: 'Montserrat-Bold.ttf', weight: 700, style: 'normal' },
		];

		// Генерируем CSS для каждого шрифта
		return fonts
			.map((font) => {
				const base64Font = this.loadFontAsBase64(font.file);

				if (!base64Font) return '';

				return `
      @font-face {
        font-family: 'Montserrat';
        src: url(data:font/truetype;charset=utf-8;base64,${base64Font}) format('truetype');
        font-weight: ${font.weight};
        font-style: ${font.style};
        font-display: swap;
      }
    `;
			})
			.join('\n');
	}

	/**
	 * Инициализирует браузер Puppeteer
	 */
	private async initBrowser() {
		if (!this.browser) {
			// Определяем, используем ли мы serverless окружение
			const isProduction = process.env.NODE_ENV === 'production';

			if (isProduction) {
				// Для production (Railway/serverless) используем chromium
				this.browser = await puppeteer.launch({
					args: [
						...chromium.args,
						'--no-sandbox',
						'--disable-setuid-sandbox',
						'--disable-dev-shm-usage',
						'--disable-accelerated-2d-canvas',
						'--no-first-run',
						'--no-zygote',
						'--single-process',
						'--disable-gpu',
					],
					defaultViewport: chromium.defaultViewport,
					executablePath: await chromium.executablePath(),
					headless: chromium.headless,
				});
			} else {
				// Для локальной разработки пытаемся использовать обычный puppeteer
				try {
					// Сначала пробуем с chromium (если установлен)
					this.browser = await puppeteer.launch({
						args: [...chromium.args],
						defaultViewport: chromium.defaultViewport,
						executablePath: await chromium.executablePath(),
						headless: chromium.headless,
					});
				} catch (error) {
					console.log('Chromium не найден, используем системный Chrome');
					// Fallback на системный браузер
					this.browser = await puppeteer.launch({
						headless: true,
						args: [
							'--no-sandbox',
							'--disable-setuid-sandbox',
							'--disable-dev-shm-usage',
							'--disable-accelerated-2d-canvas',
							'--no-first-run',
							'--no-zygote',
							'--single-process',
							'--disable-gpu',
						],
					});
				}
			}
		}
		return this.browser;
	}

	/**
	 * Получает данные клуба и игроков из базы данных
	 */
	private async getClubAndPlayersData(data: ShareImageData) {
		const storageService = new StorageService();

		// Получаем клуб с подписанным URL логотипа
		const club = await prisma.club.findUnique({
			where: { id: data.clubId },
		});

		if (!club) {
			throw new Error('Клуб не найден');
		}

		const clubLogoUrl = club.logo
			? await storageService.getSignedUrl(club.logo)
			: '';

		// Получаем всех игроков одним запросом для оптимизации
		const allPlayerIds = Object.values(data.categorizedPlayerIds).flat();

		const players = await prisma.players.findMany({
			where: { id: { in: allPlayerIds } },
		});

		// Создаем карту игроков для быстрого поиска
		const playersMap = new Map();

		for (const player of players) {
			const avatarUrl = player.avatar
				? await storageService.getSignedUrl(player.avatar)
				: '';

			playersMap.set(player.id, {
				id: player.id,
				name: player.name,
				avatarUrl,
			});
		}

		return { club, clubLogoUrl, playersMap };
	}

	/**
	 * Генерирует HTML для рендера изображения
	 */
	private async generateHTML(data: ShareImageData): Promise<string> {
		const { club, clubLogoUrl, playersMap } = await this.getClubAndPlayersData(
			data,
		);

		let fontFaces = '';
		try {
			fontFaces = this.generateFontFaces();
		} catch (error) {
			console.error('Ошибка при загрузке шрифтов:', error);
			// Продолжаем работу без локальных шрифтов
		}

		// Загружаем локальные изображения в base64
		const backgroundImage = this.loadImageAsBase64('main_bg.jpg');
		const mainLogo = this.loadImageAsBase64('main_logo.png');

		const playersHTML = data.categories
			.map((category) => {
				const playerIds = data.categorizedPlayerIds[category.name] || [];

				const playersListHTML =
					playerIds.length > 0
						? playerIds
								.map((playerId, index) => {
									const player = playersMap.get(playerId);

									if (!player) {
										console.warn(`Игрок с ID ${playerId} не найден`);
										return '';
									}

									const playerAvatar =
										player.avatarUrl ||
										createPlayerAvatarPlaceholder(player.name);

									return `
              <img src="${playerAvatar}" alt="${
										player.name
									}" class="player-avatar" onerror="this.src='${createPlayerAvatarPlaceholder(
										player.name,
									)}'" />
          `;
								})
								.filter((html) => html !== '') // Убираем пустые строки
								.join('')
						: '<div class="empty-category">— Пусто</div>';

				return `
        <div class="category-section" style="background-color: ${
					category.color
				}">
        	<span class="category-title">${category.name.toUpperCase()}</span>
        
          	<div class="category-players">
            	${playersListHTML}
          	</div>
        </div>
      `;
			})
			.join('');

		return `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Результаты игры</title>
        <style>
		${fontFaces}
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: 'Montserrat', sans-serif;
			${
				backgroundImage
					? `background: url('${backgroundImage}') no-repeat center center fixed;`
					: 'background: #1a1a1a;'
			}
			max-width: 800px;
			color: white;
			padding: 0 30px 30px;

		}

		.container {
			width: 100%;
			height: 100%;
		}

		.container-logo {
			display: flex;
			justify-content: center;
		}

		.main-logo {
			width: 164px;
			object-fit: cover;
		}

		.content {
			background: #ffffff;
			border-radius: 16px;
			padding: 20px;
		}

		.tier-list-header {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 12px;
			margin-bottom: 20px;
		}

		.club-logo {
			width: 60px;
		}

		.club-name {
			font-size: 40px;
			font-weight: bold;
			color: #000;
		}

		.category-section {
			margin-bottom: 20px;
			border-radius: 15px;
			overflow: hidden;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

			padding: 5px 5px 5px 20px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			color: white;
			font-weight: bold;
		}

		.category-title {
			font-size: 34px;
		}

		.category-players {
			display: grid;
			grid-template-columns: repeat(6, minmax(0, 1fr));
			gap: 5px
		}

		.player-avatar {
			width: 70px;
			border-radius: 10px;
			object-fit: cover;
		}

		.empty-category {
			color: #999;
			font-style: italic;
			font-size: 16px;
		}

		.footer {
			text-align: center;
			margin-top: 30px;
			font-size: 20px;
			font-weight: regular;
			color: white;
			text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
		}
	</style>
    </head>
    	<body>
        	<div class="container">       
				<div class='container-logo'>
					${mainLogo ? `<img class='main-logo' src="${mainLogo}" alt="main_logo">` : ''}
				</div>
          	
				<div class="content">
            		<div class="tier-list-header">
                        ${
													clubLogoUrl
														? `<img src="${clubLogoUrl}" alt="Логотип" class="club-logo" />`
														: ''
												}
                <span class="club-name">${club.name}</span>
            </div>
            
            <div class="categories">
              ${playersHTML}
            </div>
          </div>
          
          <div class="footer">
            @${config.telegram.botUsername}
          </div>
        </div>
      </body>
      </html>
    `;
	}

	/**
	 * Генерирует изображение на основе данных (асинхронная версия)
	 */
	public async generateResultsImage(
		data: ShareImageData,
	): Promise<{ imageBuffer: Buffer; club: { name: string } }> {
		// Выносим генерацию изображения в отдельный процесс для избежания блокировки
		return new Promise(async (resolve, reject) => {
			try {
				// Сначала получаем данные клуба
				const { club } = await this.getClubAndPlayersData(data);

				const browser = await this.initBrowser();
				const page = await browser.newPage();

				try {
					// Устанавливаем размер страницы
					await page.setViewport({ width: 800, height: 1000 });

					// Загружаем HTML (теперь асинхронно)
					const html = await this.generateHTML(data);
					await page.setContent(html, { waitUntil: 'networkidle0' });

					// Генерируем скриншот
					const screenshot = await page.screenshot({
						type: 'jpeg',
						fullPage: true,
						quality: 95,
					});

					resolve({
						imageBuffer: screenshot as Buffer,
						club: { name: club.name },
					});
				} finally {
					await page.close();
				}
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Закрывает браузер при завершении работы
	 */
	public async cleanup() {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
	}
}

export const imageGenerationService = ImageGenerationService.getInstance();
