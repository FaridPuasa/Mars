// Postgres-backed DAL for MarsDeclaration + its 3 child tables
// (Invoice/Goods/Containers), replacing every Declaration3 Mongoose query
// in index.js. See postgresMars.js's header for the full migration
// context. This file's job is narrower but more important: every read
// reconstructs the EXACT nested object shape the old Mongo document had
// (declaration.Transport.vesselName, declaration.Goods[i].hsCode, etc.) so
// the large XML-generation and list-rendering code in index.js needed
// zero changes - only the query calls themselves were swapped.
const crypto = require('crypto');
const prisma = require('./prismaClient');

function generateMongoIdShape() {
    return crypto.randomBytes(12).toString('hex');
}

function n(v) {
    if (v === undefined || v === null || v === '') return null;
    const num = Number(v);
    return Number.isNaN(num) ? null : num;
}

const CHILD_INCLUDE = {
    invoices: { orderBy: { id: 'asc' } },
    goodsLines: { orderBy: { id: 'asc' } },
    containers: { orderBy: { id: 'asc' } },
};

function toApiInvoice(row) {
    return {
        _id: row.mongoId,
        invoiceNo: row.invoiceNo,
        invoiceDate: row.invoiceDate,
        invoiceTerm: row.invoiceTerm,
        invoiceCCY: row.invoiceCCY,
        invoiceAmount: row.invoiceAmount,
        invoiceFreightCCY: row.invoiceFreightCCY,
        invoiceFreightAmount: row.invoiceFreightAmount,
        invoiceInsuranceCCY: row.invoiceInsuranceCCY,
        invoiceInsuranceAmount: row.invoiceInsuranceAmount,
        invoiceOtherCharges: row.invoiceOtherCharges,
    };
}

function toApiGoodsLine(row) {
    return {
        _id: row.mongoId,
        goodsSerialNo: row.goodsSerialNo == null ? null : Number(row.goodsSerialNo),
        goodsPackageNo: row.goodsPackageNo == null ? null : Number(row.goodsPackageNo),
        goodsPackageUnit: row.goodsPackageUnit,
        countryOrigin: row.countryOrigin,
        countryCode: row.countryCode,
        hsCode: row.hsCode,
        subCode: row.subCode,
        goodsDescription: row.goodsDescription,
        goodsC: row.goodsC,
        goodsUnit: row.goodsUnit,
        goodsCode: row.goodsCode,
        goodsQuantity: row.goodsQuantity == null ? null : Number(row.goodsQuantity),
        goodsWeight: row.goodsWeight == null ? null : Number(row.goodsWeight),
        goodsAmount: row.goodsAmount == null ? null : Number(row.goodsAmount),
        goodsCIF: row.goodsCIF,
        goodsDuty: row.goodsDuty,
        goodsDutyAmount: row.goodsDutyAmount == null ? null : Number(row.goodsDutyAmount),
        goodsLNo: row.goodsLNo,
        goodsShippingMark: row.goodsShippingMark,
        goodsContainerNo: row.goodsContainerNo,
        goodsInvoiceNo: row.goodsInvoiceNo,
        goodsControl: row.goodsControl,
        goodsImportDuty: row.goodsImportDuty,
        goodsExciseDuty: row.goodsExciseDuty,
        permitApplicationType: row.permitApplicationType,
        permitNo: row.permitNo,
        permitExpiryDate: row.permitExpiryDate,
        permitIssuedBy: row.permitIssuedBy,
    };
}

function toApiContainer(row) {
    return {
        _id: row.mongoId,
        containerNumber: row.containerNumber,
        containerType: row.containerType,
        cargoStatus: row.cargoStatus,
        sealNumber: row.sealNumber,
        containerWeight: row.containerWeight == null ? null : Number(row.containerWeight),
        containerWeightUOM: row.containerWeightUOM,
    };
}

