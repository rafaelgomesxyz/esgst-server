const fs = require('fs');
const path = require('path');

const CustomError = require('../class/CustomError');
const Pool = require('../class/Connection');
const Request = require('../class/Request');
const Utils = require('../class/Utils');
const Game = require('../routes/games/Game');

const jsonPath = path.resolve(__dirname, './rncv_sg.json');
const jobJson = require(jsonPath);

doRncvSgCronJob();

async function doRncvSgCronJob() {
	/** @type {import('mysql').PoolConnection} */
	let connection = null;
	try {
		connection = await Pool.getConnection();
		await updateRncvSg(connection);
		if (connection) {
			connection.release();
		}
	} catch (err) {
		if (connection) {
			connection.release();
		}
		console.log(`RCV/NCV games update from SG failed: ${err}`);
	}
	process.exit();
}

/**
 * @param {import('mysql').PoolConnection} connection
 */
async function updateRncvSg(connection) {
	const addedDate = Math.trunc(Date.now() / 1e3);
	let page = jobJson.page;
	let ended = false;
	if (page == 0) {
		console.log('Initializing...');
		await Pool.beginTransaction(connection);
		try {
			for (const type of Game.TYPES) {
				if (type === 'bundle') {
					continue;
				}
				await Pool.query(connection, `UPDATE games__${type}_rcv SET found = FALSE`);
				await Pool.query(connection, `UPDATE games__${type}_ncv SET found = FALSE`);
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
		console.log(`Updating RCV/NCV games from SG (page ${page}...)`);
		const names = {
			app: [],
			sub: [],
		};
		const rcv = {
			app: [],
			sub: [],
		};
		const ncv = {
			app: [],
			sub: [],
		};
		const url = `https://www.steamgifts.com/bundle-games/search?page=${page}&format=json`;
		const response = await Request.get(url);
		if (!response || !response.json || !response.json.success) {
			throw new CustomError(CustomError.COMMON_MESSAGES.sg, 500);
		}
		const results = response.json.results;
		for (const result of results) {
			const type = result.app_id ? 'app' : 'sub';
			const id = result.app_id || result.package_id;
			const name = result.name;
			const rcvTimestamp = result.reduced_value_timestamp;
			const ncvTimestamp = result.no_value_timestamp;
			if (name) {
				names[type].push({ id, name });
			}
			if (rcvTimestamp) {
				rcv[type].push({ id, effectiveDate: rcvTimestamp });
			}
			if (ncvTimestamp) {
				ncv[type].push({ id, effectiveDate: ncvTimestamp });
			}
		}
		await Pool.beginTransaction(connection);
		try {
			for (const type of Game.TYPES) {
				if (type === 'bundle') {
					continue;
				}
				if (names[type].length > 0) {
					await Pool.query(
						connection,
						`
						INSERT IGNORE INTO games__${type}_name (${type}_id, name)
						VALUES ${names[type]
							.map((name) => `(${connection.escape(name.id)}, ${connection.escape(name.name)})`)
							.join(', ')}
					`
					);
				}
				if (rcv[type].length > 0) {
					await Pool.query(
						connection,
						`
						INSERT INTO games__${type}_rcv (${type}_id, effective_date, added_date, found)
						VALUES ${rcv[type]
							.map(
								(rcv) =>
									`(${connection.escape(rcv.id)}, ${connection.escape(
										rcv.effectiveDate
									)}, ${connection.escape(addedDate)}, TRUE)`
							)
							.join(', ')}
						ON DUPLICATE KEY UPDATE effective_date = VALUES(effective_date), found = VALUES(found)
					`
					);
				}
				if (ncv[type].length > 0) {
					await Pool.query(
						connection,
						`
						INSERT INTO games__${type}_ncv (${type}_id, effective_date, added_date, found)
						VALUES ${ncv[type]
							.map(
								(ncv) =>
									`(${connection.escape(ncv.id)}, ${connection.escape(
										ncv.effectiveDate
									)}, ${connection.escape(addedDate)}, TRUE)`
							)
							.join(', ')}
						ON DUPLICATE KEY UPDATE effective_date = VALUES(effective_date), found = VALUES(found)
					`
					);
				}
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
	console.log('Finalizing...');
	await Pool.beginTransaction(connection);
	try {
		for (const type of Game.TYPES) {
			if (type === 'bundle') {
				continue;
			}
			await Pool.query(
				connection,
				`
				DELETE FROM games__${type}_rcv
				WHERE found = FALSE
			`
			);
			await Pool.query(
				connection,
				`
				DELETE FROM games__${type}_ncv
				WHERE found = FALSE
			`
			);
		}
		await Pool.query(
			connection,
			`
			INSERT INTO timestamps (name, date)
			VALUES
				('rcv_last_update_from_sg', ${connection.escape(Math.trunc(Date.now() / 1e3))}),
				('ncv_last_update', ${connection.escape(Math.trunc(Date.now() / 1e3))})
			ON DUPLICATE KEY UPDATE date = VALUES(date)
		`
		);
		await Pool.commit(connection);
	} catch (err) {
		await Pool.rollback(connection);
		throw err;
	}
	console.log('Done!');
	fs.writeFileSync(jsonPath, JSON.stringify({ page: 0 }));
}
