import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    // Override handleRequest to make authentication optional
    handleRequest(err: any, user: any) {
        // If there's a user, return it
        // If there's no user and no error, return null (no authentication)
        // Only throw if there's an actual error (e.g., invalid token)
        if (err) {
            throw err;
        }
        return user || null;
    }
}
