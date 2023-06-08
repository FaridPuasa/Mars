const mongoose = require("mongoose");

const iso_countrycodesSchema = new mongoose.Schema({

    name: {
        type: String,
    },
    alpha2: {
        type: String,
    },
    alpha_3: {
        type: String,
    },
    countrycode: {
        type: String,
    },
    iso_3166_2: {
        type: String,
    },
    region: {
      type: String,
    },
    sub_region: {
      type: String,
    },
    intermediate_region: {
      type: String,
    },
    region_code: {
      type: String,
    },
    sub_region_code: {
        type: String,
    },
    intermediate_region_code: {
        type: Number,
    }
});

module.exports = mongoose.model("iso_countrycodes", iso_countrycodesSchema);