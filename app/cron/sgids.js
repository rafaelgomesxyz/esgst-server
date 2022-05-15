const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const CustomError = require('../class/CustomError');
const Pool = require('../class/Connection');
const Request = require('../class/Request');
const Utils = require('../class/Utils');
const Game = require('../routes/games/Game');

const logPath = path.resolve(__dirname, './sgids.log');
const jsonPath = path.resolve(__dirname, './sgids.json');
if (!fs.existsSync(logPath)) {
	fs.writeFileSync(logPath, '');
}
if (!fs.existsSync(jsonPath)) {
	fs.writeFileSync(jsonPath, JSON.stringify({ page: 0 }));
}
const jobLog = fs.readFileSync(logPath, 'utf8').split('\n');
const jobJson = require(jsonPath);

doSgidsJob();

async function doSgidsJob() {
	Utils.log(jobLog, new Date().toUTCString());
	/** @type {import('mysql').PoolConnection} */
	let connection = null;
	try {
		connection = await Pool.getConnection();
		await updateSgids(connection);
		if (connection) {
			connection.release();
		}
	} catch (err) {
		if (connection) {
			connection.release();
		}
		Utils.log(jobLog, `SG IDs update failed: ${err}`);
	}
	fs.writeFileSync(logPath, jobLog.join('\n'));
	process.exit();
}

/**
 * @param {import('mysql').PoolConnection} connection
 */
async function updateSgids(connection) {
	let page = jobJson.page;
	let ended = false;

	if (page == 0) {
		Utils.log(jobLog, 'Initializing...');

		const games = {
			app: {},
			sub: {},
		};
		const dbResponse = await Request.get('https://revadike.com/sgdb.json');
		games.app = dbResponse.json.appids;
		games.sub = dbResponse.json.subids;

		await Pool.beginTransaction(connection);
		try {
			for (const type of Game.TYPES) {
				if (type === 'bundle') {
					continue;
				}
				if (Object.keys(games[type]).length === 0) {
					continue;
				}

				await Pool.query(
					connection,
					`
            INSERT IGNORE INTO games__${type}_sg (${type}_id, sg_id)
            VALUES ${Object.entries(games[type])
							.map(
								([steamId, id]) =>
									`(${connection.escape(parseInt(steamId))}, ${connection.escape(id)})`
							)
							.join(', ')}
          `
				);
			}
			await Pool.commit(connection);
		} catch (err) {
			await Pool.rollback(connection);
			throw err;
		}
	}

	do {
		await Utils.timeout(1);

		page += 1;

		Utils.log(jobLog, `Updating SG IDs (page ${page}...)`);

		const games = {
			app: {},
			sub: {},
		};
		const url = `https://www.steamgifts.com/giveaways/search?page=${page}&format=json`;
		const response = await Request.get(url);

		if (!response || !response.json || !response.json.success) {
			throw new CustomError(CustomError.COMMON_MESSAGES.sg, 500);
		}

		const results = response.json.results;
		for (const result of results) {
			const type = result.app_id ? 'app' : 'sub';
			const id = result.app_id || result.package_id;
			games[type][id] = result.id;
		}

		await Pool.beginTransaction(connection);
		try {
			for (const type of Game.TYPES) {
				if (type === 'bundle') {
					continue;
				}
				if (Object.keys(games[type]).length === 0) {
					continue;
				}

				await Pool.query(
					connection,
					`
            INSERT IGNORE INTO games__${type}_sg (${type}_id, sg_id)
            VALUES ${Object.entries(games[type])
							.map(
								([steamId, id]) =>
									`(${connection.escape(parseInt(steamId))}, ${connection.escape(id)})`
							)
							.join(', ')}
          `
				);
			}
			await Pool.commit(connection);
		} catch (err) {
			await Pool.rollback(connection);
			throw err;
		}

		fs.writeFileSync(jsonPath, JSON.stringify({ page }));

		const perPage = response.json.per_page;
		ended = perPage !== results.length;
	} while (!ended);

	Utils.log(jobLog, 'Finalizing...');

	await Pool.beginTransaction(connection);
	try {
		await Pool.query(
			connection,
			`
        INSERT INTO timestamps (name, date)
        VALUES ('sgids_last_update', ${connection.escape(Math.trunc(Date.now() / 1e3))})
        ON DUPLICATE KEY UPDATE date = VALUES(date)
      `
		);
		await Pool.commit(connection);
	} catch (err) {
		await Pool.rollback(connection);
		throw err;
	}

	Utils.log(jobLog, 'Done!');

	fs.writeFileSync(jsonPath, JSON.stringify({ page: 0 }));
}
