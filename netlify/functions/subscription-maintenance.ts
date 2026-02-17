const SCHEDULED_ENDPOINT = '/api/internal/cron/subscriptions';

function resolveBaseUrl(): string {
    return (
        process.env.URL ||
        process.env.DEPLOY_PRIME_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        ''
    );
}

function jsonResponse(status: number, payload: unknown): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

export default async function handler(_request: Request): Promise<Response> {
    const baseUrl = resolveBaseUrl().trim();
    const cronSecret = (process.env.INTERNAL_CRON_SECRET || '').trim();

    if (!baseUrl) {
        return jsonResponse(500, {
            error: 'Missing deployment URL for scheduled subscription maintenance',
        });
    }

    if (!cronSecret || cronSecret.length < 16) {
        return jsonResponse(500, {
            error: 'INTERNAL_CRON_SECRET must be configured for scheduled subscription maintenance',
        });
    }

    const endpoint = new URL(SCHEDULED_ENDPOINT, baseUrl).toString();

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'x-cron-secret': cronSecret,
                'x-trigger-source': 'netlify-scheduled-function',
            },
        });

        const payloadText = await response.text();
        if (!response.ok) {
            return jsonResponse(500, {
                error: 'Subscription maintenance API returned an error',
                status: response.status,
                body: payloadText,
            });
        }

        return new Response(payloadText, {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    } catch (error) {
        return jsonResponse(500, {
            error: 'Failed to call subscription maintenance API',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
