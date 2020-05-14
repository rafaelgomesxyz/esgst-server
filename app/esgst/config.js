const config = {
	connection: {
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME,
	},
	secrets: {
		sgPhpSessId: process.env.SG_PHPSESSID,
		sgToolsApiKey: process.env.SGTOOLS_APIKEY,
	},
};

module.exports = config;