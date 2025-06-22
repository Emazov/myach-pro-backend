/**
 * Рекурсивно преобразует BigInt значения в Number в объекте
 */
export function convertBigIntToNumber(obj: any): any {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (typeof obj === 'bigint') {
		return Number(obj);
	}

	if (Array.isArray(obj)) {
		return obj.map(convertBigIntToNumber);
	}

	if (typeof obj === 'object') {
		const converted: any = {};
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				converted[key] = convertBigIntToNumber(obj[key]);
			}
		}
		return converted;
	}

	return obj;
}
