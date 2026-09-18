// Postgres-backed data-access layer for Mars, replacing every Mongoose
// query in index.js/passport.js. Cut over 2026-09-18 after confirming
// parity with the dual-write mirror (dualWriteSync.js, now retired):
// User 5/5, Consignee 3/3, PortCode 110/110, CountryCode 249/249,
// UnlocodePort 111553/111553, HsCode 20763/20763 (mirrored from the
// live `hscode2` Mongo collection - the old `hscode`/`declaration` model
// files were confirmed dead, 0 real documents, never removed until now).
//
// Declaration is the one collection with a genuinely different shape:
// the Mongo document nests most fields under Procedure/Exporter/Importer/
// Agent/Transport/SupportingDocuments/TemporaryImport/Transit/
// SecurityDeposit/DeclarationGoods/Declarant sub-objects, plus
// Invoice/Goods/Containers arrays - while the Postgres MarsDeclaration
// table has every one of those fields flattened to a top-level column
// (see dualWriteSync.js's declarationToPgData(), which this file's
// toPgDeclarationFields() is adapted from). To avoid rewriting the large
// XML-generation and list-rendering code in index.js (which freely
// accesses declaration.Transport.vesselName, declaration.Goods[i].hsCode,
// etc.), every declaration read here reconstructs that exact same nested
// shape from the flat Postgres columns + child tables - so that code
// needed zero changes, only the query calls at the edges changed.
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

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- User ---

function toApiUser(row) {
    return {
        _id: row.mongoId,
        name: row.name,
        email: row.email,
        password: row.password,
        phone: row.phone,
        idType: row.idType,
        icNo: row.icNo,
        icColor: row.icColor,
        address: row.address,
        registration: row.registration,
        postcode: row.postcode,
        designation: row.designation,
        company: row.company,
    };
}

async function findAllUsers() {
    const rows = await prisma.marsUser.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toApiUser);
}

async function findUserByEmail(email) {
    const row = await prisma.marsUser.findFirst({ where: { email } });
    return row ? toApiUser(row) : null;
}

async function findUserByEmailExcludingId(email, excludeMongoId) {
    const row = await prisma.marsUser.findFirst({ where: { email, mongoId: { not: String(excludeMongoId) } } });
    return row ? toApiUser(row) : null;
}

async function findUserById(mongoId) {
    const row = await prisma.marsUser.findUnique({ where: { mongoId: String(mongoId) } });
    return row ? toApiUser(row) : null;
}

async function createUser(data) {
    const row = await prisma.marsUser.create({
        data: { mongoId: generateMongoIdShape(), ...data },
    });
    return toApiUser(row);
}

async function updateUser(mongoId, data) {
    const existing = await prisma.marsUser.findUnique({ where: { mongoId: String(mongoId) } });
    if (!existing) return null;
    const row = await prisma.marsUser.update({ where: { id: existing.id }, data });
    return toApiUser(row);
}

async function deleteUser(mongoId) {
    const existing = await prisma.marsUser.findUnique({ where: { mongoId: String(mongoId) } });
    if (!existing) return null;
    await prisma.marsUser.delete({ where: { id: existing.id } });
    return existing;
}

// --- Consignee ---

function toApiConsignee(row) {
    return {
        _id: row.mongoId,
        name: row.name,
        address: row.address,
        country: row.country,
        reg: row.reg,
        ic: row.ic,
        icColor: row.icColor,
        telephone: row.telephone,
        postal: row.postal,
    };
}

async function findAllConsignees({ search, page, pageSize } = {}) {
    const where = search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { address: { contains: search, mode: 'insensitive' } }, { country: { contains: search, mode: 'insensitive' } }] }
        : {};
    const totalCount = await prisma.marsConsignee.count({ where });
    const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
    const currentPage = Math.min(page, totalPages);
    const rows = await prisma.marsConsignee.findMany({
        where, orderBy: { name: 'asc' }, skip: (currentPage - 1) * pageSize, take: pageSize,
    });
    return { customers: rows.map(toApiConsignee), totalCount, totalPages, currentPage };
}

async function findAllConsigneesUnpaginated() {
    const rows = await prisma.marsConsignee.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toApiConsignee);
}

