const { compose } = require('compose-middleware');
const { Router } = require('express');
const mySqlSession = require('express-mysql-session');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam');
const Pool = require('../class/Connection');
const Auth = require('./auth/Auth');
const Game = require('./games/Game');
const Games = require('./games/Games');
const SgIds = require('./games/SgIds');
const Rcv = require('./games/Rcv');
const Ncv = require('./games/Ncv');
const Uh = require('./users/Uh');
const Ust = require('./users/Ust');
const SettingsStats = require('./settings/Stats');
const config = require('../config');

const MySqlStore = mySqlSession(session);

passport.use(
	new SteamStrategy(
		{
			apiKey: config.secrets.steamApiKey,
			realm: 'https://rafaelgssa.com/',
			returnURL: 'https://rafaelgssa.com/esgst/login/return',
		},
		Auth.auth
	)
);

passport.serializeUser((user, done) => {
	done(null, user.steamId);
});

passport.deserializeUser(async (steamId, done) => {
	try {
		const user = await Auth.getUser({ id: steamId });
		done(null, user);
	} catch (err) {
		done(err);
	}
});

const routes = Router();

routes.get('/esgst/login', handleSession.bind(null, 'origin_steam', {}, []));
routes.get('/esgst/login/return', handleSession.bind(null, 'steam', {}, [Auth.login]));
routes.get('/esgst/me', handleSession.bind(null, 'normal', {}, [Auth.getLoggedInUser]));
routes.get('/esgst/logout', handleSession.bind(null, 'origin', {}, [Auth.logout]));
routes.get('/esgst/game/:type/:id', Game.get);
routes.get('/esgst/games', Games.get);
routes.get('/esgst/games/sgids', SgIds.get);
routes.get('/esgst/games/rcv', Rcv.get);
routes.get('/esgst/games/ncv', Ncv.get);
routes.get('/esgst/user/\\+:steamid/uh', Uh.get);
routes.get('/esgst/users/uh', Uh.get);
routes.get('/esgst/users/ust', Ust.get);
routes.post('/esgst/users/ust', Ust.post);
routes.get(
	'/esgst/users/ust/ticket',
	handleSession.bind(null, 'auth', { minRole: 2 }, [Ust.getTicket])
);
routes.post(
	'/esgst/users/ust/ticket',
	handleSession.bind(null, 'auth', { minRole: 2 }, [Ust.postTicket])
);
routes.get('/esgst/settings/stats', SettingsStats.get);
routes.post('/esgst/settings/stats', SettingsStats.post);

async function handleSession(type, options, nextMiddlewares, req, res, next) {
	const connection = await Pool.getConnection();
	const sessionStore = new MySqlStore({}, connection);
	const sessionInitializers = [
		session({
			key: 'SESSID',
			secret: config.secrets.secret,
			store: sessionStore,
			resave: false,
			saveUninitialized: false,
			cookie: {
				path: '/',
				httpOnly: true,
				secure: false,
				maxAge: 604800000,
			},
		}),
		passport.initialize(),
		passport.session(),
	];

	let middlewares = [];
	switch (type) {
		case 'normal':
			middlewares = sessionInitializers;
			break;
		case 'origin':
			middlewares = [...sessionInitializers, saveOrigin];
			break;
		case 'steam':
			middlewares = [...sessionInitializers, passport.authenticate('steam')];
			break;
		case 'origin_steam':
			middlewares = [...sessionInitializers, saveOrigin, passport.authenticate('steam')];
			break;
		case 'auth':
			middlewares = [...sessionInitializers, checkAuth(connection, options.minRole)];
			break;
	}
	middlewares.push(releaseConnection(connection));
	middlewares.push(...nextMiddlewares);

	const composedMiddleware = compose(middlewares);
	composedMiddleware(req, res, next);
}

function saveOrigin(req, res, next) {
	req.session.origin = req.query.origin;
	next();
}

function checkAuth(connection, minRole) {
	return (req, res, next) => {
		if (req.isAuthenticated() && (!minRole || (req.user && req.user.role <= minRole))) {
			next();
		} else {
			if (connection) {
				connection.release();
			}
			res.status(401).json(null);
		}
	};
}

function releaseConnection(connection) {
	return (req, res, next) => {
		if (connection) {
			connection.release();
		}
		next();
	};
}

module.exports = routes;
