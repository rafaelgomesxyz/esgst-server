const fs = require('fs');
const path = require('path');

const Pool = require('../class/Connection');
const Request = require('../class/Request');
const Utils = require('../class/Utils');

const jsonPath = path.resolve(__dirname, './uh.json');
const jobJson = require(jsonPath);

doUhCronJob();

async function doUhCronJob() {
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
		console.log(`UH histories update failed: ${err}`);
	}
	process.exit();
}

/**
 * @param {import('mysql').PoolConnection} connection
 */
async function updateUh(connection) {
	const now = Math.trunc(Date.now() / 1e3);
	let index = jobJson.index;
	let ended = false;
	let canceled = false;
	if (index == 0) {
		console.log('Initializing...');
	}
	do {
		const rows = await Pool.query(
			connection,
			`
			SELECT steam_id, usernames, last_check, last_update
			FROM users__uh
			LIMIT ${index}, 100
		`
		);
		ended = rows.length === 0;
		if (!ended) {
			const uh = [];
			console.log(`Updating UH histories (index ${index}...)`);
			for (const row of rows) {
				const steamId = row.steam_id;
				const usernames = row.usernames.split(', ');
				const lastCheck = parseInt(row.last_check);
				const differenceInSeconds = now - lastCheck;
				if (differenceInSeconds >= 60 * 60 * 24 * 7) {
					await Utils.timeout(1);
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
		if (!canceled) {
			index += 100;
		}
		fs.writeFileSync(jsonPath, JSON.stringify({ index }));
	} while (!ended && !canceled);
	if (canceled) {
		console.log('Canceled!');
	} else {
		fs.writeFileSync(jsonPath, JSON.stringify({ index: 0 }));
		console.log('Done!');
	}
}
