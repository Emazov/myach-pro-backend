import { prisma } from '../prisma';
import { config } from '../config/env';

export class AdminService {
	/**
	 * Проверяет, является ли пользователь админом
	 */
	static async isAdmin(telegramId: string): Promise<boolean> {
		try {
			// Проверяем в таблице AdminUser
			const adminUser = await prisma.adminUser.findUnique({
				where: { telegramId },
			});

			if (adminUser) {
				return true;
			}

			// Fallback: проверяем переменную окружения (для совместимости)
			return telegramId === config.telegram.adminId;
		} catch (error) {
			console.error('Ошибка при проверке админа:', error);
			// Fallback на переменную окружения при ошибке БД
			return telegramId === config.telegram.adminId;
		}
	}

	/**
	 * Добавляет нового админа
	 */
	static async addAdmin(
		telegramId: string,
		username: string | null,
		addedBy: string,
	): Promise<{ success: boolean; message: string }> {
		try {
			// Проверяем, что добавляющий является админом
			const isAdminUser = await this.isAdmin(addedBy);
			if (!isAdminUser) {
				return { success: false, message: 'Недостаточно прав' };
			}

			// Проверяем, не является ли пользователь уже админом
			const existingAdmin = await prisma.adminUser.findUnique({
				where: { telegramId },
			});

			if (existingAdmin) {
				return { success: false, message: 'Пользователь уже является админом' };
			}

			// Добавляем нового админа
			await prisma.adminUser.create({
				data: {
					telegramId,
					username,
					addedBy,
				},
			});

			// Обновляем роль пользователя в основной таблице
			await prisma.user.updateMany({
				where: { telegramId },
				data: { role: 'admin' },
			});

			return { success: true, message: 'Админ успешно добавлен' };
		} catch (error) {
			console.error('Ошибка при добавлении админа:', error);
			return { success: false, message: 'Ошибка сервера' };
		}
	}

	/**
	 * Удаляет админа
	 */
	static async removeAdmin(
		telegramId: string,
		removedBy: string,
	): Promise<{ success: boolean; message: string }> {
		try {
			// Проверяем, что удаляющий является админом
			const isAdminUser = await this.isAdmin(removedBy);
			if (!isAdminUser) {
				return { success: false, message: 'Недостаточно прав' };
			}

			// Нельзя удалить самого себя
			if (telegramId === removedBy) {
				return { success: false, message: 'Нельзя удалить самого себя' };
			}

			// Нельзя удалить главного админа (из переменной окружения)
			if (telegramId === config.telegram.adminId) {
				return { success: false, message: 'Нельзя удалить главного админа' };
			}

			// Удаляем из таблицы админов
			const deletedAdmin = await prisma.adminUser.delete({
				where: { telegramId },
			});

			// Обновляем роль пользователя в основной таблице
			await prisma.user.updateMany({
				where: { telegramId },
				data: { role: 'user' },
			});

			return { success: true, message: 'Админ успешно удален' };
		} catch (error) {
			console.error('Ошибка при удалении админа:', error);
			return { success: false, message: 'Админ не найден или ошибка сервера' };
		}
	}

	/**
	 * Ищет пользователей по username
	 */
	static async searchUsersByUsername(
		searchQuery: string,
		requestedBy: string,
	): Promise<{ success: boolean; users?: any[]; message: string }> {
		try {
			// Проверяем, что запрашивающий является админом
			const isAdminUser = await this.isAdmin(requestedBy);
			if (!isAdminUser) {
				return { success: false, message: 'Недостаточно прав' };
			}

			// Ищем пользователей по username (частичное совпадение)
			const users = await prisma.user.findMany({
				where: {
					username: {
						contains: searchQuery,
						mode: 'insensitive',
					},
				},
				select: {
					telegramId: true,
					username: true,
					role: true,
				},
				take: 10, // Ограничиваем количество результатов
			});

			return { success: true, users, message: 'Поиск выполнен успешно' };
		} catch (error) {
			console.error('Ошибка при поиске пользователей:', error);
			return { success: false, message: 'Ошибка сервера' };
		}
	}

	/**
	 * Добавляет нового админа по username
	 */
	static async addAdminByUsername(
		username: string,
		addedBy: string,
	): Promise<{ success: boolean; message: string }> {
		try {
			// Проверяем, что добавляющий является админом
			const isAdminUser = await this.isAdmin(addedBy);
			if (!isAdminUser) {
				return { success: false, message: 'Недостаточно прав' };
			}

			// Ищем пользователя по username
			const user = await prisma.user.findFirst({
				where: {
					username: {
						equals: username,
						mode: 'insensitive',
					},
				},
			});

			if (!user) {
				return { success: false, message: 'Пользователь не найден' };
			}

			// Используем существующий метод добавления админа
			return await this.addAdmin(user.telegramId, user.username, addedBy);
		} catch (error) {
			console.error('Ошибка при добавлении админа по username:', error);
			return { success: false, message: 'Ошибка сервера' };
		}
	}

	/**
	 * Получает список всех админов
	 */
	static async getAdmins(): Promise<any[]> {
		try {
			const admins = await prisma.adminUser.findMany({
				select: {
					id: true,
					telegramId: true,
					username: true,
					addedBy: true,
					createdAt: true,
				},
				orderBy: { createdAt: 'asc' },
			});

			// Добавляем главного админа из переменной окружения, если его нет в списке
			const mainAdminExists = admins.some(
				(admin) => admin.telegramId === config.telegram.adminId,
			);

			if (!mainAdminExists) {
				admins.unshift({
					id: 'main-admin',
					telegramId: config.telegram.adminId,
					username: 'Главный админ',
					addedBy: null,
					createdAt: new Date('2024-01-01'),
				});
			}

			return admins;
		} catch (error) {
			console.error('Ошибка при получении списка админов:', error);
			return [];
		}
	}
}
