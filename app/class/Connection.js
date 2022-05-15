const mysql = require('mysql');
const defaultConfig = require('../config').connection;

class _Pool {
	constructor(config = {}) {
		this._config = config;
		/** @type {import('mysql').Pool} */
		this._pool = null;
	}

	/**
	 * @returns {Promise<import('mysql').PoolConnection>}
	 */
	async getConnection() {
		if (!this._pool) {
			const connection = mysql.createConnection({ ...defaultConfig, ...this._config });
			const row = (await Pool.query(connection, 'SHOW VARIABLES LIKE "max_connections"'))[0];
			connection.end();

			const connectionLimit = Math.floor(parseInt(row.Value) * 0.9);
			this._pool = mysql.createPool({ ...defaultConfig, ...this._config, connectionLimit });

			console.log(`Connection limit: ${connectionLimit}`);
		}

		return new Promise((resolve, reject) => {
			this._pool.getConnection((err, connection) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(connection);
			});
		});
	}

	/**
	 * @param {import('mysql').PoolConnection} connection
	 * @param {*} sql
	 */
	query(connection, sql) {
		return new Promise((resolve, reject) => {
			connection.query(sql, (err, rows) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(rows);
			});
		});
	}

	/**
	 * @param {import('mysql').PoolConnection} connection
	 */
	beginTransaction(connection) {
		return new Promise((resolve, reject) => {
			connection.beginTransaction((err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	/**
	 * @param {import('mysql').PoolConnection} connection
	 */
	commit(connection) {
		return new Promise((resolve, reject) => {
			connection.commit((err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	/**
	 * @param {import('mysql').PoolConnection} connection
	 */
	rollback(connection) {
		return new Promise((resolve, reject) => {
			connection.rollback((err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	/**
	 * @param {import('mysql').PoolConnection} connection
	 * @param {Function} callback
	 */
	async transaction(connection, callback) {
		await this.beginTransaction(connection);
		try {
			await callback();
			await this.commit(connection);
		} catch (err) {
			await this.rollback(connection);
			throw err;
		}
	}
}

const Pool = new _Pool();

module.exports = Pool;
