import { config } from '../config/env';
import { prisma } from '../prisma';
import { StorageService } from './storage.service';
import { generateImageInWorker } from '../workers/imageWorker';
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

	// Кэш для ресурсов
	private resourcesCache: {
		fonts: Map<string, string>;
		images: Map<string, string>;
		isInitialized: boolean;
	} = {
		fonts: new Map(),
		images: new Map(),
		isInitialized: false,
	};

	private constructor() {}

	public static getInstance(): ImageGenerationService {
		if (!ImageGenerationService.instance) {
			ImageGenerationService.instance = new ImageGenerationService();
		}
		return ImageGenerationService.instance;
	}

	/**
	 * Предварительно загружает все ресурсы в кэш
	 */
	public async initializeResources(): Promise<void> {
		if (this.resourcesCache.isInitialized) {
			return;
		}

		try {
			// Загружаем шрифты параллельно
			const fontPromises = [
				this.loadFontAsBase64('Montserrat-Regular.ttf'),
				this.loadFontAsBase64('Montserrat-Bold.ttf'),
			];

			// Загружаем изображения параллельно
			const imagePromises = [
				this.loadImageAsBase64('main_bg.jpg'),
				this.loadImageAsBase64('main_logo.png'),
			];

			// Ждем загрузки всех ресурсов
			await Promise.all([...fontPromises, ...imagePromises]);

			this.resourcesCache.isInitialized = true;
		} catch (error) {
			console.error('❌ Ошибка при инициализации ресурсов:', error);
			// Продолжаем работу даже с ошибками
			this.resourcesCache.isInitialized = true;
		}
	}

	/**
	 * Асинхронно загружает шрифт в формате base64 для встраивания в HTML
	 */
	private async loadFontAsBase64(fontFileName: string): Promise<string> {
		try {
			// Проверяем кэш
			if (this.resourcesCache.fonts.has(fontFileName)) {
				return this.resourcesCache.fonts.get(fontFileName)!;
			}

			// Путь к шрифтам относительно корня проекта
			const fontPath = path.join(
				process.cwd(),
				'assets',
				'fonts',
				fontFileName,
			);

			// Проверяем существование файла асинхронно
			try {
				await fs.promises.access(fontPath);
			} catch {
				console.warn(`Шрифт не найден: ${fontPath}`);
				this.resourcesCache.fonts.set(fontFileName, '');
				return '';
			}

			// Читаем и кодируем шрифт в base64 асинхронно
			const fontBuffer = await fs.promises.readFile(fontPath);
			const base64Font = fontBuffer.toString('base64');

			// Кэшируем результат
			this.resourcesCache.fonts.set(fontFileName, base64Font);
			return base64Font;
		} catch (error) {
			console.error('Ошибка при загрузке шрифта:', error);
			this.resourcesCache.fonts.set(fontFileName, '');
			return '';
		}
	}

	/**
	 * Асинхронно загружает изображение в формате base64 для встраивания в HTML
	 */
	private async loadImageAsBase64(imageFileName: string): Promise<string> {
		try {
			// Проверяем кэш
			if (this.resourcesCache.images.has(imageFileName)) {
				return this.resourcesCache.images.get(imageFileName)!;
			}

			// Путь к изображениям относительно корня проекта
			const imagePath = path.join(process.cwd(), 'assets', imageFileName);

			// Проверяем существование файла асинхронно
			try {
				await fs.promises.access(imagePath);
			} catch {
				console.warn(`Изображение не найдено: ${imagePath}`);
				this.resourcesCache.images.set(imageFileName, '');
				return '';
			}

			// Читаем и кодируем изображение в base64 асинхронно
			const imageBuffer = await fs.promises.readFile(imagePath);
			const extension = path.extname(imageFileName).toLowerCase();

			// Определяем MIME-тип
			let mimeType = 'image/jpeg';
			if (extension === '.png') mimeType = 'image/png';
			else if (extension === '.jpg' || extension === '.jpeg')
				mimeType = 'image/jpeg';
			else if (extension === '.gif') mimeType = 'image/gif';
			else if (extension === '.webp') mimeType = 'image/webp';

			const dataUri = `data:${mimeType};base64,${imageBuffer.toString(
				'base64',
			)}`;

			// Кэшируем результат
			this.resourcesCache.images.set(imageFileName, dataUri);
			return dataUri;
		} catch (error) {
			console.error('Ошибка при загрузке изображения:', error);
			this.resourcesCache.images.set(imageFileName, '');
			return '';
		}
	}

	/**
	 * Асинхронно генерирует CSS для встраивания шрифтов
	 */
	private async generateFontFaces(): Promise<string> {
		// Список шрифтов для загрузки
		const fonts = [
			{ file: 'Montserrat-Regular.ttf', weight: 400, style: 'normal' },
			{ file: 'Montserrat-Bold.ttf', weight: 700, style: 'normal' },
		];

		// Загружаем все шрифты параллельно
		const fontPromises = fonts.map(async (font) => {
			const base64Font = await this.loadFontAsBase64(font.file);

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
		});

		const fontCssArray = await Promise.all(fontPromises);
		return fontCssArray.filter((css) => css !== '').join('\n');
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

		// Получаем всех игроков одним запросом для оптимизации
		const allPlayerIds = Object.values(data.categorizedPlayerIds).flat();

		const players = await prisma.players.findMany({
			where: { id: { in: allPlayerIds } },
		});

		// Собираем все ключи изображений для батч-обработки
		const logoKeys = club.logo ? [club.logo] : [];
		const avatarKeys = players
			.map((player) => player.avatar)
			.filter(Boolean) as string[];

		// Получаем все URL за один раз
		const [logoUrls, avatarUrls] = await Promise.all([
			storageService.getBatchFastUrls(logoKeys, 'logo'),
			storageService.getBatchFastUrls(avatarKeys, 'avatar'),
		]);

		const clubLogoUrl = club.logo ? logoUrls[club.logo] || '' : '';

		// Создаем карту игроков для быстрого поиска
		const playersMap = new Map();

		for (const player of players) {
			const avatarUrl = player.avatar ? avatarUrls[player.avatar] || '' : '';

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

		// Убеждаемся, что ресурсы инициализированы
		await this.initializeResources();

		let fontFaces = '';
		try {
			fontFaces = await this.generateFontFaces();
		} catch (error) {
			console.error('Ошибка при загрузке шрифтов:', error);
			// Продолжаем работу без локальных шрифтов
		}

		// Загружаем локальные изображения в base64 (теперь из кэша)
		const backgroundImage = await this.loadImageAsBase64('main_bg.jpg');
		const mainLogo = await this.loadImageAsBase64('main_logo.png');

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
					? `background: url('${backgroundImage}') no-repeat center center;`
					: 'background: #1a1a1a;'
			}
			background-size: cover;
			max-width: 600px;
			height: 100vh;
			color: white;
			padding: 20px;

		}

		.container {
			width: 100%;
			height: 100%;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
		}

		.container-logo {
			display: flex;
			justify-content: center;
		}

		.main-logo {
			width: 140px;
			object-fit: cover;
		}

		.content {
			background: #ffffff;
			border-radius: 25px;
			padding: 10px;
			width: 100%;
		}

		.tier-list-header {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 12px;
		}

		.club-logo {
			width: 50px;
		}

		.club-name {
			font-size: 32px;
			font-weight: bold;
			color: #000;
		}

		.category-section {
			margin-top: 15px;
			border-radius: 15px;
			overflow: hidden;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

			padding: 5px 5px 5px 10px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			color: white;
			font-weight: bold;
		}

		.category-title {
			font-size: 28px;
		}

		.category-players {
			display: grid;
			grid-template-columns: repeat(6, minmax(0, 1fr));
			gap: 5px
		}

		.player-avatar {
			width: 50px;
			border-radius: 10px;
			object-fit: cover;
		}

		.empty-category {
			color: #999;
			font-style: italic;
			font-size: 16px;
		}

		.footer {
			height: 100px;
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
          
          		<div class="footer"></div>
        	</div>
      </body>
      </html>
    `;
	}

	/**
	 * Генерирует изображение на основе данных (неблокирующая версия с Worker)
	 */
	public async generateResultsImage(
		data: ShareImageData,
	): Promise<{ imageBuffer: Buffer; club: { name: string } }> {
		try {
			// Сначала получаем данные клуба
			const { club } = await this.getClubAndPlayersData(data);

			// Генерируем HTML
			const html = await this.generateHTML(data);

			// Генерируем изображение в отдельном Worker потоке (оптимизированный размер)
			const imageBuffer = await generateImageInWorker(html, 600, 800);

			return {
				imageBuffer,
				club: { name: club.name },
			};
		} catch (error) {
			console.error('Ошибка при генерации изображения:', error);
			throw error;
		}
	}

	/**
	 * Очищает кэш ресурсов при завершении работы
	 */
	public async cleanup() {
		this.resourcesCache.fonts.clear();
		this.resourcesCache.images.clear();
		this.resourcesCache.isInitialized = false;
	}
}

export const imageGenerationService = ImageGenerationService.getInstance();
