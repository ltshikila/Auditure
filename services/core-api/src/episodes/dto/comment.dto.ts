import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCommentDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    content: string;
}

export class CommentResponseDto {
    id: string;
    episodeId: string;
    userId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
        id: string;
        firstName: string;
        lastName: string;
    };
}
