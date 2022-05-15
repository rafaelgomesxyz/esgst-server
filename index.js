require('dotenv').config();

const cors = require('cors');
const express = require('express');
const routes = require('./app/routes');

const app = express();
const port = process.env.PORT || 8000;

app.enable('trust proxy');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(routes);

app.listen(port, () => {
	console.log(`Server started on port ${port}...`);
});
