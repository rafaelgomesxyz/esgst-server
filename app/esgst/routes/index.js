const { Router } = require('express');
const mySqlSession = require('express-mysql-session');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam');
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
const sessionStore = new MySqlStore({ ...config.connection });
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

routes.get('/esgst/login', ...sessionWithOriginSteam());
routes.get('/esgst/login/return', ...sessionWithSteam(), Auth.login);
routes.get('/esgst/me', ...normalSession(), Auth.getLoggedInUser);
routes.get('/esgst/logout', ...sessionWithOrigin(), Auth.logout);
routes.get('/esgst/game/:type/:id', Game.get);
routes.get('/esgst/games', Games.get);
routes.get('/esgst/games/sgids', SgIds.get);
routes.get('/esgst/games/rcv', Rcv.get);
routes.get('/esgst/games/ncv', Ncv.get);
routes.post('/esgst/games/ncv', Ncv.post);
routes.get('/esgst/user/\\+:steamid/uh', Uh.get);
routes.get('/esgst/users/uh', Uh.get);
routes.get('/esgst/users/ust', Ust.get);
routes.post('/esgst/users/ust', Ust.post);
routes.get('/esgst/users/ust/ticket', ...sessionWithAuth(2), Ust.getTicket);
routes.post('/esgst/users/ust/ticket', ...sessionWithAuth(2), Ust.postTicket);
routes.get('/esgst/settings/stats', SettingsStats.get);
routes.post('/esgst/settings/stats', SettingsStats.post);

function normalSession() {
	return sessionInitializers;
}

function steamSession() {
	return [passport.authenticate('steam')];
}

function sessionWithOrigin() {
	return [...normalSession(), saveOrigin];
}

function sessionWithSteam() {
	return [...normalSession(), ...steamSession()];
}

function sessionWithOriginSteam() {
	return [...sessionWithOrigin(), ...steamSession()];
}

function sessionWithAuth(minRole) {
	return [...normalSession(), checkAuth(minRole)];
}

function saveOrigin(req, res, next) {
	req.session.origin = req.query.origin;
	next();
}

function checkAuth(minRole) {
	return (req, res, next) => {
		if (req.isAuthenticated() && (!minRole || (req.user && req.user.role <= minRole))) {
			next();
		} else {
			res.status(401).json(null);
		}
	};
}

module.exports = routes;
