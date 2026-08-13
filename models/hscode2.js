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
    category: {
        type: String,
    },
});

hscode2Schema.index({ HSCode: 1 });
hscode2Schema.index({ Heading: 1 });

module.exports = mongoose.model("hscode2", hscode2Schema);