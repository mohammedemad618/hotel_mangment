import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import connectDB from '@/core/db/connection';
import { Booking } from '@/core/db/models';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';

export const runtime = 'nodejs';

const lastArrayItemExpr = (path: string) => ({ $arrayElemAt: [path, -1] });

const allowedPaymentMethods = ['cash', 'card', 'bank_transfer', 'online'];
const allowedPaymentStatuses = ['pending', 'partial', 'paid', 'refunded'];

const paymentMethodLabels: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    online: 'Online',
};

const paymentStatusLabels: Record<string, string> = {
    pending: 'Pending',
    partial: 'Partial',
    paid: 'Paid',
    refunded: 'Refunded',
};

const toStartOfDay = (value: string) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
};

const toEndOfDay = (value: string) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    date.setHours(23, 59, 59, 999);
    return date;
};

async function handler(
    request: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    _auth: AuthContext
) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const method = searchParams.get('method');
        const fromDateParam = searchParams.get('fromDate');
        const toDateParam = searchParams.get('toDate');
        const lang = searchParams.get('lang') === 'en' ? 'en' : 'ar';

        if (status && !allowedPaymentStatuses.includes(status)) {
            return NextResponse.json(
                { error: 'Invalid payment status' },
                { status: 400 }
            );
        }

        if (method && !allowedPaymentMethods.includes(method)) {
            return NextResponse.json(
                { error: 'Invalid payment method' },
                { status: 400 }
            );
        }

        const from = fromDateParam ? toStartOfDay(fromDateParam) : null;
        const to = toDateParam ? toEndOfDay(toDateParam) : null;
        if (fromDateParam && !from) {
            return NextResponse.json(
                { error: 'Invalid fromDate value' },
                { status: 400 }
            );
        }
        if (toDateParam && !to) {
            return NextResponse.json(
                { error: 'Invalid toDate value' },
                { status: 400 }
            );
        }
        if (from && to && from > to) {
            return NextResponse.json(
                { error: 'fromDate must be before toDate' },
                { status: 400 }
            );
        }

        const filter: Record<string, any> = {
            status: { $nin: ['cancelled', 'no_show'] },
        };

        if (status) {
            filter['payment.status'] = status;
        }

        const exprConditions: any[] = [];
        const lastTransactionDateExpr = lastArrayItemExpr('$payment.transactions.date');
        const effectiveDateExpr = { $ifNull: [lastTransactionDateExpr, '$updatedAt'] };
        const lastTransactionMethodExpr = lastArrayItemExpr('$payment.transactions.method');
        const effectiveMethodExpr = {
            $ifNull: [lastTransactionMethodExpr, { $ifNull: ['$payment.method', 'cash'] }],
        };

        if (method) {
            exprConditions.push({ $eq: [effectiveMethodExpr, method] });
        }
        if (from) {
            exprConditions.push({ $gte: [effectiveDateExpr, from] });
        }
        if (to) {
            exprConditions.push({ $lte: [effectiveDateExpr, to] });
        }
        if (exprConditions.length > 0) {
            filter.$expr = exprConditions.length === 1 ? exprConditions[0] : { $and: exprConditions };
        }

        const totalRecords = await Booking.countDocuments(filter);
        if (totalRecords === 0) {
            return NextResponse.json(
                { error: 'No records found for selected filters' },
                { status: 404 }
            );
        }

        if (totalRecords > 10000) {
            return NextResponse.json(
                { error: 'Too many records to export. Please narrow date range.' },
                { status: 413 }
            );
        }

        const bookings = await Booking.find(filter)
            .populate('roomId', 'roomNumber')
            .populate('guestId', 'firstName lastName')
            .sort({ updatedAt: -1 })
            .limit(10000)
            .lean();

        const rows = bookings.map((booking: any) => {
            const total = booking.pricing?.total || 0;
            const paidAmount = booking.payment?.paidAmount || 0;
            const remaining = Math.max(total - paidAmount, 0);
            const transactions = booking.payment?.transactions || [];
            const latest = transactions[transactions.length - 1];
            const latestMethod = latest?.method || booking.payment?.method || 'cash';
            const latestDate = latest?.date || booking.updatedAt || booking.createdAt || new Date();
            const guestName = booking.guestId
                ? `${booking.guestId.firstName || ''} ${booking.guestId.lastName || ''}`.trim()
                : '';

            return {
                bookingNumber: booking.bookingNumber || '-',
                guestName: guestName || '-',
                roomNumber: booking.roomId?.roomNumber || '-',
                total,
                paidAmount,
                remaining,
                latestAmount: latest?.amount ?? 0,
                method: paymentMethodLabels[latestMethod] || latestMethod || '-',
                date: new Date(latestDate),
                status: paymentStatusLabels[booking.payment?.status] || booking.payment?.status || 'Pending',
            };
        });

        const totals = rows.reduce(
            (acc, row) => {
                acc.total += row.total;
                acc.paid += row.paidAmount;
                acc.remaining += row.remaining;
                return acc;
            },
            { total: 0, paid: 0, remaining: 0 }
        );

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Hotel Management System';
        workbook.created = new Date();

        const summarySheetName = lang === 'en' ? 'Summary' : '\u0627\u0644\u0645\u0644\u062e\u0635';
        const detailsSheetName = lang === 'en' ? 'Transactions' : '\u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a';

        const summarySheet = workbook.addWorksheet(summarySheetName, {
            views: [{ state: 'frozen', ySplit: 1 }],
        });
        const detailsSheet = workbook.addWorksheet(detailsSheetName, {
            views: [{ state: 'frozen', ySplit: 1 }],
        });

        summarySheet.columns = [
            { header: lang === 'en' ? 'Metric' : '\u0627\u0644\u0628\u064a\u0627\u0646', key: 'metric', width: 30 },
            { header: lang === 'en' ? 'Value' : '\u0627\u0644\u0642\u064a\u0645\u0629', key: 'value', width: 40 },
        ];

        const summaryRows = [
            { metric: lang === 'en' ? 'From Date' : '\u0645\u0646 \u062a\u0627\u0631\u064a\u062e', value: fromDateParam || (lang === 'en' ? 'All' : '\u0627\u0644\u0643\u0644') },
            { metric: lang === 'en' ? 'To Date' : '\u0625\u0644\u0649 \u062a\u0627\u0631\u064a\u062e', value: toDateParam || (lang === 'en' ? 'All' : '\u0627\u0644\u0643\u0644') },
            { metric: lang === 'en' ? 'Exported At' : '\u0648\u0642\u062a \u0627\u0644\u062a\u0635\u062f\u064a\u0631', value: new Date().toISOString() },
            { metric: lang === 'en' ? 'Records Count' : '\u0639\u062f\u062f \u0627\u0644\u0633\u062c\u0644\u0627\u062a', value: rows.length },
            { metric: lang === 'en' ? 'Total Amount' : '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062d\u062c\u0632', value: totals.total },
            { metric: lang === 'en' ? 'Total Paid' : '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u062f\u0641\u0648\u0639', value: totals.paid },
            { metric: lang === 'en' ? 'Total Remaining' : '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u062a\u0628\u0642\u064a', value: totals.remaining },
        ];
        summaryRows.forEach((row) => summarySheet.addRow(row));

        const summaryHeader = summarySheet.getRow(1);
        summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summaryHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' },
        };
        summaryHeader.alignment = { vertical: 'middle', horizontal: 'center' };

        ['B6', 'B7', 'B8'].forEach((cellRef) => {
            summarySheet.getCell(cellRef).numFmt = '#,##0.00';
        });

        detailsSheet.columns = [
            { header: lang === 'en' ? 'Booking #' : '\u0631\u0642\u0645 \u0627\u0644\u062d\u062c\u0632', key: 'bookingNumber', width: 14 },
            { header: lang === 'en' ? 'Guest' : '\u0627\u0644\u0646\u0632\u064a\u0644', key: 'guestName', width: 24 },
            { header: lang === 'en' ? 'Room' : '\u0627\u0644\u063a\u0631\u0641\u0629', key: 'roomNumber', width: 12 },
            { header: lang === 'en' ? 'Booking Total' : '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062d\u062c\u0632', key: 'total', width: 16 },
            { header: lang === 'en' ? 'Paid' : '\u0627\u0644\u0645\u062f\u0641\u0648\u0639', key: 'paidAmount', width: 14 },
            { header: lang === 'en' ? 'Remaining' : '\u0627\u0644\u0645\u062a\u0628\u0642\u064a', key: 'remaining', width: 14 },
            { header: lang === 'en' ? 'Latest Payment' : '\u0622\u062e\u0631 \u062f\u0641\u0639\u0629', key: 'latestAmount', width: 16 },
            { header: lang === 'en' ? 'Method' : '\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639', key: 'method', width: 18 },
            { header: lang === 'en' ? 'Transaction Date' : '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0639\u0645\u0644\u064a\u0629', key: 'date', width: 22 },
            { header: lang === 'en' ? 'Status' : '\u0627\u0644\u062d\u0627\u0644\u0629', key: 'status', width: 14 },
        ];

        rows.forEach((row) => detailsSheet.addRow(row));

        detailsSheet.autoFilter = {
            from: 'A1',
            to: 'J1',
        };

        const detailsHeader = detailsSheet.getRow(1);
        detailsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        detailsHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' },
        };
        detailsHeader.alignment = { vertical: 'middle', horizontal: 'center' };

        ['D', 'E', 'F', 'G'].forEach((column) => {
            detailsSheet.getColumn(column).numFmt = '#,##0.00';
            detailsSheet.getColumn(column).alignment = { horizontal: 'right' };
        });
        detailsSheet.getColumn('I').numFmt = 'yyyy-mm-dd hh:mm';
        detailsSheet.getColumn('I').alignment = { horizontal: 'center' };

        const buffer = await workbook.xlsx.writeBuffer();
        const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);

        const fromPart = fromDateParam || 'all';
        const toPart = toDateParam || 'all';
        const filename = `finance-report-${fromPart}-to-${toPart}.xlsx`;

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename=\"${filename}\"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('Finance export error:', error);
        return NextResponse.json(
            { error: 'Failed to generate export file' },
            { status: 500 }
        );
    }
}

export const GET = withPermission(PERMISSIONS.REPORT_EXPORT, handler);