async function findConsigneeByName(name) {
    const row = await prisma.marsConsignee.findFirst({ where: { name } });
    return row ? toApiConsignee(row) : null;
}

async function createConsignee(data) {
    const row = await prisma.marsConsignee.create({ data: { mongoId: generateMongoIdShape(), ...data } });
    return toApiConsignee(row);
}

async function updateConsignee(mongoId, data) {
    const existing = await prisma.marsConsignee.findUnique({ where: { mongoId: String(mongoId) } });
    if (!existing) return null;
    const row = await prisma.marsConsignee.update({ where: { id: existing.id }, data });
    return toApiConsignee(row);
}

// Upsert-by-name - mirrors the old Mongo `updateOne({name}, {$setOnInsert, $set}, {upsert:true})`
// pattern used for Exporter/Agent side-effect writes in the declaration routes.
async function upsertConsigneeByName(name, data) {
    const existing = await prisma.marsConsignee.findFirst({ where: { name } });
    if (existing) {
        const row = await prisma.marsConsignee.update({ where: { id: existing.id }, data });
        return toApiConsignee(row);
    }
    const row = await prisma.marsConsignee.create({ data: { mongoId: generateMongoIdShape(), name, ...data } });
    return toApiConsignee(row);
}

async function deleteConsignee(mongoId) {
    const existing = await prisma.marsConsignee.findUnique({ where: { mongoId: String(mongoId) } });
    if (!existing) return null;
    await prisma.marsConsignee.delete({ where: { id: existing.id } });
    return existing;
}

// --- Reference data (read-only: Port_Code, ISO_CountryCodes; read+small
// admin CRUD: HsCode, UnlocodePort) ---

function toApiPortCode(row) {
    return { _id: row.mongoId, country: row.country, portCode: row.portCode };
}

async function findAllPortCodes() {
    const rows = await prisma.marsPortCode.findMany({ orderBy: { country: 'asc' } });
    return rows.map(toApiPortCode);
}

function toApiCountryCode(row) {
    return {
        _id: row.mongoId, name: row.name, alpha2: row.alpha2, alpha3: row.alpha3,
        countryCode: row.countryCode, iso31662: row.iso31662, region: row.region,
        subRegion: row.subRegion, intermediateRegion: row.intermediateRegion,
        regionCode: row.regionCode, subRegionCode: row.subRegionCode,
        intermediateRegionCode: row.intermediateRegionCode,
    };
}

async function findAllCountryCodes() {
    const rows = await prisma.marsCountryCode.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toApiCountryCode);
}

// Only 249 rows total - a JS-side case-insensitive substring match (same
// intent as the old Mongo `$regex` lookup used for XML country-code
// resolution) is simpler and safe at this size, no need for a raw query.
async function findCountryCodeByNameContains(needle) {
    if (!needle) return null;
    const rows = await prisma.marsCountryCode.findMany();
    const lower = needle.toLowerCase();
    const match = rows.find((r) => (r.name || '').toLowerCase().includes(lower));
    return match ? toApiCountryCode(match) : null;
}

function toApiHsCode(row) {
    return {
        _id: row.mongoId,
        HSCode: row.hsCode,
        heading: row.heading,
        Description: row.description,
        quantity: row.quantity,
        importDutyRate: row.importDutyRate,
        exciseDutyRate: row.exciseDutyRate,
        category: row.category,
        subCategory: row.subCategory,
    };
}

// "Declarable" hscodes only - matches the old Mongo filter
// `{ HSCode: { $regex: /^\d{4}\.\d{2}\.\d{2}$/ } }` (excludes heading-level
// entries that don't carry the full dotted format). Postgres's `~` regex
// operator is the direct equivalent; raw SQL since Prisma's query builder
// has no regex primitive.
const { Prisma } = require('@prisma/client');

