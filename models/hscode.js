const mongoose = require("mongoose");

const hscodeSchema = new mongoose.Schema({

    heading: {
        type: String,
    },
    description: {
        name: {
            type:String
        },
        category: {
            cat1: {
                type:String
            },
            cat2: {
                type:String
            },
            cat3: {
                type:String
            },
            cat4: {
                type:String
            },
        },
        hscodeentry: {
            type: String
        },
        unitOfQuantity: {
            type: String
        },
        rateOfImportDuty: {
            type: String
        },
        rateOfExciseDuty: {
            type: String
        },
    },
});


module.exports = mongoose.model("hscode", hscodeSchema);