// Reconstructs the exact nested-document shape the Mongoose Declaration3
// model had - the inverse of toPgDeclarationFields() below.
function toApiDeclaration(row) {
    return {
        _id: row.mongoId,
        dateGranted: row.dateGranted,
        departureDate: row.departureDate,
        cept: row.cept,
        ceptFormNo: row.ceptFormNo,
        ceptDate: row.ceptDate,

        Procedure: {
            customsProcedure: row.customsProcedure,
            customsProcedureCode: row.customsProcedureCode,
            prevProcedure: row.prevProcedure,
            prevProcedureCode: row.prevProcedureCode,
            dutiableIndicator: row.dutiableIndicator,
            dutiableIndicatorCode: row.dutiableIndicatorCode,
            clearanceStation: row.clearanceStation,
            clearanceStationCode: row.clearanceStationCode,
        },

        Exporter: {
            exporterName: row.exporterName,
            exporterAddress: row.exporterAddress,
            exporterRegistration: row.exporterRegistration,
            exporterCountry: row.exporterCountry,
            exporterPhone: row.exporterPhone,
            exporterPostal: row.exporterPostal,
            exporterTransport: row.exporterTransport,
        },

        Importer: {
            importerType: row.importerType,
            importerName: row.importerName,
            importerAddress: row.importerAddress,
            regTraderCoyRegNo: row.regTraderCoyRegNo,
            importerRegistration: row.importerRegistration,
            importerICColor: row.importerICColor,
            importerPhone: row.importerPhone,
            importerPostal: row.importerPostal,
        },

        Agent: {
            agentName: row.agentName,
            agentAddress: row.agentAddress,
            agentRegistration: row.agentRegistration,
            agentPhone: row.agentPhone,
            agentPostal: row.agentPostal,
        },

        Transport: {
            arrivalDate: row.arrivalDate,
            containerNo: row.containerNo,
            vesselNo: row.vesselNo,
            vesselName: row.vesselName,
            bldoawb: row.bldoawb,
            hbhawb: row.hbhawb,
            countryShipment: row.countryShipment,
            countryShipmentCode: row.countryShipmentCode,
            countryDestination: row.countryDestination,
            countryDestinationCode: row.countryDestinationCode,
            portOfEntry: row.portOfEntry,
            portOfEntryCode: row.portOfEntryCode,
            portOfDischarge: row.portOfDischarge,
            portOfDischargeCode: row.portOfDischargeCode,
            placeRelease: row.placeRelease,
            placeReleaseCode: row.placeReleaseCode,
            placeReceipt: row.placeReceipt,
            placeReceiptCode: row.placeReceiptCode,
        },

        SupportingDocuments: {
            exchangeCurrency: row.exchangeCurrency,
            exchangeRate: row.exchangeRate,
            prevDeclarationNo: row.prevDeclarationNo,
            dutyExem: row.dutyExem,
            portOfExit: row.portOfExit,
            portOfExitCode: row.portOfExitCode,
        },

        TemporaryImport: {
            typeOfApplication: row.typeOfApplication,
            grantedPeriod: row.grantedPeriod,
            estDateOfExport: row.estDateOfExport,
            placeExport: row.placeExport,
            projectName: row.projectName,
            projectDateFrom: row.projectDateFrom,
            projectDateTo: row.projectDateTo,
        },

        Transit: {
            modeTransport: row.modeTransport,
            meanTransport: row.meanTransport,
            officeDeptFirst: row.officeDeptFirst,
            officeDeptFirstCode: row.officeDeptFirstCode,
            officeDeptLast: row.officeDeptLast,
            officeDeptLastCode: row.officeDeptLastCode,
            officeDeptSecond: row.officeDeptSecond,
            officeDeptSecondCode: row.officeDeptSecondCode,
            officeDeptThird: row.officeDeptThird,
            officeDeptThirdCode: row.officeDeptThirdCode,
        },

        SecurityDeposit: {
            depositType: row.depositType,
            depositAmount: row.depositAmount == null ? null : Number(row.depositAmount),
            bankGuaranteeAmount: row.bankGuaranteeAmount == null ? null : Number(row.bankGuaranteeAmount),
            bankGuaranteeNo: row.bankGuaranteeNo,
            bankName: row.bankName,
            bankCode: row.bankCode,
        },

        DeclarationGoods: {
            totalGrossWeight: row.totalGrossWeight == null ? null : Number(row.totalGrossWeight),
            grossWeightUnit: row.grossWeightUnit,
            totalPackagesNo: row.totalPackagesNo,
            packageNoUnit: row.packageNoUnit,
            totalInvoiceAmount: row.totalInvoiceAmount == null ? null : Number(row.totalInvoiceAmount),
            invoiceCurrency: row.invoiceCurrency,
            invoiceRate: row.invoiceRate == null ? null : Number(row.invoiceRate),
            invoiceInsuranceType: row.invoiceInsuranceType,
            insuranceAmount: row.insuranceAmount == null ? null : Number(row.insuranceAmount),
            insuranceCurrency: row.insuranceCurrency,
            insuranceRate: row.insuranceRate == null ? null : Number(row.insuranceRate),
            freightType: row.freightType,
            freightCharge: row.freightCharge == null ? null : Number(row.freightCharge),
            freightCurrency: row.freightCurrency,
            freightRate: row.freightRate == null ? null : Number(row.freightRate),
            otherCharges: row.otherCharges == null ? null : Number(row.otherCharges),
            otherChargesType: row.otherChargesType,
            remarks: row.remarks,
        },

        Declarant: {
            declarantName: row.declarantName,
            declarantID: row.declarantID,
            declarantICNo: row.declarantICNo,
            declarantICColor: row.declarantICColor,
            declarantDesignation: row.declarantDesignation,
        },

        declarationDate: row.declarationDate,
        shippingMark: row.shippingMark,
        postedBy: row.postedBy,

        Invoice: (row.invoices || []).map(toApiInvoice),
        Goods: (row.goodsLines || []).map(toApiGoodsLine),
        Containers: (row.containers || []).map(toApiContainer),
    };
}

