import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID } from 'class-validator';

export class CreateCommentDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    content: string;

    @IsOptional()
    @IsUUID()
    parentCommentId?: string;
}

export class CommentResponseDto {
    id: string;
    episodeId: string;
    userId: string;
    content: string;
    parentCommentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        profilePictureUrl: string | null;
    };
}
