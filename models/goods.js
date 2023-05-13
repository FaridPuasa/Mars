const mongoose = require("mongoose");

const goodsSchema = new mongoose.Schema({

    date: {
        type: Date,
    },
    goodsSerialNo: {
        type: Number,
    },
    goodsDescription: {
        type: String,
    },
    goodsHSCode: {
        type: String,
    },
    shippingMarks: {
        type: String,
    },
    countryOrigin: {
      type: String,
    },
    quantity: {
      type: Number,
    },
    quantityUOM: {
      type: String,
    },
    noPackages: {
      type: Number,
    },
    noPackagesUnit: {
        type: String,
    },
    invoiceNo: {
        type: String,
    },
    invoiceAmount: {
        type: Number,
    },
    goodsGrossWeight: {
        type: Number,
    },
    goodsGrossWeightUnit: {
        type: String,
    },
    permitDetails: {
        permitApplicationType: {
            type: String
        },
        permitNo: {
            type: String
        },
        permitExpiryDate: {
            type: String,
        },
        permitIssuedBy: {
            type: String,
        },
    },
});

module.exports = mongoose.model("goods", goodsSchema);