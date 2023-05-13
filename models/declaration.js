const mongoose = require("mongoose");

const declarationSchema = new mongoose.Schema({

    declarationDate: {
        type: Date,
    },

    /* Header Details */

    declarationType: {
        type: String,
    },
    customsProcedure: {
        type: String,
    },
    dutiableIndicator: {
        type: String,
    },
    transportMode: {
        type: String,
    },
    countryShipment: {
      type: String,
    },
    countryDestination: {
      type: String,
    },
    portDischarge: {
      type: String,
    },
    portEntry: {
      type: String,
    },
    clearanceStationCode: {
        type: String,
    },
    remarks: {
        type: String,
    },

    /* Party Details */

    traderType: {
        type: String,
    },
    regTraderCoyRegNo: {
        type: String,
    },
    individualTraderICNo: {
        type: String,
    },
    individualTraderIDType: {
        type: String,
    },
    individualTraderICColour: {
        type: String,
    },
    individualAddress: {
        type: String,
    },
    traderName: {
        type: String,
    },
    consigneeCompanyRegNo: {
        type: String,
    },
    consigneeName: {
        type: String,
    },
    dutyExemptIndicator: {
        type: String,
    },
    ceptSchemeIndicator: {
        type: String,
    },
    /* Bill of Lading details */

    masterBillNo: {
        type: String,
    },
    vesselFlightVehicleNo: {
        type: String,
    },
    vesselName: {
        type: String,
    },
    vesselFlightArrivalDate: {
        type: Date,
    },
    containerTransportIndicator: {
        type: String,
    },
    totalGrossWeight: {
        type: String,
    },
    totalGrossWeightUnit: {
        type: String,
    },
    totalNoPackages: {
        type: Number,
    },
    totalNoPackagesUnit: {
        type: String,
    },

    /* Transit details */

    /* Guarantee details */

    bgAmount: {
        type: Number,
    }
});

module.exports = mongoose.model("declaration", declarationSchema);