// The inverse of toApiDeclaration() - flattens the nested object shape the
// index.js routes already build (unchanged from the old Mongoose-doc
// construction) into the Postgres MarsDeclaration row's columns. Adapted
// from dualWriteSync.js's declarationToPgData(), which took a saved
// Mongoose document; this takes the same plain nested object directly.
function toPgDeclarationFields(d) {
    const Procedure = d.Procedure || {};
    const Exporter = d.Exporter || {};
    const Importer = d.Importer || {};
    const Agent = d.Agent || {};
    const Transport = d.Transport || {};
    const SupportingDocuments = d.SupportingDocuments || {};
    const TemporaryImport = d.TemporaryImport || {};
    const Transit = d.Transit || {};
    const SecurityDeposit = d.SecurityDeposit || {};
    const DeclarationGoods = d.DeclarationGoods || {};
    const Declarant = d.Declarant || {};

    return {
        dateGranted: d.dateGranted ?? null,
        departureDate: d.departureDate ?? null,
        cept: d.cept ?? null,
        ceptFormNo: d.ceptFormNo ?? null,
        ceptDate: d.ceptDate ?? null,
        declarationDate: d.declarationDate ?? null,
        shippingMark: d.shippingMark ?? null,
        postedBy: d.postedBy ?? null,

        customsProcedure: Procedure.customsProcedure ?? null,
        customsProcedureCode: Procedure.customsProcedureCode ?? null,
        prevProcedure: Procedure.prevProcedure ?? null,
        prevProcedureCode: Procedure.prevProcedureCode ?? null,
        dutiableIndicator: Procedure.dutiableIndicator ?? null,
        dutiableIndicatorCode: Procedure.dutiableIndicatorCode ?? null,
        clearanceStation: Procedure.clearanceStation ?? null,
        clearanceStationCode: Procedure.clearanceStationCode ?? null,

        exporterName: Exporter.exporterName ?? null,
        exporterAddress: Exporter.exporterAddress ?? null,
        exporterRegistration: Exporter.exporterRegistration ?? null,
        exporterCountry: Exporter.exporterCountry ?? null,
        exporterPhone: Exporter.exporterPhone ?? null,
        exporterPostal: Exporter.exporterPostal ?? null,
        exporterTransport: Exporter.exporterTransport ?? null,

        importerType: Importer.importerType ?? null,
        importerName: Importer.importerName ?? null,
        importerAddress: Importer.importerAddress ?? null,
        regTraderCoyRegNo: Importer.regTraderCoyRegNo ?? null,
        importerRegistration: Importer.importerRegistration ?? null,
        importerICColor: Importer.importerICColor ?? null,
        importerPhone: Importer.importerPhone ?? null,
        importerPostal: Importer.importerPostal ?? null,

        agentName: Agent.agentName ?? null,
        agentAddress: Agent.agentAddress ?? null,
        agentRegistration: Agent.agentRegistration ?? null,
        agentPhone: Agent.agentPhone ?? null,
        agentPostal: Agent.agentPostal ?? null,

        arrivalDate: Transport.arrivalDate ?? null,
        containerNo: Transport.containerNo ?? null,
        vesselNo: Transport.vesselNo ?? null,
        vesselName: Transport.vesselName ?? null,
        bldoawb: Transport.bldoawb ?? null,
        hbhawb: Transport.hbhawb ?? null,
        countryShipment: Transport.countryShipment ?? null,
        countryShipmentCode: Transport.countryShipmentCode ?? null,
        countryDestination: Transport.countryDestination ?? null,
        countryDestinationCode: Transport.countryDestinationCode ?? null,
        portOfEntry: Transport.portOfEntry ?? null,
        portOfEntryCode: Transport.portOfEntryCode ?? null,
        portOfDischarge: Transport.portOfDischarge ?? null,
        portOfDischargeCode: Transport.portOfDischargeCode ?? null,
        placeRelease: Transport.placeRelease ?? null,
        placeReleaseCode: Transport.placeReleaseCode ?? null,
        placeReceipt: Transport.placeReceipt ?? null,
        placeReceiptCode: Transport.placeReceiptCode ?? null,

        exchangeCurrency: SupportingDocuments.exchangeCurrency ?? null,
        exchangeRate: SupportingDocuments.exchangeRate ?? null,
        prevDeclarationNo: SupportingDocuments.prevDeclarationNo ?? null,
        dutyExem: SupportingDocuments.dutyExem ?? null,
        portOfExit: SupportingDocuments.portOfExit ?? null,
        portOfExitCode: SupportingDocuments.portOfExitCode ?? null,

        typeOfApplication: TemporaryImport.typeOfApplication ?? null,
        grantedPeriod: TemporaryImport.grantedPeriod ?? null,
        estDateOfExport: TemporaryImport.estDateOfExport ?? null,
        placeExport: TemporaryImport.placeExport ?? null,
        projectName: TemporaryImport.projectName ?? null,
        projectDateFrom: TemporaryImport.projectDateFrom ?? null,
        projectDateTo: TemporaryImport.projectDateTo ?? null,

        modeTransport: Transit.modeTransport ?? null,
        meanTransport: Transit.meanTransport ?? null,
        officeDeptFirst: Transit.officeDeptFirst ?? null,
        officeDeptFirstCode: Transit.officeDeptFirstCode ?? null,
        officeDeptLast: Transit.officeDeptLast ?? null,
        officeDeptLastCode: Transit.officeDeptLastCode ?? null,
        officeDeptSecond: Transit.officeDeptSecond ?? null,
        officeDeptSecondCode: Transit.officeDeptSecondCode ?? null,
        officeDeptThird: Transit.officeDeptThird ?? null,
        officeDeptThirdCode: Transit.officeDeptThirdCode ?? null,

        depositType: SecurityDeposit.depositType ?? null,
        depositAmount: n(SecurityDeposit.depositAmount),
        bankGuaranteeAmount: n(SecurityDeposit.bankGuaranteeAmount),
        bankGuaranteeNo: SecurityDeposit.bankGuaranteeNo ?? null,
        bankName: SecurityDeposit.bankName ?? null,
        bankCode: SecurityDeposit.bankCode ?? null,

        totalGrossWeight: n(DeclarationGoods.totalGrossWeight),
        grossWeightUnit: DeclarationGoods.grossWeightUnit ?? null,
        totalPackagesNo: DeclarationGoods.totalPackagesNo != null ? Math.trunc(Number(DeclarationGoods.totalPackagesNo)) : null,
        packageNoUnit: DeclarationGoods.packageNoUnit ?? null,
        totalInvoiceAmount: n(DeclarationGoods.totalInvoiceAmount),
        invoiceCurrency: DeclarationGoods.invoiceCurrency ?? null,
        invoiceRate: n(DeclarationGoods.invoiceRate),
        invoiceInsuranceType: DeclarationGoods.invoiceInsuranceType ?? null,
        insuranceAmount: n(DeclarationGoods.insuranceAmount),
        insuranceCurrency: DeclarationGoods.insuranceCurrency ?? null,
        insuranceRate: n(DeclarationGoods.insuranceRate),
        freightType: DeclarationGoods.freightType ?? null,
        freightCharge: n(DeclarationGoods.freightCharge),
        freightCurrency: DeclarationGoods.freightCurrency ?? null,
        freightRate: n(DeclarationGoods.freightRate),
        otherCharges: n(DeclarationGoods.otherCharges),
        otherChargesType: DeclarationGoods.otherChargesType ?? null,
        remarks: DeclarationGoods.remarks ?? null,

        declarantName: Declarant.declarantName ?? null,
        declarantID: Declarant.declarantID ?? null,
        declarantICNo: Declarant.declarantICNo ?? null,
        declarantICColor: Declarant.declarantICColor ?? null,
        declarantDesignation: Declarant.declarantDesignation ?? null,
    };
}

