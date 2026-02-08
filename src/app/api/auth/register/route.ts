import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
    return NextResponse.json(
        { error: 'التسجيل متاح فقط عبر لوحة السوبر أدمن' },
        { status: 403 }
    );
}
