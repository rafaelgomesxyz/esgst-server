const CustomError = require('../../class/CustomError');
const Pool = require('../../class/Connection');

/**
 * @api {SCHEMA} SettingsStats SettingsStats
 * @apiGroup Schemas
 * @apiName SettingsStats
 * @apiDescription Settings stats.
 * @apiVersion 1.0.0
 *
 * @apiParam (Schema) {Object} result
 * @apiParam (Schema) {Object} result.settings An object containing the usage count for each setting.
 * @apiParam (Schema) {Integer} result.submissions The number of user submissions that have been counted.
 * 
 * @apiSampleRequest off
 */

/**
 * @api {GET} /settings/stats GetSettingsStats
 * @apiGroup Settings
 * @apiName GetSettingsStats
 * @apiDescription Returns settings stats.
 * @apiVersion 1.0.0
 *
 * @apiSuccess (Success Response (200)) {Object} output
 * @apiSuccess (Success Response (200)) {NULL} output.error Always NULL in a success response.
 * @apiSuccess (Success Response (200)) {[SettingsStats](#api-Schemas-SettingsStats)} output.result The information requested.
 *
 * @apiError (Error Response (400, 500)) {Object} output
 * @apiError (Error Response (400, 500)) {String} output.error The error message.
 * @apiError (Error Response (400, 500)) {NULL} output.result Always NULL in an error response.
 */

/**
 * @api {PUT} /settings/stats PostSettingsStats
 * @apiGroup Settings
 * @apiName PostSettingsStats
 * @apiDescription Updates settings stats.
 * @apiVersion 1.0.0
 *
 * @apiParam (Body Parameters) {String} uuid The tracking UUID.
 * @apiParam (Body Parameters) {String[]} settingsKeys An array containing the keys for the enabled settings.
 *
 * @apiSuccess (Success Response (200)) {Object} output
 * @apiSuccess (Success Response (200)) {NULL} output.error Always NULL in a success response.
 * @apiSuccess (Success Response (200)) {TRUE} output.result Always TRUE in a success response.
 *
 * @apiError (Error Response (400, 500)) {Object} output
 * @apiError (Error Response (400, 500)) {String} output.error The error message.
 * @apiError (Error Response (400, 500)) {FALSE} output.result Always FALSE in an error response.
 */

class SettingsStats {
	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static async get(req, res) {
		/** @type {import('mysql').PoolConnection} */
		let connection = null;
		try {
			connection = await Pool.getConnection();
			const result = {
				'settings': {},
				'submissions': 0,
			};
			const dataRows = await Pool.query(connection, 'SELECT * FROM settings__stats');
			for (const dataRow of dataRows) {
				for (const [key, value] of Object.entries(dataRow)) {
					if (key === 'uuid') {
						continue;
					}
					if (!result.settings[key]) {
						result.settings[key] = 0;
					}
					result.settings[key] += value;
				}
			}
			result.submissions = dataRows.length;
			if (connection) {
				connection.release();
			}
			res.status(200)
				.json({
					error: null,
					result,
				});
		} catch (err) {
			if (connection) {
				connection.release();
			}
			console.log(`GET ${req.route.path} failed with params ${JSON.stringify(req.params)} and query ${JSON.stringify(req.query)}: ${err.message} ${err.stack ? err.stack.replace(/\n/g, ' ') : ''}`);
			if (!err.status) {
				err.status = 500;
				err.message = CustomError.COMMON_MESSAGES.internal;
			}
			res.status(err.status)
				.json({
					error: err.message,
					result: null,
				});
		}
	}

	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static async post(req, res) {
		/** @type {import('mysql').PoolConnection} */
		let connection = null;
		try {
			connection = await Pool.getConnection();
			const { uuid, settingsKeys } = req.body;
			const columnRows = await Pool.query(connection, 'DESCRIBE settings__stats');
			const columns = columnRows.filter((columnRow) => columnRow.Field !== 'uuid');
			const values = columns.map((column) => settingsKeys.includes(column) ? 1 : 0).join(', ');
			await Pool.query(connection, `
				INSERT INTO settings__stats (uuid, ${columns.join(', ')})
				VALUES (${connection.escape(uuid)}, ${values})
				ON DUPLICATE KEY UPDATE ${columns.map((column) => `${column} = VALUES(${column})`).join(', ')}
			`);
			if (connection) {
				connection.release();
			}
			res.status(200)
				.json({
					error: null,
					result: true,
				});
		} catch (err) {
			if (connection) {
				connection.release();
			}
			console.log(`POST ${req.route.path} failed with params ${JSON.stringify(req.params)} and query ${JSON.stringify(req.query)}: ${err.message} ${err.stack ? err.stack.replace(/\n/g, ' ') : ''}`);
			if (!err.status) {
				err.status = 500;
				err.message = CustomError.COMMON_MESSAGES.internal;
			}
			res.status(err.status)
				.json({
					error: err.message,
					result: false,
				});
		}
	}
}

module.exports = SettingsStats;