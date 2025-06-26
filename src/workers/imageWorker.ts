import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/**
 * Worker для генерации изображений без блокировки основного потока
 */

if (!isMainThread && parentPort) {
	// Код воркера
	parentPort.on(
		'message',
		async (data: {
			html: string;
			viewportWidth: number;
			viewportHeight: number;
		}) => {
			try {
				const { html, viewportWidth, viewportHeight } = data;

				// Определяем, используем ли мы serverless окружение
				const isProduction = process.env.NODE_ENV === 'production';

				let browser;
				if (isProduction) {
					// Для production (Railway/serverless) используем chromium
					browser = await puppeteer.launch({
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
					// Для локальной разработки
					try {
						browser = await puppeteer.launch({
							args: [...chromium.args],
							defaultViewport: chromium.defaultViewport,
							executablePath: await chromium.executablePath(),
							headless: chromium.headless,
						});
					} catch (error) {
						// Fallback на системный браузер
						browser = await puppeteer.launch({
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

				const page = await browser.newPage();

				try {
					// Устанавливаем размер страницы
					await page.setViewport({
						width: viewportWidth,
						height: viewportHeight,
					});

					// Загружаем HTML
					await page.setContent(html, { waitUntil: 'networkidle0' });

					// Генерируем скриншот
					const screenshot = await page.screenshot({
						type: 'jpeg',
						fullPage: true,
						quality: 95,
					});

					parentPort!.postMessage({
						success: true,
						imageBuffer: screenshot,
					});
				} finally {
					await page.close();
					await browser.close();
				}
			} catch (error) {
				parentPort!.postMessage({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		},
	);
}

/**
 * Создает Worker для генерации изображения
 */
export async function generateImageInWorker(
	html: string,
	viewportWidth: number = 800,
	viewportHeight: number = 1000,
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(__filename);

		worker.postMessage({ html, viewportWidth, viewportHeight });

		worker.on(
			'message',
			(result: { success: boolean; imageBuffer?: Buffer; error?: string }) => {
				worker.terminate();

				if (result.success && result.imageBuffer) {
					resolve(result.imageBuffer);
				} else {
					reject(new Error(result.error || 'Worker failed'));
				}
			},
		);

		worker.on('error', (error) => {
			worker.terminate();
			reject(error);
		});

		worker.on('exit', (code) => {
			if (code !== 0) {
				reject(new Error(`Worker stopped with exit code ${code}`));
			}
		});
	});
}
