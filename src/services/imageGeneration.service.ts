import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { config } from '../config/env';

export interface ShareImageData {
	categorizedPlayers: { [key: string]: any[] };
	categories: Array<{ name: string; color: string; slots: number }>;
	clubName: string;
	clubLogoUrl?: string;
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
	 * Генерирует HTML для рендера изображения
	 */
	private generateHTML(data: ShareImageData): string {
		const playersHTML = data.categories
			.map((category) => {
				const players = data.categorizedPlayers[category.name] || [];

				const playersListHTML =
					players.length > 0
						? players
								.map(
									(player, index) => `
            <div class="player-item">
              <span class="player-number">${index + 1}</span>
              <span class="player-name">${player.name}</span>
            </div>
          `,
								)
								.join('')
						: '<div class="empty-category">— Пусто</div>';

				return `
        <div class="category-section">
          <div class="category-header" style="background-color: ${
						category.color
					}">
            <span class="category-title">${category.name.toUpperCase()}</span>
            <span class="category-count">(${players.length}/${
					category.slots
				})</span>
          </div>
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
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(180deg, #EC3381 0%, #FF6B9D 100%);
            width: 800px;
            min-height: 1000px;
            color: white;
            padding: 40px;
          }
          
          .container {
            width: 100%;
            height: 100%;
          }
          
          .header {
            text-align: center;
            margin-bottom: 60px;
          }
          
          .logo {
            width: 64px;
            height: 64px;
            margin: 0 auto 20px;
            display: block;
          }
          
          .main-title {
            font-size: 48px;
            font-weight: bold;
            color: white;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          }
          
          .content {
            background: #ffffff;
            border-radius: 16px;
            padding: 40px;
            color: #333;
          }
          
          .tier-list-header {
            text-align: center;
            margin-bottom: 40px;
          }
          
          .tier-list-title {
            font-size: 28px;
            font-weight: bold;
            color: #333;
            margin-bottom: 16px;
          }
          
          .club-info {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
          }
          
          .club-logo {
            width: 32px;
            height: 32px;
            border-radius: 4px;
          }
          
          .club-name {
            font-size: 24px;
            font-weight: 600;
            color: #333;
          }
          
          .category-section {
            margin-bottom: 24px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          .category-header {
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: white;
            font-weight: bold;
          }
          
          .category-title {
            font-size: 20px;
          }
          
          .category-count {
            font-size: 16px;
            opacity: 0.9;
          }
          
          .category-players {
            background: #f8f9fa;
            padding: 16px 20px;
            min-height: 60px;
          }
          
          .player-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 18px;
          }
          
          .player-number {
            font-weight: 600;
            color: #666;
            min-width: 24px;
          }
          
          .player-name {
            color: #333;
          }
          
          .empty-category {
            color: #999;
            font-style: italic;
            font-size: 16px;
          }
          
          .footer {
            text-align: center;
            margin-top: 40px;
            font-size: 20px;
            color: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
          }
        </style>
      </head>
      <body>
        <div class="container">       
          <div class="content">
            <div class="tier-list-header">
              <h2 class="tier-list-title">ТИР-ЛИСТ</h2>
              <div class="club-info">
                ${
									data.clubLogoUrl
										? `<img src="${data.clubLogoUrl}" alt="Логотип" class="club-logo" />`
										: ''
								}
                <span class="club-name">${data.clubName}</span>
              </div>
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
	 * Генерирует изображение на основе данных
	 */
	public async generateResultsImage(data: ShareImageData): Promise<Buffer> {
		const browser = await this.initBrowser();
		const page = await browser.newPage();

		try {
			// Устанавливаем размер страницы
			await page.setViewport({ width: 800, height: 1000 });

			// Загружаем HTML
			const html = this.generateHTML(data);
			await page.setContent(html, { waitUntil: 'networkidle0' });

			// Генерируем скриншот
			const screenshot = await page.screenshot({
				type: 'jpeg',
				fullPage: true,
				quality: 95,
			});

			return screenshot as Buffer;
		} finally {
			await page.close();
		}
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