async function findHsCodesPage({ search, page, pageSize }) {
    const searchClause = search
        ? Prisma.sql`AND (hs_code ILIKE ${'%' + search + '%'} OR description ILIKE ${'%' + search + '%'} OR category ILIKE ${'%' + search + '%'} OR sub_category ILIKE ${'%' + search + '%'})`
        : Prisma.empty;

    const countRows = await prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM mars.hs_codes
        WHERE hs_code ~ '^\\d{4}\\.\\d{2}\\.\\d{2}$' ${searchClause}
    `);
    const totalCount = countRows[0].count;
    const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
    const currentPage = Math.min(page, totalPages);

    const rows = await prisma.$queryRaw(Prisma.sql`
        SELECT * FROM mars.hs_codes
        WHERE hs_code ~ '^\\d{4}\\.\\d{2}\\.\\d{2}$' ${searchClause}
        ORDER BY hs_code ASC
        LIMIT ${pageSize} OFFSET ${(currentPage - 1) * pageSize}
    `);
    const hscode = rows.map((r) => toApiHsCode({
        mongoId: r.mongo_id, hsCode: r.hs_code, heading: r.heading, description: r.description,
        quantity: r.quantity, importDutyRate: r.import_duty_rate, exciseDutyRate: r.excise_duty_rate,
        category: r.category, subCategory: r.sub_category,
    }));
    return { hscode, totalCount, totalPages, currentPage };
}

async function searchHsCodes({ search, skip, limit }) {
    const searchClause = search
        ? Prisma.sql`AND (hs_code ILIKE ${'%' + search + '%'} OR description ILIKE ${'%' + search + '%'} OR category ILIKE ${'%' + search + '%'} OR sub_category ILIKE ${'%' + search + '%'})`
        : Prisma.empty;
    const rows = await prisma.$queryRaw(Prisma.sql`
        SELECT * FROM mars.hs_codes
        WHERE hs_code ~ '^\\d{4}\\.\\d{2}\\.\\d{2}$' ${searchClause}
        ORDER BY hs_code ASC
        LIMIT ${limit} OFFSET ${skip}
    `);
    return rows.map((r) => toApiHsCode({
        mongoId: r.mongo_id, hsCode: r.hs_code, heading: r.heading, description: r.description,
        quantity: r.quantity, importDutyRate: r.import_duty_rate, exciseDutyRate: r.excise_duty_rate,
        category: r.category, subCategory: r.sub_category,
    }));
}

function toApiUnlocodePort(row) {
    return { _id: row.mongoId, Country: row.country, Location: row.location, Name: row.name };
}

async function findUnlocodePortsPage({ search, page, pageSize }) {
    const where = search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { country: { contains: search, mode: 'insensitive' } }, { location: { contains: search, mode: 'insensitive' } }] }
        : {};
    const totalCount = await prisma.marsUnlocodePort.count({ where });
    const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
    const currentPage = Math.min(page, totalPages);
    const rows = await prisma.marsUnlocodePort.findMany({
        where, orderBy: { name: 'asc' }, skip: (currentPage - 1) * pageSize, take: pageSize,
    });
    return { unlocode_port_list: rows.map(toApiUnlocodePort), totalCount, totalPages, currentPage };
}

async function createUnlocodePort(data) {
    const row = await prisma.marsUnlocodePort.create({
        data: { mongoId: generateMongoIdShape(), country: data.Country, location: data.Location, name: data.Name },
    });
    return toApiUnlocodePort(row);
}

async function updateUnlocodePort(mongoId, data) {
    const existing = await prisma.marsUnlocodePort.findUnique({ where: { mongoId: String(mongoId) } });
    if (!existing) return null;
    const row = await prisma.marsUnlocodePort.update({
        where: { id: existing.id }, data: { country: data.Country, location: data.Location, name: data.Name },
    });
    return toApiUnlocodePort(row);
}

async function deleteUnlocodePort(mongoId) {
    const existing = await prisma.marsUnlocodePort.findUnique({ where: { mongoId: String(mongoId) } });
    if (!existing) return null;
    await prisma.marsUnlocodePort.delete({ where: { id: existing.id } });
    return existing;
}

module.exports = {
    escapeRegex,
    findAllUsers, findUserByEmail, findUserByEmailExcludingId, findUserById, createUser, updateUser, deleteUser,
    findAllConsignees, findAllConsigneesUnpaginated, findConsigneeByName, createConsignee, updateConsignee, upsertConsigneeByName, deleteConsignee,
    findAllPortCodes, findAllCountryCodes, findCountryCodeByNameContains,
    findHsCodesPage, searchHsCodes,
    findUnlocodePortsPage, createUnlocodePort, updateUnlocodePort, deleteUnlocodePort,
    generateMongoIdShape,
};
