import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { Project } from '@/lib/db/models/project';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    await connectToDatabase();
    const project = await Project.findById(id);
    if (!project) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ project });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        await connectToDatabase();
        const data = await req.json();

        const project = await Project.findByIdAndUpdate(
            id,
            {
                $set: {
                    ...(data.name && { name: data.name }),
                    ...(data.github_owner && { github_owner: data.github_owner }),
                    ...(data.github_repo && { github_repo: data.github_repo }),
                    ...(data.github_token && { github_token: data.github_token }),
                    ...(data.allowed_origins && { allowed_origins: data.allowed_origins }),
                }
            },
            { new: true }
        );

        if (!project) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({ project });
    } catch (error) {
        console.error('Project update failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
