import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { Project } from '@/lib/db/models/project';
import { randomBytes } from 'crypto';

export async function GET(req: NextRequest) {
    await connectToDatabase();
    const projects = await Project.find().sort({ created_at: -1 });
    return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const data = await req.json();

        if (!data.name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        // Generate a simple API key
        const apiKey = 'pk_' + randomBytes(16).toString('hex');

        const project = await Project.create({
            name: data.name,
            api_key: apiKey,
            allowed_origins: data.allowed_origins || [],
        });

        return NextResponse.json({ project }, { status: 201 });
    } catch (error) {
        console.error('Project creation failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
