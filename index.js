const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const routes = require('./app/esgst/routes');

const app = express();
const port = process.env.PORT || 3000;

app.enable('trust proxy');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());
app.use((req, res, next) => {
	if (req.secure || req.hostname === 'localhost') {
		next();
	} else {
		res.redirect(`https://${req.hostname}${req.originalUrl}`);
	}
});
app.use(routes);

app.listen(port, () => {
	console.log(`Server started on port ${port}...`);
});
