const CustomError = require('../../class/CustomError');
const Pool = require('../../class/Connection');
const Utils = require('../../class/Utils');

/**
 * @api {GET} /info/timestamps GetInfoTimestamps
 * @apiGroup Info
 * @apiName GetInfoTimestamps
 * @apiDescription Returns info timestamps.
 * @apiVersion 1.0.0
 *
 * @apiSuccess (Success Response (200)) {Object} output
 * @apiSuccess (Success Response (200)) {NULL} output.error Always NULL in a success response.
 * @apiSuccess (Success Response (200)) {Object} output.result The information requested.
 *
 * @apiError (Error Response (400, 500)) {Object} output
 * @apiError (Error Response (400, 500)) {String} output.error The error message.
 * @apiError (Error Response (400, 500)) {NULL} output.result Always NULL in an error response.
 */

class InfoTimestamps {
	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static async get(req, res) {
		/** @type {import('mysql').PoolConnection} */
		let connection = null;
		try {
			connection = await Pool.getConnection();
			const result = {};
			const rows = await Pool.query(connection, 'SELECT * FROM timestamps');
			for (const row of rows) {
				result[row['name']] = Utils.formatDate(parseInt(row['date']) * 1e3);
			}
			if (connection) {
				connection.release();
			}
			res.status(200).json({
				error: null,
				result,
			});
		} catch (err) {
			if (connection) {
				connection.release();
			}
			console.log(
				`GET ${req.route.path} failed with params ${JSON.stringify(
					req.params
				)} and query ${JSON.stringify(req.query)}: ${err.message} ${
					err.stack ? err.stack.replace(/\n/g, ' ') : ''
				}`
			);
			if (!err.status) {
				err.status = 500;
				err.message = CustomError.COMMON_MESSAGES.internal;
			}
			res.status(err.status).json({
				error: err.message,
				result: null,
			});
		}
	}
}

module.exports = InfoTimestamps;
