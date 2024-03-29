const CustomError = require('../../class/CustomError');
const Pool = require('../../class/Connection');
const Request = require('../../class/Request');
const Utils = require('../../class/Utils');

/**
 * @api {SCHEMA} App App
 * @apiGroup Schemas
 * @apiName App
 * @apiDescription The optional properties are included based on the "filters" parameter. If the parameter isn't used, all of the optional properties are included, except where noted.
 * @apiVersion 1.0.0
 *
 * @apiParam (Schema) {Object} app
 * @apiParam (Schema) {String=app} [app.type=app] [NOT FILTERABLE] The type of the game.
 * This property is only available for the [GetGames](#api-Games-GetGames) method when used with the parameter "join_all".
 * @apiParam (Schema) {Integer} [app.app_id] [NOT FILTERABLE] The Steam ID of the game. This property is not available for the [GetGames](#api-Games-GetGames) method when used without the "join_all", "format_array" and "show_id" parameters.
 * @apiParam (Schema) {String} [app.name] The name of the game.
 * @apiParam (Schema) {Boolean} [app.released] Whether the game has been released to the Steam store or not.
 * @apiParam (Schema) {Boolean} [app.removed] Whether the game has been removed from the Steam store or not.
 * @apiParam (Schema) {Boolean} [app.steam_cloud] Whether the game has Steam cloud or not.
 * @apiParam (Schema) {Boolean} [app.trading_cards] Whether the game has trading cards or not.
 * @apiParam (Schema) {Boolean/NULL} [app.learning] A boolean indicating whether Steam is learning about the game or not, or NULL if the information is not accessible.
 * @apiParam (Schema) {Boolean} [app.multiplayer] Whether the game is multiplayer or not.
 * @apiParam (Schema) {Boolean} [app.singleplayer] Whether the game is singleplayer or not.
 * @apiParam (Schema) {Boolean} [app.linux] Whether the game runs on Linux or not.
 * @apiParam (Schema) {Boolean} [app.mac] Whether the game runs on Mac or not.
 * @apiParam (Schema) {Boolean} [app.windows] Whether the game runs on Windows or not.
 * @apiParam (Schema) {Integer} [app.achievements] The number of achievements that the game has, or 0 if it doesn't have any.
 * @apiParam (Schema) {Integer} [app.price] The price of the game in USD ($9.99 is represented as 999), or 0 if it's free.
 * @apiParam (Schema) {Object/NULL} [app.metacritic] Information about the Metacritic score of the game, or NULL if it doesn't have a Metacritic page.
 * @apiParam (Schema) {Integer} app.metacritic.score The Metacritic score of the game.
 * @apiParam (Schema) {String} app.metacritic.id The Metacritic ID of the game, useful for building its Metacritic URL (https://www.metacritic.com/game/pc/{id}).
 * @apiParam (Schema) {Object/NULL} [app.rating] Information about the Steam rating of the game, or NULL if it doesn't have enough ratings.
 * @apiParam (Schema) {Integer} app.rating.percentage The percentage of positive ratings that the game has.
 * @apiParam (Schema) {Integer} app.rating.count The total number of ratings that the game has.
 * @apiParam (Schema) {String/NULL} [app.release_date] When the game was released or is going to be released in the format YYYY-MM-DD, or NULL if there's no release date.
 * @apiParam (Schema) {String[]} [app.genres] The genres of the game (according to the developers). Can be empty.
 * @apiParam (Schema) {String[]} [app.tags] The user-defined tags of the game (according to the players). Can be empty.
 * @apiParam (Schema) {Integer/NULL} [app.base] The Steam ID of the base game, or NULL if the game isn't a DLC.
 * @apiParam (Schema) {Integer[]} [app.dlcs] The Steam IDs of the DLCs that the game has. Can be empty.
 * @apiParam (Schema) {Integer[]} [app.subs] The Steam IDs of the subs that include the game. Can be empty.
 * @apiParam (Schema) {Integer[]} [app.bundles] The Steam IDs of the bundles that include the game. Can be empty.
 * @apiParam (Schema) {String} app.last_update When the information was last updated in the format YYYY/MM/DD HH:mm:SS (UTC timezone).
 *
 * @apiSampleRequest off
 */

