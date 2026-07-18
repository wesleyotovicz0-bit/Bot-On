const { JsonDatabase } = require("wio.db")
const dbc = new JsonDatabase({ databasePath: "./json/botconfig.json"})
module.exports = {
	// PRODUÇÃO = false
	// HOMOLOGAÇÃO = true
	sandbox: false,
	validateMtls: false,
	client_id: dbc.get(`pagamentos.secret_id`),
	client_secret: dbc.get(`pagamentos.secret_token`),
	certificate: `./Lib/${dbc.get(`pagamentos.certificado`) ? dbc.get(`pagamentos.certificado`) : "undefinied"}.p12`,
}