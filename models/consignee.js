const mongoose = require("mongoose");

const consigneeSchema = new mongoose.Schema({

    name: {
        type: String,
    },
    address: {
        type: String,
    },
    reg: {
        type: String,
    },
    ic: {
        type: String,
    },
    icColor: {
        type: String,
    },
    telephone: {
        type: String,
    },
    postal: {
        type: String,
    },
});

module.exports = mongoose.model("consignee", consigneeSchema);