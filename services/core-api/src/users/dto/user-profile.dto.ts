export class UserProfileResponseDto {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date | null;
    profilePictureUrl: string | null;
    isEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