class App {
	/**
	 * @param {import('mysql').PoolConnection} connection
	 * @param {import('express').Request} req
	 * @param {Array<number>} ids
	 */
	static async get(connection, req, ids) {
		const columns = {
			name: 'g_an.name',
			released: 'g_a.released',
			removed: 'g_a.removed',
			steam_cloud: 'g_a.steam_cloud',
			trading_cards: 'g_a.trading_cards',
			learning: 'g_a.learning',
			multiplayer: 'g_a.multiplayer',
			singleplayer: 'g_a.singleplayer',
			linux: 'g_a.linux',
			mac: 'g_a.mac',
			windows: 'g_a.windows',
			achievements: 'g_a.achievements',
			price: 'g_a.price',
			metacritic: 'g_a.metacritic_score, g_a.metacritic_id',
			rating: 'g_a.rating_percentage, g_a.rating_count',
			release_date: 'g_a.release_date',
			base: 'g_d.app_id AS base',
		};
		const columnKeys = [...Object.keys(columns), 'genres', 'tags', 'dlcs', 'subs', 'bundles'];

		const params = Object.assign({}, { filters: req.query.filters || req.query.app_filters || '' });
		const validator = {
			filters: {
				message: `Must be a comma-separated list containing the following values: ${columnKeys.join(
					', '
				)}`,
				regex: new RegExp(`^(((${columnKeys.join('|')}),?)+)?$`),
			},
		};
		Utils.validateParams(params, validator);

		const filters = {};
		for (const columnKey of columnKeys) {
			filters[columnKey] = true;
		}
		if (params.filters) {
			const filterKeys = params.filters.split(',');
			for (const columnKey of columnKeys) {
				if (!filterKeys.includes(columnKey)) {
					delete columns[columnKey];
					delete filters[columnKey];
				}
			}
		}

		const preparedIds = ids.map((id) => connection.escape(id)).join(',');
		const rows = await Pool.query(
			connection,
			`
				SELECT ${[
					'g_a.app_id',
					...Object.values(columns),
					...(filters.release_date ? [] : ['g_a.release_date']),
					'g_a.last_update',
					'g_a.queued_for_update',
				].join(', ')}
				FROM games__app AS g_a
				${
					filters.name
						? `
								INNER JOIN games__app_name AS g_an
								ON g_a.app_id = g_an.app_id
							`
						: ''
				}
				${
					filters.base
						? `
								LEFT JOIN games__dlc AS g_d
								ON g_a.app_id = g_d.dlc_id
							`
						: ''
				}
				WHERE g_a.app_id IN (${preparedIds})
			`
		);

		let genreMap = {};
		if (filters.genres) {
			const genreRows = await Pool.query(
				connection,
				`
					SELECT g_ag.app_id, GROUP_CONCAT(g_g.name) AS genres
					FROM games__app_genre AS g_ag
					INNER JOIN games__genre AS g_g
					ON g_ag.genre_id = g_g.genre_id
					WHERE g_ag.app_id IN (${preparedIds})
					GROUP BY g_ag.app_id
				`
			);
			genreMap = Utils.getQueryMap(genreRows, 'app_id');
		}

		let tagMap = {};
		if (filters.tags) {
			const tagRows = await Pool.query(
				connection,
				`
					SELECT g_at.app_id, GROUP_CONCAT(g_t.name) AS tags
					FROM games__app_tag AS g_at
					INNER JOIN games__tag AS g_t
					ON g_at.tag_id = g_t.tag_id
					WHERE g_at.app_id IN (${preparedIds})
					GROUP BY g_at.app_id
				`
			);
			tagMap = Utils.getQueryMap(tagRows, 'app_id');
		}

		let dlcMap = {};
		if (filters.dlcs) {
			const dlcRows = await Pool.query(
				connection,
				`
					SELECT g_d.app_id, GROUP_CONCAT(g_d.dlc_id) AS dlcs
					FROM games__dlc AS g_d
					WHERE g_d.app_id IN (${preparedIds})
					GROUP BY g_d.app_id
				`
			);
			dlcMap = Utils.getQueryMap(dlcRows, 'app_id');
		}

		let subMap = {};
		if (filters.subs) {
			const subRows = await Pool.query(
				connection,
				`
					SELECT g_sa.app_id, GROUP_CONCAT(g_sa.sub_id) AS subs
					FROM games__sub_app AS g_sa
					WHERE g_sa.app_id IN (${preparedIds})
					GROUP BY g_sa.app_id
				`
			);
			subMap = Utils.getQueryMap(subRows, 'app_id');
		}

		let bundleMap = {};
		if (filters.bundles) {
			const bundleRows = await Pool.query(
				connection,
				`
					SELECT g_ba.app_id, GROUP_CONCAT(g_ba.bundle_id) AS bundles
					FROM games__bundle_app AS g_ba
					WHERE g_ba.app_id IN (${preparedIds})
					GROUP BY g_ba.app_id
				`
			);
			bundleMap = Utils.getQueryMap(bundleRows, 'app_id');
		}

		const apps = [];
		const found = [];
		const to_queue = [];
		const now = Math.trunc(Date.now() / 1e3);
		for (const row of rows) {
			const app = {
				app_id: row.app_id,
			};
			if (filters.name) {
				app.name = row.name;
			}
			if (filters.released) {
				app.released = !!row.released;
			}
			if (filters.removed) {
				app.removed = !!row.removed;
			}
			if (filters.steam_cloud) {
				app.steam_cloud = !!row.steam_cloud;
			}
			if (filters.trading_cards) {
				app.trading_cards = !!row.trading_cards;
			}
			if (filters.learning) {
				app.learning = Utils.isSet(row.learning) ? !!row.learning : null;
			}
			if (filters.multiplayer) {
				app.multiplayer = !!row.multiplayer;
			}
			if (filters.singleplayer) {
				app.singleplayer = !!row.singleplayer;
			}
			if (filters.linux) {
				app.linux = !!row.linux;
			}
			if (filters.mac) {
				app.mac = !!row.mac;
			}
			if (filters.windows) {
				app.windows = !!row.windows;
			}
			if (filters.achievements) {
				app.achievements = row.achievements;
			}
			if (filters.price) {
				app.price = row.price;
			}
			if (filters.metacritic) {
				app.metacritic = Utils.isSet(row.metacritic_score)
					? {
							score: row.metacritic_score,
							url: `https://www.metacritic.com/game/pc/${row.metacritic_id}`,
					  }
					: null;
			}
			if (filters.rating) {
				app.rating = Utils.isSet(row.rating_percentage)
					? {
							percentage: row.rating_percentage,
							count: row.rating_count,
					  }
					: null;
			}
			if (filters.release_date) {
				app.release_date = Utils.isSet(row.release_date)
					? Utils.formatDate(parseInt(row.release_date) * 1e3)
					: null;
			}
			if (filters.genres) {
				const genreRow = genreMap[row.app_id];
				app.genres = genreRow ? genreRow.genres.split(',') : [];
			}
			if (filters.tags) {
				const tagRow = tagMap[row.app_id];
				app.tags = tagRow ? tagRow.tags.split(',') : [];
			}
			if (filters.base) {
				app.base = Utils.isSet(row.base) ? row.base : null;
			}
			if (filters.dlcs) {
				const dlcRow = dlcMap[row.app_id];
				app.dlcs = dlcRow ? dlcRow.dlcs.split(',').map((dlcId) => parseInt(dlcId)) : [];
			}
			if (filters.subs) {
				const subRow = subMap[row.app_id];
				app.subs = subRow ? subRow.subs.split(',').map((subId) => parseInt(subId)) : [];
			}
			if (filters.bundles) {
				const bundleRow = bundleMap[row.app_id];
				app.bundles = bundleRow
					? bundleRow.bundles.split(',').map((bundleId) => parseInt(bundleId))
					: [];
			}
			app.last_update = Utils.formatDate(parseInt(row.last_update) * 1e3, true);
			app.queued_for_update = !!row.queued_for_update;
			if (!app.queued_for_update) {
				const releaseDate = Utils.isSet(row.release_date)
					? Math.trunc(new Date(parseInt(row.release_date) * 1e3).getTime() / 1e3)
					: now;
				const lastUpdate = Math.trunc(new Date(parseInt(row.last_update) * 1e3).getTime() / 1e3);
				const differenceInSeconds = now - lastUpdate;
				if (now - releaseDate > 60 * 60 * 24 * 180) {
					if (
						differenceInSeconds > 60 * 60 * 24 * 30 ||
						(!Utils.isSet(row.learning) && !row.removed && differenceInSeconds > 60 * 60 * 24)
					) {
						app.queued_for_update = true;
						to_queue.push(app.app_id);
					}
				} else if (
					differenceInSeconds > 60 * 60 * 24 * 6 ||
					(!Utils.isSet(row.learning) && !row.removed && differenceInSeconds > 60 * 60 * 24)
				) {
					app.queued_for_update = true;
					to_queue.push(app.app_id);
				}
			}
			apps.push(app);
			found.push(app.app_id);
		}
		const notFound = ids.filter((id) => !found.includes(id));
		to_queue.push(...notFound);
		if (to_queue.length > 0) {
			await Pool.transaction(connection, async () => {
				await Pool.query(
					connection,
					`
						INSERT INTO games__app (app_id, queued_for_update)
						VALUES ${to_queue.map((id) => `(${connection.escape(id)}, TRUE)`).join(', ')}
						ON DUPLICATE KEY UPDATE queued_for_update = VALUES(queued_for_update)
					`
				);
			});
		}
		return apps;
	}

