import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProject extends Document {
    name: string;
    api_key: string;
    allowed_origins: string[];
    github_owner?: string;
    github_repo?: string;
    github_token?: string;
    created_at: Date;
}

const ProjectSchema = new Schema<IProject>(
    {
        name: { type: String, required: true },
        api_key: { type: String, required: true, unique: true, index: true },
        allowed_origins: { type: [String], default: [] }, // For CORS
        github_owner: { type: String }, // NEW: Target Repo Owner
        github_repo: { type: String },  // NEW: Target Repo Name
        github_token: { type: String }, // NEW: PAT for that user
    },
    {
        timestamps: { createdAt: 'created_at' },
    }
);

export const Project: Model<IProject> =
    mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
