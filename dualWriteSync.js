// Postgres dual-write sync functions for the 3 collections with real CRUD
// (User, Consignee, Declaration3) plus Unlocode_port_list2, whose small
// admin CRUD UI also needs mirroring. Hscode2/Port_Code/ISO_CountryCodes
// have no write path anywhere in this app (confirmed via grep) - static
// reference data, not dual-written.
//
// Every function takes the full saved/updated Mongoose document (not raw
// req.body) so field derivation happens in exactly one place per model,
// matching however Mongoose itself already cast/defaulted the data.
// Postgres write failures are always caught and logged here, never thrown -
// callers don't need their own try/catch around these.
const prisma = require('./prismaClient');
const { isDualWriteEnabled } = require('./dualWrite');

function logFail(collectionName, op, mongoId, err) {
    console.error(`[Postgres dual-write] ${collectionName}.${op} failed for mongoId=${mongoId}:`, err.message);
}

async function syncUserToPostgres(doc) {
    if (!isDualWriteEnabled('users')) return;
    const mongoId = doc._id.toString();
    try {
        await prisma.marsUser.upsert({
            where: { mongoId },
            create: {
                mongoId,
                name: doc.name ?? null,
                email: doc.email ?? null,
                password: doc.password ?? null,
                phone: doc.phone ?? null,
                idType: doc.idType ?? null,
                icNo: doc.icNo ?? null,
                icColor: doc.icColor ?? null,
                address: doc.address ?? null,
                registration: doc.registration ?? null,
                postcode: doc.postcode ?? null,
                designation: doc.designation ?? null,
                company: doc.company ?? null,
            },
            update: {
                name: doc.name ?? null,
                email: doc.email ?? null,
                // Only overwrite the Postgres password hash when this call
                // actually carries one - profile/admin updates that don't
                // touch the password pass the doc without it re-selected
                // (Mongoose's `select: false`), and we must not null out an
                // otherwise-untouched hash.
                ...(doc.password !== undefined ? { password: doc.password } : {}),
                phone: doc.phone ?? null,
                idType: doc.idType ?? null,
                icNo: doc.icNo ?? null,
                icColor: doc.icColor ?? null,
                address: doc.address ?? null,
                registration: doc.registration ?? null,
                postcode: doc.postcode ?? null,
                designation: doc.designation ?? null,
                company: doc.company ?? null,
            },
        });
    } catch (err) {
        logFail('users', 'upsert', mongoId, err);
    }
}

async function dualWriteDeleteUser(mongoId) {
    if (!isDualWriteEnabled('users')) return;
    try {
        await prisma.marsUser.deleteMany({ where: { mongoId: mongoId.toString() } });
    } catch (err) {
        logFail('users', 'delete', mongoId, err);
    }
}

async function syncConsigneeToPostgres(doc) {
    if (!isDualWriteEnabled('consignees')) return;
    const mongoId = doc._id.toString();
    const data = {
        name: doc.name ?? null,
        address: doc.address ?? null,
        country: doc.country ?? null,
        reg: doc.reg ?? null,
        ic: doc.ic ?? null,
        icColor: doc.icColor ?? null,
        telephone: doc.telephone ?? null,
        postal: doc.postal ?? null,
    };
    try {
        await prisma.marsConsignee.upsert({ where: { mongoId }, create: { mongoId, ...data }, update: data });
    } catch (err) {
        logFail('consignees', 'upsert', mongoId, err);
    }
}

async function dualWriteDeleteConsignee(mongoId) {
    if (!isDualWriteEnabled('consignees')) return;
    try {
        await prisma.marsConsignee.deleteMany({ where: { mongoId: mongoId.toString() } });
    } catch (err) {
        logFail('consignees', 'delete', mongoId, err);
    }
}

// Same "resolve by Mongo upsert-then-lookup" shape isn't needed here since
// Consignee upserts inside the declaration routes key on `name`, not _id -
// re-reads the just-upserted/created doc by name so we always have a real
// mongoId to sync with, since a raw Mongoose updateOne() doesn't return the
// document itself.
async function syncConsigneeByNameToPostgres(Consignee, name) {
    if (!isDualWriteEnabled('consignees')) return;
    if (!name || !name.trim()) return;
    const doc = await Consignee.findOne({ name });
    if (doc) await syncConsigneeToPostgres(doc);
}