function invoiceRowsData(invoices, declarationId) {
    return (invoices || []).map((inv) => ({
        mongoId: generateMongoIdShape(),
        declarationId,
        invoiceNo: inv.invoiceNo ?? null,
        invoiceDate: inv.invoiceDate ?? null,
        invoiceTerm: inv.invoiceTerm ?? null,
        invoiceCCY: inv.invoiceCCY ?? null,
        invoiceAmount: inv.invoiceAmount ?? null,
        invoiceFreightCCY: inv.invoiceFreightCCY ?? null,
        invoiceFreightAmount: inv.invoiceFreightAmount ?? null,
        invoiceInsuranceCCY: inv.invoiceInsuranceCCY ?? null,
        invoiceInsuranceAmount: inv.invoiceInsuranceAmount ?? null,
        invoiceOtherCharges: inv.invoiceOtherCharges ?? null,
    }));
}

function goodsLineRowsData(goods, declarationId) {
    return (goods || []).map((g) => ({
        mongoId: generateMongoIdShape(),
        declarationId,
        goodsSerialNo: g.goodsSerialNo != null ? Math.trunc(Number(g.goodsSerialNo)) : null,
        goodsPackageNo: g.goodsPackageNo != null ? Math.trunc(Number(g.goodsPackageNo)) : null,
        goodsPackageUnit: g.goodsPackageUnit ?? null,
        countryOrigin: g.countryOrigin ?? null,
        countryCode: g.countryCode ?? null,
        hsCode: g.hsCode ?? null,
        subCode: g.subCode ?? null,
        goodsDescription: g.goodsDescription ?? null,
        goodsC: g.goodsC ?? null,
        goodsUnit: g.goodsUnit ?? null,
        goodsCode: g.goodsCode ?? null,
        goodsQuantity: n(g.goodsQuantity),
        goodsWeight: n(g.goodsWeight),
        goodsAmount: n(g.goodsAmount),
        goodsCIF: g.goodsCIF ?? null,
        goodsDuty: g.goodsDuty ?? null,
        goodsDutyAmount: n(g.goodsDutyAmount),
        goodsLNo: g.goodsLNo ?? null,
        goodsShippingMark: g.goodsShippingMark ?? null,
        goodsContainerNo: g.goodsContainerNo ?? null,
        goodsInvoiceNo: g.goodsInvoiceNo ?? null,
        goodsControl: g.goodsControl ?? null,
        goodsImportDuty: g.goodsImportDuty ?? null,
        goodsExciseDuty: g.goodsExciseDuty ?? null,
        permitApplicationType: g.permitApplicationType ?? null,
        permitNo: g.permitNo ?? null,
        permitExpiryDate: g.permitExpiryDate ?? null,
        permitIssuedBy: g.permitIssuedBy ?? null,
    }));
}

