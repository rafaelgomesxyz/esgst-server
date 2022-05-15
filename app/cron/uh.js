const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Pool = require('../class/Connection');
const Request = require('../class/Request');
const Utils = require('../class/Utils');

const logPath = path.resolve(__dirname, './uh.log');
if (!fs.existsSync(logPath)) {
	fs.writeFileSync(logPath, '');
}
const jobLog = fs.readFileSync(logPath, 'utf8').split('\n');

doUhCronJob();

async function doUhCronJob() {
	Utils.log(jobLog, new Date().toUTCString());
	/** @type {import('mysql').PoolConnection} */
	let connection = null;
	try {
		connection = await Pool.getConnection();
		await updateUh(connection);
		if (connection) {
			connection.release();
		}
	} catch (err) {
		if (connection) {
			connection.release();
		}
		Utils.log(jobLog, `UH histories update failed: ${err}`);
	}
	fs.writeFileSync(logPath, jobLog.join('\n'));
	process.exit();
}

/**
 * @param {import('mysql').PoolConnection} connection
 */
async function updateUh(connection) {
	const now = Math.trunc(Date.now() / 1e3);
	const days28 = now - 60 * 60 * 24 * 28;
	let ended = false;
	let canceled = false;
	Utils.log(jobLog, 'Initializing...');
	const rows = await Pool.query(
		connection,
		`
		SELECT steam_id, usernames, last_check, last_update
		FROM users__uh
		WHERE last_check <= ${days28}
		LIMIT 500
	`
	);
	ended = rows.length === 0;
	if (!ended) {
		const uh = [];
		Utils.log(jobLog, `Updating UH histories...`);
		for (const row of rows) {
			const steamId = row.steam_id;
			const usernames = row.usernames.split(', ');
			await Utils.timeout(1);
			Utils.log(jobLog, `Updating UH history for ${steamId}...`);
			const url = `https://www.steamgifts.com/go/user/${steamId}`;
			try {
				const response = await Request.head(url);
				const parts = response.url.split('/user/');
				const username = parts && parts.length === 2 ? parts[1] : '[DELETED]';
				const values = {
					steam_id: steamId,
					usernames: row.usernames,
					last_check: now,
					last_update: row.last_update,
				};
				if (usernames[0] !== username) {
					usernames.unshift(username);
					values.usernames = usernames.join(', ');
					values.last_update = now;
				}
				uh.push(values);
			} catch (err) {
				canceled = true;
			}
			if (canceled) {
				break;
			}
		}
		if (uh.length > 0) {
			await Pool.beginTransaction(connection);
			try {
				await Pool.query(
					connection,
					`
					INSERT INTO users__uh (steam_id, usernames, last_check, last_update)
					VALUES ${uh
						.map(
							(values) =>
								`(${connection.escape(values.steam_id)}, ${connection.escape(
									values.usernames
								)}, ${connection.escape(values.last_check)}, ${connection.escape(
									values.last_update
								)})`
						)
						.join(', ')}
					ON DUPLICATE KEY UPDATE usernames = VALUES(usernames), last_check = VALUES(last_check), last_update = VALUES(last_update)
				`
				);
				await Pool.commit(connection);
			} catch (err) {
				await Pool.rollback(connection);
				throw err;
			}
		}
	}
	if (canceled) {
		Utils.log(jobLog, 'Canceled!');
	} else {
		Utils.log(jobLog, 'Finalizing...');

		await Pool.beginTransaction(connection);
		try {
			await Pool.query(
				connection,
				`
					INSERT INTO timestamps (name, date)
					VALUES ('uh_last_update', ${connection.escape(Math.trunc(Date.now() / 1e3))})
					ON DUPLICATE KEY UPDATE date = VALUES(date)
				`
			);
			await Pool.commit(connection);
		} catch (err) {
			await Pool.rollback(connection);
			throw err;
		}

		Utils.log(jobLog, 'Done!');
	}
}
