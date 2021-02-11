const Pool = require('../../class/Connection');

class Auth {
	static async auth(identifier, profile, done) {
		try {
			const user = await Auth.getUser(profile);
			done(null, user);
		} catch (err) {
			done(err);
		}
	}

	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static login(req, res) {
		if (req.session.origin) {
			res.redirect(req.session.origin);
		} else {
			res.redirect('/esgst');
		}
	}

	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static getLoggedInUser(req, res) {
		if (req.isAuthenticated()) {
			res.status(200).json(req.user || null);
		} else {
			res.status(200).json(null);
		}
	}

	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static logout(req, res) {
		req.logout();
		req.session.destroy(() => {
			if (req.query.origin) {
				res.redirect(req.query.origin);
			} else {
				res.redirect('/esgst');
			}
		});
	}

	static async getUser(profile) {
		/** @type {import('mysql').PoolConnection} */
		let connection = null;
		try {
			connection = await Pool.getConnection();
			if (profile.displayName) {
				await Pool.query(
					connection,
					`
						INSERT INTO auth__users (steam_id, username)
						VALUES (${connection.escape(profile.id)}, ${connection.escape(profile.displayName)})
						ON DUPLICATE KEY UPDATE username = ${connection.escape(profile.displayName)}
					`
				);
			}
			const rows = await Pool.query(
				connection,
				`
					SELECT steam_id, role_id, username
					FROM auth__users
					WHERE steam_id = ${connection.escape(profile.id)}
				`
			);
			const row = rows[0];
			if (connection) {
				connection.release();
			}
			return {
				steamId: row.steam_id,
				role: row.role_id,
				username: row.username,
			};
		} catch (err) {
			if (connection) {
				connection.release();
			}
			throw err;
		}
	}
}

module.exports = Auth;
