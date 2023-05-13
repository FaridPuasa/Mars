const mongoose = require("mongoose");

const port_codeSchema = new mongoose.Schema({

    country: {
        type: String,
    },
    port_code: {
        type: String,
    },
});

module.exports = mongoose.model("port_code", port_codeSchema);