function n(v) {
    if (v === undefined || v === null || v === '') return null;
    const num = Number(v);
    return Number.isNaN(num) ? null : num;
}

function declarationToPgData(doc, pgId) {
    const d = doc.toObject ? doc.toObject() : doc;
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

// Upserts the main MarsDeclaration row and fully replaces its 3 child
// tables (Invoice/Goods/Containers) to match the given Mongo document's
// current state exactly - same "replace all children" pattern
// grfmxstatusupdate uses for ORDERS.history, appropriate here because the
// app always resubmits declarations as a whole (no partial line-item
// edits), so there's no risk of losing an in-flight edit to another line.
async function syncDeclarationToPostgres(doc) {
    if (!isDualWriteEnabled('declarations')) return;
    const mongoId = doc._id.toString();
    try {
        const row = await prisma.marsDeclaration.upsert({
            where: { mongoId },
            create: { mongoId, ...declarationToPgData(doc) },
            update: declarationToPgData(doc),
            select: { id: true },
        });

        const d = doc.toObject ? doc.toObject() : doc;

        await prisma.marsDeclarationInvoice.deleteMany({ where: { declarationId: row.id } });
        const invoices = d.Invoice || [];
        if (invoices.length > 0) {
            await prisma.marsDeclarationInvoice.createMany({
                data: invoices.map((inv) => ({
                    mongoId: inv._id ? inv._id.toString() : null,
                    declarationId: row.id,
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
                })),
            });
        }

        await prisma.marsDeclarationGoodsLine.deleteMany({ where: { declarationId: row.id } });
        const goods = d.Goods || [];
        if (goods.length > 0) {
            await prisma.marsDeclarationGoodsLine.createMany({
                data: goods.map((g) => ({
                    mongoId: g._id ? g._id.toString() : null,
                    declarationId: row.id,
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
                })),
            });
        }

        await prisma.marsDeclarationContainer.deleteMany({ where: { declarationId: row.id } });
        const containers = d.Containers || [];
        if (containers.length > 0) {
            await prisma.marsDeclarationContainer.createMany({
                data: containers.map((c) => ({
                    mongoId: c._id ? c._id.toString() : null,
                    declarationId: row.id,
                    containerNumber: c.containerNumber ?? null,
                    containerType: c.containerType ?? null,
                    cargoStatus: c.cargoStatus ?? null,
                    sealNumber: c.sealNumber ?? null,
                    containerWeight: n(c.containerWeight),
                    containerWeightUOM: c.containerWeightUOM ?? null,
                })),
            });
        }
    } catch (err) {
        logFail('declarations', 'upsert', mongoId, err);
    }
}

async function dualWriteDeleteDeclaration(mongoId) {
    if (!isDualWriteEnabled('declarations')) return;
    try {
        // Child rows cascade automatically (onDelete: Cascade in schema.prisma).
        await prisma.marsDeclaration.deleteMany({ where: { mongoId: mongoId.toString() } });
    } catch (err) {
        logFail('declarations', 'delete', mongoId, err);
    }
}

async function syncUnlocodePortToPostgres(doc) {
    if (!isDualWriteEnabled('unlocodePorts')) return;
    const mongoId = doc._id.toString();
    const data = { country: doc.Country ?? null, location: doc.Location ?? null, name: doc.Name ?? null };
    try {
        await prisma.marsUnlocodePort.upsert({ where: { mongoId }, create: { mongoId, ...data }, update: data });
    } catch (err) {
        logFail('unlocodePorts', 'upsert', mongoId, err);
    }
}

async function dualWriteDeleteUnlocodePort(mongoId) {
    if (!isDualWriteEnabled('unlocodePorts')) return;
    try {
        await prisma.marsUnlocodePort.deleteMany({ where: { mongoId: mongoId.toString() } });
    } catch (err) {
        logFail('unlocodePorts', 'delete', mongoId, err);
    }
}

module.exports = {
    syncUserToPostgres,
    dualWriteDeleteUser,
    syncConsigneeToPostgres,
    syncConsigneeByNameToPostgres,
    dualWriteDeleteConsignee,
    syncDeclarationToPostgres,
    dualWriteDeleteDeclaration,
    syncUnlocodePortToPostgres,
    dualWriteDeleteUnlocodePort,
};
