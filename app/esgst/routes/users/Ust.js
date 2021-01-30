const CustomError = require('../../class/CustomError');
const Pool = require('../../class/Connection');
const Request = require('../../class/Request');
const Utils = require('../../class/Utils');

/**
 * @api {SCHEMA} Ust Ust
 * @apiGroup Schemas
 * @apiName Ust
 * @apiVersion 1.0.0
 *
 * @apiParam (Schema) {Object} user
 * @apiParam (Schema) {String} [user.steam_id] The Steam ID of the user. This property is not available without the "format_array" and "show_steam_id" parameters.
 * @apiParam (Schema) {String} user.not_activated The last suspension that the user served for a not activated win in the format YYYY/MM/DD HH:mm:SS (UTC timezone).
 * @apiParam (Schema) {String} user.multiple The last suspension that the user served for a multiple win in the format YYYY/MM/DD HH:mm:SS (UTC timezone).
 *
 * @apiSampleRequest off
 */

/**
 * @api {SCHEMA} UstObject UstObject
 * @apiGroup Schemas
 * @apiName UstObject
 * @apiVersion 1.0.0
 *
 * @apiParam (Schema) {Object} result
 * @apiParam (Schema) {Object} result.found An object of [Ust](#api-Schemas-Ust) objects for the users that were found, with their Steam IDs as the keys.
 * @apiParam (Schema) {String[]} result.not_found The Steam IDs of the users that were not found.
 *
 * @apiSampleRequest off
 */

/**
 * @api {SCHEMA} UstArray UstArray
 * @apiGroup Schemas
 * @apiName UstArray
 * @apiVersion 1.0.0
 *
 * @apiParam (Schema) {Object} result
 * @apiParam (Schema) {[Ust](#api-Schemas-Ust)[]} result.found The users that were found.
 * @apiParam (Schema) {String[]} result.not_found The Steam IDs of the users that were not found.
 *
 * @apiSampleRequest off
 */

/**
 * @api {GET} /users/ust GetUst
 * @apiGroup Users
 * @apiName GetUst
 * @apiDescription Returns the suspension history for users.
 * @apiVersion 1.0.0
 *
 * @apiParam (Query Parameters) {Boolean} [format_array] If true, the result is a [UstArray](#api-Schemas-UstArray) object. If false, the result is a [UstObject](#api-Schemas-UstObject) object.
 * @apiParam (Query Parameters) {Boolean} [show_steam_id] If false, the [Ust](#api-Schemas-Ust) object from the "found" object does not have the "steam_id" property.
 * @apiParam (Query Parameters) {String} [steam_ids] A comma-separated list of Steam IDs for the users requested.
 *
 * @apiSuccess (Success Response (200)) {Object} output
 * @apiSuccess (Success Response (200)) {NULL} output.error Always NULL in a success response.
 * @apiSuccess (Success Response (200)) {[UstObject](#api-Schemas-UstObject)/[UstArray](#api-Schemas-UstArray)} output.result The information requested.
 *
 * @apiError (Error Response (400, 500)) {Object} output
 * @apiError (Error Response (400, 500)) {String} output.error The error message.
 * @apiError (Error Response (400, 500)) {NULL} output.result Always NULL in an error response.
 */

class Ust {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  static async get(req, res) {
    /** @type {import('mysql').PoolConnection} */
    let connection = null;
    try {
      connection = await Pool.getConnection();
      const result = await Ust._find(connection, req);
      if (connection) {
        connection.release();
      }
      res.status(200).json({
        error: null,
        result: result ? result : null,
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

  /**
   * @param {import('mysql').PoolConnection} connection
   * @param {import('express').Request} req
   */
  static async _find(connection, req) {
    const booleanMessage = 'Must be true or false.';
    const booleanRegex = /^(true|false|1|0|)$/i;
    const trueBooleanRegex = /^(true|1|)$/i;
    const params = Object.assign({}, req.query);
    const validator = {
      format_array: {
        message: booleanMessage,
        regex: booleanRegex,
      },
      show_steam_id: {
        message: booleanMessage,
        regex: booleanRegex,
      },
      steam_ids: {
        message:
          'Must be a comma-separated list of Steam ids e.g. 76561198020696458,76561198174510278.',
        regex: /^((\d+,)*\d+$|$)/,
      },
    };
    Utils.validateParams(params, validator);
    if (
      typeof params.format_array !== 'undefined' &&
      params.format_array.match(trueBooleanRegex)
    ) {
      params.format_array = true;
      params.show_steam_id = false;
    } else if (
      typeof params.show_steam_id !== 'undefined' &&
      params.show_steam_id.match(trueBooleanRegex)
    ) {
      params.show_steam_id = true;
      params.format_array = false;
    } else {
      params.format_array = false;
      params.show_steam_id = false;
    }
    const result = {
      found: params.format_array ? [] : {},
      not_found: [],
    };
    const steamIds = params.steam_ids ? params.steam_ids.split(',') : [];
    let conditions = [];
    if (params.steam_ids) {
      conditions.push(
        `(${steamIds
          .map((steamId) => `steam_id = ${connection.escape(steamId)}`)
          .join(' OR ')})`
      );
    }
    const rows = await Pool.query(
      connection,
      `
			SELECT steam_id, not_activated, multiple
			FROM users__ust
			${
        conditions.length > 0
          ? `
				WHERE ${conditions.join(' AND ')}
			`
          : ''
      }
		`
    );
    const steamIdsFound = [];
    for (const row of rows) {
      const steamId = row.steam_id;
      const not_activated = parseInt(row.not_activated) * 1e3;
      const multiple = parseInt(row.multiple) * 1e3;
      const user = {
        steam_id: steamId,
        not_activated:
          not_activated > 0 ? Utils.formatDate(not_activated, true) : 0,
        multiple: multiple > 0 ? Utils.formatDate(multiple, true) : 0,
      };
      if (params.format_array) {
        result.found.push(user);
      } else {
        if (!params.show_steam_id) {
          delete user.steam_id;
        }
        result.found[steamId] = user;
      }
      steamIdsFound.push(steamId);
    }
    const steamIdsNotFound = steamIds.filter(
      (steamId) => !steamIdsFound.includes(steamId)
    );
    for (const steamId of steamIdsNotFound) {
      result.not_found.push(steamId);
    }
    return result;
  }
}

module.exports = Ust;
