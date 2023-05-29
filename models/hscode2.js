const mongoose = require("mongoose");

const hscode2Schema = new mongoose.Schema({

    Heading: {
        type: String,
    },
    HSCode: {
        type: String,
    },
    Description: {
        type: String,
    },
    Quantity: {
        type: String,
    },
    ImportDutyRate: {
        type: String,
    },
    ExciseDutyRate: {
        type: String,
    },
});


module.exports = mongoose.model("hscode2", hscode2Schema);