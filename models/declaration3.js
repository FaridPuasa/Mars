const mongoose = require("mongoose");

const declaration3Schema = new mongoose.Schema({

    dateGranted: {
        type: String,
    },

    departureDate: {
        type: String,
    },

    cept: {
        type: String,
    },

    Procedure: {

    /* Header Details */

        customsProcedure: {
            type: String,
        },
        customsProcedureCode: {
            type: String,
        },
        prevProcedure: {
            type: String,
        },
        prevProcedureCode: {
            type: String,
        },
        dutiableIndicator: {
            type: String,
        },
        dutiableIndicatorCode: {
            type: String,
        },
        clearanceStation: {
            type: String,
        },
        clearanceStationCode: {
            type: String,
        },
    },

    Exporter: {

        exporterName: {
        type: String,
        },
        exporterAddress: {
        type: String,
        },
        exporterRegistration: {
        type: String,
        },
        exporterCountry: {
        type: String,
        },
        exporterPhone: {
            type: String,
        },
        exporterPostal: {
            type: String,
        },
        exporterTransport: {
            type: String,
        },
    },

    Importer: {

        importerType: {
            type: String,
        },
        importerName: {
            type: String,
        },
        importerAddress: {
            type: String,
        },
        regTraderCoyRegNo: {
            type: String,
        },
        importerRegistration: {
            type: String,
        },
        importerICColor: {
            type: String,
        },
        importerPhone: {
            type: String,
        },
        importerPostal: {
            type: String,
        },
    },

    Agent: {

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
        agentPostal: {
            type: String,
        },
    },


    Transport: {
        arrivalDate: {
            type: String,
        },
        containerNo: {
            type: String,
        },
        vesselNo: {
            type: String,
        },
        vesselName: {
            type: String,
        },
        bldoawb: {
            type: String,
        },
        hbhawb: {
            type: String,
        },
        countryShipment: {
            type: String,
        },
        countryShipmentCode: {
            type: String,
        },
        countryDestination: {
            type: String,
        },
        countryDestinationCode: {
            type: String,
        },
        portOfEntry: {
            type: String,
        },
        portOfEntryCode: {
            type: String,
        },
        portOfDischarge: {
            type: String,
        },
        portOfDischargeCode: {
            type: String,
        },
        placeRelease: {
            type: String,
        },
        placeReleaseCode: {
            type: String,
        },
        placeReceipt: {
            type: String,
        },
        placeReceiptCode: {
            type: String,
        },
    },

    SupportingDocuments: {

        exchangeCurrency: {
            type: String,
        },
        exchangeRate: {
            type: String,
        },
        prevDeclarationNo: {
            type: String,
        },
        dutyExem: {
            type: String,
        },
        portOfExit: {
            type: String,
        },
        portOfExitCode: {
            type: String,
        },
    },

    TemporaryImport: {

        typeOfApplication: {
            type: String,
        },
        grantedPeriod: {
            type: String,
        },
        estDateOfExport: {
            type: String,
        },
        placeExport: {
            type: String,
        },
        projectName: {
            type: String,
        },
        projectDateFrom: {
            type: String,
        },
        projectDateTo: {
            type: String,
        },

    },
    
    Transit: {

        modeTransport: {
            type: String,
        },
        meanTransport: {
            type: String,
        },
        officeDeptFirst: {
            type: String,
        },
        officeDeptFirstCode: {
            type: String,
        },
        officeDeptLast: {
            type: String,
        },
        officeDeptLastCode: {
            type: String,
        },
        officeDeptSecond: {
            type: String,
        },
        officeDeptSecondCode: {
            type: String,
        },
        officeDeptThird: {
            type: String,
        },
        officeDeptThirdCode: {
            type: String,
        },

    },

    SecurityDeposit: {

        depositType: {
            type: String,
        },
        depositAmount: {
            type: Number,
        },
        bankGuaranteeAmount: {
            type: Number,
        },
        bankGuaranteeNo: {
            type: String,
        },
        bankName: {
            type: String,
        },
        bankCode: {
            type: String,
        },

    },

    DeclarationGoods: {

        totalGrossWeight: {
            type: Number,
        },
        grossWeightUnit: {
            type: String,
        },
        totalPackagesNo: {
            type: Number,
        },
        packageNoUnit: {
            type: String,
        },
        totalInvoiceAmount: {
            type: Number,
        },
        invoiceCurrency: {
            type: String,
        },
        invoiceRate: {
            type: Number,
        },
        invoiceInsuranceType: {
            type: String,
        },
        insuranceAmount: {
            type: Number,
        },
        insuranceCurrency: {
            type: String,
        },
        insuranceRate: {
            type: Number,
        },
        freightType: {
            type: String,
        },
        freightCharge: {
            type: Number,
        },
        freightCurrency: {
            type: String,
        },
        freightRate: {
            type: Number,
        },
        otherCharges: {
            type: Number,
        },
        otherChargesType: {
            type: String,
        },

    },

    Declarant: {

        declarantName: {
            type: String,
        },
        declarantID: {
            type: String,
        },
        declarantICNo: {
            type: String,
        },
        declarantICColor: {
            type: String,
        },
        declarantDesignation: {
            type: String,
        },

    },

    declarationDate: {
        type: String,
    },

    shippingMark: {
        type: String,
    },

    postedBy: {
        type: String,
    },

    Invoice: [
        {
        invoiceNo: {
            type: String,
        },
        invoiceDate: {
            type: String,
        },
        invoiceTerm: {
            type: String,
        },
        invoiceCCY: {
            type: String,
        },
        invoiceAmount: {
            type: Number,
        },
        invoiceFreightCCY: {
            type: String,
        },
        invoiceFreightAmount: {
            type: Number,
        },
        invoiceInsuranceCCY: {
            type: String,
        },
        invoiceInsuranceAmount: {
            type: Number,
        },
        invoiceOtherCharges: {
            type: Number,
        },
    }],
    Goods: [
        {
            goodsSerialNo: {
                type: Number,
            },
            goodsPackageNo: {
                type: Number,
            },
            goodsPackageUnit: {
                type: String,
            },
            countryOrigin: {
                type: String,
            },
            countryCode: {
                type: String,
            },
            hsCode: {
                type: String,
            },
            subCode: {
                type: String,
            },
            goodsDescription: {
                type: String,
            },
            goodsC: {
                type: String,
            },
            goodsUnit: {
                type: String,
            },
            goodsCode: {
                type: String,
            },
            goodsQuantity: {
                type: Number,
            },
            goodsWeight: {
                type: Number,
            },
            goodsAmount: {
                type: Number,
            },
            goodsCIF: {
                type: String,
            },
            goodsDuty: {
                type: String,
            },
            goodsDutyAmount: {
                type: Number,
            },
            goodsLNo: {
                type: String,
            },
            goodsShippingMark: {
                type: String,
            },
            goodsContainerNo: {
                type: String,
            },
            goodsInvoiceNo: {
                type: String,
            },
            goodsControl: {
                type: String,
            },
            goodsImportDuty: {
                type: String,
            },
            goodsExciseDuty: {
                type: String,
        }
    }],
});

module.exports = mongoose.model("declaration3", declaration3Schema);