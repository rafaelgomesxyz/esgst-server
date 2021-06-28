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

module.exports = routes;
