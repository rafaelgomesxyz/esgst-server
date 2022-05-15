const { Router } = require('express');
const InfoTimestamps = require('./info/Timestamps');
const Game = require('./games/Game');
const Games = require('./games/Games');
const SgIds = require('./games/SgIds');
const Rcv = require('./games/Rcv');
const Ncv = require('./games/Ncv');
const Uh = require('./users/Uh');
const SettingsStats = require('./settings/Stats');

const routes = Router();

routes.get('/api/info/timestamps', InfoTimestamps.get);
routes.get('/api/game/:type/:id', Game.get);
routes.get('/api/games', Games.get);
routes.get('/api/games/sgids', SgIds.get);
routes.get('/api/games/rcv', Rcv.get);
routes.get('/api/games/ncv', Ncv.get);
routes.get('/api/user/\\+:steamid/uh', Uh.get);
routes.get('/api/users/uh', Uh.get);
routes.get('/api/settings/stats', SettingsStats.get);
routes.post('/api/settings/stats', SettingsStats.post);
routes.get('/esgst/info/timestamps', InfoTimestamps.get);
routes.get('/esgst/game/:type/:id', Game.get);
routes.get('/esgst/games', Games.get);
routes.get('/esgst/games/sgids', SgIds.get);
routes.get('/esgst/games/rcv', Rcv.get);
routes.get('/esgst/games/ncv', Ncv.get);
routes.get('/esgst/user/\\+:steamid/uh', Uh.get);
routes.get('/esgst/users/uh', Uh.get);
routes.get('/esgst/settings/stats', SettingsStats.get);
routes.post('/esgst/settings/stats', SettingsStats.post);

routes.get(/\/api\/((?!docs).)*/, (req, res) => {
	res.redirect('/api/docs');
});
routes.get('/esgst/*', (req, res) => {
	res.redirect('/api/docs');
});

module.exports = routes;
