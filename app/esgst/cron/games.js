const Pool = require('../class/Connection');
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
      LIMIT 100
    `
	);
	console.log(`${appRows.length} apps found!`);
	for (const appRow of appRows) {
		console.log(`Updating app ${appRow.app_id}...`);
		await App.fetch(connection, appRow.app_id);
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
	console.log(`${bundleRows.length} bundles found!`);
	for (const bundleRow of bundleRows) {
		console.log(`Updating bundle ${bundleRow.bundle_id}...`);
		await Bundle.fetch(connection, bundleRow.bundle_id);
	}

	const subRows = await Pool.query(
		connection,
		`
      SELECT sub_id
      FROM games__sub
      WHERE queued_for_update = TRUE
      ORDER BY last_update
      LIMIT 100
    `
	);
	console.log(`${subRows.length} subs found!`);
	for (const subRow of subRows) {
		console.log(`Updating sub ${subRow.sub_id}...`);
		await Sub.fetch(connection, subRow.sub_id);
	}

	console.log('Done!');
}
