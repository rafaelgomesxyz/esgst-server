const CustomError = require('../../class/CustomError');
const Pool = require('../../class/Connection');

/**
 * @api {SCHEMA} SettingStats SettingStats
 * @apiGroup Schemas
 * @apiName SettingStats
 * @apiDescription Setting stats.
 * @apiVersion 1.0.0
 *
 * @apiParam (Schema) {Object} setting
 * @apiParam (Schema) {String} setting.id The setting's ID.
 * @apiParam (Schema) {Integer} setting.count The setting's usage count.
 *
 * @apiSampleRequest off
 */

/**
 * @api {SCHEMA} SettingsStats SettingsStats
 * @apiGroup Schemas
 * @apiName SettingsStats
 * @apiDescription Settings stats.
 * @apiVersion 1.0.0
 *
 * @apiParam (Schema) {Object} result
 * @apiParam (Schema) {SettingStats[]} result.settings An array of [SettingStats](#api-Schemas-SettingStats), sorted by usage count.
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
        settings: {},
        submissions: 0,
      };
      const excludedColumns = ['uuid', '_v', '_lastSubmitted'];
      const dataRows = await Pool.query(
        connection,
        'SELECT * FROM settings__stats WHERE _v = 2'
      );
      for (const dataRow of dataRows) {
        const keys = Object.keys(dataRow).filter(
          (key) => !excludedColumns.includes(key)
        );
        for (const key of keys) {
          const value = dataRow[key];
          if (!result.settings[key]) {
            result.settings[key] = {
              id: key,
              count: 0,
            };
          }
          result.settings[key].count += value;
        }
      }
      result.settings = Object.values(result.settings).sort((a, b) => {
        if (a.count > b.count) {
          return -1;
        }
        if (a.count < b.count) {
          return 1;
        }
        return 0;
      });
      result.submissions = dataRows.length;
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

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  static async post(req, res) {
    /** @type {import('mysql').PoolConnection} */
    let connection = null;
    try {
      connection = await Pool.getConnection();
      const { v, uuid, settingsKeys } = req.body;
      const excludedColumns = ['uuid', '_v', '_lastSubmitted'];
      const columnRows = await Pool.query(
        connection,
        'DESCRIBE settings__stats'
      );
      const columns = columnRows
        .filter((columnRow) => !excludedColumns.includes(columnRow.Field))
        .map((columnRow) => columnRow.Field);
      const missingColumns = settingsKeys.filter(
        (settingsKey) => !columns.includes(settingsKey)
      );
      if (missingColumns.length > 0) {
        await Pool.query(
          connection,
          `
					ALTER TABLE settings__stats
						${missingColumns
              .map(
                (missingColumn) =>
                  `ADD COLUMN ${connection.escapeId(
                    missingColumn
                  )} TINYINT(1) NOT NULL DEFAULT 0`
              )
              .join(', ')}
				`
        );
      }
      columns.push(...missingColumns);
      const escapedColumns = columns.map((column) =>
        connection.escapeId(column)
      );
      const now = Math.trunc(Date.now() / 1e3);
      const values = columns
        .map((column) => (settingsKeys.includes(column) ? 1 : 0))
        .join(', ');
      await Pool.query(
        connection,
        `
				INSERT INTO settings__stats (\`uuid\`, \`_v\`, \`_lastSubmitted\`, ${escapedColumns.join(
          ', '
        )})
				VALUES (${connection.escape(uuid)}, ${
          v ? connection.escape(v) : 'NULL'
        }, ${now}, ${values})
				ON DUPLICATE KEY UPDATE \`_v\` = VALUES(\`_v\`), \`_lastSubmitted\` = VALUES(\`_lastSubmitted\`), ${escapedColumns
          .map((column) => `${column} = VALUES(${column})`)
          .join(', ')}
			`
      );
      if (connection) {
        connection.release();
      }
      res.status(200).json({
        error: null,
        result: true,
      });
    } catch (err) {
      if (connection) {
        connection.release();
      }
      console.log(
        `POST ${req.route.path} failed with params ${JSON.stringify(
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
        result: false,
      });
    }
  }
}

module.exports = SettingsStats;
