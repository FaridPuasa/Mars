const mongoose = require("mongoose");

const unlocode_port_list2Schema = new mongoose.Schema({

    Country: {
        type: String,
    },
    Location: {
        type: String,
    },
    Name: {
        type: String,
    },
});

module.exports = mongoose.model("unlocode_port_list2", unlocode_port_list2Schema);