function containerRowsData(containers, declarationId) {
    return (containers || []).map((c) => ({
        mongoId: generateMongoIdShape(),
        declarationId,
        containerNumber: c.containerNumber ?? null,
        containerType: c.containerType ?? null,
        cargoStatus: c.cargoStatus ?? null,
        sealNumber: c.sealNumber ?? null,
        containerWeight: n(c.containerWeight),
        containerWeightUOM: c.containerWeightUOM ?? null,
    }));
}

async function createDeclaration(d) {
    const row = await prisma.marsDeclaration.create({
        data: { mongoId: generateMongoIdShape(), ...toPgDeclarationFields(d) },
    });
    const invoices = invoiceRowsData(d.Invoice, row.id);
    const goods = goodsLineRowsData(d.Goods, row.id);
    const containers = containerRowsData(d.Containers, row.id);
    if (invoices.length) await prisma.marsDeclarationInvoice.createMany({ data: invoices });
    if (goods.length) await prisma.marsDeclarationGoodsLine.createMany({ data: goods });
    if (containers.length) await prisma.marsDeclarationContainer.createMany({ data: containers });

    const full = await prisma.marsDeclaration.findUnique({ where: { id: row.id }, include: CHILD_INCLUDE });
    return toApiDeclaration(full);
}

// Full replace of the 3 child tables to match the given nested object's
// current state exactly - the app always resubmits declarations as a
// whole (no partial line-item edits), so there's no risk of losing an
// in-flight edit to another line. Same pattern dualWriteSync.js used.
async function updateDeclaration(mongoId, d) {
    const existing = await prisma.marsDeclaration.findUnique({ where: { mongoId: String(mongoId) } });
    if (!existing) return null;

    await prisma.marsDeclaration.update({ where: { id: existing.id }, data: toPgDeclarationFields(d) });

    await prisma.marsDeclarationInvoice.deleteMany({ where: { declarationId: existing.id } });
    await prisma.marsDeclarationGoodsLine.deleteMany({ where: { declarationId: existing.id } });
    await prisma.marsDeclarationContainer.deleteMany({ where: { declarationId: existing.id } });

    const invoices = invoiceRowsData(d.Invoice, existing.id);
    const goods = goodsLineRowsData(d.Goods, existing.id);
    const containers = containerRowsData(d.Containers, existing.id);
    if (invoices.length) await prisma.marsDeclarationInvoice.createMany({ data: invoices });
    if (goods.length) await prisma.marsDeclarationGoodsLine.createMany({ data: goods });
    if (containers.length) await prisma.marsDeclarationContainer.createMany({ data: containers });

    const full = await prisma.marsDeclaration.findUnique({ where: { id: existing.id }, include: CHILD_INCLUDE });
    return toApiDeclaration(full);
}

