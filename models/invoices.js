const mongoose = require("mongoose");

const invoicesSchema = new mongoose.Schema({

    invoicesDate: {
        type: String,
    },
    invoiceNumber: {
        type: String,
    },
    invoiceDate: {
        type: String,
    },
    termType: {
        type: String,
    },
    invoiceAmount: {
        type: Number,
    },
    invoiceCurrency: {
      type: String,
    },
    freightAmount: {
      type: Number,
    },
    freightCurrency: {
      type: String,
    },
    insuranceAmount: {
      type: Number,
    },
    insuranceCurrency: {
        type: String,
    },
    otherAmount: {
        type: Number,
    },
    otherAmountCurrency: {
        type: String,
    }
});

module.exports = mongoose.model("invoices", invoicesSchema);