	/**
	 * @param {import('mysql').PoolConnection} connection
	 * @param {number} appId
	 */
	static async fetch(connection, appId) {
		const apiUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=achievements,basic,categories,genres,metacritic,name,packages,platforms,price_overview,release_date&cc=us&l=en`;
		const apiResponse = await Request.get(apiUrl);
		if (!apiResponse || !apiResponse.json || !apiResponse.json[appId]) {
			throw new CustomError(CustomError.COMMON_MESSAGES.steam, 500);
		}
		if (apiResponse.json[appId].success) {
			const apiData = apiResponse.json[appId].data;
			if (!apiData || (apiData.type !== 'game' && apiData.type !== 'dlc')) {
				await Pool.beginTransaction(connection);
				try {
					await Pool.query(
						connection,
						`
							INSERT INTO games__app (app_id, removed, last_update, queued_for_update)
							VALUES (${appId}, TRUE, ${connection.escape(Math.trunc(Date.now() / 1e3))}, FALSE)
							ON DUPLICATE KEY UPDATE removed = VALUES(removed), last_update = VALUES(last_update), queued_for_update = VALUES(queued_for_update)
						`
					);
					await Pool.commit(connection);
				} catch (err) {
					await Pool.rollback(connection);
					throw err;
				}
				return;
			}
			const storeUrl = `https://store.steampowered.com/app/${appId}?cc=us&l=en`;
			const storeConfig = {
				headers: {
					Cookie: 'birthtime=0; mature_content=1;',
				},
			};
			const storeResponse = await Request.get(storeUrl, storeConfig);
			if (!storeResponse.html) {
				throw new CustomError(CustomError.COMMON_MESSAGES.steam, 500);
			}
			const isStoreResponseOk = !!storeResponse.html.querySelector('.apphub_AppName');
			const releaseDate = apiData.release_date;
			const removed = !storeResponse.url.match(
				new RegExp(`store\.steampowered\.com.*?\/app\/${appId}`)
			);
			const categories = apiData.categories
				? apiData.categories.map((category) => category.description.toLowerCase())
				: [];
			const platforms = apiData.platforms;
			const metacritic = apiData.metacritic;
			let rating = null;
			if (isStoreResponseOk && !removed) {
				const element = storeResponse.html.querySelector(
					'#userReviews .user_reviews_summary_row:last-child'
				);
				if (element) {
					const text = element.dataset.tooltipHtml.replace(/[,.]/, '');
					rating = text.match(/(\d+)%.+?(\d+)/);
				}
			}
			const app = {
				app_id: appId,
				released: !releaseDate.coming_soon,
				removed: removed,
				steam_cloud: categories.includes('steam cloud'),
				trading_cards: categories.includes('steam trading cards'),
				learning: isStoreResponseOk ? !!storeResponse.html.querySelector('.learning_about') : null,
				multiplayer:
					[
						'multi-player',
						'online multi-player',
						'co-op',
						'local co-op',
						'online co-op',
						'shared/split screen',
					].filter((category) => categories.includes(category)).length > 0,
				singleplayer: categories.includes('single-player'),
				linux: platforms.linux,
				mac: platforms.mac,
				windows: platforms.windows,
				achievements: parseInt((apiData.achievements && apiData.achievements.total) || 0),
				price: parseInt((apiData.price_overview && apiData.price_overview.initial) || 0),
				metacritic_score: metacritic ? parseInt(metacritic.score) : null,
				metacritic_id: metacritic
					? metacritic.url.replace(/https:\/\/www\.metacritic\.com\/game\/pc\/|\?.+/, '')
					: null,
				rating_percentage: rating ? parseInt(rating[1]) : null,
				rating_count: rating ? parseInt(rating[2]) : null,
				release_date: null,
				last_update: Math.trunc(Date.now() / 1e3),
				queued_for_update: false,
			};
			if (releaseDate.date) {
				const timestamp = new Date(`${releaseDate.date.replace(/st|nd|rd|th/, '')} UTC`).getTime();
				if (!Number.isNaN(timestamp)) {
					app['release_date'] = Math.trunc(timestamp / 1e3);
				}
			}
			const genres = [];
			if (apiData.genres) {
				for (const genre of apiData.genres) {
					genres.push({
						id: parseInt(genre.id),
						name: genre.description.trim(),
					});
				}
			}
			const tags = [];
			if (isStoreResponseOk && !removed) {
				const matches = storeResponse.text.match(/InitAppTagModal[\S\s]*?(\[[\S\s]*?]),/);
				if (matches) {
					const elements = JSON.parse(matches[1]);
					for (const element of elements) {
						tags.push({
							id: parseInt(element.tagid),
							name: element.name,
						});
					}
				}
			}
			const base =
				parseInt((apiData.type === 'dlc' && apiData.fullgame && apiData.fullgame.appid) || 0) ||
				null;
			const dlcs = apiData.dlc ? apiData.dlc.map((item) => parseInt(item)) : [];
			const subs = apiData.packages ? apiData.packages.map((item) => parseInt(item)) : [];
			const bundles = [];
			if (isStoreResponseOk && !removed) {
				const elements = storeResponse.html.querySelectorAll('[data-ds-bundleid]');
				for (const element of elements) {
					bundles.push(parseInt(element.dataset.dsBundleid));
				}
			}
			await Pool.beginTransaction(connection);
			try {
				const columns = Object.keys(app);
				const values = Object.values(app);
				await Pool.query(
					connection,
					`
						INSERT INTO games__app (${columns.join(', ')})
						VALUES (${values.map((value) => connection.escape(value)).join(', ')})
						ON DUPLICATE KEY UPDATE ${columns.map((column) => `${column} = VALUES(${column})`).join(', ')}
					`
				);
				await Pool.query(
					connection,
					`
						INSERT IGNORE INTO games__app_name (app_id, name)
						VALUES (${connection.escape(appId)}, ${connection.escape(apiData.name)})
					`
				);
				if (genres.length > 0) {
					await Pool.query(
						connection,
						`
							INSERT IGNORE INTO games__genre (genre_id, name)
							VALUES ${genres
								.map(
									(genre) => `(${connection.escape(genre.id)}, ${connection.escape(genre.name)})`
								)
								.join(', ')}
						`
					);
					await Pool.query(
						connection,
						`
							INSERT IGNORE INTO games__app_genre (app_id, genre_id)
							VALUES ${genres
								.map((genre) => `(${connection.escape(appId)}, ${connection.escape(genre.id)})`)
								.join(', ')}
						`
					);
				}
				if (tags.length > 0) {
					await Pool.query(
						connection,
						`
							INSERT IGNORE INTO games__tag (tag_id, name)
							VALUES ${tags
								.map((tag) => `(${connection.escape(tag.id)}, ${connection.escape(tag.name)})`)
								.join(', ')}
						`
					);
					await Pool.query(
						connection,
						`
							INSERT IGNORE INTO games__app_tag (app_id, tag_id)
							VALUES ${tags
								.map((tag) => `(${connection.escape(appId)}, ${connection.escape(tag.id)})`)
								.join(', ')}
						`
					);
				}
				if (base || dlcs.length > 0) {
					await Pool.query(
						connection,
						`
							INSERT IGNORE INTO games__dlc (dlc_id, app_id)
							VALUES ${
								base
									? `(${connection.escape(appId)}, ${connection.escape(base)})`
									: dlcs
											.map((dlcId) => `(${connection.escape(dlcId)}, ${connection.escape(appId)})`)
											.join(', ')
							}
						`
					);
				}
				if (subs.length > 0) {
					await Pool.query(
						connection,
						`
							INSERT IGNORE INTO games__sub_app (sub_id, app_id)
							VALUES ${subs
								.map((subId) => `(${connection.escape(subId)}, ${connection.escape(appId)})`)
								.join(', ')}
						`
					);
				}
				if (bundles.length > 0) {
					await Pool.query(
						connection,
						`
							INSERT IGNORE INTO games__bundle_app (bundle_id, app_id)
							VALUES ${bundles
								.map((bundleId) => `(${connection.escape(bundleId)}, ${connection.escape(appId)})`)
								.join(', ')}
						`
					);
				}
				await Pool.commit(connection);
			} catch (err) {
				await Pool.rollback(connection);
				throw err;
			}
		} else {
			await Pool.beginTransaction(connection);
			try {
				await Pool.query(
					connection,
					`
						INSERT INTO games__app (app_id, removed, last_update, queued_for_update)
						VALUES (${appId}, TRUE, ${connection.escape(Math.trunc(Date.now() / 1e3))}, FALSE)
						ON DUPLICATE KEY UPDATE removed = VALUES(removed), last_update = VALUES(last_update), queued_for_update = VALUES(queued_for_update)
					`
				);
				await Pool.commit(connection);
			} catch (err) {
				await Pool.rollback(connection);
				throw err;
			}
		}
	}
}

module.exports = App;
