const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Pool = require('../class/Connection');
const Utils = require('../class/Utils');
const App = require('../routes/games/App');
const Bundle = require('../routes/games/Bundle');
const Sub = require('../routes/games/Sub');

const logPath = path.resolve(__dirname, './games.log');
if (!fs.existsSync(logPath)) {
	fs.writeFileSync(logPath, '');
}
const jobLog = fs.readFileSync(logPath, 'utf8').split('\n');

doGamesCronJob();

async function doGamesCronJob() {
	Utils.log(jobLog, new Date().toUTCString());
	/** @type {import('mysql').PoolConnection} */
	let connection = null;
	try {
		connection = await Pool.getConnection();
		await updateGames(connection);
		if (connection) {
			connection.release();
		}
	} catch (err) {
		if (connection) {
			connection.release();
		}
		Utils.log(jobLog, `Games update failed: ${err}`);
	}
	fs.writeFileSync(logPath, jobLog.join('\n'));
	process.exit();
}

/**
 * @param {import('mysql').PoolConnection} connection
 */
async function updateGames(connection) {
	Utils.log(jobLog, 'Initializing...');

	const now = Math.trunc(Date.now() / 1e3);

	const appsToUnqueue = [];
	const appsToRemove = [];
	const appRows = await Pool.query(
		connection,
		`
      SELECT app_id, release_date, last_update
      FROM games__app
      WHERE queued_for_update = TRUE
      ORDER BY last_update
      LIMIT 500
    `
	);
	Utils.log(jobLog, `${appRows.length} apps found!`);
	for (const [i, appRow] of appRows.entries()) {
		if (appRow.release_date) {
			const releaseDate = Math.trunc(new Date(parseInt(appRow.release_date) * 1e3).getTime() / 1e3);
			const lastUpdate = Math.trunc(new Date(parseInt(appRow.last_update) * 1e3).getTime() / 1e3);
			const differenceInSeconds = now - lastUpdate;
			if (now - releaseDate > 60 * 60 * 24 * 180 && differenceInSeconds < 60 * 60 * 24 * 30) {
				appsToUnqueue.push(appRow.app_id);
				continue;
			}
		}
		Utils.log(jobLog, `[${i + 1}] Updating app ${appRow.app_id}...`);
		try {
			await App.fetch(connection, appRow.app_id);
			await Utils.timeout(1);
		} catch (err) {
			if (err.status === 400) {
				appsToRemove.push(appRow.app_id);
			} else {
				Utils.log(jobLog, `Failed: ${err.message} ${err.stack}`);
				break;
			}
		}
	}
	if (appsToUnqueue.length > 0) {
		Utils.log(jobLog, `Unqueueing ${appsToUnqueue.length} apps (${appsToUnqueue.join(', ')})...`);
		await Pool.beginTransaction(connection);
		try {
			await Pool.query(
				connection,
				`
					UPDATE games__app
					SET queued_for_update = FALSE
					WHERE ${appsToUnqueue.map((appId) => `app_id = ${connection.escape(appId)}`).join(' OR ')}
				`
			);
			await Pool.commit(connection);
		} catch (err) {
			await Pool.rollback(connection);
			throw err;
		}
	}
	if (appsToRemove.length > 0) {
		Utils.log(jobLog, `Removing ${appsToRemove.length} apps (${appsToRemove.join(', ')})...`);
		await Pool.beginTransaction(connection);
		try {
			await Pool.query(
				connection,
				`
					DELETE FROM games__app
					WHERE ${appsToRemove.map((appId) => `app_id = ${connection.escape(appId)}`).join(' OR ')}
				`
			);
			await Pool.commit(connection);
		} catch (err) {
			await Pool.rollback(connection);
			throw err;
		}
	}

	const bundleRows = await Pool.query(
		connection,
		`
      SELECT bundle_id
      FROM games__bundle
      WHERE queued_for_update = TRUE
      ORDER BY last_update
      LIMIT 100
    `
	);
	Utils.log(jobLog, `${bundleRows.length} bundles found!`);
	for (const [i, bundleRow] of bundleRows.entries()) {
		Utils.log(jobLog, `[${i + 1}] Updating bundle ${bundleRow.bundle_id}...`);
		await Bundle.fetch(connection, bundleRow.bundle_id);
		await Utils.timeout(1);
	}

	const subsToUnqueue = [];
	const subsToRemove = [];
	const subRows = await Pool.query(
		connection,
		`
			SELECT sub_id, release_date, last_update
      FROM games__sub
      WHERE queued_for_update = TRUE
      ORDER BY last_update
      LIMIT 100
    `
	);
	Utils.log(jobLog, `${subRows.length} subs found!`);
	for (const [i, subRow] of subRows.entries()) {
		if (subRow.release_date) {
			const releaseDate = Math.trunc(new Date(parseInt(subRow.release_date) * 1e3).getTime() / 1e3);
			const lastUpdate = Math.trunc(new Date(parseInt(subRow.last_update) * 1e3).getTime() / 1e3);
			const differenceInSeconds = now - lastUpdate;
			if (now - releaseDate > 60 * 60 * 24 * 180 && differenceInSeconds < 60 * 60 * 24 * 30) {
				subsToUnqueue.push(subRow.sub_id);
				continue;
			}
		}
		Utils.log(jobLog, `[${i + 1}] Updating sub ${subRow.sub_id}...`);
		try {
			await Sub.fetch(connection, subRow.sub_id);
			await Utils.timeout(1);
		} catch (err) {
			if (err.status === 400) {
				subsToRemove.push(subRow.sub_id);
			} else {
				Utils.log(jobLog, `Failed: ${err.message} ${err.stack}`);
				break;
			}
		}
	}
	if (subsToUnqueue.length > 0) {
		Utils.log(jobLog, `Unqueueing ${subsToUnqueue.length} subs (${subsToUnqueue.join(', ')})...`);
		await Pool.beginTransaction(connection);
		try {
			await Pool.query(
				connection,
				`
					UPDATE games__sub
					SET queued_for_update = FALSE
					WHERE ${subsToUnqueue.map((subId) => `sub_id = ${connection.escape(subId)}`).join(' OR ')}
				`
			);
			await Pool.commit(connection);
		} catch (err) {
			await Pool.rollback(connection);
			throw err;
		}
	}
	if (subsToRemove.length > 0) {
		Utils.log(jobLog, `Removing ${subsToRemove.length} subs (${subsToRemove.join(', ')})...`);
		await Pool.beginTransaction(connection);
		try {
			await Pool.query(
				connection,
				`
					DELETE FROM games__sub
					WHERE ${subsToRemove.map((subId) => `sub_id = ${connection.escape(subId)}`).join(' OR ')}
				`
			);
			await Pool.commit(connection);
		} catch (err) {
			await Pool.rollback(connection);
			throw err;
		}
	}

	Utils.log(jobLog, 'Finalizing...');

	await Pool.beginTransaction(connection);
	try {
		await Pool.query(
			connection,
			`
        INSERT INTO timestamps (name, date)
        VALUES ('games_last_update', ${connection.escape(Math.trunc(Date.now() / 1e3))})
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
