const mysql = require('mysql');
const defaultConfig = require('../config').connection;

class _Pool {
	constructor(config = {}) {
		/** @type {import('mysql').Pool} */
		this._pool = mysql.createPool({
			...defaultConfig,
			...config,
			connectionLimit: 5,
		});
	}

	/**
	 * @returns {Promise<import('mysql').PoolConnection>}
	 */
	getConnection() {
		return new Promise((resolve, reject) => {
			this._pool.getConnection((err, connection) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(connection);
			});
		})
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
		})
	}

	/**
	 * @param {import('mysql').PoolConnection} connection 
	 */
	beginTransaction(connection) {
		return new Promise((resolve, reject) => {
			connection.beginTransaction(err => {
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
			connection.commit(err => {
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
			connection.rollback(err => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}
}

const Pool = new _Pool();

module.exports = Pool;