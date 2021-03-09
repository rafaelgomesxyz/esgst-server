const Pool = require('../class/Connection');
const Utils = require('../class/Utils');
const App = require('../routes/games/App');
const Bundle = require('../routes/games/Bundle');
const Sub = require('../routes/games/Sub');

doGamesCronJob();

async function doGamesCronJob() {
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
		console.log(`Games update failed: ${err}`);
	}
	process.exit();
}

/**
 * @param {import('mysql').PoolConnection} connection
 */
async function updateGames(connection) {
	console.log('Initializing...');

	const appRows = await Pool.query(
		connection,
		`
      SELECT app_id
      FROM games__app
      WHERE queued_for_update = TRUE
      ORDER BY last_update
      LIMIT 200
    `
	);
	console.log(`${appRows.length} apps found!`);
	for (const [i, appRow] of appRows.entries()) {
		console.log(`[${i + 1}] Updating app ${appRow.app_id}...`);
		await App.fetch(connection, appRow.app_id);
		await Utils.timeout(1);
	}

	const bundleRows = await Pool.query(
		connection,
		`
      SELECT bundle_id
      FROM games__bundle
      WHERE queued_for_update = TRUE
      ORDER BY last_update
      LIMIT 200
    `
	);
	console.log(`${bundleRows.length} bundles found!`);
	for (const [i, bundleRow] of bundleRows.entries()) {
		console.log(`[${i + 1}] Updating bundle ${bundleRow.bundle_id}...`);
		await Bundle.fetch(connection, bundleRow.bundle_id);
		await Utils.timeout(1);
	}

	const subRows = await Pool.query(
		connection,
		`
      SELECT sub_id
      FROM games__sub
      WHERE queued_for_update = TRUE
      ORDER BY last_update
      LIMIT 200
    `
	);
	console.log(`${subRows.length} subs found!`);
	for (const [i, subRow] of subRows.entries()) {
		console.log(`[${i + 1}] Updating sub ${subRow.sub_id}...`);
		await Sub.fetch(connection, subRow.sub_id);
		await Utils.timeout(1);
	}

	console.log('Done!');
}
