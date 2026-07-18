const { JsonDatabase } = require("wio.db")
const dbc = new JsonDatabase({ databasePath: "./json/botconfig.json"})
module.exports = {
	// PRODUÇÃO = false
	// HOMOLOGAÇÃO = true
	sandbox: false,
	validateMtls: false,
	client_id: dbc.get(`esales.secret_id`),
	client_secret: dbc.get(`esales.secret_token`),
	certificate: `./schema/${dbc.get(`esales.certificado`) ? dbc.get(`esales.certificado`) : "undefinied"}.p12`,
}