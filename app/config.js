const config = {
	connection: {
		host: process.env.DB_HOST,
		port: process.env.DB_PORT,
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME,
	},
	secrets: {
		secret: process.env.SECRET,
		sgToolsApiKey: process.env.SGTOOLS_APIKEY,
		steamApiKey: process.env.STEAM_APIKEY,
	},
};

module.exports = config;