async function deleteDeclaration(mongoId) {
    const existing = await prisma.marsDeclaration.findUnique({ where: { mongoId: String(mongoId) } });
    if (!existing) return null;
    // Child rows cascade automatically (onDelete: Cascade in schema.prisma).
    await prisma.marsDeclaration.delete({ where: { id: existing.id } });
    return existing;
}

async function findDeclarationById(mongoId) {
    const row = await prisma.marsDeclaration.findUnique({ where: { mongoId: String(mongoId) }, include: CHILD_INCLUDE });
    return row ? toApiDeclaration(row) : null;
}

// renderSingleWindowList()'s filter set - mirrors the old Mongo dot-path
// filters exactly: Goods.goodsInvoiceNo -> a goodsLines relation filter,
// Importer.importerName/Transport.* /Agent.* -> their now-flat columns.
async function findAllDeclarationsForList({ invoiceNo, importer, vessel, country, agent, dateFrom, dateTo, postedBy } = {}) {
    const AND = [];
    if (invoiceNo && invoiceNo.trim()) {
        AND.push({ goodsLines: { some: { goodsInvoiceNo: { contains: invoiceNo.trim(), mode: 'insensitive' } } } });
    }
    if (importer && importer.trim()) AND.push({ importerName: { contains: importer.trim(), mode: 'insensitive' } });
    if (vessel && vessel.trim()) AND.push({ vesselName: { contains: vessel.trim(), mode: 'insensitive' } });
    if (country && country.trim()) AND.push({ countryShipment: { contains: country.trim(), mode: 'insensitive' } });
    if (agent && agent.trim()) AND.push({ agentName: { contains: agent.trim(), mode: 'insensitive' } });
    if (dateFrom && dateFrom.trim()) AND.push({ declarationDate: { gte: dateFrom.trim() } });
    if (dateTo && dateTo.trim()) AND.push({ declarationDate: { lte: dateTo.trim() } });
    if (postedBy) AND.push({ postedBy });

    const rows = await prisma.marsDeclaration.findMany({
        where: AND.length ? { AND } : undefined,
        orderBy: { id: 'desc' },
        include: CHILD_INCLUDE,
    });
    return rows.map(toApiDeclaration);
}

module.exports = {
    findAllDeclarationsForList, findDeclarationById, createDeclaration, updateDeclaration, deleteDeclaration,
};
