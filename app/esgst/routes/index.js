const { Router } = require('express');
const Game = require('./games/Game');
const Games = require('./games/Games');
const SgIds = require('./games/SgIds');
const Rcv = require('./games/Rcv');
const Ncv = require('./games/Ncv');
const Uh = require('./users/Uh');
const Ust = require('./users/Ust');
const SettingsStats = require('./settings/Stats');

const routes = Router();

routes.get('/esgst/game/:type/:id', Game.get);
routes.get('/esgst/games', Games.get);
routes.get('/esgst/games/sgids', SgIds.get);
routes.get('/esgst/games/rcv', Rcv.get);
routes.get('/esgst/games/ncv', Ncv.get);
routes.post('/esgst/games/ncv', Ncv.post);
routes.get('/esgst/user/\\+:steamid/uh', Uh.get);
routes.get('/esgst/users/uh', Uh.get);
routes.get('/esgst/users/ust', Ust.get);
routes.get('/esgst/settings/stats', SettingsStats.get);
routes.post('/esgst/settings/stats', SettingsStats.post);

module.exports = routes;
