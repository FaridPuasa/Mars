const mongoose = require("mongoose");

const bdnswSchema = new mongoose.Schema(
  {
    date: {
        type: Date,
    },
    customsProcedure: {
        type: String,
    },
    somethingProcedure: {
        type: String,
    },
    transportProcedure: {
        type: String,
    },
    clearanceProcedure: {
        type: String,
    },
    exporterName: {
        type: String,
    },
    exporterAddress: {
        type: String,
    },
    exporterRegistration: {
        type: String,
    },
    exporterPhone: {
        type: String,
    },
    exporterSomething: {
        type: String,
    },
    importerName: {
        type: String,
    },
    importerAddress: {
        type: String,
    },
    importerRegistration: {
        type: String,
    },
    importerPhone: {
        type: String,
    },
    importerSomething: {
        type: String,
    },
    agentName: {
        type: String,
    },
    agentAddress: {
        type: String,
    },
    agentRegistration: {
        type: String,
    },
    agentPhone: {
        type: String,
    },
    agentPost: {
        type: String,
    },
    arrivalDate: {
        type: String,
    },
    something21: {
        type: String,
    },
    vesselNum: {
        type: String,
    },
    vesselName: {
        type: String,
    },
    billType: {
        type: String,
    },
    houseBill: {
        type: String,
    },
    transitCountry: {
        type: String,
    },
    destinationCountry: {
        type: String,
    },
    entryPort: {
        type: String,
    },
    dischargePort: {
        type: String,
    },
    something30: {
        type: String,
    },
    exitPort: {
        type: String,
    },
    exchangeRate: {
        type: String,
    },
    currencyFrom: {
        type: String,
    },
    currencyTo: {
        type: String,
    },
    CheeseString: {
        type: String,
    },
    BillNyeSaysHi: {
        type: String,
    },
});

module.exports = mongoose.model("Bdnsw", bdnswSchema);