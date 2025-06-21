import { parse } from '@telegram-apps/init-data-node';

export function parseInitData(initDataRaw: string) {
	try {
		const initData = parse(initDataRaw);

		return initData;
	} catch (e: any) {
		throw new Error(`Failed to parse init data: ${e.message}`);
	}
}
