import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { Project } from '@/lib/db/models/project';
import { FeedbackItem } from '@/lib/db/models/feedback-item';

export async function POST(req: NextRequest) {
    // CORS Handling
    const origin = req.headers.get('origin');

    if (req.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
            },
        });
    }

    try {
        await connectToDatabase();

        // 1. Validate API Key
        const apiKey = req.headers.get('x-api-key');
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
        }

        const project = await Project.findOne({ api_key: apiKey });
        if (!project) {
            return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
        }

        // 2. Validate Origin (Simple check)
        if (project.allowed_origins.length > 0 && origin) {
            if (!project.allowed_origins.includes(origin)) {
                // console.warn(`Origin ${origin} not allowed for project ${project.name}`);
                // For PoC, we might be lenient or return 403
            }
        }

        // 3. Parse Body
        const data = await req.json();
        if (!data.content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }

        // 4. Create Feedback Item
        const feedback = await FeedbackItem.create({
            project_id: project._id,
            source: 'custom', // From widget
            content: data.content,
            normalized_severity: 50, // Default for unstructured
            status: 'pending',
            meta: {
                ...data.meta,
                via_widget: true,
                origin: origin
            }
        });

        return NextResponse.json({
            success: true,
            id: feedback._id
        }, {
            status: 201,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
            }
        });

    } catch (error) {
        console.error('External feedback ingestion error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function OPTIONS(req: NextRequest) {
    const origin = req.headers.get('origin');
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
        },
    });
}
